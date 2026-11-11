from datetime import date, datetime
from typing import List, Optional
import uuid
from fastapi import APIRouter, BackgroundTasks, Depends, status
from fastapi.responses import JSONResponse
from app.db import Database, get_db
from app.deps import get_current_user
from app.schemas.tours import (
    BookingCreateRequest,
    BookingStatusUpdateRequest,
    DepartureCreateRequest,
    TourCreateRequest,
    TourUpdateRequest,
)
from app.serializers import record_to_dict
from app.services.email import (
    send_booking_cancelled_email,
    send_booking_confirmed_email,
)

router = APIRouter(tags=["Commercial Tours, Departures & Bookings"])


def parse_date(val: Optional[str]) -> Optional[date]:
    """Parse string to Python date object safely for asyncpg."""
    if not val:
        return None
    if isinstance(val, date):
        return val
    try:
        return datetime.strptime(str(val)[:10], "%Y-%m-%d").date()
    except Exception:
        return None


# -------------------------------------------------------------
# 1. PUBLIC TOURS DISCOVERY & DETAIL
# -------------------------------------------------------------
@router.get("/api/tours")
async def list_published_tours(db: Database = Depends(get_db)):
    """Retrieve all published commercial tours for the traveler discovery catalog."""
    rows = await db.fetch(
        """
        SELECT t.*, d.name AS destination_name, d.image AS destination_image, d.district, d.division,
          u.name AS planner_name,
          (SELECT count(*)::int FROM tour_departures WHERE tour_id = t.id) AS departures_count
        FROM tours t
        JOIN destinations d ON d.id = t.destination_id
        JOIN users u ON u.id = t.planner_id
        WHERE t.status = 'PUBLISHED'
        ORDER BY t.created_at DESC
        """
    )
    return [record_to_dict(r) for r in rows]


@router.get("/api/tours/{id}")
async def get_tour_detail(id: str, db: Database = Depends(get_db)):
    """Retrieve detailed dossier for a tour, including planner bio and departures."""
    try:
        tour_uuid = uuid.UUID(id)
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Tour not found"})

    tour = await db.fetchrow(
        """
        SELECT t.*, d.name AS destination_name, d.image AS destination_image, d.district, d.division,
          u.name AS planner_name, coalesce(up.bio, '') AS planner_bio
        FROM tours t
        JOIN destinations d ON d.id = t.destination_id
        JOIN users u ON u.id = t.planner_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE t.id = $1
        """,
        tour_uuid,
    )
    if not tour:
        return JSONResponse(status_code=404, content={"error": "Tour not found"})

    departures = await db.fetch(
        """
        SELECT td.*,
          coalesce((SELECT sum(travelers_count)::int FROM bookings WHERE departure_id = td.id AND status <> 'CANCELLED'), 0) AS booked_count
        FROM tour_departures td
        WHERE td.tour_id = $1
        ORDER BY td.start_date ASC
        """,
        tour_uuid,
    )

    tour_dict = record_to_dict(tour)
    tour_dict["departures"] = [record_to_dict(d) for d in departures]
    return tour_dict


