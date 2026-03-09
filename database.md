# Database Schema

## Table: `geography_columns`

| Column Name | Data Type | Nullable | Default |
|-------------|-----------|----------|---------|
| `f_table_catalog` | `name` | Yes | `None` |
| `f_table_schema` | `name` | Yes | `None` |
| `f_table_name` | `name` | Yes | `None` |
| `f_geography_column` | `name` | Yes | `None` |
| `coord_dimension` | `integer` | Yes | `None` |
| `srid` | `integer` | Yes | `None` |
| `type` | `text` | Yes | `None` |

## Table: `geometry_columns`

| Column Name | Data Type | Nullable | Default |
|-------------|-----------|----------|---------|
| `f_table_catalog` | `character varying(256)` | Yes | `None` |
| `f_table_schema` | `name` | Yes | `None` |
| `f_table_name` | `name` | Yes | `None` |
| `f_geometry_column` | `name` | Yes | `None` |
| `coord_dimension` | `integer` | Yes | `None` |
| `srid` | `integer` | Yes | `None` |
| `type` | `character varying(30)` | Yes | `None` |

## Table: `significant_points`

| Column Name | Data Type | Nullable | Default |
|-------------|-----------|----------|---------|
| `id` | `integer` | No | `nextval('significant_points_id_seq'::regclass)` |
| `waypoint_name` | `character varying(10)` | No | `None` |
| `routes` | `ARRAY` | Yes | `None` |
| `raw_coordinates` | `character varying(30)` | Yes | `None` |
| `geom` | `USER-DEFINED` | Yes | `None` |
| `created_at` | `timestamp without time zone` | Yes | `CURRENT_TIMESTAMP` |

**Primary Key(s):** `id`

## Table: `aerodrome_documents`

| Column Name | Data Type | Nullable | Default |
|-------------|-----------|----------|---------|
| `icao_code` | `character varying(10)` | No | `None` |
| `airport_name` | `character varying(255)` | Yes | `None` |
| `source_url` | `text` | Yes | `None` |
| `aip_document` | `jsonb` | No | `None` |
| `last_updated` | `timestamp without time zone` | Yes | `CURRENT_TIMESTAMP` |

**Primary Key(s):** `icao_code`

## Table: `spatial_features`

| Column Name | Data Type | Nullable | Default |
|-------------|-----------|----------|---------|
| `feature_id` | `integer` | No | `nextval('spatial_features_feature_id_seq'::regclass)` |
| `icao_code` | `character varying(10)` | Yes | `None` |
| `feature_category` | `character varying(50)` | Yes | `None` |
| `feature_name` | `character varying(100)` | Yes | `None` |
| `elevation_m` | `numeric` | Yes | `None` |
| `geom` | `USER-DEFINED` | Yes | `None` |

**Primary Key(s):** `feature_id`

## Table: `ats_route_segments`

| Column Name | Data Type | Nullable | Default |
|-------------|-----------|----------|---------|
| `id` | `integer` | No | `nextval('ats_route_segments_id_seq'::regclass)` |
| `route_id` | `character varying(20)` | No | `None` |
| `sequence_number` | `integer` | No | `None` |
| `track_magnetic` | `character varying(20)` | Yes | `None` |
| `distance_nm` | `numeric` | Yes | `None` |
| `upper_limit` | `character varying(20)` | Yes | `None` |
| `lower_limit` | `character varying(20)` | Yes | `None` |
| `airspace_class` | `character varying(10)` | Yes | `None` |
| `mea` | `character varying(20)` | Yes | `None` |
| `lateral_limits` | `character varying(20)` | Yes | `None` |
| `direction_odd` | `character varying(5)` | Yes | `None` |
| `direction_even` | `character varying(5)` | Yes | `None` |

**Primary Key(s):** `id`

## Table: `aerodrome_charts`

| Column Name | Data Type | Nullable | Default |
|-------------|-----------|----------|---------|
| `chart_id` | `integer` | No | `nextval('aerodrome_charts_chart_id_seq'::regclass)` |
| `icao_code` | `character varying(10)` | Yes | `None` |
| `chart_title` | `character varying(255)` | Yes | `None` |
| `chart_index` | `character varying(50)` | Yes | `None` |
| `minio_url` | `text` | Yes | `None` |

