import bcrypt from 'bcryptjs'
import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || `postgres://${process.env.USER ?? 'postgres'}@localhost:5432/porikroma`,
})

async function seed() {
  console.log('Beginning database seeding...')

  // 1. Password hash for password123
  const passwordHash = await bcrypt.hash('password123', 10)

  // 2. Insert standard test users
  const usersToCreate = [
    { email: 'traveler@porikroma.com', name: 'Rafi Ahmed', role: 'TRAVELER' },
    { email: 'traveler2@porikroma.com', name: 'Samira Rahman', role: 'TRAVELER' },
    { email: 'planner@porikroma.com', name: 'Nadia Rahman', role: 'TOUR_PLANNER' },
    { email: 'admin@porikroma.com', name: 'Platform Admin', role: 'ADMIN' },
  ]

  const userIds: Record<string, string> = {}

  for (const u of usersToCreate) {
    const res = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, password_hash = EXCLUDED.password_hash
       RETURNING id, email`,
      [u.name, u.email, passwordHash, u.role]
    )
    userIds[u.email] = res.rows[0].id

    // User privacy settings
    await pool.query(
      `INSERT INTO user_privacy_settings (user_id, profile_visibility, travel_history_visibility, footprint_visibility, reviews_visibility)
       VALUES ($1, 'PUBLIC', 'PUBLIC', 'PUBLIC', 'PUBLIC')
       ON CONFLICT (user_id) DO UPDATE SET profile_visibility = 'PUBLIC'`,
      [res.rows[0].id]
    )
  }

  // User profiles
  await pool.query(
    `INSERT INTO user_profiles (user_id, username, bio, travel_style, interests)
     VALUES ($1, 'rafi-ahmed', 'A slow traveler who prefers local food, long walks, and a little room for surprise.', 'Slow outdoors', ARRAY['Nature', 'Food & Drink', 'Slow Travel', 'Photography'])
     ON CONFLICT (user_id) DO UPDATE SET bio = EXCLUDED.bio, interests = EXCLUDED.interests`,
    [userIds['traveler@porikroma.com']]
  )

  await pool.query(
    `INSERT INTO user_profiles (user_id, username, bio, travel_style, interests)
     VALUES ($1, 'samira-rahman', 'Curious trekker and hill-tract explorer. Always looking for hidden gems.', 'Active trekker', ARRAY['Trekking', 'Culture', 'Mountains'])
     ON CONFLICT (user_id) DO UPDATE SET bio = EXCLUDED.bio, interests = EXCLUDED.interests`,
    [userIds['traveler2@porikroma.com']]
  )

  await pool.query(
    `INSERT INTO user_profiles (user_id, username, bio, travel_style, interests)
     VALUES ($1, 'nadia-rahman', 'Verified tour planner and tea-country expedition leader. Over 10 years guiding across Bangladesh.', 'Expedition Leader', ARRAY['Guiding', 'Responsible Travel', 'Tea Culture'])
     ON CONFLICT (user_id) DO UPDATE SET bio = EXCLUDED.bio, interests = EXCLUDED.interests`,
    [userIds['planner@porikroma.com']]
  )

  // 3. Destinations
  const destinations = [
    {
      name: "Cox's Bazar",
      division: 'Chattogram Division',
      district: "Cox's Bazar",
      description: 'The world’s longest natural sea beach, with golden sand, fresh coastal seafood, and calming sunsets along Marine Drive.',
      category: 'Beach',
      estimatedBudget: 9200,
      image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1000&q=85',
    },
    {
      name: 'Sylhet',
      division: 'Sylhet Division',
      district: 'Sylhet',
      description: 'A serene expanse of emerald tea estates, crystal clear freshwater rivers, and rich culinary culture.',
      category: 'Culture',
      estimatedBudget: 8500,
      image: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1000&q=85',
    },
    {
      name: 'Bandarban',
      division: 'Chattogram Division',
      district: 'Bandarban',
      description: 'Misty green peaks, authentic indigenous villages, cloud ridges, and remote trails for adventurous spirits.',
      category: 'Adventure',
      estimatedBudget: 14500,
      image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1000&q=85',
    },
    {
      name: 'Sajek Valley',
      division: 'Chattogram Division',
      district: 'Rangamati',
      description: 'Cloud country for a slow reset, sunrise viewpoints above an ocean of clouds, and cozy hill-cottage stays.',
      category: 'Nature',
      estimatedBudget: 5800,
      image: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=1000&q=85',
    },
    {
      name: 'Sundarbans',
      division: 'Khulna Division',
      district: 'Bagerhat',
      description: 'The majestic UNESCO World Heritage mangrove forest, tidal waterways, Royal Bengal tigers, and serene boat expeditions.',
      category: 'Wildlife',
      estimatedBudget: 28000,
      image: 'https://images.unsplash.com/photo-1473445361085-b9a07f55608b?w=1000&q=85',
    },
    {
      name: 'Sreemangal',
      division: 'Sylhet Division',
      district: 'Moulvibazar',
      description: 'The tea capital of Bangladesh, featuring Lawachara National Park, seven-layer tea, and peaceful cycling trails.',
      category: 'Nature',
      estimatedBudget: 6500,
      image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1000&q=85',
    },
    {
      name: 'Rangamati',
      division: 'Chattogram Division',
      district: 'Rangamati',
      description: 'Sparkling Kaptai Lake, hanging bridge, Shuvolong waterfalls, and indigenous cultural markets.',
      category: 'Culture',
      estimatedBudget: 7500,
      image: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?w=1000&q=85',
    },
  ]

  const destIds: Record<string, string> = {}

  for (const d of destinations) {
    const existing = await pool.query('SELECT id FROM destinations WHERE name = $1', [d.name])
    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE destinations SET division = $1, district = $2, description = $3, category = $4, estimated_budget = $5, image = $6 WHERE id = $7',
        [d.division, d.district, d.description, d.category, d.estimatedBudget, d.image, existing.rows[0].id]
      )
      destIds[d.name] = existing.rows[0].id
    } else {
      const created = await pool.query(
        'INSERT INTO destinations (name, division, district, description, category, estimated_budget, image) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [d.name, d.division, d.district, d.description, d.category, d.estimatedBudget, d.image]
      )
      destIds[d.name] = created.rows[0].id
    }
  }

  // 4. Achievements
  const achievements = [
    { code: 'FIRST_DESTINATION', title: 'First Destination', description: 'Began your journey by recording your first explored place.' },
    { code: 'FIVE_DISTRICTS', title: 'District Explorer', description: 'Explored 5 different districts across Bangladesh.' },
    { code: 'TEN_DISTRICTS', title: 'Seasoned Wanderer', description: 'Reached 10 explored districts across Bangladesh.' },
    { code: 'GROUP_EXPEDITION', title: 'Trail Companion', description: 'Participated in a group expedition.' },
    { code: 'BUDGET_MASTER', title: 'Budget Master', description: 'Kept trip expenses strictly within the planned budget.' },
    { code: 'TRAVEL_WRITER', title: 'Storyteller', description: 'Wrote travel journal memories and notes.' },
  ]

  for (const a of achievements) {
    await pool.query(
      `INSERT INTO travel_achievements (code, title, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description`,
      [a.code, a.title, a.description]
    )
  }

  // Unlock some achievements for traveler
  const achRows = (await pool.query('SELECT id, code FROM travel_achievements')).rows
  for (const ach of achRows.slice(0, 3)) {
    await pool.query(
      `INSERT INTO user_achievements (user_id, achievement_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userIds['traveler@porikroma.com'], ach.id]
    )
  }

  // 5. Passport entries for Rafi
  const passportPlaces = ["Cox's Bazar", 'Sylhet', 'Bandarban', 'Sajek Valley']
  for (const place of passportPlaces) {
    if (destIds[place]) {
      await pool.query(
        `INSERT INTO passport_entries (user_id, destination_id, visited_on, visibility)
         VALUES ($1, $2, '2024-10-15', 'PUBLIC')
         ON CONFLICT (user_id, destination_id) DO NOTHING`,
        [userIds['traveler@porikroma.com'], destIds[place]]
      )
    }
  }

  // 6. Wishlist destinations for Rafi
  for (const place of ['Sundarbans', 'Sreemangal']) {
    if (destIds[place]) {
      await pool.query(
        `INSERT INTO wishlist_destinations (user_id, destination_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userIds['traveler@porikroma.com'], destIds[place]]
      )
    }
  }

  // 7. Trips for Rafi
  // Trip 1: Cox's Bazar escape (Upcoming)
  const trip1 = (
    await pool.query(
      `INSERT INTO trips (creator_id, destination_id, name, start_date, end_date, status, visibility, budget, description)
       VALUES ($1, $2, 'Cox’s Bazar escape', '2025-05-18', '2025-05-22', 'UPCOMING', 'PUBLIC', 32700, 'A slow coastal getaway with sunrise beach walks and seafood dinners.')
       RETURNING id`,
      [userIds['traveler@porikroma.com'], destIds["Cox's Bazar"]]
    )
  ).rows[0]

  await pool.query(
    `INSERT INTO trip_members (trip_id, user_id, role)
     VALUES ($1, $2, 'OWNER'), ($1, $3, 'MEMBER')
     ON CONFLICT DO NOTHING`,
    [trip1.id, userIds['traveler@porikroma.com'], userIds['traveler2@porikroma.com']]
  )

  // Trip 2: The tea garden days (Completed)
  const trip2 = (
    await pool.query(
      `INSERT INTO trips (creator_id, destination_id, name, start_date, end_date, status, visibility, budget, description)
       VALUES ($1, $2, 'The tea garden days', '2024-10-04', '2024-10-07', 'COMPLETED', 'PUBLIC', 28000, 'A gentle week of tea gardens, river air, and unhurried mornings in Sylhet.')
       RETURNING id`,
      [userIds['traveler@porikroma.com'], destIds['Sylhet']]
    )
  ).rows[0]

  await pool.query(
    `INSERT INTO trip_members (trip_id, user_id, role)
     VALUES ($1, $2, 'OWNER'), ($1, $3, 'MEMBER')
     ON CONFLICT DO NOTHING`,
    [trip2.id, userIds['traveler@porikroma.com'], userIds['planner@porikroma.com']]
  )

  // Trip 3: Bandarban Keokradong Trek (Planning)
  const trip3 = (
    await pool.query(
      `INSERT INTO trips (creator_id, destination_id, name, start_date, end_date, status, visibility, budget, description)
       VALUES ($1, $2, 'Bandarban Keokradong Ridge', '2025-09-14', '2025-09-18', 'PLANNING', 'PUBLIC', 22000, 'Trekking to Boga Lake and Keokradong summit with local indigenous guides.')
       RETURNING id`,
      [userIds['traveler@porikroma.com'], destIds['Bandarban']]
    )
  ).rows[0]

  await pool.query(
    `INSERT INTO trip_members (trip_id, user_id, role)
     VALUES ($1, $2, 'OWNER')
     ON CONFLICT DO NOTHING`,
    [trip3.id, userIds['traveler@porikroma.com']]
  )

  // Itinerary items for Trip 1
  const trip1Items = [
    { dayDate: '2025-05-18', title: 'Arrival & check-in at Kolatoli', location: 'Mermaid Eco Resort', notes: 'Check in, settle in, evening beach stroll', sortOrder: 1 },
    { dayDate: '2025-05-19', title: 'Marine Drive sunrise cruise & Himchari', location: 'Himchari National Park', notes: 'Walk up the stairs for panoramic ocean view', sortOrder: 2 },
    { dayDate: '2025-05-20', title: 'Inani coral beach & fresh coconut water', location: 'Inani Beach', notes: 'Take open hood jeep along the Marine Drive', sortOrder: 3 },
    { dayDate: '2025-05-21', title: 'Local fish barbecue & night market', location: 'Salt & Pepper Grill', notes: 'Sample fresh grilled rupchanda and crab', sortOrder: 4 },
  ]
  for (const it of trip1Items) {
    await pool.query(
      `INSERT INTO trip_itinerary_items (trip_id, day_date, title, location, notes, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [trip1.id, it.dayDate, it.title, it.location, it.notes, it.sortOrder]
    )
  }

  // Checklist items for Trip 1
  const trip1Checklist = [
    { title: 'Breathable linen clothes & sun hat', completed: true },
    { title: 'Reef-safe sunscreen and sunglasses', completed: true },
    { title: 'Waterproof dry bag for beach outings', completed: false },
    { title: 'Cash for beachside coconut vendors', completed: true },
    { title: 'Camera & extra memory card', completed: false },
  ]
  for (const ch of trip1Checklist) {
    await pool.query(
      `INSERT INTO trip_checklists (trip_id, title, completed, created_by)
       VALUES ($1, $2, $3, $4)`,
      [trip1.id, ch.title, ch.completed, userIds['traveler@porikroma.com']]
    )
  }

  // Notes for Trip 1
  const trip1Notes = [
    'Best sunset angle is by the fishing boat docks at South Beach around 5:45 PM.',
    'Keep emergency contact for resort shuttle handy: +880 1711 000000.',
    'Recommended lunch spot: Jhaoban Restaurant for traditional mashed dishes (vortas).',
  ]
  for (const n of trip1Notes) {
    await pool.query(
      `INSERT INTO trip_notes (trip_id, author_id, body)
       VALUES ($1, $2, $3)`,
      [trip1.id, userIds['traveler@porikroma.com'], n]
    )
  }

  // Map places for Trip 1
  const trip1Places = [
    { name: 'Kolatoli Point', category: 'Beach', notes: 'Main surf and beach stretch with great sunset', lat: 21.4172, lng: 91.9813 },
    { name: 'Inani Beach', category: 'Nature', notes: 'Coral stone beach with fewer crowds', lat: 21.3056, lng: 92.0528 },
    { name: 'Himchari Waterfall & Peak', category: 'Sightseeing', notes: 'Panoramic hillside overlooking the Bay of Bengal', lat: 21.3611, lng: 92.0194 },
    { name: 'Salt & Pepper Coastal Dining', category: 'Dining', notes: 'Fresh local seafood grill', lat: 21.4231, lng: 91.9792 },
  ]
  for (const p of trip1Places) {
    await pool.query(
      `INSERT INTO trip_map_places (trip_id, name, category, notes, lat, lng)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [trip1.id, p.name, p.category, p.notes, p.lat, p.lng]
    )
  }

  // Expenses for Trip 1
  const trip1Expenses = [
    { title: 'Resort booking deposit', category: 'Stay', amount: 14500, paidBy: userIds['traveler@porikroma.com'], expenseDate: '2025-05-18' },
    { title: 'Private vehicle transfer from airport', category: 'Transport', amount: 3500, paidBy: userIds['traveler@porikroma.com'], expenseDate: '2025-05-18' },
    { title: 'Dinner at Salt & Pepper', category: 'Food & drink', amount: 3200, paidBy: userIds['traveler2@porikroma.com'], expenseDate: '2025-05-19' },
    { title: 'Inani open-hood jeep hire', category: 'Activities', amount: 2500, paidBy: userIds['traveler@porikroma.com'], expenseDate: '2025-05-20' },
    { title: 'Beachside coffee and coconuts', category: 'Food & drink', amount: 800, paidBy: userIds['traveler@porikroma.com'], expenseDate: '2025-05-20' },
  ]
  for (const exp of trip1Expenses) {
    await pool.query(
      `INSERT INTO expenses (trip_id, paid_by, title, category, amount, expense_date)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [trip1.id, exp.paidBy, exp.title, exp.category, exp.amount, exp.expenseDate]
    )
  }

  // Settlements for Trip 1
  await pool.query(
    `INSERT INTO expense_settlements (trip_id, from_user_id, to_user_id, amount, status)
     VALUES ($1, $2, $3, 1600, 'PENDING')`,
    [trip1.id, userIds['traveler2@porikroma.com'], userIds['traveler@porikroma.com']]
  )

  // 8. Group travel expeditions
  // Group 1: The slow road through Sylhet (organized by Nadia)
  const group1 = (
    await pool.query(
      `INSERT INTO groups (trip_id, organizer_id, title, capacity, budget_per_person, published)
       VALUES ($1, $2, 'The slow road through Sylhet', 6, 8500, true)
       RETURNING id`,
      [trip2.id, userIds['planner@porikroma.com']]
    )
  ).rows[0]

  await pool.query(
    `INSERT INTO group_members (group_id, user_id)
     VALUES ($1, $2), ($1, $3)
     ON CONFLICT DO NOTHING`,
    [group1.id, userIds['planner@porikroma.com'], userIds['traveler@porikroma.com']]
  )

  // Group 2: Bandarban Keokradong Expedition (organized by Nadia)
  const group2 = (
    await pool.query(
      `INSERT INTO groups (trip_id, organizer_id, title, capacity, budget_per_person, published)
       VALUES ($1, $2, 'Bandarban Keokradong & Boga Lake Ridge', 8, 14500, true)
       RETURNING id`,
      [trip3.id, userIds['planner@porikroma.com']]
    )
  ).rows[0]

  await pool.query(
    `INSERT INTO group_members (group_id, user_id)
     VALUES ($1, $2), ($1, $3)
     ON CONFLICT DO NOTHING`,
    [group2.id, userIds['planner@porikroma.com'], userIds['traveler2@porikroma.com']]
  )

  // Applications
  await pool.query(
    `INSERT INTO applications (group_id, applicant_id, status, answers)
     VALUES ($1, $2, 'PENDING', '{"experience": "Hiked in Sajek and Bandarban before.", "diet": "None", "commitment": "Yes, confirmed available."}')
     ON CONFLICT (group_id, applicant_id) DO NOTHING`,
    [group2.id, userIds['traveler@porikroma.com']]
  )

  // Group messages
  const groupMessages = [
    { sender: userIds['planner@porikroma.com'], body: 'Welcome everyone to the slow road through Sylhet! Excited to lead this journey.' },
    { sender: userIds['traveler@porikroma.com'], body: 'Looking forward to the tea estate sunrise trails. What time do we meet at the Sylhet airport?' },
    { sender: userIds['planner@porikroma.com'], body: 'We have our private microbus arriving at 10:30 AM right outside Terminal 1.' },
  ]
  for (const m of groupMessages) {
    await pool.query(
      `INSERT INTO group_messages (group_id, sender_id, body)
       VALUES ($1, $2, $3)`,
      [group1.id, m.sender, m.body]
    )
  }

  // 9. Tours for Tour Planner
  const tour1 = (
    await pool.query(
      `INSERT INTO tours (planner_id, destination_id, title, description, price, capacity, status)
       VALUES ($1, $2, 'Sylhet Tea Country & Swamp Forest Odyssey', 'A curated 4-day immersive exploration across Sreemangal tea estates and Ratargul swamp forest.', 8500, 12, 'PUBLISHED')
       RETURNING id`,
      [userIds['planner@porikroma.com'], destIds['Sylhet']]
    )
  ).rows[0]

  const departure1 = (
    await pool.query(
      `INSERT INTO tour_departures (tour_id, start_date, end_date, capacity, status)
       VALUES ($1, '2025-06-12', '2025-06-15', 12, 'OPEN')
       RETURNING id`,
      [tour1.id]
    )
  ).rows[0]

  // Booking for traveler on departure1
  await pool.query(
    `INSERT INTO bookings (departure_id, traveler_id, status, travelers_count)
     VALUES ($1, $2, 'CONFIRMED', 2)
     ON CONFLICT (departure_id, traveler_id) DO NOTHING`,
    [departure1.id, userIds['traveler@porikroma.com']]
  )

  const tour2 = (
    await pool.query(
      `INSERT INTO tours (planner_id, destination_id, title, description, price, capacity, status)
       VALUES ($1, $2, 'Bandarban Cloud Peaks & Indigenous Trails', 'Challenging high-altitude trek visiting Boga Lake, Keokradong, and Saka Haphong with certified mountaineers.', 16500, 8, 'PUBLISHED')
       RETURNING id`,
      [userIds['planner@porikroma.com'], destIds['Bandarban']]
    )
  ).rows[0]

  await pool.query(
    `INSERT INTO tour_departures (tour_id, start_date, end_date, capacity, status)
     VALUES ($1, '2025-10-20', '2025-10-25', 8, 'OPEN')`,
    [tour2.id]
  )

  // 10. Community Posts
  const communityPosts = [
    {
      author: userIds['traveler@porikroma.com'],
      body: 'Quiet morning along Inani beach. The low tide reveals untouched coral reefs and tide pools. Bangladesh coastlines have so much gentle beauty when you step away from crowded central points.',
    },
    {
      author: userIds['planner@porikroma.com'],
      body: 'Essential advice for visiting Ratargul Freshwater Swamp during monsoon: Always hire local boatmen who know current water depths, wear life vests, and avoid loud music so birds and wildlife aren’t disturbed.',
    },
    {
      author: userIds['traveler2@porikroma.com'],
      body: 'Just completed the trek up Konglak Hill in Sajek Valley before dawn. The cloud layer rolling over the green ridges was breathtaking. Warm tea at the peak is 10/10 recommended.',
    },
  ]

  for (const post of communityPosts) {
    const p = (
      await pool.query(
        `INSERT INTO community_posts (author_id, body, visibility)
         VALUES ($1, $2, 'PUBLIC')
         RETURNING id`,
        [post.author, post.body]
      )
    ).rows[0]

    // Add reactions
    await pool.query(
      `INSERT INTO community_reactions (post_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [p.id, userIds['traveler@porikroma.com']]
    )

    // Add comment
    await pool.query(
      `INSERT INTO community_comments (post_id, author_id, body)
       VALUES ($1, $2, 'Wonderful reflection! So true regarding responsible pacing.')`,
      [p.id, userIds['planner@porikroma.com']]
    )
  }

  // 11. Traveler review
  await pool.query(
    `INSERT INTO traveler_reviews (trip_id, reviewer_id, reviewed_user_id, communication, punctuality, reliability, teamwork, respectfulness, cooperation, responsibility, overall, body)
     VALUES ($1, $2, $3, 5, 5, 5, 5, 5, 5, 5, 5, 'Rafi was an exceptional expedition companion. Always respectful of local guides and kept a patient, kind spirit throughout.')
     ON CONFLICT (trip_id, reviewer_id, reviewed_user_id) DO NOTHING`,
    [trip2.id, userIds['planner@porikroma.com'], userIds['traveler@porikroma.com']]
  )

  // 12. Destination reviews
  if (destIds["Cox's Bazar"]) {
    await pool.query(
      `INSERT INTO reviews (destination_id, author_id, rating, body)
       VALUES ($1, $2, 5, 'Incredible vastness and calming atmosphere along Marine drive.')
       ON CONFLICT (destination_id, author_id) DO NOTHING`,
      [destIds["Cox's Bazar"], userIds['traveler@porikroma.com']]
    )
  }

  if (destIds['Sylhet']) {
    await pool.query(
      `INSERT INTO reviews (destination_id, author_id, rating, body)
       VALUES ($1, $2, 5, 'The tea gardens and Lalakhal river water are paradise.')
       ON CONFLICT (destination_id, author_id) DO NOTHING`,
      [destIds['Sylhet'], userIds['traveler2@porikroma.com']]
    )
  }

  // 13. Notifications for Rafi
  const notifs = [
    { type: 'TRIP_INVITATION', detail: 'Samira invited you to join Bandarban Keokradong Ridge', link: `/trips/${trip1.id}` },
    { type: 'TRAVELER_REVIEW', detail: 'Nadia Rahman left you a 5.0 traveler review for The tea garden days', link: '/profile' },
    { type: 'EXPENSE_ADDED', detail: 'Samira added "Dinner at Salt & Pepper" (৳3,200) to Cox’s Bazar escape', link: `/trips/${trip1.id}/expenses` },
  ]
  for (const n of notifs) {
    await pool.query(
      `INSERT INTO notifications (user_id, type, detail, link, read)
       VALUES ($1, $2, $3, $4, false)`,
      [userIds['traveler@porikroma.com'], n.type, n.detail, n.link]
    )
  }

  // 14. Verification request for admin
  await pool.query(
    `INSERT INTO verification_requests (user_id, status, note)
     VALUES ($1, 'PENDING', 'Applying for official verified Tour Planner badge with 10 years licensed experience in Sylhet & Chittagong Hill Tracts.')`,
    [userIds['planner@porikroma.com']]
  )

  // 15. User report for admin
  await pool.query(
    `INSERT INTO user_reports (reporter_id, reported_user_id, reason)
     VALUES ($1, $2, 'Inappropriate promotional spam posted in community discussion.')`,
    [userIds['traveler@porikroma.com'], userIds['traveler2@porikroma.com']]
  )

  // 16. AI conversation
  const aiConvo = (
    await pool.query(
      `INSERT INTO ai_conversations (user_id, title)
       VALUES ($1, 'A quiet weekend in Sylhet')
       RETURNING id`,
      [userIds['traveler@porikroma.com']]
    )
  ).rows[0]

  await pool.query(
    `INSERT INTO ai_messages (conversation_id, sender, body)
     VALUES
     ($1, 'USER', 'What are the best slow travel spots in Sylhet for 3 days on a ৳10,000 budget?'),
     ($1, 'ASSISTANT', 'For a slow, reflective 3 days in Sylhet under ৳10,000, I recommend focusing on Sreemangal and Lalakhal rather than rushing through every town. Day 1: Arrive via Parabat Express train (approx ৳450), stay in an eco-cottage near Radhanagar (৳2,500/night). Day 2: Early morning walk in Lawachara Rainforest before tour buses arrive, followed by fresh seven-color tea and local tribal culinary spread. Day 3: Hire a shared local boat at Lalakhal for emerald river reflections before heading home. Total estimated cost: ৳8,200 with ample buffer for local delicacies.')`,
    [aiConvo.id]
  )

  console.log('Database seeded successfully with rich test data!')
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Seeding error:', err)
    pool.end()
    process.exit(1)
  })
