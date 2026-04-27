import yaml

from app.core.database import Base


def test_martin_schema_synchronization():
    """
    Parses martin.yaml.example and cross-references it with app/models/.
    Every table, id_column, and property must exist in the SQLAlchemy models,
    except for known database views/materialized views.
    """
    with open("martin.yaml.example") as f:
        config = yaml.safe_load(f)

    tables = config.get("postgres", {}).get("tables", {})

    # Force import of all models so they register with Base.metadata
    import app.models.aerodrome
    import app.models.airspace
    import app.models.daylight
    import app.models.navigation
    import app.models.notam

    # Map of SQLAlchemy table names to their classes
    metadata = Base.metadata
    db_tables = {table.name: table for table in metadata.sorted_tables}

    # Known views/materialized views that might not have direct models
    known_views = {
        "ats_waypoints_grouped",
        "v_ats_route_segments",
        "airspaces_geometry",
        "airspaces_metadata"
    }

    errors = []

    for key, table_config in tables.items():
        table_name = table_config.get("table")
        if table_name in known_views:
            continue

        if table_name not in db_tables:
            errors.append(f"Table '{table_name}' from Martin config not found in SQLAlchemy models.")
            continue

        db_table = db_tables[table_name]

        # Check id_column
        id_col = table_config.get("id_column")
        if id_col:
            if id_col not in db_table.columns:
                errors.append(f"ID column '{id_col}' in table '{table_name}' not found in SQLAlchemy model.")

        # Check properties
        properties = table_config.get("properties", {})
        for prop in properties:
            if prop not in db_table.columns:
                errors.append(f"Property '{prop}' in table '{table_name}' not found in SQLAlchemy model.")

    assert not errors, "Schema synchronization failures:\n" + "\n".join(errors)