**Primary Key(s):** `chart_id`

## Table: `ats_routes_geom`

| Column Name | Data Type | Nullable | Default |
|-------------|-----------|----------|---------|
| `route_id` | `character varying(20)` | Yes | `None` |
| `route_designator` | `character varying(100)` | Yes | `None` |
| `route_type` | `character varying(20)` | Yes | `None` |
| `remarks` | `text` | Yes | `None` |
| `waypoint_count` | `bigint` | Yes | `None` |
| `geom` | `USER-DEFINED` | Yes | `None` |

## Table: `fir_airspaces`

| Column Name | Data Type | Nullable | Default |
|-------------|-----------|----------|---------|
| `_id` | `text` | Yes | `None` |
| `createdBy` | `text` | Yes | `None` |
| `createdAt` | `timestamp with time zone` | Yes | `None` |
| `updatedBy` | `text` | Yes | `None` |
| `updatedAt` | `timestamp with time zone` | Yes | `None` |
| `name` | `text` | Yes | `None` |
| `dataIngestion` | `boolean` | Yes | `None` |
| `type` | `integer` | Yes | `None` |
| `icaoClass` | `integer` | Yes | `None` |
| `activity` | `integer` | Yes | `None` |
| `onDemand` | `boolean` | Yes | `None` |
| `onRequest` | `boolean` | Yes | `None` |
| `byNotam` | `boolean` | Yes | `None` |
| `specialAgreement` | `boolean` | Yes | `None` |
| `requestCompliance` | `boolean` | Yes | `None` |
| `country` | `text` | Yes | `None` |
| `upperLimit` | `text` | Yes | `None` |
| `lowerLimit` | `text` | Yes | `None` |
| `hoursOfOperation` | `text` | Yes | `None` |
| `deletable` | `boolean` | Yes | `None` |
| `geom` | `USER-DEFINED` | Yes | `None` |

## Table: `radio_nav_aids`

| Column Name | Data Type | Nullable | Default |
|-------------|-----------|----------|---------|
| `id` | `integer` | No | `nextval('radio_nav_aids_id_seq'::regclass)` |
| `station_name` | `character varying(100)` | No | `None` |
| `ident` | `character varying(10)` | No | `None` |
| `aid_type` | `character varying(30)` | Yes | `None` |
| `frequency` | `character varying(30)` | Yes | `None` |
| `hours_of_operation` | `character varying(100)` | Yes | `None` |
| `elevation` | `character varying(30)` | Yes | `None` |
| `remarks` | `text` | Yes | `None` |
| `raw_coordinates` | `character varying(40)` | Yes | `None` |
| `geom` | `USER-DEFINED` | Yes | `None` |
| `created_at` | `timestamp without time zone` | Yes | `CURRENT_TIMESTAMP` |

**Primary Key(s):** `id`

## Table: `ats_routes`

| Column Name | Data Type | Nullable | Default |
|-------------|-----------|----------|---------|
| `id` | `integer` | No | `nextval('ats_routes_id_seq'::regclass)` |
| `route_id` | `character varying(20)` | No | `None` |
| `route_designator` | `character varying(100)` | Yes | `None` |
| `route_type` | `character varying(20)` | No | `None` |
| `remarks` | `text` | Yes | `None` |
| `created_at` | `timestamp without time zone` | Yes | `CURRENT_TIMESTAMP` |

**Primary Key(s):** `id`

## Table: `ats_route_waypoints`

| Column Name | Data Type | Nullable | Default |
|-------------|-----------|----------|---------|
| `id` | `integer` | No | `nextval('ats_route_waypoints_id_seq'::regclass)` |
| `route_id` | `character varying(20)` | No | `None` |
| `sequence_number` | `integer` | No | `None` |
| `waypoint_name` | `character varying(50)` | Yes | `None` |
| `raw_coordinates` | `character varying(60)` | Yes | `None` |
| `navaid_info` | `character varying(50)` | Yes | `None` |
| `geom` | `USER-DEFINED` | Yes | `None` |

**Primary Key(s):** `id`

