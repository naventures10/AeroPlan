"""
LLM-based parser for complex airspace lateral limits.

Uses Pydantic AI with Google Gemini (gemini-2.5-pro) to extract structured
geometry from text that contains arcs, topological boundaries, or mixed
segment types that cannot be parsed deterministically.

Requires GEMINI_API_KEY in the project .env file.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from pydantic_ai import Agent
from pydantic_ai.models.google import GoogleModel

from .models import (
    LLMGeometryOutput,
    ComplexPolygonAirspace,
    CircularAirspace,
)

# Auto-load .env from the project root (parent of this package)
_project_root = Path(__file__).resolve().parent.parent
load_dotenv(_project_root / ".env")


# ---------------------------------------------------------------------------
# System prompt with few-shot examples
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are an expert Aeronautical Information Systems (AIS) data engineer.

Your job is to convert DGCA (India) airspace lateral limits text into a structured geometry format.

CRITICAL RULES:

1. COORDINATE CONVERSION: Convert ALL DMS coordinates into Decimal Degrees.
   - Format DDMMSSH or DDMMSS.sH → decimal. Examples:
     - 250000N = 25.0000°
     - 0760000E = 76.0000°
     - 311959.3N = 31.3331°
     - 0785954.3E = 78.9984°
   - Handle abbreviated formats: 0958N = 09°58'00" = 9.9667°

2. ARC SEGMENTS: When you see "along clockwise/counter-clockwise arc of X NM
   radius centred at [center] to [endpoint]", create an ArcSegment with:
   - arc_center: the center coordinate
   - radius_value: the numeric radius
   - radius_unit: "NM" or "KM" as specified
   - direction: "clockwise" or "counter-clockwise"
   - end_coordinate: where the arc ends

3. TOPOLOGICAL BOUNDARIES: When you see "along International Boundary" or
   "along Indo-X border", create a TopologicalBoundary with:
   - boundary_description: the exact text describing this border
   - boundary_entities: list of COUNTRY NAMES ONLY (e.g., ["India", "Pakistan"])
   - end_coordinate: where the border segment ends (the next stated coordinate)
   - DO NOT hallucinate intermediate coordinates for borders

4. RULE OF AGGREGATION: NEVER output back-to-back topological segments.
   Merge consecutive border references into one TopologicalBoundary.
   BAD: Topo(India,Pakistan) → Topo(India,China)
   GOOD: Topo(India,Pakistan,China) with single end_coordinate

5. STRAIGHT SEGMENTS: Any coordinate-to-coordinate connection that is not
   an arc or border is a StraightSegment.

6. STARTING COORDINATE: The first coordinate mentioned is the starting_coordinate.
   Build the boundary chain from there.

7. POLYGON CLOSURE: The last segment must end at or near the starting_coordinate
   (the polygon must close). If the text says "to point of origin", the last
   segment's end_coordinate should match the starting_coordinate.

8. CIRCLE DETECTION: If the text describes "a circle of radius X centred at Y",
   output a CircularAirspace, not a ComplexPolygonAirspace.

9. RADIUS UNITS: Pay attention to whether the text says "NM" (nautical miles)
   or "KM" (kilometers). Default to NM if unspecified.

EXAMPLE INPUT:
"Area bounded by lines joining points 153545N 0732759E then along the clockwise
arc of a circle of 25NM radius centred on 154433N 0735201E to 155237N 0741620E;
153855N 0741620E; 153545N 0741131E to point of origin."

EXAMPLE OUTPUT (as JSON):
{
  "geometry": {
    "geometry_type": "complex_polygon",
    "starting_coordinate": {"lat": 15.5958, "lng": 73.4664},
    "boundaries": [
      {
        "segment_type": "arc",
        "arc_center": {"lat": 15.7425, "lng": 73.8669},
        "radius_value": 25.0,
        "radius_unit": "NM",
        "direction": "clockwise",
        "end_coordinate": {"lat": 15.8769, "lng": 74.2722}
      },
      {
        "segment_type": "straight",
        "end_coordinate": {"lat": 15.6486, "lng": 74.2722}
      },
      {
        "segment_type": "straight",
        "end_coordinate": {"lat": 15.5958, "lng": 73.4664}
      }
    ]
  }
}
"""


# ---------------------------------------------------------------------------
# LLM Agent factory — follows the same pattern as Google_colab.ipynb
# ---------------------------------------------------------------------------

_agent: Optional[Agent] = None


def _get_agent() -> Agent:
    """Lazily create the Pydantic AI agent.

    Matches the Colab notebook pattern:
      model = GoogleModel('gemini-2.5-pro')
      agent = Agent(model, output_type=..., system_prompt=...)

    GEMINI_API_KEY is read from .env via load_dotenv() at module load.
    """
    global _agent
    if _agent is None:
        if not os.environ.get("GEMINI_API_KEY"):
            raise RuntimeError(
                "GEMINI_API_KEY not found in environment or .env file. "
                "Add it to your .env file:\n  GEMINI_API_KEY=your-key-here"
            )

        # Same pattern as the working Colab notebook
        model = GoogleModel("gemini-2.5-pro")

        _agent = Agent(
            model,
            output_type=LLMGeometryOutput,
            model_settings={"temperature": 1.0},
            system_prompt=SYSTEM_PROMPT,
        )
    return _agent


# ---------------------------------------------------------------------------
# LLM parsing with retry
# ---------------------------------------------------------------------------

async def parse_with_llm(
    lateral_limits_text: str,
    name: str = "",
    max_retries: int = 3,
    base_delay: float = 2.0,
) -> Optional[LLMGeometryOutput]:
    """Send a lateral_limits text to the LLM and get structured geometry back.

    Args:
        lateral_limits_text: The raw text to parse.
        name: Airspace name (included in the prompt for context).
        max_retries: Number of retry attempts on failure.
        base_delay: Base delay in seconds for exponential backoff.

    Returns:
        LLMGeometryOutput on success, None on failure.
    """
    agent = _get_agent()

    prompt = f"Airspace: {name}\n\nLateral limits text:\n{lateral_limits_text}"

    for attempt in range(max_retries):
        try:
            result = await agent.run(prompt)
            return result.output
        except Exception as e:
            delay = base_delay * (2 ** attempt)
            print(
                f"  [!] Attempt {attempt + 1}/{max_retries} failed for '{name}': {e}"
            )
            if attempt < max_retries - 1:
                print(f"      Retrying in {delay:.1f}s...")
                await asyncio.sleep(delay)

    return None


async def parse_batch_with_llm(
    entries: list[dict],
    batch_size: int = 10,
    delay_between: float = 1.0,
) -> list[tuple[dict, Optional[LLMGeometryOutput]]]:
    """Parse a batch of entries with the LLM, with rate limiting.

    Args:
        entries: List of dicts with at least 'name' and 'lateral_limits' keys.
        batch_size: How many to process before pausing for review.
        delay_between: Delay in seconds between individual LLM calls.

    Returns:
        List of (entry, result) tuples.
    """
    results = []

    for i, entry in enumerate(entries):
        name = entry.get("name", f"Entry {i}")
        text = entry.get("lateral_limits", "")

        print(f"\n[{i + 1}/{len(entries)}] Parsing: {name}")
        result = await parse_with_llm(text, name=name)

        if result is not None:
            print(f"  ✓ Parsed as: {result.geometry.geometry_type}")
        else:
            print(f"  ✗ FAILED to parse")

        results.append((entry, result))

        # Rate limiting
        if delay_between > 0 and i < len(entries) - 1:
            await asyncio.sleep(delay_between)

    return results
