from typing import Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from app.db import Database, get_db
from app.services.weather import (
    fetch_weather_data,
    resolve_coords_for_name,
)

router = APIRouter(tags=["Weather Services"])


@router.get("/api/weather")
async def get_weather(
    lat: Optional[float] = Query(None, description="Latitude"),
    lon: Optional[float] = Query(None, description="Longitude"),
    destination_id: Optional[str] = Query(None, description="Destination UUID"),
    destinationId: Optional[str] = Query(None, description="Destination UUID (camelCase alias)"),
    destination: Optional[str] = Query(None, description="Destination name or district"),
    db: Database = Depends(get_db),
):
    """
    Get current weather and 5-day forecast for coordinates or destination.
    Results are cached in memory for ~30 minutes per location.
    """
    final_lat: Optional[float] = None
    final_lon: Optional[float] = None
    location_name: str = "Bangladesh"

    # 1. Direct coordinates
    if lat is not None and lon is not None:
        try:
            final_lat = float(lat)
            final_lon = float(lon)
            if destination:
                location_name = destination
        except (ValueError, TypeError):
            return JSONResponse(status_code=400, content={"error": "Invalid coordinates provided"})

    # 2. Destination UUID lookup
    dest_id_str = destination_id or destinationId
    if (final_lat is None or final_lon is None) and dest_id_str:
        try:
            dest_uuid = uuid.UUID(dest_id_str)
            row = await db.fetchrow(
                "SELECT id, name, district, division FROM destinations WHERE id = $1",
                dest_uuid,
            )
            if row:
                location_name = row["name"]
                final_lat, final_lon = resolve_coords_for_name(
                    f"{row['name']} {row['district']} {row['division']}"
                )
            else:
                return JSONResponse(status_code=404, content={"error": "Destination not found"})
        except (ValueError, TypeError):
            return JSONResponse(status_code=400, content={"error": "Invalid destination ID"})

    # 3. Destination name string
    if (final_lat is None or final_lon is None) and destination:
        location_name = destination.strip()
        final_lat, final_lon = resolve_coords_for_name(location_name)

    # 4. Fallback default to Dhaka
    if final_lat is None or final_lon is None:
        final_lat, final_lon = (23.8103, 90.4125)
        location_name = "Dhaka"

    weather = await fetch_weather_data(final_lat, final_lon, location_name)
    return JSONResponse(status_code=status.HTTP_200_OK, content=weather)
