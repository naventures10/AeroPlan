"""Ingest validation schemas for ENR 4.4 Significant Points.

These schemas validate the structural shape of the JSON produced by
``ENRSignificantPointsExtractor`` — ensuring the correct keys exist.
"""

from pydantic import BaseModel, Field, model_validator


class SignificantPointIngest(BaseModel):
    """A significant point dict from the scraper."""

    waypoint: str
    coordinates: str = Field(default="")
    routes: list[str] = Field(default_factory=list)


class ENR44SignificantPointsDocumentIngest(BaseModel):
    """Root structure for ``enr_4_4_significant_points.json``."""

    source_url: str
    significant_points: list[SignificantPointIngest]
    total_count: int = Field(ge=0)

    # Standard metadata from BaseENRExtractor can be loose at the root ingest layer,
    # but we validate total_count matches the length of the list.

    @model_validator(mode="after")
    def validate_count_matches(self) -> "ENR44SignificantPointsDocumentIngest":
        if self.total_count != len(self.significant_points):
            raise ValueError(
                f"total_count ({self.total_count}) does not match "
                f"actual significant_points length ({len(self.significant_points)})"
            )
        return self
