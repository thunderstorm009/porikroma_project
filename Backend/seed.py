import asyncio
from datetime import date, datetime
import json
import os
from pathlib import Path
import sys
from typing import Dict
import asyncpg
import bcrypt
from dotenv import load_dotenv

# Load Backend/.env if present
env_path = Path(__file__).resolve().parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgres://{os.getenv('USER', 'postgres')}@localhost:5432/porikroma",
)


def to_date(val):
    if isinstance(val, str):
        return date.fromisoformat(val)
    return val


async def seed(database_url: str = DATABASE_URL) -> None:
    print("Beginning database seeding...")
    conn = await asyncpg.connect(database_url)

    try:
        # 1. Password hash for password123
        password_hash = bcrypt.hashpw(b"password123", bcrypt.gensalt(10)).decode("utf-8")

        # 2. Insert standard test users
        users_to_create = [
            {"email": "traveler@porikroma.com", "name": "Rafi Ahmed", "role": "TRAVELER"},
            {"email": "traveler2@porikroma.com", "name": "Samira Rahman", "role": "TRAVELER"},
            {"email": "planner@porikroma.com", "name": "Nadia Rahman", "role": "TOUR_PLANNER"},
            {"email": "admin@porikroma.com", "name": "Platform Admin", "role": "ADMIN"},
        ]

        user_ids: Dict[str, str] = {}

        for u in users_to_create:
            row = await conn.fetchrow(
                """INSERT INTO users (name, email, password_hash, role)
                   VALUES ($1, $2, $3, $4)
                   ON CONFLICT (email) DO UPDATE SET
                       name = EXCLUDED.name,
                       role = EXCLUDED.role,
                       password_hash = EXCLUDED.password_hash
                   RETURNING id, email""",
                u["name"],
                u["email"],
                password_hash,
                u["role"],
            )
            user_id = str(row["id"])
            user_ids[u["email"]] = user_id

            # User privacy settings
            await conn.execute(
                """INSERT INTO user_privacy_settings (user_id, profile_visibility, travel_history_visibility, footprint_visibility, reviews_visibility)
                   VALUES ($1, 'PUBLIC', 'PUBLIC', 'PUBLIC', 'PUBLIC')
                   ON CONFLICT (user_id) DO UPDATE SET profile_visibility = 'PUBLIC'""",
                row["id"],
            )

        # User profiles
        await conn.execute(
            """INSERT INTO user_profiles (user_id, username, bio, travel_style, interests)
               VALUES ($1, 'rafi-ahmed', 'A slow traveler who prefers local food, long walks, and a little room for surprise.', 'Slow outdoors', ARRAY['Nature', 'Food & Drink', 'Slow Travel', 'Photography'])
               ON CONFLICT (user_id) DO UPDATE SET bio = EXCLUDED.bio, interests = EXCLUDED.interests""",
            asyncpg.pgproto.types.UUID(user_ids["traveler@porikroma.com"])
            if hasattr(asyncpg.pgproto.types, "UUID")
            else user_ids["traveler@porikroma.com"],
        )

        await conn.execute(
            """INSERT INTO user_profiles (user_id, username, bio, travel_style, interests)
               VALUES ($1, 'samira-rahman', 'Curious trekker and hill-tract explorer. Always looking for hidden gems.', 'Active trekker', ARRAY['Trekking', 'Culture', 'Mountains'])
               ON CONFLICT (user_id) DO UPDATE SET bio = EXCLUDED.bio, interests = EXCLUDED.interests""",
            asyncpg.pgproto.types.UUID(user_ids["traveler2@porikroma.com"])
            if hasattr(asyncpg.pgproto.types, "UUID")
            else user_ids["traveler2@porikroma.com"],
        )

        await conn.execute(
            """INSERT INTO user_profiles (user_id, username, bio, travel_style, interests)
               VALUES ($1, 'nadia-rahman', 'Verified tour planner and tea-country expedition leader. Over 10 years guiding across Bangladesh.', 'Expedition Leader', ARRAY['Guiding', 'Responsible Travel', 'Tea Culture'])
               ON CONFLICT (user_id) DO UPDATE SET bio = EXCLUDED.bio, interests = EXCLUDED.interests""",
            asyncpg.pgproto.types.UUID(user_ids["planner@porikroma.com"])
            if hasattr(asyncpg.pgproto.types, "UUID")
            else user_ids["planner@porikroma.com"],
        )

        # 3. Destinations
        destinations = [
            {
                "name": "Cox's Bazar",
                "division": "Chattogram Division",
                "district": "Cox's Bazar",
                "description": "The world’s longest natural sea beach, with golden sand, fresh coastal seafood, and calming sunsets along Marine Drive.",
                "category": "Beach",
                "estimatedBudget": 9200,
                "image": "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1000&q=85",
            },
            {
                "name": "Sylhet",
                "division": "Sylhet Division",
                "district": "Sylhet",
                "description": "A serene expanse of emerald tea estates, crystal clear freshwater rivers, and rich culinary culture.",
                "category": "Culture",
                "estimatedBudget": 8500,
                "image": "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1000&q=85",
            },
            {
                "name": "Bandarban",
                "division": "Chattogram Division",
                "district": "Bandarban",
                "description": "Misty green peaks, authentic indigenous villages, cloud ridges, and remote trails for adventurous spirits.",
                "category": "Adventure",
                "estimatedBudget": 14500,
                "image": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1000&q=85",
            },
            {
                "name": "Sajek Valley",
                "division": "Chattogram Division",
                "district": "Rangamati",
                "description": "Cloud country for a slow reset, sunrise viewpoints above an ocean of clouds, and cozy hill-cottage stays.",
                "category": "Nature",
                "estimatedBudget": 5800,
                "image": "https://images.unsplash.com/photo-1528127269322-539801943592?w=1000&q=85",
            },
            {
                "name": "Sundarbans",
                "division": "Khulna Division",
                "district": "Bagerhat",
                "description": "The majestic UNESCO World Heritage mangrove forest, tidal waterways, Royal Bengal tigers, and serene boat expeditions.",
                "category": "Wildlife",
                "estimatedBudget": 28000,
                "image": "https://images.unsplash.com/photo-1473445361085-b9a07f55608b?w=1000&q=85",
            },
            {
                "name": "Sreemangal",
                "division": "Sylhet Division",
                "district": "Moulvibazar",
                "description": "The tea capital of Bangladesh, featuring Lawachara National Park, seven-layer tea, and peaceful cycling trails.",
                "category": "Nature",
                "estimatedBudget": 6500,
                "image": "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1000&q=85",
            },
            {
                "name": "Rangamati",
                "division": "Chattogram Division",
                "district": "Rangamati",
                "description": "Sparkling Kaptai Lake, hanging bridge, Shuvolong waterfalls, and indigenous cultural markets.",
                "category": "Culture",
                "estimatedBudget": 7500,
                "image": "https://images.unsplash.com/photo-1500534623283-312aade485b7?w=1000&q=85",
            },
        ]

        dest_ids: Dict[str, Any] = {}
        for d in destinations:
            existing = await conn.fetchrow("SELECT id FROM destinations WHERE name = $1", d["name"])
            if existing:
                await conn.execute(
                    """UPDATE destinations SET division = $1, district = $2, description = $3,
                       category = $4, estimated_budget = $5, image = $6 WHERE id = $7""",
                    d["division"],
                    d["district"],
                    d["description"],
                    d["category"],
                    d["estimatedBudget"],
                    d["image"],
                    existing["id"],
                )
                dest_ids[d["name"]] = existing["id"]
            else:
                created = await conn.fetchrow(
                    """INSERT INTO destinations (name, division, district, description, category, estimated_budget, image)
                       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id""",
                    d["name"],
                    d["division"],
                    d["district"],
                    d["description"],
                    d["category"],
                    d["estimatedBudget"],
                    d["image"],
                )
                dest_ids[d["name"]] = created["id"]

        # 4. Achievements
        achievements = [
            {"code": "FIRST_DESTINATION", "title": "First Destination", "description": "Began your journey by recording your first explored place."},
            {"code": "FIVE_DISTRICTS", "title": "District Explorer", "description": "Explored 5 different districts across Bangladesh."},
            {"code": "TEN_DISTRICTS", "title": "Seasoned Wanderer", "description": "Reached 10 explored districts across Bangladesh."},
            {"code": "GROUP_EXPEDITION", "title": "Trail Companion", "description": "Participated in a group expedition."},
            {"code": "BUDGET_MASTER", "title": "Budget Master", "description": "Kept trip expenses strictly within the planned budget."},
            {"code": "TRAVEL_WRITER", "title": "Storyteller", "description": "Wrote travel journal memories and notes."},
        ]

        for a in achievements:
            await conn.execute(
                """INSERT INTO travel_achievements (code, title, description)
                   VALUES ($1, $2, $3)
                   ON CONFLICT (code) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description""",
                a["code"],
                a["title"],
                a["description"],
            )

        # Unlock some achievements for traveler
        ach_rows = await conn.fetch("SELECT id, code FROM travel_achievements")
        for ach in ach_rows[:3]:
            await conn.execute(
                """INSERT INTO user_achievements (user_id, achievement_id)
                   VALUES ($1, $2)
                   ON CONFLICT DO NOTHING""",
                user_ids["traveler@porikroma.com"],
                ach["id"],
            )

        # 5. Passport entries for Rafi
        passport_places = ["Cox's Bazar", "Sylhet", "Bandarban", "Sajek Valley"]
        for place in passport_places:
            if place in dest_ids:
                await conn.execute(
                    """INSERT INTO passport_entries (user_id, destination_id, visited_on, visibility)
                       VALUES ($1, $2, '2024-10-15', 'PUBLIC')
                       ON CONFLICT (user_id, destination_id) DO NOTHING""",
                    user_ids["traveler@porikroma.com"],
                    dest_ids[place],
                )

        # 6. Wishlist destinations for Rafi
        for place in ["Sundarbans", "Sreemangal"]:
            if place in dest_ids:
                await conn.execute(
                    """INSERT INTO wishlist_destinations (user_id, destination_id)
                       VALUES ($1, $2)
                       ON CONFLICT DO NOTHING""",
                    user_ids["traveler@porikroma.com"],
                    dest_ids[place],
                )

        # 7. Trips for Rafi
        # Helper to get or create trip
        async def get_or_create_trip(creator_id, dest_id, name, start_date, end_date, status, visibility, budget, description):
            existing = await conn.fetchrow(
                "SELECT id FROM trips WHERE creator_id = $1 AND name = $2 LIMIT 1",
                creator_id,
                name,
            )
            if existing:
                return existing["id"]
            row = await conn.fetchrow(
                """INSERT INTO trips (creator_id, destination_id, name, start_date, end_date, status, visibility, budget, description)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                   RETURNING id""",
                creator_id,
                dest_id,
                name,
                to_date(start_date),
                to_date(end_date),
                status,
                visibility,
                budget,
                description,
            )
            return row["id"]

        trip1_id = await get_or_create_trip(
            user_ids["traveler@porikroma.com"],
            dest_ids["Cox's Bazar"],
            "Cox’s Bazar escape",
            "2025-05-18",
            "2025-05-22",
            "UPCOMING",
            "PUBLIC",
            32700,
            "A slow coastal getaway with sunrise beach walks and seafood dinners.",
        )
        await conn.execute(
            """INSERT INTO trip_members (trip_id, user_id, role)
               VALUES ($1, $2, 'OWNER'), ($1, $3, 'MEMBER')
               ON CONFLICT DO NOTHING""",
            trip1_id,
            user_ids["traveler@porikroma.com"],
            user_ids["traveler2@porikroma.com"],
        )

        trip2_id = await get_or_create_trip(
            user_ids["traveler@porikroma.com"],
            dest_ids["Sylhet"],
            "The tea garden days",
            "2024-10-04",
            "2024-10-07",
            "COMPLETED",
            "PUBLIC",
            28000,
            "A gentle week of tea gardens, river air, and unhurried mornings in Sylhet.",
        )
        await conn.execute(
            """INSERT INTO trip_members (trip_id, user_id, role)
               VALUES ($1, $2, 'OWNER'), ($1, $3, 'MEMBER')
               ON CONFLICT DO NOTHING""",
            trip2_id,
            user_ids["traveler@porikroma.com"],
            user_ids["planner@porikroma.com"],
        )

        # Completed demo trip shared by both traveler demo accounts. This powers
        # the profile review form and provides a real example rating/review.
        profile_demo_trip_id = await get_or_create_trip(
            user_ids["traveler@porikroma.com"],
            dest_ids["Cox's Bazar"],
            "Demo: Cox’s Bazar travel companions",
            "2024-12-10",
            "2024-12-13",
            "COMPLETED",
            "PUBLIC",
            24000,
            "Completed sample trip shared by the traveler demo accounts for profile ratings and reviews.",
        )
        await conn.execute(
            """INSERT INTO trip_members (trip_id, user_id, role)
               VALUES ($1, $2, 'OWNER'), ($1, $3, 'MEMBER')
               ON CONFLICT DO NOTHING""",
            profile_demo_trip_id,
            user_ids["traveler@porikroma.com"],
            user_ids["traveler2@porikroma.com"],
        )
        await conn.execute(
            """INSERT INTO peer_reviews (trip_id, reviewer_id, reviewee_id, rating, comment)
               VALUES ($1, $2, $3, 5, 'A thoughtful and reliable travel companion. Shared plans clearly, stayed flexible, and helped make the trip enjoyable.')
               ON CONFLICT (trip_id, reviewer_id, reviewee_id) DO NOTHING""",
            profile_demo_trip_id,
            user_ids["traveler2@porikroma.com"],
            user_ids["traveler@porikroma.com"],
        )

        trip3_id = await get_or_create_trip(
            user_ids["traveler@porikroma.com"],
            dest_ids["Bandarban"],
            "Bandarban Keokradong Ridge",
            "2025-09-14",
            "2025-09-18",
            "PLANNING",
            "PUBLIC",
            22000,
            "Trekking to Boga Lake and Keokradong summit with local indigenous guides.",
        )
        await conn.execute(
            """INSERT INTO trip_members (trip_id, user_id, role)
               VALUES ($1, $2, 'OWNER')
               ON CONFLICT DO NOTHING""",
            trip3_id,
            user_ids["traveler@porikroma.com"],
        )

        # Itinerary items for Trip 1
        trip1_items = [
            {"dayDate": "2025-05-18", "title": "Arrival & check-in at Kolatoli", "location": "Mermaid Eco Resort", "notes": "Check in, settle in, evening beach stroll", "sortOrder": 1},
            {"dayDate": "2025-05-19", "title": "Marine Drive sunrise cruise & Himchari", "location": "Himchari National Park", "notes": "Walk up the stairs for panoramic ocean view", "sortOrder": 2},
            {"dayDate": "2025-05-20", "title": "Inani coral beach & fresh coconut water", "location": "Inani Beach", "notes": "Take open hood jeep along the Marine Drive", "sortOrder": 3},
            {"dayDate": "2025-05-21", "title": "Local fish barbecue & night market", "location": "Salt & Pepper Grill", "notes": "Sample fresh grilled rupchanda and crab", "sortOrder": 4},
        ]
        for it in trip1_items:
            existing = await conn.fetchrow(
                "SELECT id FROM trip_itinerary_items WHERE trip_id = $1 AND title = $2 LIMIT 1",
                trip1_id,
                it["title"],
            )
            if not existing:
                await conn.execute(
                    """INSERT INTO trip_itinerary_items (trip_id, day_date, title, location, notes, sort_order)
                       VALUES ($1, $2, $3, $4, $5, $6)""",
                    trip1_id,
                    to_date(it["dayDate"]),
                    it["title"],
                    it["location"],
                    it["notes"],
                    it["sortOrder"],
                )

        # Checklist items for Trip 1
        trip1_checklist = [
            {"title": "Breathable linen clothes & sun hat", "completed": True},
            {"title": "Reef-safe sunscreen and sunglasses", "completed": True},
            {"title": "Waterproof dry bag for beach outings", "completed": False},
            {"title": "Cash for beachside coconut vendors", "completed": True},
            {"title": "Camera & extra memory card", "completed": False},
        ]
        for ch in trip1_checklist:
            existing = await conn.fetchrow(
                "SELECT id FROM trip_checklists WHERE trip_id = $1 AND title = $2 LIMIT 1",
                trip1_id,
                ch["title"],
            )
            if not existing:
                await conn.execute(
                    """INSERT INTO trip_checklists (trip_id, title, completed, created_by)
                       VALUES ($1, $2, $3, $4)""",
                    trip1_id,
                    ch["title"],
                    ch["completed"],
                    user_ids["traveler@porikroma.com"],
                )

        # Notes for Trip 1
        trip1_notes = [
            "Best sunset angle is by the fishing boat docks at South Beach around 5:45 PM.",
            "Keep emergency contact for resort shuttle handy: +880 1711 000000.",
            "Recommended lunch spot: Jhaoban Restaurant for traditional mashed dishes (vortas).",
        ]
        for n in trip1_notes:
            existing = await conn.fetchrow(
                "SELECT id FROM trip_notes WHERE trip_id = $1 AND body = $2 LIMIT 1",
                trip1_id,
                n,
            )
            if not existing:
                await conn.execute(
                    """INSERT INTO trip_notes (trip_id, author_id, body)
                       VALUES ($1, $2, $3)""",
                    trip1_id,
                    user_ids["traveler@porikroma.com"],
                    n,
                )

        # Map places for Trip 1
        trip1_places = [
            {"name": "Kolatoli Point", "category": "Beach", "notes": "Main surf and beach stretch with great sunset", "lat": 21.4172, "lng": 91.9813},
            {"name": "Inani Beach", "category": "Nature", "notes": "Coral stone beach with fewer crowds", "lat": 21.3056, "lng": 92.0528},
            {"name": "Himchari Waterfall & Peak", "category": "Sightseeing", "notes": "Panoramic hillside overlooking the Bay of Bengal", "lat": 21.3611, "lng": 92.0194},
            {"name": "Salt & Pepper Coastal Dining", "category": "Dining", "notes": "Fresh local seafood grill", "lat": 21.4231, "lng": 91.9792},
        ]
        for p in trip1_places:
            existing = await conn.fetchrow(
                "SELECT id FROM trip_map_places WHERE trip_id = $1 AND name = $2 LIMIT 1",
                trip1_id,
                p["name"],
            )
            if not existing:
                await conn.execute(
                    """INSERT INTO trip_map_places (trip_id, name, category, notes, lat, lng)
                       VALUES ($1, $2, $3, $4, $5, $6)""",
                    trip1_id,
                    p["name"],
                    p["category"],
                    p["notes"],
                    p["lat"],
                    p["lng"],
                )

        # Expenses for Trip 1
        trip1_expenses = [
            {"title": "Resort booking deposit", "category": "Stay", "amount": 14500, "paidBy": user_ids["traveler@porikroma.com"], "expenseDate": "2025-05-18"},
            {"title": "Private vehicle transfer from airport", "category": "Transport", "amount": 3500, "paidBy": user_ids["traveler@porikroma.com"], "expenseDate": "2025-05-18"},
            {"title": "Dinner at Salt & Pepper", "category": "Food & drink", "amount": 3200, "paidBy": user_ids["traveler2@porikroma.com"], "expenseDate": "2025-05-19"},
            {"title": "Inani open-hood jeep hire", "category": "Activities", "amount": 2500, "paidBy": user_ids["traveler@porikroma.com"], "expenseDate": "2025-05-20"},
            {"title": "Beachside coffee and coconuts", "category": "Food & drink", "amount": 800, "paidBy": user_ids["traveler@porikroma.com"], "expenseDate": "2025-05-20"},
        ]
        for exp in trip1_expenses:
            existing = await conn.fetchrow(
                "SELECT id FROM expenses WHERE trip_id = $1 AND title = $2 LIMIT 1",
                trip1_id,
                exp["title"],
            )
            if not existing:
                await conn.execute(
                    """INSERT INTO expenses (trip_id, paid_by, title, category, amount, expense_date)
                       VALUES ($1, $2, $3, $4, $5, $6)""",
                    trip1_id,
                    exp["paidBy"],
                    exp["title"],
                    exp["category"],
                    exp["amount"],
                    to_date(exp["expenseDate"]),
                )

        # Settlements for Trip 1
        existing_settlement = await conn.fetchrow(
            "SELECT id FROM expense_settlements WHERE trip_id = $1 AND from_user_id = $2 AND to_user_id = $3 LIMIT 1",
            trip1_id,
            user_ids["traveler2@porikroma.com"],
            user_ids["traveler@porikroma.com"],
        )
        if not existing_settlement:
            await conn.execute(
                """INSERT INTO expense_settlements (trip_id, from_user_id, to_user_id, amount, status)
                   VALUES ($1, $2, $3, 1600, 'PENDING')""",
                trip1_id,
                user_ids["traveler2@porikroma.com"],
                user_ids["traveler@porikroma.com"],
            )

        # 8. Group travel expeditions
        async def get_or_create_group(trip_id, organizer_id, title, capacity, budget, published):
            existing = await conn.fetchrow(
                "SELECT id FROM groups WHERE trip_id = $1 AND title = $2 LIMIT 1",
                trip_id,
                title,
            )
            if existing:
                return existing["id"]
            row = await conn.fetchrow(
                """INSERT INTO groups (trip_id, organizer_id, title, capacity, budget_per_person, published)
                   VALUES ($1, $2, $3, $4, $5, $6)
                   RETURNING id""",
                trip_id,
                organizer_id,
                title,
                capacity,
                budget,
                published,
            )
            return row["id"]

        group1_id = await get_or_create_group(
            trip2_id,
            user_ids["planner@porikroma.com"],
            "The slow road through Sylhet",
            6,
            8500,
            True,
        )
        await conn.execute(
            """INSERT INTO group_members (group_id, user_id)
               VALUES ($1, $2), ($1, $3)
               ON CONFLICT DO NOTHING""",
            group1_id,
            user_ids["planner@porikroma.com"],
            user_ids["traveler@porikroma.com"],
        )

        group2_id = await get_or_create_group(
            trip3_id,
            user_ids["planner@porikroma.com"],
            "Bandarban Keokradong & Boga Lake Ridge",
            8,
            14500,
            True,
        )
        await conn.execute(
            """INSERT INTO group_members (group_id, user_id)
               VALUES ($1, $2), ($1, $3)
               ON CONFLICT DO NOTHING""",
            group2_id,
            user_ids["planner@porikroma.com"],
            user_ids["traveler2@porikroma.com"],
        )

        # Applications
        await conn.execute(
            """INSERT INTO applications (group_id, applicant_id, status, answers)
               VALUES ($1, $2, 'PENDING', '{"experience": "Hiked in Sajek and Bandarban before.", "diet": "None", "commitment": "Yes, confirmed available."}')
               ON CONFLICT (group_id, applicant_id) DO NOTHING""",
            group2_id,
            user_ids["traveler@porikroma.com"],
        )

        # Group messages
        group_messages = [
            {"sender": user_ids["planner@porikroma.com"], "body": "Welcome everyone to the slow road through Sylhet! Excited to lead this journey."},
            {"sender": user_ids["traveler@porikroma.com"], "body": "Looking forward to the tea estate sunrise trails. What time do we meet at the Sylhet airport?"},
            {"sender": user_ids["planner@porikroma.com"], "body": "We have our private microbus arriving at 10:30 AM right outside Terminal 1."},
        ]
        for m in group_messages:
            existing = await conn.fetchrow(
                "SELECT id FROM group_messages WHERE group_id = $1 AND sender_id = $2 AND body = $3 LIMIT 1",
                group1_id,
                m["sender"],
                m["body"],
            )
            if not existing:
                await conn.execute(
                    """INSERT INTO group_messages (group_id, sender_id, body)
                       VALUES ($1, $2, $3)""",
                    group1_id,
                    m["sender"],
                    m["body"],
                )

        # 9. Tours for Tour Planner
        async def get_or_create_tour(planner_id, dest_id, title, description, price, capacity, status):
            existing = await conn.fetchrow(
                "SELECT id FROM tours WHERE planner_id = $1 AND title = $2 LIMIT 1",
                planner_id,
                title,
            )
            if existing:
                return existing["id"]
            row = await conn.fetchrow(
                """INSERT INTO tours (planner_id, destination_id, title, description, price, capacity, status)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   RETURNING id""",
                planner_id,
                dest_id,
                title,
                description,
                price,
                capacity,
                status,
            )
            return row["id"]

        tour1_id = await get_or_create_tour(
            user_ids["planner@porikroma.com"],
            dest_ids["Sylhet"],
            "Sylhet Tea Country & Swamp Forest Odyssey",
            "A curated 4-day immersive exploration across Sreemangal tea estates and Ratargul swamp forest.",
            8500,
            12,
            "PUBLISHED",
        )

        async def get_or_create_departure(tour_id, start_date, end_date, capacity, status):
            sd = to_date(start_date)
            ed = to_date(end_date)
            existing = await conn.fetchrow(
                "SELECT id FROM tour_departures WHERE tour_id = $1 AND start_date = $2 AND end_date = $3 LIMIT 1",
                tour_id,
                sd,
                ed,
            )
            if existing:
                return existing["id"]
            row = await conn.fetchrow(
                """INSERT INTO tour_departures (tour_id, start_date, end_date, capacity, status)
                   VALUES ($1, $2, $3, $4, $5)
                   RETURNING id""",
                tour_id,
                sd,
                ed,
                capacity,
                status,
            )
            return row["id"]

        departure1_id = await get_or_create_departure(
            tour1_id,
            "2025-06-12",
            "2025-06-15",
            12,
            "OPEN",
        )

        # Booking for traveler on departure1
        await conn.execute(
            """INSERT INTO bookings (departure_id, traveler_id, status, travelers_count)
               VALUES ($1, $2, 'CONFIRMED', 2)
               ON CONFLICT (departure_id, traveler_id) DO NOTHING""",
            departure1_id,
            user_ids["traveler@porikroma.com"],
        )

        tour2_id = await get_or_create_tour(
            user_ids["planner@porikroma.com"],
            dest_ids["Bandarban"],
            "Bandarban Cloud Peaks & Indigenous Trails",
            "Challenging high-altitude trek visiting Boga Lake, Keokradong, and Saka Haphong with certified mountaineers.",
            16500,
            8,
            "PUBLISHED",
        )
        await get_or_create_departure(
            tour2_id,
            "2025-10-20",
            "2025-10-25",
            8,
            "OPEN",
        )

        # 10. Community Posts
        community_posts = [
            {
                "author": user_ids["traveler@porikroma.com"],
                "body": "Quiet morning along Inani beach. The low tide reveals untouched coral reefs and tide pools. Bangladesh coastlines have so much gentle beauty when you step away from crowded central points.",
            },
            {
                "author": user_ids["planner@porikroma.com"],
                "body": "Essential advice for visiting Ratargul Freshwater Swamp during monsoon: Always hire local boatmen who know current water depths, wear life vests, and avoid loud music so birds and wildlife aren’t disturbed.",
            },
            {
                "author": user_ids["traveler2@porikroma.com"],
                "body": "Just completed the trek up Konglak Hill in Sajek Valley before dawn. The cloud layer rolling over the green ridges was breathtaking. Warm tea at the peak is 10/10 recommended.",
            },
        ]

        for post in community_posts:
            existing = await conn.fetchrow(
                "SELECT id FROM community_posts WHERE author_id = $1 AND body = $2 LIMIT 1",
                post["author"],
                post["body"],
            )
            if existing:
                post_id = existing["id"]
            else:
                p = await conn.fetchrow(
                    """INSERT INTO community_posts (author_id, body, visibility)
                       VALUES ($1, $2, 'PUBLIC')
                       RETURNING id""",
                    post["author"],
                    post["body"],
                )
                post_id = p["id"]

            # Add reactions
            await conn.execute(
                """INSERT INTO community_reactions (post_id, user_id)
                   VALUES ($1, $2)
                   ON CONFLICT DO NOTHING""",
                post_id,
                user_ids["traveler@porikroma.com"],
            )

            # Add comment if not exists
            existing_comment = await conn.fetchrow(
                "SELECT id FROM community_comments WHERE post_id = $1 AND author_id = $2 LIMIT 1",
                post_id,
                user_ids["planner@porikroma.com"],
            )
            if not existing_comment:
                await conn.execute(
                    """INSERT INTO community_comments (post_id, author_id, body)
                       VALUES ($1, $2, 'Wonderful reflection! So true regarding responsible pacing.')""",
                    post_id,
                    user_ids["planner@porikroma.com"],
                )

        # 11. Traveler review
        await conn.execute(
            """INSERT INTO traveler_reviews (trip_id, reviewer_id, reviewed_user_id, communication, punctuality, reliability, teamwork, respectfulness, cooperation, responsibility, overall, body)
               VALUES ($1, $2, $3, 5, 5, 5, 5, 5, 5, 5, 5, 'Rafi was an exceptional expedition companion. Always respectful of local guides and kept a patient, kind spirit throughout.')
               ON CONFLICT (trip_id, reviewer_id, reviewed_user_id) DO NOTHING""",
            trip2_id,
            user_ids["planner@porikroma.com"],
            user_ids["traveler@porikroma.com"],
        )

        # 12. Destination reviews
        if "Cox's Bazar" in dest_ids:
            await conn.execute(
                """INSERT INTO reviews (destination_id, author_id, rating, body)
                   VALUES ($1, $2, 5, 'Incredible vastness and calming atmosphere along Marine drive.')
                   ON CONFLICT (destination_id, author_id) DO NOTHING""",
                dest_ids["Cox's Bazar"],
                user_ids["traveler@porikroma.com"],
            )

        if "Sylhet" in dest_ids:
            await conn.execute(
                """INSERT INTO reviews (destination_id, author_id, rating, body)
                   VALUES ($1, $2, 5, 'The tea gardens and Lalakhal river water are paradise.')
                   ON CONFLICT (destination_id, author_id) DO NOTHING""",
                dest_ids["Sylhet"],
                user_ids["traveler2@porikroma.com"],
            )

        # 13. Notifications for Rafi
        notifs = [
            {"type": "TRIP_INVITATION", "detail": "Samira invited you to join Bandarban Keokradong Ridge", "link": f"/trips/{trip1_id}"},
            {"type": "TRAVELER_REVIEW", "detail": "Nadia Rahman left you a 5.0 traveler review for The tea garden days", "link": "/profile"},
            {"type": "EXPENSE_ADDED", "detail": 'Samira added "Dinner at Salt & Pepper" (৳3,200) to Cox’s Bazar escape', "link": f"/trips/{trip1_id}/expenses"},
        ]
        for n in notifs:
            existing = await conn.fetchrow(
                "SELECT id FROM notifications WHERE user_id = $1 AND type = $2 AND detail = $3 LIMIT 1",
                user_ids["traveler@porikroma.com"],
                n["type"],
                n["detail"],
            )
            if not existing:
                await conn.execute(
                    """INSERT INTO notifications (user_id, type, detail, link, read)
                       VALUES ($1, $2, $3, $4, false)""",
                    user_ids["traveler@porikroma.com"],
                    n["type"],
                    n["detail"],
                    n["link"],
                )

        # 14. Verification request for admin
        existing_verif = await conn.fetchrow(
            "SELECT id FROM verification_requests WHERE user_id = $1 AND status = 'PENDING' LIMIT 1",
            user_ids["planner@porikroma.com"],
        )
        if not existing_verif:
            await conn.execute(
                """INSERT INTO verification_requests (user_id, status, note)
                   VALUES ($1, 'PENDING', 'Applying for official verified Tour Planner badge with 10 years licensed experience in Sylhet & Chittagong Hill Tracts.')""",
                user_ids["planner@porikroma.com"],
            )

        # 15. User report for admin
        existing_report = await conn.fetchrow(
            "SELECT id FROM user_reports WHERE reporter_id = $1 AND reported_user_id = $2 LIMIT 1",
            user_ids["traveler@porikroma.com"],
            user_ids["traveler2@porikroma.com"],
        )
        if not existing_report:
            await conn.execute(
                """INSERT INTO user_reports (reporter_id, reported_user_id, reason)
                   VALUES ($1, $2, 'Inappropriate promotional spam posted in community discussion.')""",
                user_ids["traveler@porikroma.com"],
                user_ids["traveler2@porikroma.com"],
            )

        # 16. AI conversation
        existing_ai = await conn.fetchrow(
            "SELECT id FROM ai_conversations WHERE user_id = $1 AND title = $2 LIMIT 1",
            user_ids["traveler@porikroma.com"],
            "A quiet weekend in Sylhet",
        )
        if existing_ai:
            ai_convo_id = existing_ai["id"]
        else:
            ai_convo = await conn.fetchrow(
                """INSERT INTO ai_conversations (user_id, title)
                   VALUES ($1, $2)
                   RETURNING id""",
                user_ids["traveler@porikroma.com"],
                "A quiet weekend in Sylhet",
            )
            ai_convo_id = ai_convo["id"]

        existing_ai_msg = await conn.fetchrow(
            "SELECT id FROM ai_messages WHERE conversation_id = $1 LIMIT 1",
            ai_convo_id,
        )
        if not existing_ai_msg:
            await conn.execute(
                """INSERT INTO ai_messages (conversation_id, sender, body)
                   VALUES
                   ($1, 'USER', 'What are the best slow travel spots in Sylhet for 3 days on a ৳10,000 budget?'),
                   ($1, 'ASSISTANT', 'For a slow, reflective 3 days in Sylhet under ৳10,000, I recommend focusing on Sreemangal and Lalakhal rather than rushing through every town. Day 1: Arrive via Parabat Express train (approx ৳450), stay in an eco-cottage near Radhanagar (৳2,500/night). Day 2: Early morning walk in Lawachara Rainforest before tour buses arrive, followed by fresh seven-color tea and local tribal culinary spread. Day 3: Hire a shared local boat at Lalakhal for emerald river reflections before heading home. Total estimated cost: ৳8,200 with ample buffer for local delicacies.')""",
                ai_convo_id,
            )

        print("Database seeded successfully with rich test data!")

    finally:
        await conn.close()


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else DATABASE_URL
    try:
        asyncio.run(seed(url))
    except (asyncpg.PostgresConnectionError, ConnectionRefusedError, OSError) as exc:
        print(f"Database is unavailable. Start PostgreSQL and try again. ({exc})", file=sys.stderr)
        sys.exit(1)