# -------------------------------------------------------------
# 2. TOUR PLANNER TOURS CRUD
# -------------------------------------------------------------
@router.post("/api/tours", status_code=status.HTTP_201_CREATED)
async def create_tour(
    data: TourCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Create a new commercial tour package. Restricted to TOUR_PLANNER and ADMIN."""
    if current_user["role"] not in ("TOUR_PLANNER", "ADMIN"):
        return JSONResponse(status_code=403, content={"error": "Tour planner role required"})

    try:
        dest_uuid = uuid.UUID(data.destinationId)
        planner_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=400, content={"error": "Invalid destination ID"})

    dest = await db.fetchrow("SELECT id FROM destinations WHERE id = $1", dest_uuid)
    if not dest:
        return JSONResponse(status_code=404, content={"error": "Destination not found"})

    row = await db.fetchrow(
        """
        INSERT INTO tours (planner_id, destination_id, title, description, price, capacity, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        """,
        planner_uuid,
        dest_uuid,
        data.title,
        data.description,
        data.price,
        data.capacity,
        data.status,
    )
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=record_to_dict(row))


@router.put("/api/tours/{id}")
async def update_tour(
    id: str,
    data: TourUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Update a tour package. Only owning planner or ADMIN permitted."""
    try:
        tour_uuid = uuid.UUID(id)
        user_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Tour not found"})

    existing = await db.fetchrow("SELECT id, planner_id FROM tours WHERE id = $1", tour_uuid)
    if not existing:
        return JSONResponse(status_code=404, content={"error": "Tour not found"})

    if existing["planner_id"] != user_uuid and current_user["role"] != "ADMIN":
        return JSONResponse(status_code=403, content={"error": "You can only edit your own tours"})

    dest_uuid = None
    if data.destinationId:
        try:
            dest_uuid = uuid.UUID(data.destinationId)
            dest = await db.fetchrow("SELECT id FROM destinations WHERE id = $1", dest_uuid)
            if not dest:
                return JSONResponse(status_code=404, content={"error": "Destination not found"})
        except (ValueError, TypeError):
            return JSONResponse(status_code=400, content={"error": "Invalid destination ID"})

    row = await db.fetchrow(
        """
        UPDATE tours
        SET title = coalesce($1, title),
            description = coalesce($2, description),
            price = coalesce($3, price),
            capacity = coalesce($4, capacity),
            status = coalesce($5, status),
            destination_id = coalesce($6, destination_id)
        WHERE id = $7
        RETURNING *
        """,
        data.title,
        data.description,
        data.price,
        data.capacity,
        data.status,
        dest_uuid,
        tour_uuid,
    )
    return record_to_dict(row)


@router.get("/api/planner/tours")
async def list_planner_tours(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """List tours created by the authenticated planner."""
    if current_user["role"] not in ("TOUR_PLANNER", "ADMIN"):
        return JSONResponse(status_code=403, content={"error": "Tour planner role required"})

    user_uuid = uuid.UUID(str(current_user["id"]))
    rows = await db.fetch(
        """
        SELECT t.*, d.name AS destination_name, d.image AS destination_image,
          (SELECT count(*)::int FROM tour_departures WHERE tour_id = t.id) AS departures_count,
          (SELECT coalesce(sum(b.travelers_count), 0)::int FROM tour_departures td JOIN bookings b ON b.departure_id = td.id WHERE td.tour_id = t.id AND b.status = 'CONFIRMED') AS total_participants
        FROM tours t
        JOIN destinations d ON d.id = t.destination_id
        WHERE t.planner_id = $1
        ORDER BY t.created_at DESC
        """,
        user_uuid,
    )
    return [record_to_dict(r) for r in rows]


# -------------------------------------------------------------
# 3. DEPARTURES MANAGEMENT
# -------------------------------------------------------------
@router.post("/api/tours/{id}/departures", status_code=status.HTTP_201_CREATED)
async def create_tour_departure(
    id: str,
    data: DepartureCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Add a scheduled departure to a tour. Restricted to the owning planner or ADMIN."""
    try:
        tour_uuid = uuid.UUID(id)
        user_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Tour not found"})

    tour = await db.fetchrow("SELECT id, planner_id FROM tours WHERE id = $1", tour_uuid)
    if not tour:
        return JSONResponse(status_code=404, content={"error": "Tour not found"})

    if tour["planner_id"] != user_uuid and current_user["role"] != "ADMIN":
        return JSONResponse(status_code=403, content={"error": "You can only add departures to your own tours"})

    s_date = parse_date(data.startDate)
    e_date = parse_date(data.endDate)
    if not s_date or not e_date:
        return JSONResponse(status_code=400, content={"error": "Invalid date format, expected YYYY-MM-DD"})
    if e_date < s_date:
        return JSONResponse(status_code=400, content={"error": "End date must be on or after start date"})

    row = await db.fetchrow(
        """
        INSERT INTO tour_departures (tour_id, start_date, end_date, capacity, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        """,
        tour_uuid,
        s_date,
        e_date,
        data.capacity,
        data.status,
    )
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=record_to_dict(row))


@router.get("/api/planner/departures")
async def list_planner_departures(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """List scheduled departures for all tours owned by the authenticated planner."""
    if current_user["role"] not in ("TOUR_PLANNER", "ADMIN"):
        return JSONResponse(status_code=403, content={"error": "Tour planner role required"})

    user_uuid = uuid.UUID(str(current_user["id"]))
    rows = await db.fetch(
        """
        SELECT td.*, t.title AS tour_title, d.name AS destination_name,
          coalesce((SELECT sum(travelers_count)::int FROM bookings WHERE departure_id = td.id AND status <> 'CANCELLED'), 0) AS booked_count
        FROM tour_departures td
        JOIN tours t ON t.id = td.tour_id
        JOIN destinations d ON d.id = t.destination_id
        WHERE t.planner_id = $1
        ORDER BY td.start_date ASC
        """,
        user_uuid,
    )
    return [record_to_dict(r) for r in rows]


# -------------------------------------------------------------
# 4. BOOKINGS (TRAVELER RESERVATION & PLANNER MANAGEMENT)
# -------------------------------------------------------------
@router.post("/api/departures/{id}/bookings", status_code=status.HTTP_201_CREATED)
async def book_departure_seats(
    id: str,
    data: BookingCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Reserve seats on a scheduled departure with strict seat availability checks."""
    try:
        dep_uuid = uuid.UUID(id)
        traveler_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Departure not found"})

    departure = await db.fetchrow(
        """
        SELECT td.*, t.planner_id, t.title AS tour_title
        FROM tour_departures td
        JOIN tours t ON t.id = td.tour_id
        WHERE td.id = $1
        """,
        dep_uuid,
    )
    if not departure:
        return JSONResponse(status_code=404, content={"error": "Departure not found"})

    if departure["status"] in ("CANCELLED", "COMPLETED"):
        return JSONResponse(status_code=400, content={"error": "Departure is not open for booking"})

    # Reject duplicate active bookings by the same traveler
    existing_active = await db.fetchrow(
        """
        SELECT id, status FROM bookings
        WHERE departure_id = $1 AND traveler_id = $2 AND status <> 'CANCELLED'
        """,
        dep_uuid,
        traveler_uuid,
    )
    if existing_active:
        return JSONResponse(
            status_code=400,
            content={"error": "You already have an active booking for this departure. View your existing reservation in My Bookings."},
        )

    # Check available seats against total active bookings on this departure
    booked_stats = await db.fetchrow(
        """
        SELECT coalesce(sum(travelers_count)::int, 0) AS booked_count
        FROM bookings
        WHERE departure_id = $1 AND status <> 'CANCELLED'
        """,
        dep_uuid,
    )
    booked_count = booked_stats["booked_count"] if booked_stats else 0
    available_seats = departure["capacity"] - booked_count

    if data.travelersCount > available_seats:
        return JSONResponse(
            status_code=400,
            content={"error": f"Booking cannot exceed available seats. Only {max(0, available_seats)} seats remaining."},
        )

    b_status = data.status or "PENDING"

    row = await db.fetchrow(
        """
        INSERT INTO bookings (departure_id, traveler_id, travelers_count, status)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (departure_id, traveler_id)
        DO UPDATE SET travelers_count = EXCLUDED.travelers_count, status = EXCLUDED.status
        RETURNING *
        """,
        dep_uuid,
        traveler_uuid,
        data.travelersCount,
        b_status,
    )

    # Notify planner about new booking
    try:
        await db.execute(
            """
            INSERT INTO notifications (user_id, type, detail, link)
            VALUES ($1, $2, $3, $4)
            """,
            departure["planner_id"],
            "NEW_BOOKING",
            f"New booking received for {departure['tour_title']}.",
            "/planner/tours/participants",
        )
    except Exception:
        pass

    return JSONResponse(status_code=status.HTTP_201_CREATED, content=record_to_dict(row))


@router.get("/api/planner/bookings")
async def list_planner_bookings(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """List participant bookings for all tours owned by the authenticated planner."""
    if current_user["role"] not in ("TOUR_PLANNER", "ADMIN"):
        return JSONResponse(status_code=403, content={"error": "Tour planner role required"})

    user_uuid = uuid.UUID(str(current_user["id"]))
    rows = await db.fetch(
        """
        SELECT b.*, u.name AS traveler_name, u.email AS traveler_email,
          t.title AS tour_title, t.price AS tour_price, td.start_date, td.end_date
        FROM bookings b
        JOIN tour_departures td ON td.id = b.departure_id
        JOIN tours t ON t.id = td.tour_id
        JOIN users u ON u.id = b.traveler_id
        WHERE t.planner_id = $1
        ORDER BY b.created_at DESC
        """,
        user_uuid,
    )
    return [record_to_dict(r) for r in rows]


@router.patch("/api/bookings/{id}/status")
async def update_booking_status(
    id: str,
    data: BookingStatusUpdateRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Confirm or cancel a booking. Only the owning tour planner (or ADMIN) has permission."""
    try:
        booking_uuid = uuid.UUID(id)
        user_uuid = uuid.UUID(str(current_user["id"]))
    except (ValueError, TypeError):
        return JSONResponse(status_code=404, content={"error": "Booking not found"})

    booking = await db.fetchrow(
        """
        SELECT b.*, td.capacity, td.id AS dep_id, td.start_date, t.planner_id, t.title AS tour_title,
               u.email AS traveler_email, u.name AS traveler_name
        FROM bookings b
        JOIN tour_departures td ON td.id = b.departure_id
        JOIN tours t ON t.id = td.tour_id
        LEFT JOIN users u ON u.id = b.traveler_id
        WHERE b.id = $1
        """,
        booking_uuid,
    )
    if not booking:
        return JSONResponse(status_code=404, content={"error": "Booking not found"})

    is_owner_planner = (booking["planner_id"] == user_uuid or current_user["role"] == "ADMIN")
    is_traveler_owner = (booking["traveler_id"] == user_uuid)

    if not is_owner_planner:
        # A traveler can cancel their own booking before departure if it is pending or confirmed
        if is_traveler_owner and data.status == "CANCELLED":
            if booking["status"] == "CANCELLED":
                return JSONResponse(status_code=400, content={"error": "Booking is already cancelled"})
            dep_start = parse_date(booking.get("start_date"))
            if dep_start and dep_start < date.today():
                return JSONResponse(status_code=400, content={"error": "Cannot cancel a booking after departure has begun"})
        else:
            return JSONResponse(
                status_code=403,
                content={"error": "Only the owning tour planner can confirm or cancel bookings"},
            )

    # Capacity check if confirming
    if data.status == "CONFIRMED" and booking["status"] != "CONFIRMED":
        booked_stats = await db.fetchrow(
            """
            SELECT coalesce(sum(travelers_count)::int, 0) AS confirmed_count
            FROM bookings
            WHERE departure_id = $1 AND status = 'CONFIRMED' AND id <> $2
            """,
            booking["dep_id"],
            booking_uuid,
        )
        confirmed_count = booked_stats["confirmed_count"] if booked_stats else 0
        if confirmed_count + booking["travelers_count"] > booking["capacity"]:
            return JSONResponse(
                status_code=400,
                content={"error": "Cannot confirm booking: exceeds departure capacity"},
            )

    row = await db.fetchrow(
        """
        UPDATE bookings
        SET status = $1
        WHERE id = $2
        RETURNING *
        """,
        data.status,
        booking_uuid,
    )

    # Notifications & Email Dispatch in Background Task
    try:
        traveler_email = booking.get("traveler_email")
        traveler_name = booking.get("traveler_name") or "Traveler"
        tour_title = booking.get("tour_title") or "Tour"
        dep_date = str(booking.get("start_date") or "")
        seats = booking.get("travelers_count") or 1
        total_price = int(booking.get("total_price") or 0)

        if is_owner_planner:
            await db.execute(
                """
                INSERT INTO notifications (user_id, type, detail, link)
                VALUES ($1, $2, $3, $4)
                """,
                booking["traveler_id"],
                f"BOOKING_{data.status}",
                f"Your booking for {tour_title} has been {data.status.lower()}.",
                "/my-bookings",
            )
            if data.status == "CONFIRMED" and traveler_email:
                background_tasks.add_task(
                    send_booking_confirmed_email,
                    traveler_email,
                    traveler_name,
                    tour_title,
                    dep_date,
                    seats,
                    total_price,
                    str(booking_uuid),
                )
            elif data.status == "CANCELLED" and traveler_email:
                background_tasks.add_task(
                    send_booking_cancelled_email,
                    traveler_email,
                    traveler_name,
                    tour_title,
                    dep_date,
                    "Cancelled by tour planner",
                )
        elif is_traveler_owner and data.status == "CANCELLED":
            await db.execute(
                """
                INSERT INTO notifications (user_id, type, detail, link)
                VALUES ($1, $2, $3, $4)
                """,
                booking["planner_id"],
                "BOOKING_CANCELLED",
                f"Booking for {tour_title} was cancelled by traveler.",
                "/planner/tours/participants",
            )
            if traveler_email:
                background_tasks.add_task(
                    send_booking_cancelled_email,
                    traveler_email,
                    traveler_name,
                    tour_title,
                    dep_date,
                    "Cancelled by traveler",
                )
    except Exception:
        pass

    return record_to_dict(row)


@router.get("/api/me/bookings")
async def list_my_bookings(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Retrieve booking history for the authenticated traveler."""
    user_uuid = uuid.UUID(str(current_user["id"]))
    rows = await db.fetch(
        """
        SELECT b.*, t.id AS tour_id, t.title AS tour_title, t.price,
          (t.price * b.travelers_count)::numeric AS total_price,
          td.start_date, td.end_date, d.name AS destination_name, d.image AS destination_image,
          d.district, d.division, u.name AS planner_name
        FROM bookings b
        JOIN tour_departures td ON td.id = b.departure_id
        JOIN tours t ON t.id = td.tour_id
        JOIN destinations d ON d.id = t.destination_id
        JOIN users u ON u.id = t.planner_id
        WHERE b.traveler_id = $1
        ORDER BY td.start_date ASC
        """,
        user_uuid,
    )
    return [record_to_dict(r) for r in rows]
