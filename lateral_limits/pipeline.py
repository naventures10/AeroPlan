"""
Pipeline orchestrator for lateral limits parsing.

Loads combined_airspace_data.json, classifies each entry, routes to
deterministic or LLM parser, validates outputs, and saves results.

Supports scheduled background mode to work around free-tier rate limits.

Usage:
    # Dry run (deterministic only):
    python -m lateral_limits --dry-run

    # Single interactive run:
    python -m lateral_limits --batch-size 10

    # Scheduled background mode (process 5 per batch, every 60 min):
    python -m lateral_limits --scheduled --batch-size 5 --interval 60
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from .deterministic_parsers import classify_and_parse
from .llm_parser import parse_with_llm
from .models import (
    AirspaceExtraction,
    AirspaceGeometry,
    CircularAirspace,
    BoundingBoxAirspace,
    AnnularRingAirspace,
    SimplePolygonAirspace,
    ComplexPolygonAirspace,
    LLMGeometryOutput,
)
from .validation import validate_geometry


# ---------------------------------------------------------------------------
# Progress tracking
# ---------------------------------------------------------------------------

PROGRESS_FILENAME = "llm_progress.json"


def _load_progress(output_dir: Path) -> dict:
    """Load incremental LLM progress from disk."""
    progress_path = output_dir / PROGRESS_FILENAME
    if progress_path.exists():
        with open(progress_path) as f:
            return json.load(f)
    return {"completed": [], "failed_names": [], "llm_parsed": []}


def _save_progress(output_dir: Path, progress: dict) -> None:
    """Persist LLM progress so future runs can skip already-done entries."""
    progress_path = output_dir / PROGRESS_FILENAME
    with open(progress_path, "w") as f:
        json.dump(progress, f, indent=2, default=str)


# ---------------------------------------------------------------------------
# GeoJSON helpers
# ---------------------------------------------------------------------------

def _circle_to_geojson_polygon(
    center_lat: float, center_lng: float, radius_nm: float, num_points: int = 64
) -> list[list[float]]:
    """Approximate a circle as a GeoJSON polygon ring."""
    radius_deg_lat = radius_nm / 60.0
    radius_deg_lng = radius_deg_lat / math.cos(math.radians(center_lat))

    points = []
    for i in range(num_points + 1):
        angle = 2 * math.pi * i / num_points
        lat = center_lat + radius_deg_lat * math.sin(angle)
        lng = center_lng + radius_deg_lng * math.cos(angle)
        points.append([round(lng, 6), round(lat, 6)])

    return points


def _bbox_to_geojson_polygon(
    lat_south: float, lat_north: float, lng_west: float, lng_east: float
) -> list[list[float]]:
    """Convert bounding box to GeoJSON polygon ring."""
    return [
        [round(lng_west, 6), round(lat_south, 6)],
        [round(lng_east, 6), round(lat_south, 6)],
        [round(lng_east, 6), round(lat_north, 6)],
        [round(lng_west, 6), round(lat_north, 6)],
        [round(lng_west, 6), round(lat_south, 6)],
    ]


def geometry_to_geojson_feature(
    extraction: AirspaceExtraction,
) -> dict | None:
    """Convert a parsed AirspaceExtraction to a GeoJSON Feature.

    Only handles deterministic geometries (circle, bbox, simple polygon).
    Complex polygons (LLM-parsed with arcs) are NOT included in GeoJSON.
    """
    geom = extraction.geometry
    properties = {
        "name": extraction.name,
        "type": extraction.airspace_type,
        "upper_limit": extraction.upper_limit,
        "lower_limit": extraction.lower_limit,
        "source": extraction.source,
        "parse_method": extraction.parse_method,
    }

    if isinstance(geom, CircularAirspace):
        radius = geom.radius_value
        if geom.radius_unit == "KM":
            radius = radius / 1.852
        ring = _circle_to_geojson_polygon(geom.center.lat, geom.center.lng, radius)
        return {
            "type": "Feature",
            "properties": properties,
            "geometry": {"type": "Polygon", "coordinates": [ring]},
        }

    elif isinstance(geom, BoundingBoxAirspace):
        ring = _bbox_to_geojson_polygon(
            geom.lat_south, geom.lat_north, geom.lng_west, geom.lng_east
        )
        return {
            "type": "Feature",
            "properties": properties,
            "geometry": {"type": "Polygon", "coordinates": [ring]},
        }

    elif isinstance(geom, AnnularRingAirspace):
        radius = geom.outer_radius_value
        if geom.radius_unit == "KM":
            radius = radius / 1.852
        ring = _circle_to_geojson_polygon(geom.center.lat, geom.center.lng, radius)
        properties["note"] = f"Annular ring, inner radius {geom.inner_radius_value} {geom.radius_unit}"
        return {
            "type": "Feature",
            "properties": properties,
            "geometry": {"type": "Polygon", "coordinates": [ring]},
        }

    elif isinstance(geom, SimplePolygonAirspace):
        ring = [
            [round(c.lng, 6), round(c.lat, 6)] for c in geom.coordinates
        ]
        if ring[0] != ring[-1]:
            ring.append(ring[0])
        return {
            "type": "Feature",
            "properties": properties,
            "geometry": {"type": "Polygon", "coordinates": [ring]},
        }

    return None


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def load_airspace_data(path: Path) -> list[dict]:
    """Load and flatten all airspace entries from combined_airspace_data.json."""
    with open(path) as f:
        data = json.load(f)

    entries = []
    for category, items in data.get("airspace_by_category", {}).items():
        for item in items:
            entries.append(item)

    return entries


def _save_final_outputs(
    output_dir: Path,
    deterministic_results: list[AirspaceExtraction],
    llm_results: list[AirspaceExtraction],
    llm_failures: list[dict],
    stats: dict,
    total_entries: int,
) -> None:
    """Save the structured JSON and GeoJSON outputs."""
    output_dir.mkdir(parents=True, exist_ok=True)

    all_results = deterministic_results + llm_results

    # 1. Structured JSON
    structured_output = {
        "metadata": {
            "total_entries": total_entries,
            "parsed_deterministic": len(deterministic_results),
            "parsed_llm": len(llm_results),
            "failed": len(llm_failures),
            "stats": stats,
            "last_updated": datetime.now().isoformat(),
        },
        "parsed_airspaces": [r.model_dump() for r in all_results],
        "failures": llm_failures,
    }

    json_path = output_dir / "parsed_lateral_limits.json"
    with open(json_path, "w") as f:
        json.dump(structured_output, f, indent=2, default=str)
    print(f"\n✓ Saved structured JSON: {json_path}")

    # 2. GeoJSON
    features = []
    for extraction in all_results:
        feature = geometry_to_geojson_feature(extraction)
        if feature is not None:
            features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    }

    geojson_path = output_dir / "airspace_geometries.geojson"
    with open(geojson_path, "w") as f:
        json.dump(geojson, f, indent=2)
    print(f"✓ Saved GeoJSON ({len(features)} features): {geojson_path}")

    return len(features)


async def run_pipeline(
    input_path: Path,
    output_dir: Path,
    dry_run: bool = False,
    batch_size: int = 10,
    scheduled: bool = False,
    interval_minutes: int = 60,
) -> None:
    """Run the full parsing pipeline.

    Args:
        input_path: Path to combined_airspace_data.json
        output_dir: Directory to save output files
        dry_run: If True, skip LLM calls
        batch_size: Number of LLM entries to process per batch
        scheduled: If True, run in background mode with interval waits
        interval_minutes: Minutes between scheduled batches
    """
    print(f"\n{'='*60}")
    print(f"  Lateral Limits Parser Pipeline")
    print(f"{'='*60}")
    print(f"  Input:     {input_path}")
    print(f"  Output:    {output_dir}")
    print(f"  Dry run:   {dry_run}")
    print(f"  Batch:     {batch_size}")
    print(f"  Scheduled: {scheduled} (every {interval_minutes} min)" if scheduled else "")
    print(f"{'='*60}\n")

    # Load data
    entries = load_airspace_data(input_path)
    print(f"Loaded {len(entries)} airspace entries.\n")

    # Phase 1: Deterministic parsing
    deterministic_results: list[AirspaceExtraction] = []
    complex_entries: list[dict] = []
    stats = {"circle": 0, "bounding_box": 0, "annular_ring": 0, "simple_polygon": 0, "complex": 0}

    print("Phase 1: Deterministic parsing...")
    print("-" * 40)

    for entry in entries:
        text = entry.get("lateral_limits", "")
        classification, geometry = classify_and_parse(text)
        stats[classification] += 1

        if geometry is not None:
            extraction = AirspaceExtraction(
                name=entry.get("name", ""),
                airspace_type=entry.get("type", ""),
                upper_limit=entry.get("upper_limit", ""),
                lower_limit=entry.get("lower_limit", ""),
                source=entry.get("source", ""),
                geometry=geometry,
                parse_method="deterministic",
                original_text=text,
                confidence=1.0,
            )

            val_result = validate_geometry(geometry, name=entry.get("name", ""))
            if val_result.errors:
                print(f"  ✗ VALIDATION ERROR: {entry.get('name')}")
                for err in val_result.errors:
                    print(f"    - {err}")
            elif val_result.warnings:
                print(f"  ⚠ {entry.get('name')}: {len(val_result.warnings)} warning(s)")

            deterministic_results.append(extraction)
        else:
            complex_entries.append(entry)

    print(f"\nDeterministic parsing complete:")
    print(f"  - Circles:         {stats['circle']}")
    print(f"  - Bounding boxes:  {stats['bounding_box']}")
    print(f"  - Annular rings:   {stats['annular_ring']}")
    print(f"  - Simple polygons: {stats['simple_polygon']}")
    print(f"  - Complex (→ LLM): {stats['complex']}")
    print(f"  Total deterministic: {len(deterministic_results)}/{len(entries)}")

    # Phase 2: LLM parsing
    llm_results: list[AirspaceExtraction] = []
    llm_failures: list[dict] = []

    if dry_run:
        print(f"\n[DRY RUN] Skipping {len(complex_entries)} complex entries.")
        llm_failures = complex_entries

    elif complex_entries:
        # Load any existing progress
        progress = _load_progress(output_dir)
        already_done = set(progress.get("completed", []))
        already_failed = set(progress.get("failed_names", []))

        # Rebuild previously parsed LLM results from progress
        for saved in progress.get("llm_parsed", []):
            try:
                llm_results.append(AirspaceExtraction.model_validate(saved))
            except Exception:
                pass

        # Filter out already-processed entries
        remaining = [
            e for e in complex_entries
            if e.get("name", "") not in already_done
            and e.get("name", "") not in already_failed
        ]

        if not remaining:
            print(f"\n✓ All {len(complex_entries)} complex entries already processed!")
        else:
            print(f"\nPhase 2: LLM parsing...")
            print(f"  Total complex: {len(complex_entries)}")
            print(f"  Already done:  {len(already_done)}")
            print(f"  Remaining:     {len(remaining)}")
            print("-" * 40)

            batch_num = 0
            i = 0

            while i < len(remaining):
                batch_num += 1
                batch_end = min(i + batch_size, len(remaining))
                batch = remaining[i:batch_end]

                now = datetime.now().strftime("%H:%M:%S")
                print(f"\n[{now}] Batch {batch_num}: "
                      f"entries {i + 1}–{batch_end} of {len(remaining)}")

                batch_success = 0
                batch_fail = 0

                for j, entry in enumerate(batch):
                    name = entry.get("name", "")
                    text = entry.get("lateral_limits", "")

                    print(f"\n  [{i + j + 1}/{len(remaining)}] {name}")
                    print(f"  Text: {text[:100]}...")

                    result = await parse_with_llm(text, name=name)

                    if result is not None:
                        extraction = AirspaceExtraction(
                            name=name,
                            airspace_type=entry.get("type", ""),
                            upper_limit=entry.get("upper_limit", ""),
                            lower_limit=entry.get("lower_limit", ""),
                            source=entry.get("source", ""),
                            geometry=result.geometry,
                            parse_method="llm",
                            original_text=text,
                            confidence=0.85,
                        )

                        val_result = validate_geometry(result.geometry, name=name)
                        if val_result.errors:
                            print(f"  ✗ VALIDATION ERROR")
                            for err in val_result.errors:
                                print(f"    - {err}")
                            extraction.confidence = 0.5
                        elif val_result.warnings:
                            print(f"  ⚠ {len(val_result.warnings)} warning(s)")

                        print(f"  ✓ Parsed as: {result.geometry.geometry_type}")
                        llm_results.append(extraction)
                        progress["completed"].append(name)
                        progress["llm_parsed"].append(extraction.model_dump())
                        batch_success += 1
                    else:
                        print(f"  ✗ FAILED")
                        llm_failures.append(entry)
                        progress["failed_names"].append(name)
                        batch_fail += 1

                    await asyncio.sleep(0.5)

                # Save progress after each batch
                _save_progress(output_dir, progress)
                print(f"\n  Batch {batch_num} done: "
                      f"{batch_success} ✓, {batch_fail} ✗")

                i = batch_end

                # Save outputs after each batch so results are always up-to-date
                _save_final_outputs(
                    output_dir, deterministic_results, llm_results,
                    llm_failures, stats, len(entries),
                )

                # If scheduled and more entries remain, wait for the interval
                if scheduled and i < len(remaining):
                    entries_left = len(remaining) - i
                    batches_left = math.ceil(entries_left / batch_size)
                    eta_hours = (batches_left * interval_minutes) / 60

                    print(f"\n{'='*60}")
                    print(f"  ⏳ Waiting {interval_minutes} min before next batch...")
                    print(f"     {entries_left} entries remaining "
                          f"(~{batches_left} batches, ~{eta_hours:.1f}h ETA)")
                    next_run = datetime.now().strftime("%H:%M")
                    print(f"     Started waiting at {next_run}")
                    print(f"{'='*60}")

                    await asyncio.sleep(interval_minutes * 60)

                elif not scheduled and i < len(remaining):
                    # Interactive mode — ask to continue
                    print(f"\n{'='*40}")
                    print(f"Batch complete. {len(remaining) - i} entries remaining.")
                    response = input("Continue? [Y/n/q] ").strip().lower()
                    if response in ("n", "q"):
                        print("Stopping LLM processing.")
                        llm_failures.extend(remaining[i:])
                        break

        # Add entries that were previously marked as failed
        for entry in complex_entries:
            name = entry.get("name", "")
            if name in already_failed and entry not in llm_failures:
                llm_failures.append(entry)

    # Save final outputs
    num_features = _save_final_outputs(
        output_dir, deterministic_results, llm_results,
        llm_failures, stats, len(entries),
    )

    # Summary
    print(f"\n{'='*60}")
    print(f"  Pipeline Summary")
    print(f"{'='*60}")
    print(f"  Total entries:           {len(entries)}")
    print(f"  Parsed (deterministic):  {len(deterministic_results)}")
    print(f"  Parsed (LLM):            {len(llm_results)}")
    print(f"  Failed/skipped:          {len(llm_failures)}")
    print(f"  GeoJSON features:        {num_features}")
    print(f"{'='*60}")

    if scheduled and llm_failures:
        print(f"\n💡 To retry failed entries, delete their names from")
        print(f"   {output_dir / PROGRESS_FILENAME} and re-run.")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Parse airspace lateral limits to structured data"
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=Path(__file__).parent.parent / "output" / "combined_airspace_data.json",
        help="Path to combined_airspace_data.json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent.parent / "output",
        help="Output directory",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only run deterministic parsers, skip LLM calls",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=10,
        help="Number of entries to send to LLM per batch",
    )
    parser.add_argument(
        "--scheduled",
        action="store_true",
        help="Run in scheduled background mode (process batches at intervals)",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=60,
        help="Minutes between scheduled batches (default: 60)",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Reset LLM progress and start fresh",
    )

    args = parser.parse_args()

    # Handle reset
    if args.reset:
        progress_path = args.output / PROGRESS_FILENAME
        if progress_path.exists():
            progress_path.unlink()
            print(f"✓ Reset progress: deleted {progress_path}")
        else:
            print("No progress file to reset.")
        return

    asyncio.run(run_pipeline(
        input_path=args.input,
        output_dir=args.output,
        dry_run=args.dry_run,
        batch_size=args.batch_size,
        scheduled=args.scheduled,
        interval_minutes=args.interval,
    ))


if __name__ == "__main__":
    main()
