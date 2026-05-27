from pydantic import BaseModel, field_validator


class AirspaceMetadataRecord(BaseModel):
    name: str | None = None
    identification: str | None = None
    lateral_limits: str | None = None
    upper_limit: str | None = None
    lower_limit: str | None = None
    classifications: str | None = None
    remarks: str | None = None
    source_file: str | None = None
    services: list | dict | None = None
    airspace_type: str | None = None

    @field_validator("airspace_type")
    @classmethod
    def validate_airspace_type(cls, v: str | None) -> str | None:
        valid_types = {
            "FIR",
            "CTA_UPPER",
            "CTR",
            "CTA_LOWER",
            "DANGER",
            "PROHIBITED",
            "RESTRICTED",
            "TSA",
            "TRA",
            "ADIZ",
            "UPR_ZONE",
        }
        if v and v not in valid_types:
            raise ValueError(f"Invalid airspace_type: '{v}'. Must be one of {valid_types} or None")
        return v


class AirspaceMetadataDatabaseValidator:
    @staticmethod
    def validate_metadata_record(metadata: dict) -> None:
        """Validates the raw metadata dictionary before SQL construction."""
        AirspaceMetadataRecord(**metadata)

    @staticmethod
    def validate_metadata_params(params: tuple) -> None:
        """Validates the parameter tuple right before DB insertion."""
        # The tuple shape is: (name, identification, lateral_limits, upper_limit, lower_limit,
        #                      classifications, remarks, source_file, services, airspace_type)
        if len(params) != 10:
            raise ValueError(f"Expected 10 parameters for insertion, got {len(params)}")

        AirspaceMetadataRecord(
            name=params[0],
            identification=params[1],
            lateral_limits=params[2],
            upper_limit=params[3],
            lower_limit=params[4],
            classifications=params[5],
            remarks=params[6],
            source_file=params[7],
            services=params[8].adapted
            if hasattr(params[8], "adapted")
            else params[8],  # Handle psycopg2 Json wrapper if passed directly
            airspace_type=params[9],
        )
