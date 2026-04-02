"""
Models package — re-exports all ORM models so existing imports like
``from app.models import Notam`` continue to work.
"""

from app.models.aerodrome import AerodromeChart, AerodromeDocument, SpatialFeature
from app.models.airspace import AtsRoute, AtsRouteSegment, AtsRoutesGeom, AtsRouteWaypoint
from app.models.daylight import DaylightTime
from app.models.navigation import RadioNavAid, SignificantPoint
from app.models.notam import Notam

__all__ = [
    "AerodromeChart",
    "AerodromeDocument",
    "AtsRoute",
    "AtsRouteSegment",
    "AtsRoutesGeom",
    "AtsRouteWaypoint",
    "DaylightTime",
    "RadioNavAid",
    "SignificantPoint",
    "SpatialFeature",
    "Notam",
]
