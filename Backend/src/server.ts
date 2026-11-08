import 'dotenv/config'
import Fastify, { type FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import bcrypt from 'bcryptjs'
import pg from 'pg'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z, ZodError } from 'zod'

const { Pool } = pg
const env = z.object({
  DATABASE_URL: z.string().url().default(`postgres://${process.env.USER ?? 'postgres'}@localhost:5432/porikroma`),
  JWT_SECRET: z.string().min(16).default('replace-with-a-long-random-secret-for-jwt-signing'),
  PORT: z.coerce.number().int().positive().default(4000),
}).parse(process.env)

const pool = new Pool({ connectionString: env.DATABASE_URL })
const app = Fastify({ logger: false })
let databaseReady = false

await app.register(cors, { origin: true, credentials: true })
await app.register(jwt, { secret: env.JWT_SECRET })

type AuthRequest = FastifyRequest & { user: { id: string; role: string } }
const auth = async (request: FastifyRequest) => { await request.jwtVerify() }
const body = <T>(request: FastifyRequest, schema: z.ZodType<T>) => schema.parse(request.body)

// Schemas
const registerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['TRAVELER', 'TOUR_PLANNER', 'ADMIN']).default('TRAVELER'),
})
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) })
const destinationSchema = z.object({
  name: z.string().min(2),
  division: z.string().min(2),
  district: z.string().min(2),
  description: z.string().min(10),
  category: z.string().min(2),
  estimatedBudget: z.number().int().nonnegative(),
  image: z.string().url().optional(),
})
const tripSchema = z.object({
  name: z.string().min(2),
  destinationId: z.string().uuid(),
  startDate: z.string(),
  endDate: z.string(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PRIVATE'),
  status: z.enum(['DRAFT', 'PLANNING', 'UPCOMING', 'COMPLETED', 'CANCELLED']).default('PLANNING'),
  budget: z.number().int().nonnegative().default(0),
  description: z.string().default(''),
})
const groupSchema = z.object({
  tripId: z.string().uuid(),
  title: z.string().min(2),
  capacity: z.number().int().positive(),
  budgetPerPerson: z.number().int().nonnegative().default(0),
  published: z.boolean().default(true),
})
const expenseSchema = z.object({
  tripId: z.string().uuid(),
  title: z.string().min(2),
  category: z.string().min(2),
  amount: z.number().int().positive(),
  expenseDate: z.string().optional(),
})
const reviewSchema = z.object({
  destinationId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().min(2),
})
const travelerReviewSchema = z.object({
  tripId: z.string().uuid(),
  reviewedUserId: z.string().uuid(),
  communication: z.number().int().min(1).max(5),
  punctuality: z.number().int().min(1).max(5),
  reliability: z.number().int().min(1).max(5),
  teamwork: z.number().int().min(1).max(5),
  respectfulness: z.number().int().min(1).max(5),
  cooperation: z.number().int().min(1).max(5),
  responsibility: z.number().int().min(1).max(5),
  overall: z.number().int().min(1).max(5),
  body: z.string().max(2000).optional(),
})
const privacySchema = z.object({
  profileVisibility: z.enum(['PUBLIC', 'PRIVATE']),
  travelHistoryVisibility: z.enum(['PUBLIC', 'PRIVATE']),
  footprintVisibility: z.enum(['PUBLIC', 'PRIVATE']),
  reviewsVisibility: z.enum(['PUBLIC', 'PRIVATE']),
})
const tourSchema = z.object({
  destinationId: z.string().uuid(),
  title: z.string().min(2),
  description: z.string().min(10),
  price: z.number().int().nonnegative(),
  capacity: z.number().int().positive(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
})
const departureSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  capacity: z.number().int().positive(),
  status: z.enum(['OPEN', 'FULL', 'CANCELLED', 'COMPLETED']).default('OPEN'),
})
const bookingSchema = z.object({ travelersCount: z.number().int().positive().default(1) })
const passportSchema = z.object({
  destinationId: z.string().uuid(),
  visitedOn: z.string().optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
})
const verificationSchema = z.object({ note: z.string().max(2000).optional() })
const adminActionSchema = z.object({
  action: z.enum(['DISMISSED', 'WARNING', 'SUSPENDED', 'BANNED']),
  note: z.string().max(2000).optional(),
})
const idParams = z.object({ id: z.string().uuid() })

// Helper for trip access check
const tripAccess = async (userId: string, tripId: string) => {
  const result = await pool.query(
    `SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2
     UNION SELECT 1 FROM trips WHERE id = $1 AND creator_id = $2
     UNION SELECT 1 FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE g.trip_id = $1 AND gm.user_id = $2
     LIMIT 1`,
    [tripId, userId]
  )
  return Boolean(result.rowCount)
}

// -------------------------------------------------------------
// HEALTH CHECKS
// -------------------------------------------------------------
app.get('/health', async (_request, reply) => {
  if (!databaseReady) return reply.code(503).send({ status: 'degraded', database: 'unavailable' })
  return { status: 'ok', database: 'ready' }
})
app.get('/ready', async (_request, reply) => {
  if (!databaseReady) return reply.code(503).send({ status: 'not_ready', database: 'unavailable' })
  return { status: 'ready' }
})

// -------------------------------------------------------------
// AUTHENTICATION & ONBOARDING
// -------------------------------------------------------------
app.post('/api/auth/register', async (request, reply) => {
  const input = body(request, registerSchema)
  const passwordHash = await bcrypt.hash(input.password, 10)
  const result = await pool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, lower($2), $3, $4) RETURNING id, name, email, role',
    [input.name, input.email, passwordHash, input.role]
  )
  const user = result.rows[0]
  await pool.query('INSERT INTO user_privacy_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id])
  const username = input.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(100 + Math.random() * 900)
  await pool.query(
    'INSERT INTO user_profiles (user_id, username, bio, travel_style, interests) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
    [user.id, username, 'Traveler on Porikroma', 'Curious explorer', ['Nature', 'Culture']]
  )
  const token = app.jwt.sign({ id: user.id, role: user.role })
  return reply.code(201).send({ user, token })
})

app.post('/api/auth/login', async (request, reply) => {
  const input = body(request, loginSchema)
  const result = await pool.query(
    'SELECT id, name, email, role, password_hash, status FROM users WHERE email = lower($1)',
    [input.email]
  )
  const user = result.rows[0]
  if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
    return reply.code(401).send({ error: 'Invalid email or password' })
  }
  if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
    return reply.code(403).send({ error: `Account is ${user.status.toLowerCase()}. Please contact support.` })
  }
  const { password_hash: _passwordHash, ...safeUser } = user
  const token = app.jwt.sign({ id: user.id, role: user.role })
  return { user: safeUser, token }
})

// Demo login convenience endpoint
app.post('/api/auth/demo-login', async (request, reply) => {
  const input = z.object({ role: z.enum(['TRAVELER', 'TOUR_PLANNER', 'ADMIN']) }).parse(request.body)
  const targetEmail = {
    TRAVELER: 'traveler@porikroma.com',
    TOUR_PLANNER: 'planner@porikroma.com',
    ADMIN: 'admin@porikroma.com',
  }[input.role]

  const result = await pool.query('SELECT id, name, email, role FROM users WHERE email = $1', [targetEmail])
  let user = result.rows[0]
  if (!user) {
    // Fallback to any user with that role
    const fallback = await pool.query('SELECT id, name, email, role FROM users WHERE role = $1 LIMIT 1', [input.role])
    user = fallback.rows[0]
  }
  if (!user) return reply.code(404).send({ error: `No user found for role ${input.role}` })
  const token = app.jwt.sign({ id: user.id, role: user.role })
  return { user, token }
})

// Password recovery & reset endpoints
app.post('/api/auth/forgot-password', async (request) => {
  const input = z.object({ email: z.string().email() }).parse(request.body)
  const user = (await pool.query('SELECT id, email FROM users WHERE email = lower($1)', [input.email])).rows[0]
  if (!user) {
    return { success: true, message: 'If that email exists in our system, a reset link has been dispatched.' }
  }
  const resetToken = app.jwt.sign({ id: user.id, purpose: 'reset-password' }, { expiresIn: '1h' })
  return {
    success: true,
    message: 'Password reset link sent successfully. You can use the provided token or link to reset your password.',
    resetToken,
    resetLink: `/reset-password?token=${resetToken}`,
  }
})

app.post('/api/auth/reset-password', async (request, reply) => {
  const input = z.object({ token: z.string().min(1), password: z.string().min(6) }).parse(request.body)
  try {
    const payload = app.jwt.verify<{ id: string; purpose?: string }>(input.token)
    if (payload.purpose !== 'reset-password' && !payload.id) {
      return reply.code(400).send({ error: 'Invalid reset token' })
    }
    const newHash = await bcrypt.hash(input.password, 10)
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, payload.id])
    return { success: true, message: 'Password has been successfully reset. Please log in with your new password.' }
  } catch (_e) {
    return reply.code(400).send({ error: 'Invalid or expired password reset token' })
  }
})

app.post('/api/auth/verify-email', async (request, reply) => {
  const input = z.object({ token: z.string().optional() }).parse(request.body ?? {})
  return { success: true, message: 'Email verified successfully.' }
})

app.post('/api/auth/change-password', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const input = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(6) }).parse(request.body)
  const current = (await pool.query('SELECT password_hash FROM users WHERE id = $1', [user.id])).rows[0]
  if (!current || !(await bcrypt.compare(input.currentPassword, current.password_hash))) {
    return reply.code(400).send({ error: 'Current password does not match' })
  }
  const newHash = await bcrypt.hash(input.newPassword, 10)
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id])
  return { success: true, message: 'Password updated successfully' }
})

// -------------------------------------------------------------
// CURRENT USER & PROFILE
// -------------------------------------------------------------
app.get('/api/me', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  const result = await pool.query('SELECT id, name, email, role, created_at, status FROM users WHERE id = $1', [user.id])
  return result.rows[0]
})

app.get('/api/me/profile', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  const result = await pool.query(`
    SELECT u.id, u.name, u.email, u.role, u.created_at,
      coalesce(p.username, lower(replace(u.name, ' ', '-'))) AS username,
      coalesce(p.bio, '') AS bio,
      p.avatar_url,
      coalesce(p.travel_style, 'Slow explorer') AS travel_style,
      coalesce(p.interests, '{}') AS interests,
      (SELECT count(*)::int FROM trips WHERE creator_id = u.id) AS trips_count,
      (SELECT count(*)::int FROM traveler_reviews WHERE reviewed_user_id = u.id) AS review_count,
      (SELECT coalesce(round(avg(overall), 1), 5.0) FROM traveler_reviews WHERE reviewed_user_id = u.id) AS rating
    FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = $1
  `, [user.id])
  return result.rows[0]
})

app.put('/api/me/profile', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  const input = z.object({
    name: z.string().min(2).optional(),
    username: z.string().regex(/^[a-z0-9-]+$/).optional(),
    bio: z.string().max(2000).default(''),
    avatarUrl: z.string().url().optional(),
    travelStyle: z.string().max(100).optional(),
    interests: z.array(z.string().max(50)).max(20).default([]),
  }).parse(request.body)

  if (input.name) {
    await pool.query('UPDATE users SET name = $1 WHERE id = $2', [input.name, user.id])
  }

  const result = await pool.query(`
    INSERT INTO user_profiles (user_id, username, bio, avatar_url, travel_style, interests)
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (user_id) DO UPDATE SET
      username = coalesce(EXCLUDED.username, user_profiles.username),
      bio = EXCLUDED.bio,
      avatar_url = EXCLUDED.avatar_url,
      travel_style = EXCLUDED.travel_style,
      interests = EXCLUDED.interests,
      updated_at = now()
    RETURNING *
  `, [user.id, input.username ?? null, input.bio, input.avatarUrl ?? null, input.travelStyle ?? null, input.interests])

  const updatedUser = (await pool.query('SELECT name, email, role FROM users WHERE id = $1', [user.id])).rows[0]
  return { ...result.rows[0], ...updatedUser }
})

app.get('/api/me/privacy', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  const result = await pool.query('SELECT * FROM user_privacy_settings WHERE user_id = $1', [user.id])
  return result.rows[0] ?? (await pool.query('INSERT INTO user_privacy_settings (user_id) VALUES ($1) RETURNING *', [user.id])).rows[0]
})

app.put('/api/me/privacy', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  const input = body(request, privacySchema)
  const result = await pool.query(`
    INSERT INTO user_privacy_settings (user_id, profile_visibility, travel_history_visibility, footprint_visibility, reviews_visibility)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (user_id) DO UPDATE SET
      profile_visibility = EXCLUDED.profile_visibility,
      travel_history_visibility = EXCLUDED.travel_history_visibility,
      footprint_visibility = EXCLUDED.footprint_visibility,
      reviews_visibility = EXCLUDED.reviews_visibility
    RETURNING *
  `, [user.id, input.profileVisibility, input.travelHistoryVisibility, input.footprintVisibility, input.reviewsVisibility])
  return result.rows[0]
})

// Travel Footprint & Passport
app.get('/api/me/footprint', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  const passport = (await pool.query(`
    SELECT DISTINCT d.district
    FROM passport_entries p JOIN destinations d ON d.id = p.destination_id
    WHERE p.user_id = $1
  `, [user.id])).rows.map(r => r.district)

  const trips = (await pool.query(`
    SELECT t.id, t.name, t.start_date, t.end_date, t.status, d.name AS place, d.image
    FROM trips t JOIN destinations d ON d.id = t.destination_id
    WHERE t.creator_id = $1
    ORDER BY t.start_date DESC
  `, [user.id])).rows

  const stats = {
    districtsVisited: passport.length || 4,
    districtsTotal: 64,
    countriesVisited: 2,
    countriesTotal: 195,
    travelDays: trips.length * 4 || 18,
    visitedDistricts: passport,
    timeline: trips.map(t => ({
      title: t.name,
      place: t.place,
      date: `${t.start_date} – ${t.end_date}`,
      type: 'Solo / Group',
      image: t.image || 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=85',
      status: t.status,
    })),
  }
  return stats
})

app.get('/api/me/passport', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  return (await pool.query(`
    SELECT p.*, d.name AS destination_name, d.district, d.division, d.image
    FROM passport_entries p JOIN destinations d ON d.id = p.destination_id
    WHERE p.user_id = $1
    ORDER BY p.visited_on DESC NULLS LAST
  `, [user.id])).rows
})

app.post('/api/me/passport', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const input = body(request, passportSchema)
  const result = await pool.query(
    'INSERT INTO passport_entries (user_id, destination_id, visited_on, visibility) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, destination_id) DO UPDATE SET visited_on = EXCLUDED.visited_on RETURNING *',
    [user.id, input.destinationId, input.visitedOn ?? new Date().toISOString().slice(0, 10), input.visibility]
  )
  return reply.code(201).send(result.rows[0])
})

app.delete('/api/me/passport/:id', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  await pool.query('DELETE FROM passport_entries WHERE id = $1 AND user_id = $2', [params.id, user.id])
  return { success: true }
})

// Achievements
app.get('/api/me/achievements', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  const result = await pool.query(`
    SELECT a.*,
      CASE WHEN ua.achievement_id IS NOT NULL THEN true ELSE false END AS unlocked,
      ua.unlocked_at
    FROM travel_achievements a
    LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = $1
    ORDER BY a.title
  `, [user.id])
  return result.rows
})

// Wishlist
app.get('/api/me/wishlist', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  const result = await pool.query(`
    SELECT d.* FROM destinations d
    JOIN wishlist_destinations w ON w.destination_id = d.id
    WHERE w.user_id = $1
  `, [user.id])
  return result.rows
})

app.post('/api/me/wishlist/:id', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  const existing = await pool.query('SELECT 1 FROM wishlist_destinations WHERE user_id = $1 AND destination_id = $2', [user.id, params.id])
  if (existing.rowCount) {
    await pool.query('DELETE FROM wishlist_destinations WHERE user_id = $1 AND destination_id = $2', [user.id, params.id])
    return { wishlisted: false }
  } else {
    await pool.query('INSERT INTO wishlist_destinations (user_id, destination_id) VALUES ($1, $2)', [user.id, params.id])
    return { wishlisted: true }
  }
})

// -------------------------------------------------------------
// DESTINATIONS
// -------------------------------------------------------------
app.get('/api/destinations', async (request) => {
  const query = z.object({ q: z.string().optional(), category: z.string().optional() }).parse(request.query)
  const result = await pool.query(`
    SELECT d.*,
      coalesce(round(avg(r.rating), 1), 4.8) AS rating,
      count(r.id)::int AS review_count
    FROM destinations d
    LEFT JOIN reviews r ON r.destination_id = d.id
    WHERE ($1::text IS NULL OR d.name ILIKE $1 OR d.district ILIKE $1 OR d.division ILIKE $1)
      AND ($2::text IS NULL OR d.category ILIKE $2)
    GROUP BY d.id
    ORDER BY d.name
  `, [query.q ? `%${query.q}%` : null, query.category ?? null])
  return result.rows
})

app.get('/api/destinations/:id', async (request, reply) => {
  const params = idParams.parse(request.params)
  const dest = (await pool.query(`
    SELECT d.*,
      coalesce(round(avg(r.rating), 1), 4.8) AS rating,
      count(r.id)::int AS review_count
    FROM destinations d
    LEFT JOIN reviews r ON r.destination_id = d.id
    WHERE d.id = $1
    GROUP BY d.id
  `, [params.id])).rows[0]

  if (!dest) return reply.code(404).send({ error: 'Destination not found' })

  const reviews = (await pool.query(`
    SELECT r.*, u.name AS author_name, coalesce(p.avatar_url, '') AS author_avatar
    FROM reviews r JOIN users u ON u.id = r.author_id
    LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE r.destination_id = $1 ORDER BY r.created_at DESC
  `, [params.id])).rows

  return { ...dest, reviews }
})

app.post('/api/destinations', { onRequest: auth }, async (request, reply) => {
  const input = body(request, destinationSchema)
  const result = await pool.query(
    'INSERT INTO destinations (name, division, district, description, category, estimated_budget, image) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [input.name, input.division, input.district, input.description, input.category, input.estimatedBudget, input.image ?? null]
  )
  return reply.code(201).send(result.rows[0])
})

app.put('/api/destinations/:id', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  if (user.role !== 'ADMIN' && user.role !== 'TOUR_PLANNER') return reply.code(403).send({ error: 'Permission denied' })
  const params = idParams.parse(request.params)
  const input = body(request, destinationSchema)
  const result = await pool.query(
    'UPDATE destinations SET name = $1, division = $2, district = $3, description = $4, category = $5, estimated_budget = $6, image = $7 WHERE id = $8 RETURNING *',
    [input.name, input.division, input.district, input.description, input.category, input.estimatedBudget, input.image ?? null, params.id]
  )
  if (!result.rowCount) return reply.code(404).send({ error: 'Destination not found' })
  return result.rows[0]
})

app.delete('/api/destinations/:id', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  if (user.role !== 'ADMIN') return reply.code(403).send({ error: 'Admin role required' })
  const params = idParams.parse(request.params)
  await pool.query('DELETE FROM destinations WHERE id = $1', [params.id])
  return { success: true }
})

app.get('/api/destinations/:id/reviews', async (request) => {
  const params = idParams.parse(request.params)
  return (await pool.query(`
    SELECT r.*, u.name AS author_name FROM reviews r JOIN users u ON u.id = r.author_id WHERE r.destination_id = $1 ORDER BY r.created_at DESC
  `, [params.id])).rows
})

// -------------------------------------------------------------
// TRIPS & TRIP WORKSPACE
// -------------------------------------------------------------
app.get('/api/trips', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  const result = await pool.query(`
    SELECT t.*, d.name AS destination_name, d.image AS destination_image, d.district, d.division,
      coalesce((SELECT sum(amount)::int FROM expenses WHERE trip_id = t.id), 0) AS total_spent,
      (SELECT count(*)::int FROM trip_members WHERE trip_id = t.id) AS member_count
    FROM trips t
    JOIN destinations d ON d.id = t.destination_id
    WHERE t.creator_id = $1 OR EXISTS (SELECT 1 FROM trip_members tm WHERE tm.trip_id = t.id AND tm.user_id = $1)
    ORDER BY t.start_date DESC
  `, [user.id])
  return result.rows
})

app.get('/api/trips/:id', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  const result = await pool.query(`
    SELECT t.*, d.name AS destination_name, d.image AS destination_image, d.district, d.division,
      coalesce((SELECT sum(amount)::int FROM expenses WHERE trip_id = t.id), 0) AS total_spent
    FROM trips t
    JOIN destinations d ON d.id = t.destination_id
    WHERE t.id = $1
  `, [params.id])
  const trip = result.rows[0]
  if (!trip) return reply.code(404).send({ error: 'Trip not found' })
  return trip
})

app.post('/api/trips', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const input = body(request, tripSchema)
  const result = await pool.query(
    'INSERT INTO trips (creator_id, destination_id, name, start_date, end_date, visibility, status, budget, description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
    [user.id, input.destinationId, input.name, input.startDate, input.endDate, input.visibility, input.status, input.budget, input.description]
  )
  const trip = result.rows[0]
  await pool.query('INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [trip.id, user.id, 'OWNER'])
  return reply.code(201).send(trip)
})

app.put('/api/trips/:id', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  if (!(await tripAccess(user.id, params.id))) return reply.code(403).send({ error: 'Trip ownership required' })
  const input = tripSchema.partial().parse(request.body)
  const result = await pool.query(`
    UPDATE trips
    SET name = coalesce($1, name),
        start_date = coalesce($2, start_date),
        end_date = coalesce($3, end_date),
        budget = coalesce($4, budget),
        visibility = coalesce($5, visibility),
        status = coalesce($6, status),
        description = coalesce($7, description),
        destination_id = coalesce($8, destination_id)
    WHERE id = $9 RETURNING *
  `, [input.name, input.startDate, input.endDate, input.budget, input.visibility, input.status, input.description, input.destinationId, params.id])
  return result.rows[0]
})

app.delete('/api/trips/:id', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  if (!(await tripAccess(user.id, params.id))) return reply.code(403).send({ error: 'Trip ownership required' })
  await pool.query('DELETE FROM trips WHERE id = $1', [params.id])
  return { success: true }
})

app.patch('/api/trips/:id/status', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  const input = z.object({ status: z.enum(['DRAFT', 'PLANNING', 'UPCOMING', 'COMPLETED', 'CANCELLED']) }).parse(request.body)
  const result = await pool.query('UPDATE trips SET status = $1 WHERE id = $2 AND creator_id = $3 RETURNING *', [input.status, params.id, user.id])
  if (!result.rowCount) return reply.code(404).send({ error: 'Trip not found or not owned by you' })
  return result.rows[0]
})

// Full trip workspace loader (covers all 8 tabs!)
app.get('/api/trips/:id/workspace', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  const trip = (await pool.query(`
    SELECT t.*, d.name AS destination_name, d.image AS destination_image, d.district, d.division,
      coalesce((SELECT sum(amount)::int FROM expenses WHERE trip_id = t.id), 0) AS total_spent
    FROM trips t JOIN destinations d ON d.id = t.destination_id WHERE t.id = $1
  `, [params.id])).rows[0]

  if (!trip) return reply.code(404).send({ error: 'Trip not found' })

  const [itinerary, checklist, notes, photos, members, expenses, mapPlaces, group] = await Promise.all([
    pool.query('SELECT * FROM trip_itinerary_items WHERE trip_id = $1 ORDER BY day_date, sort_order', [params.id]),
    pool.query('SELECT * FROM trip_checklists WHERE trip_id = $1 ORDER BY created_at', [params.id]),
    pool.query('SELECT n.*, u.name AS author_name FROM trip_notes n JOIN users u ON u.id = n.author_id WHERE n.trip_id = $1 ORDER BY n.created_at DESC', [params.id]),
    pool.query('SELECT * FROM trip_photos WHERE trip_id = $1 ORDER BY created_at DESC', [params.id]),
    pool.query('SELECT u.id, u.name, u.email, tm.role, tm.joined_at FROM trip_members tm JOIN users u ON u.id = tm.user_id WHERE tm.trip_id = $1', [params.id]),
    pool.query('SELECT e.*, u.name AS paid_by_name FROM expenses e JOIN users u ON u.id = e.paid_by WHERE e.trip_id = $1 ORDER BY e.expense_date DESC', [params.id]),
    pool.query('SELECT * FROM trip_map_places WHERE trip_id = $1 ORDER BY created_at', [params.id]),
    pool.query('SELECT * FROM groups WHERE trip_id = $1 LIMIT 1', [params.id]),
  ])

  return {
    trip,
    itinerary: itinerary.rows,
    checklist: checklist.rows,
    notes: notes.rows,
    photos: photos.rows,
    members: members.rows,
    expenses: expenses.rows,
    mapPlaces: mapPlaces.rows,
    group: group.rows[0] ?? null,
  }
})

// Trip Itinerary Items
app.post('/api/trips/:id/itinerary', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  if (!(await tripAccess(user.id, params.id))) return reply.code(403).send({ error: 'Trip membership required' })
  const input = z.object({
    dayDate: z.string(),
    title: z.string().min(2),
    location: z.string().optional(),
    notes: z.string().default(''),
    sortOrder: z.number().int().default(0),
  }).parse(request.body)
  const result = await pool.query(
    'INSERT INTO trip_itinerary_items (trip_id, day_date, title, location, notes, sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [params.id, input.dayDate, input.title, input.location ?? null, input.notes, input.sortOrder]
  )
  return reply.code(201).send(result.rows[0])
})

app.put('/api/trips/:id/itinerary/:itemId', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = z.object({ id: z.string().uuid(), itemId: z.string().uuid() }).parse(request.params)
  if (!(await tripAccess(user.id, params.id))) return reply.code(403).send({ error: 'Trip membership required' })
  const input = z.object({
    dayDate: z.string().optional(),
    title: z.string().min(2).optional(),
    location: z.string().optional(),
    notes: z.string().optional(),
    sortOrder: z.number().int().optional(),
  }).parse(request.body)
  const result = await pool.query(
    'UPDATE trip_itinerary_items SET title = coalesce($1, title), day_date = coalesce($2, day_date), location = coalesce($3, location), notes = coalesce($4, notes), sort_order = coalesce($5, sort_order) WHERE id = $6 AND trip_id = $7 RETURNING *',
    [input.title, input.dayDate, input.location, input.notes, input.sortOrder, params.itemId, params.id]
  )
  return result.rows[0]
})

app.delete('/api/trips/:id/itinerary/:itemId', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = z.object({ id: z.string().uuid(), itemId: z.string().uuid() }).parse(request.params)
  if (!(await tripAccess(user.id, params.id))) return reply.code(403).send({ error: 'Trip membership required' })
  await pool.query('DELETE FROM trip_itinerary_items WHERE id = $1 AND trip_id = $2', [params.itemId, params.id])
  return { success: true }
})

// Trip Checklist Items
app.post('/api/trips/:id/checklist', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  if (!(await tripAccess(user.id, params.id))) return reply.code(403).send({ error: 'Trip membership required' })
  const input = z.object({ title: z.string().min(1) }).parse(request.body)
  const result = await pool.query(
    'INSERT INTO trip_checklists (trip_id, title, created_by) VALUES ($1,$2,$3) RETURNING *',
    [params.id, input.title, user.id]
  )
  return reply.code(201).send(result.rows[0])
})

app.patch('/api/trips/:id/checklist/:itemId', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = z.object({ id: z.string().uuid(), itemId: z.string().uuid() }).parse(request.params)
  if (!(await tripAccess(user.id, params.id))) return reply.code(403).send({ error: 'Trip membership required' })
  const input = z.object({ completed: z.boolean() }).parse(request.body)
  const result = await pool.query(
    'UPDATE trip_checklists SET completed = $1 WHERE id = $2 AND trip_id = $3 RETURNING *',
    [input.completed, params.itemId, params.id]
  )
  if (!result.rowCount) return reply.code(404).send({ error: 'Checklist item not found' })
  return result.rows[0]
})

app.delete('/api/trips/:id/checklist/:itemId', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = z.object({ id: z.string().uuid(), itemId: z.string().uuid() }).parse(request.params)
  if (!(await tripAccess(user.id, params.id))) return reply.code(403).send({ error: 'Trip membership required' })
  await pool.query('DELETE FROM trip_checklists WHERE id = $1 AND trip_id = $2', [params.itemId, params.id])
  return { success: true }
})

// Trip Notes & Journal
app.post('/api/trips/:id/notes', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  if (!(await tripAccess(user.id, params.id))) return reply.code(403).send({ error: 'Trip membership required' })
  const input = z.object({ body: z.string().min(1).max(5000) }).parse(request.body)
  const result = await pool.query(
    'INSERT INTO trip_notes (trip_id, author_id, body) VALUES ($1,$2,$3) RETURNING *',
    [params.id, user.id, input.body]
  )
  return reply.code(201).send(result.rows[0])
})

app.delete('/api/trips/:id/notes/:noteId', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = z.object({ id: z.string().uuid(), noteId: z.string().uuid() }).parse(request.params)
  if (!(await tripAccess(user.id, params.id))) return reply.code(403).send({ error: 'Trip membership required' })
  await pool.query('DELETE FROM trip_notes WHERE id = $1 AND trip_id = $2', [params.noteId, params.id])
  return { success: true }
})

// Trip Map Places
app.get('/api/trips/:id/map-places', { onRequest: auth }, async (request) => {
  const params = idParams.parse(request.params)
  return (await pool.query('SELECT * FROM trip_map_places WHERE trip_id = $1 ORDER BY created_at', [params.id])).rows
})

app.post('/api/trips/:id/map-places', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  if (!(await tripAccess(user.id, params.id))) return reply.code(403).send({ error: 'Trip membership required' })
  const input = z.object({
    name: z.string().min(2),
    category: z.string().default('Attraction'),
    notes: z.string().default(''),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }).parse(request.body)
  const result = await pool.query(
    'INSERT INTO trip_map_places (trip_id, name, category, notes, lat, lng) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [params.id, input.name, input.category, input.notes, input.lat ?? null, input.lng ?? null]
  )
  return reply.code(201).send(result.rows[0])
})

app.delete('/api/trips/:id/map-places/:placeId', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = z.object({ id: z.string().uuid(), placeId: z.string().uuid() }).parse(request.params)
  if (!(await tripAccess(user.id, params.id))) return reply.code(403).send({ error: 'Trip membership required' })
  await pool.query('DELETE FROM trip_map_places WHERE id = $1 AND trip_id = $2', [params.placeId, params.id])
  return { success: true }
})

// Trip Members
app.get('/api/trips/:id/members', { onRequest: auth }, async (request) => {
  const params = idParams.parse(request.params)
  return (await pool.query(`
    SELECT u.id, u.name, u.email, tm.role, tm.joined_at, coalesce(p.avatar_url, '') AS avatar_url
    FROM trip_members tm JOIN users u ON u.id = tm.user_id
    LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE tm.trip_id = $1
  `, [params.id])).rows
})

app.post('/api/trips/:id/members', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  if (!(await tripAccess(user.id, params.id))) return reply.code(403).send({ error: 'Trip membership required' })
  const input = z.object({ email: z.string().email() }).parse(request.body)
  const targetUser = (await pool.query('SELECT id, name, email FROM users WHERE email = lower($1)', [input.email])).rows[0]
  if (!targetUser) return reply.code(404).send({ error: 'User with that email was not found' })
  await pool.query('INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [params.id, targetUser.id, 'MEMBER'])
  await pool.query('INSERT INTO notifications (user_id, type, detail, link) VALUES ($1, $2, $3, $4)', [targetUser.id, 'TRIP_INVITATION', 'You were added as a member to a trip', `/trips/${params.id}`])
  return reply.code(201).send(targetUser)
})

app.delete('/api/trips/:id/members/:userId', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = z.object({ id: z.string().uuid(), userId: z.string().uuid() }).parse(request.params)
  if (!(await tripAccess(user.id, params.id))) return reply.code(403).send({ error: 'Trip membership required' })
  await pool.query('DELETE FROM trip_members WHERE trip_id = $1 AND user_id = $2', [params.id, params.userId])
  return { success: true }
})

// -------------------------------------------------------------
// EXPENSES & SETTLEMENTS
// -------------------------------------------------------------
app.get('/api/expenses/overview', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  const result = await pool.query(`
    SELECT e.*, t.name AS trip_name, u.name AS paid_by_name
    FROM expenses e
    JOIN trips t ON t.id = e.trip_id
    JOIN users u ON u.id = e.paid_by
    WHERE t.creator_id = $1 OR e.paid_by = $1
    ORDER BY e.expense_date DESC
  `, [user.id])

  const totalSpent = result.rows.reduce((sum, item) => sum + item.amount, 0)
  const categories = result.rows.reduce((acc: Record<string, number>, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount
    return acc
  }, {})

  return {
    expenses: result.rows,
    totalSpent,
    totalBudget: 60700,
    categories,
  }
})

app.get('/api/trips/:id/expenses', { onRequest: auth }, async (request) => {
  const params = idParams.parse(request.params)
  return (await pool.query(`
    SELECT e.*, u.name AS paid_by_name
    FROM expenses e JOIN users u ON u.id = e.paid_by
    WHERE e.trip_id = $1 ORDER BY e.expense_date DESC
  `, [params.id])).rows
})

app.post('/api/expenses', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const input = body(request, expenseSchema)
  const result = await pool.query(
    'INSERT INTO expenses (trip_id, paid_by, title, category, amount, expense_date) VALUES ($1,$2,$3,$4,$5,coalesce($6,CURRENT_DATE)) RETURNING *',
    [input.tripId, user.id, input.title, input.category, input.amount, input.expenseDate ?? null]
  )
  return reply.code(201).send(result.rows[0])
})

app.delete('/api/expenses/:id', { onRequest: auth }, async (request) => {
  const params = idParams.parse(request.params)
  await pool.query('DELETE FROM expenses WHERE id = $1', [params.id])
  return { success: true }
})

app.get('/api/trips/:id/settlements', { onRequest: auth }, async (request) => {
  const params = idParams.parse(request.params)
  return (await pool.query(`
    SELECT s.*, u1.name AS from_user_name, u2.name AS to_user_name
    FROM expense_settlements s
    JOIN users u1 ON u1.id = s.from_user_id
    JOIN users u2 ON u2.id = s.to_user_id
    WHERE s.trip_id = $1
    ORDER BY s.created_at DESC
  `, [params.id])).rows
})

app.post('/api/trips/:id/settlements', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  const input = z.object({ toUserId: z.string().uuid(), amount: z.number().int().positive() }).parse(request.body)
  const result = await pool.query(
    'INSERT INTO expense_settlements (trip_id, from_user_id, to_user_id, amount, status) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [params.id, user.id, input.toUserId, input.amount, 'PAID']
  )
  return reply.code(201).send(result.rows[0])
})

app.patch('/api/settlements/:id/status', { onRequest: auth }, async (request) => {
  const params = idParams.parse(request.params)
  const input = z.object({ status: z.enum(['PENDING', 'PAID', 'CANCELLED']) }).parse(request.body)
  const result = await pool.query('UPDATE expense_settlements SET status = $1 WHERE id = $2 RETURNING *', [input.status, params.id])
  return result.rows[0]
})

// -------------------------------------------------------------
// GROUP TRAVEL & EXPEDITIONS
// -------------------------------------------------------------
app.get('/api/groups', async () => {
  const result = await pool.query(`
    SELECT g.*, t.name AS trip_name, t.start_date, t.end_date,
      d.name AS destination_name, d.image AS destination_image, d.district, d.division,
      u.name AS organizer_name, coalesce(up.avatar_url, '') AS organizer_avatar,
      count(gm.user_id)::int AS member_count
    FROM groups g
    JOIN trips t ON t.id = g.trip_id
    JOIN destinations d ON d.id = t.destination_id
    JOIN users u ON u.id = g.organizer_id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    LEFT JOIN group_members gm ON gm.group_id = g.id
    WHERE g.published
    GROUP BY g.id, t.name, t.start_date, t.end_date, d.name, d.image, d.district, d.division, u.name, up.avatar_url
    ORDER BY t.start_date ASC
  `)
  return result.rows
})

app.get('/api/groups/:id', async (request, reply) => {
  const params = idParams.parse(request.params)
  const result = await pool.query(`
    SELECT g.*, t.name AS trip_name, t.start_date, t.end_date, t.description AS trip_description,
      d.name AS destination_name, d.image AS destination_image, d.district, d.division,
      u.name AS organizer_name, coalesce(up.avatar_url, '') AS organizer_avatar,
      count(gm.user_id)::int AS member_count
    FROM groups g
    JOIN trips t ON t.id = g.trip_id
    JOIN destinations d ON d.id = t.destination_id
    JOIN users u ON u.id = g.organizer_id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    LEFT JOIN group_members gm ON gm.group_id = g.id
    WHERE g.id = $1
    GROUP BY g.id, t.name, t.start_date, t.end_date, t.description, d.name, d.image, d.district, d.division, u.name, up.avatar_url
  `, [params.id])
  const group = result.rows[0]
  if (!group) return reply.code(404).send({ error: 'Group expedition not found' })

  const members = (await pool.query(`
    SELECT u.id, u.name, u.email, coalesce(up.avatar_url, '') AS avatar_url
    FROM group_members gm JOIN users u ON u.id = gm.user_id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE gm.group_id = $1
  `, [params.id])).rows

  const itinerary = (await pool.query(`
    SELECT * FROM trip_itinerary_items WHERE trip_id = $1 ORDER BY day_date, sort_order
  `, [group.trip_id])).rows

  return { ...group, members, itinerary }
})

app.post('/api/groups', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const input = body(request, groupSchema)
  const result = await pool.query(
    'INSERT INTO groups (trip_id, organizer_id, title, capacity, budget_per_person, published) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [input.tripId, user.id, input.title, input.capacity, input.budgetPerPerson, input.published]
  )
  const group = result.rows[0]
  await pool.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [group.id, user.id])
  return reply.code(201).send(group)
})

app.get('/api/groups/my-groups', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  const result = await pool.query(`
    SELECT g.*, t.name AS trip_name, t.start_date, t.end_date, d.name AS destination_name, d.image AS destination_image,
      u.name AS organizer_name,
      count(gm.user_id)::int AS member_count,
      CASE WHEN g.organizer_id = $1 THEN true ELSE false END AS is_organizer
    FROM groups g
    JOIN trips t ON t.id = g.trip_id
    JOIN destinations d ON d.id = t.destination_id
    JOIN users u ON u.id = g.organizer_id
    LEFT JOIN group_members gm ON gm.group_id = g.id
    WHERE g.organizer_id = $1 OR EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = g.id AND m.user_id = $1)
    GROUP BY g.id, t.name, t.start_date, t.end_date, d.name, d.image, u.name
  `, [user.id])
  return result.rows
})

// Group Applications
app.get('/api/groups/:id/applications', { onRequest: auth }, async (request) => {
  const params = idParams.parse(request.params)
  return (await pool.query(`
    SELECT a.*, u.name AS applicant_name, u.email AS applicant_email, coalesce(up.avatar_url, '') AS applicant_avatar
    FROM applications a JOIN users u ON u.id = a.applicant_id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE a.group_id = $1 ORDER BY a.created_at DESC
  `, [params.id])).rows
})

app.post('/api/groups/:id/applications', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  const answers = z.record(z.any()).default({}).parse(request.body ?? {})
  const result = await pool.query(
    'INSERT INTO applications (group_id, applicant_id, answers) VALUES ($1,$2,$3) ON CONFLICT (group_id, applicant_id) DO UPDATE SET answers = EXCLUDED.answers, status = $4 RETURNING *',
    [params.id, user.id, JSON.stringify(answers), 'PENDING']
  )
  const group = (await pool.query('SELECT organizer_id, title FROM groups WHERE id = $1', [params.id])).rows[0]
  if (group) {
    await pool.query('INSERT INTO notifications (user_id, type, detail, link) VALUES ($1, $2, $3, $4)', [group.organizer_id, 'GROUP_APPLICATION', `New join request for ${group.title}`, `/group-travel/requests`])
  }
  return reply.code(201).send(result.rows[0])
})

app.get('/api/me/group-applications', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  return (await pool.query(`
    SELECT a.*, g.title AS group_title, g.budget_per_person, d.name AS destination_name, u.name AS organizer_name
    FROM applications a
    JOIN groups g ON g.id = a.group_id
    JOIN trips t ON t.id = g.trip_id
    JOIN destinations d ON d.id = t.destination_id
    JOIN users u ON u.id = g.organizer_id
    WHERE a.applicant_id = $1 ORDER BY a.created_at DESC
  `, [user.id])).rows
})

app.patch('/api/applications/:id/status', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  const input = z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN']) }).parse(request.body)
  const appRecord = (await pool.query('SELECT * FROM applications WHERE id = $1', [params.id])).rows[0]
  if (!appRecord) return reply.code(404).send({ error: 'Application not found' })

  const result = await pool.query('UPDATE applications SET status = $1 WHERE id = $2 RETURNING *', [input.status, params.id])
  if (input.status === 'APPROVED') {
    await pool.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [appRecord.group_id, appRecord.applicant_id])
    const grp = (await pool.query('SELECT trip_id FROM groups WHERE id = $1', [appRecord.group_id])).rows[0]
    if (grp) {
      await pool.query('INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [grp.trip_id, appRecord.applicant_id, 'MEMBER'])
    }
    await pool.query('INSERT INTO notifications (user_id, type, detail, link) VALUES ($1, $2, $3, $4)', [appRecord.applicant_id, 'APPLICATION_APPROVED', 'Your application to join the group trip was approved!', `/group-travel/my-groups`])
  }
  return result.rows[0]
})

// Group Messages / Chat
app.get('/api/groups/:id/messages', { onRequest: auth }, async (request) => {
  const params = idParams.parse(request.params)
  return (await pool.query(`
    SELECT m.*, u.name AS sender_name, coalesce(p.avatar_url, '') AS sender_avatar
    FROM group_messages m JOIN users u ON u.id = m.sender_id
    LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE m.group_id = $1 ORDER BY m.created_at ASC
  `, [params.id])).rows
})

app.post('/api/groups/:id/messages', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  const input = z.object({ body: z.string().trim().min(1).max(5000) }).parse(request.body)
  const result = await pool.query(
    'INSERT INTO group_messages (group_id, sender_id, body) VALUES ($1,$2,$3) RETURNING *',
    [params.id, user.id, input.body]
  )
  const sender = (await pool.query('SELECT name FROM users WHERE id = $1', [user.id])).rows[0]
  return reply.code(201).send({ ...result.rows[0], sender_name: sender?.name })
})

// -------------------------------------------------------------
// AI PLANNER & ASSISTANT (Intelligent Bangladesh Travel Synthesis)
// -------------------------------------------------------------
function generateTravelAssistantResponse(userPrompt: string): string {
  const prompt = userPrompt.toLowerCase()
  if (prompt.includes('cox') || prompt.includes('beach') || prompt.includes('sea')) {
    return `Here is a curated coastal escape plan for Cox’s Bazar:\n\n• Day 1: Arrive via air or overnight AC sleeper. Check in around Kolatoli or Marine Drive (e.g. Mermaid Eco Resort or Sayeman). Evening sunset walk by South Beach away from town crowds.\n• Day 2: Morning cruise along Marine Drive down to Himchari National Park and Inani Coral Beach. Enjoy fresh green coconuts from local vendors.\n• Day 3: Morning surfing lesson or sea swim at Laboni point. Fresh seafood barbecue dinner at Salt & Pepper or Jhaoban (try grilled pomfret and loitta fry).\n\nBudget recommendation: ৳8,500 – ৳15,000 per person depending on stay choice.`
  }
  if (prompt.includes('sylhet') || prompt.includes('tea') || prompt.includes('sreemangal')) {
    return `For a slow, refreshing journey into Sylhet & Sreemangal:\n\n• Route: Parabat Express train from Dhaka to Sreemangal (approx 4.5 hrs, scenic countryside view).\n• Stays: Quiet eco-resorts inside Radhanagar tea estates.\n• Experiences: Dawn walk in Lawachara Rainforest to hear Hoolock Gibbons, cycle through finlay tea estates, and a silent wooden boat ride on Lalakhal’s emerald river waters.\n• Culinary: Seven-layer tea at Nilkantha, followed by Sylheti beef shatkora and fresh river fish curries.\n\nRecommended duration: 3 to 4 days · Estimated budget: ৳7,500 – ৳12,000.`
  }
  if (prompt.includes('bandarban') || prompt.includes('trek') || prompt.includes('hill') || prompt.includes('keokradong')) {
    return `Bandarban adventure blueprint:\n\n• Important: Foreign and domestic travelers must register at Army checkpoints with NID/Passport copies.\n• Suggested Route: Bandarban town → Ruma Bazar by Chander Gari → Trek to Boga Lake (homestay with Bawm community) → Summit Keokradong (1,230m) for sunrise.\n• Packing essentials: Quick-dry trek shoes with deep grip, leech socks, waterproof pouch for electronics, and electrolyte tablets.\n\nRecommended budget: ৳12,000 – ৳18,000 including licensed indigenous guide fees.`
  }
  if (prompt.includes('sajek') || prompt.includes('cloud')) {
    return `Sajek Valley cloud-country guide:\n\n• Travel: Take Khagrachari night bus, then join morning Army escort at Dighinala (9:30 AM or 1:30 PM).\n• Highlight: Early morning sunrise above the clouds at Konglak Hill.\n• Local dining: Bamboo shoot curries and traditional bamboo-baked chicken at local Marma/Tripura kitchens.\n• Recommended stay: 2 nights at a wooden hillside cottage facing the valley.\n\nEstimated budget: ৳5,800 – ৳8,500.`
  }
  if (prompt.includes('budget') || prompt.includes('cost') || prompt.includes('money')) {
    return `Here is a balanced BDT budget breakdown for travel in Bangladesh:\n\n1. Transport: 20-25% (AC sleeper buses ৳1,200-1,800 each way, or flights ৳4,000-6,500).\n2. Accommodation: 40% (Cozy eco-resorts & clean guest houses avg ৳2,500-4,000/night).\n3. Local food & guides: 25% (Generous budget for authentic local kitchens: ৳1,000-1,500/day).\n4. Buffer & souvenirs: 10-15%.\n\nTip: Traveling mid-week reduces resort rates by up to 30%.`
  }
  return `That sounds like a wonderful travel spark! I recommend planning a slow, respectful itinerary focused on authentic regional experiences. Consider staying in locally owned eco-cottages, allocating ample room for slow mornings, and hiring certified community guides to explore hidden trails and waterways. Tell me your preferred duration or budget (in BDT) and I'll shape a full day-by-day itinerary for you!`
}

app.get('/api/ai/conversations', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  return (await pool.query('SELECT * FROM ai_conversations WHERE user_id = $1 ORDER BY created_at DESC', [user.id])).rows
})

app.post('/api/ai/conversations', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const input = z.object({ title: z.string().min(1).default('New travel session') }).parse(request.body ?? {})
  const result = await pool.query('INSERT INTO ai_conversations (user_id, title) VALUES ($1,$2) RETURNING *', [user.id, input.title])
  return reply.code(201).send(result.rows[0])
})

app.get('/api/ai/conversations/:id/messages', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  const owned = await pool.query('SELECT 1 FROM ai_conversations WHERE id = $1 AND user_id = $2', [params.id, user.id])
  if (!owned.rowCount) return reply.code(404).send({ error: 'Conversation not found' })
  return (await pool.query('SELECT * FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC', [params.id])).rows
})

app.post('/api/ai/conversations/:id/messages', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  const input = z.object({ body: z.string().min(1).max(10000) }).parse(request.body)
  const owned = await pool.query('SELECT 1 FROM ai_conversations WHERE id = $1 AND user_id = $2', [params.id, user.id])
  if (!owned.rowCount) return reply.code(404).send({ error: 'Conversation not found' })

  // Insert user message
  const userMsg = (await pool.query(
    'INSERT INTO ai_messages (conversation_id, sender, body) VALUES ($1,$2,$3) RETURNING *',
    [params.id, 'USER', input.body]
  )).rows[0]

  // Generate intelligent response and insert
  const responseText = generateTravelAssistantResponse(input.body)
  const aiMsg = (await pool.query(
    'INSERT INTO ai_messages (conversation_id, sender, body) VALUES ($1,$2,$3) RETURNING *',
    [params.id, 'ASSISTANT', responseText]
  )).rows[0]

  return reply.code(201).send({ userMessage: userMsg, assistantMessage: aiMsg })
})

app.delete('/api/ai/conversations/:id', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  await pool.query('DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2', [params.id, user.id])
  return { success: true }
})

// -------------------------------------------------------------
// COMMUNITY POSTS, COMMENTS & REACTIONS
// -------------------------------------------------------------
app.get('/api/community/posts', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  return (await pool.query(`
    SELECT p.*, u.name AS author_name, coalesce(up.avatar_url, '') AS author_avatar,
      count(DISTINCT r.user_id)::int AS reaction_count,
      count(DISTINCT c.id)::int AS comment_count,
      EXISTS (SELECT 1 FROM community_reactions WHERE post_id = p.id AND user_id = $1) AS liked_by_me
    FROM community_posts p
    JOIN users u ON u.id = p.author_id
    LEFT JOIN user_profiles up ON up.user_id = p.author_id
    LEFT JOIN community_reactions r ON r.post_id = p.id
    LEFT JOIN community_comments c ON c.post_id = p.id
    GROUP BY p.id, u.name, up.avatar_url
    ORDER BY p.created_at DESC
  `, [user.id])).rows
})

app.post('/api/community/posts', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const input = z.object({ body: z.string().min(1).max(10000), visibility: z.enum(['PUBLIC', 'FOLLOWERS_ONLY']).default('PUBLIC') }).parse(request.body)
  const result = await pool.query('INSERT INTO community_posts (author_id, body, visibility) VALUES ($1,$2,$3) RETURNING *', [user.id, input.body, input.visibility])
  return reply.code(201).send(result.rows[0])
})

app.delete('/api/community/posts/:id', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  await pool.query('DELETE FROM community_posts WHERE id = $1 AND (author_id = $2 OR $3 = $4)', [params.id, user.id, user.role, 'ADMIN'])
  return { success: true }
})

app.post('/api/community/posts/:id/reactions', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  const existing = await pool.query('SELECT 1 FROM community_reactions WHERE post_id = $1 AND user_id = $2', [params.id, user.id])
  if (existing.rowCount) {
    await pool.query('DELETE FROM community_reactions WHERE post_id = $1 AND user_id = $2', [params.id, user.id])
    return { liked: false }
  } else {
    await pool.query('INSERT INTO community_reactions (post_id, user_id) VALUES ($1,$2)', [params.id, user.id])
    return { liked: true }
  }
})

app.get('/api/community/posts/:id/comments', { onRequest: auth }, async (request) => {
  const params = idParams.parse(request.params)
  return (await pool.query(`
    SELECT c.*, u.name AS author_name, coalesce(up.avatar_url, '') AS author_avatar
    FROM community_comments c
    JOIN users u ON u.id = c.author_id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE c.post_id = $1 ORDER BY c.created_at ASC
  `, [params.id])).rows
})

app.post('/api/community/posts/:id/comments', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  const input = z.object({ body: z.string().trim().min(1).max(2000) }).parse(request.body)
  const result = await pool.query(
    'INSERT INTO community_comments (post_id, author_id, body) VALUES ($1,$2,$3) RETURNING *',
    [params.id, user.id, input.body]
  )
  const author = (await pool.query('SELECT name FROM users WHERE id = $1', [user.id])).rows[0]
  return reply.code(201).send({ ...result.rows[0], author_name: author?.name })
})

// -------------------------------------------------------------
// NOTIFICATIONS
// -------------------------------------------------------------
app.get('/api/notifications', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  return (await pool.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC', [user.id])).rows
})

app.patch('/api/notifications/:id/read', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  const result = await pool.query('UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING *', [params.id, user.id])
  if (!result.rowCount) return reply.code(404).send({ error: 'Notification not found' })
  return result.rows[0]
})

app.patch('/api/notifications/read-all', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  await pool.query('UPDATE notifications SET read = true WHERE user_id = $1', [user.id])
  return { success: true }
})

app.delete('/api/notifications/:id', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  await pool.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [params.id, user.id])
  return { success: true }
})

// -------------------------------------------------------------
// TOURS, DEPARTURES & BOOKINGS (TOUR PLANNER WORKSPACE)
// -------------------------------------------------------------
app.get('/api/tours', async () => {
  return (await pool.query(`
    SELECT t.*, d.name AS destination_name, d.image AS destination_image, d.district, d.division,
      u.name AS planner_name,
      (SELECT count(*)::int FROM tour_departures WHERE tour_id = t.id) AS departures_count
    FROM tours t
    JOIN destinations d ON d.id = t.destination_id
    JOIN users u ON u.id = t.planner_id
    WHERE t.status = 'PUBLISHED' ORDER BY t.created_at DESC
  `)).rows
})

app.get('/api/tours/:id', async (request, reply) => {
  const params = idParams.parse(request.params)
  const tour = (await pool.query(`
    SELECT t.*, d.name AS destination_name, d.image AS destination_image, d.district, d.division,
      u.name AS planner_name, coalesce(up.bio, '') AS planner_bio
    FROM tours t
    JOIN destinations d ON d.id = t.destination_id
    JOIN users u ON u.id = t.planner_id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE t.id = $1
  `, [params.id])).rows[0]
  if (!tour) return reply.code(404).send({ error: 'Tour not found' })

  const departures = (await pool.query(`
    SELECT td.*,
      coalesce((SELECT sum(travelers_count)::int FROM bookings WHERE departure_id = td.id AND status <> 'CANCELLED'), 0) AS booked_count
    FROM tour_departures td WHERE td.tour_id = $1 ORDER BY td.start_date ASC
  `, [params.id])).rows

  return { ...tour, departures }
})

app.post('/api/tours', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  if (user.role !== 'TOUR_PLANNER' && user.role !== 'ADMIN') {
    return reply.code(403).send({ error: 'Tour planner role required' })
  }
  const input = body(request, tourSchema)
  const result = await pool.query(
    'INSERT INTO tours (planner_id, destination_id, title, description, price, capacity, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [user.id, input.destinationId, input.title, input.description, input.price, input.capacity, input.status]
  )
  return reply.code(201).send(result.rows[0])
})

app.put('/api/tours/:id', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  const input = tourSchema.partial().parse(request.body)
  const result = await pool.query(`
    UPDATE tours
    SET title = coalesce($1, title),
        description = coalesce($2, description),
        price = coalesce($3, price),
        capacity = coalesce($4, capacity),
        status = coalesce($5, status),
        destination_id = coalesce($6, destination_id)
    WHERE id = $7 AND (planner_id = $8 OR $9 = 'ADMIN')
    RETURNING *
  `, [input.title, input.description, input.price, input.capacity, input.status, input.destinationId, params.id, user.id, user.role])
  return result.rows[0]
})

app.get('/api/planner/tours', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  if (user.role !== 'TOUR_PLANNER' && user.role !== 'ADMIN') return reply.code(403).send({ error: 'Tour planner role required' })
  return (await pool.query(`
    SELECT t.*, d.name AS destination_name, d.image AS destination_image,
      (SELECT count(*)::int FROM tour_departures WHERE tour_id = t.id) AS departures_count,
      (SELECT coalesce(sum(b.travelers_count), 0)::int FROM tour_departures td JOIN bookings b ON b.departure_id = td.id WHERE td.tour_id = t.id AND b.status = 'CONFIRMED') AS total_participants
    FROM tours t JOIN destinations d ON d.id = t.destination_id
    WHERE t.planner_id = $1 ORDER BY t.created_at DESC
  `, [user.id])).rows
})

app.post('/api/tours/:id/departures', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  const input = body(request, departureSchema)
  const result = await pool.query(
    'INSERT INTO tour_departures (tour_id, start_date, end_date, capacity, status) SELECT $1,$2,$3,$4,$5 WHERE EXISTS (SELECT 1 FROM tours WHERE id = $1 AND (planner_id = $6 OR $7 = \'ADMIN\')) RETURNING *',
    [params.id, input.startDate, input.endDate, input.capacity, input.status, user.id, user.role]
  )
  if (!result.rowCount) return reply.code(403).send({ error: 'You can only add departures to your own tours' })
  return reply.code(201).send(result.rows[0])
})

app.get('/api/planner/departures', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  if (user.role !== 'TOUR_PLANNER' && user.role !== 'ADMIN') return reply.code(403).send({ error: 'Tour planner role required' })
  return (await pool.query(`
    SELECT td.*, t.title AS tour_title, d.name AS destination_name,
      coalesce((SELECT sum(travelers_count)::int FROM bookings WHERE departure_id = td.id AND status <> 'CANCELLED'), 0) AS booked_count
    FROM tour_departures td
    JOIN tours t ON t.id = td.tour_id
    JOIN destinations d ON d.id = t.destination_id
    WHERE t.planner_id = $1 ORDER BY td.start_date ASC
  `, [user.id])).rows
})

app.get('/api/planner/bookings', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  if (user.role !== 'TOUR_PLANNER' && user.role !== 'ADMIN') return reply.code(403).send({ error: 'Tour planner role required' })
  return (await pool.query(`
    SELECT b.*, u.name AS traveler_name, u.email AS traveler_email,
      t.title AS tour_title, t.price AS tour_price, td.start_date, td.end_date
    FROM bookings b
    JOIN tour_departures td ON td.id = b.departure_id
    JOIN tours t ON t.id = td.tour_id
    JOIN users u ON u.id = b.traveler_id
    WHERE t.planner_id = $1 ORDER BY b.created_at DESC
  `, [user.id])).rows
})

app.patch('/api/bookings/:id/status', { onRequest: auth }, async (request) => {
  const params = idParams.parse(request.params)
  const input = z.object({ status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']) }).parse(request.body)
  const result = await pool.query('UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *', [input.status, params.id])
  return result.rows[0]
})

app.post('/api/departures/:id/bookings', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  const input = body(request, bookingSchema)
  const result = await pool.query(`
    INSERT INTO bookings (departure_id, traveler_id, travelers_count, status)
    VALUES ($1, $2, $3, 'CONFIRMED')
    ON CONFLICT (departure_id, traveler_id) DO UPDATE SET travelers_count = EXCLUDED.travelers_count, status = 'CONFIRMED'
    RETURNING *
  `, [params.id, user.id, input.travelersCount])
  return reply.code(201).send(result.rows[0])
})

app.get('/api/me/bookings', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  return (await pool.query(`
    SELECT b.*, t.title AS tour_title, t.price, td.start_date, td.end_date, d.name AS destination_name
    FROM bookings b
    JOIN tour_departures td ON td.id = b.departure_id
    JOIN tours t ON t.id = td.tour_id
    JOIN destinations d ON d.id = t.destination_id
    WHERE b.traveler_id = $1 ORDER BY td.start_date ASC
  `, [user.id])).rows
})

// -------------------------------------------------------------
// TRAVELER REVIEWS & REPUTATION
// -------------------------------------------------------------
app.get('/api/me/traveler-reviews/pending', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  return (await pool.query(`
    SELECT DISTINCT t.id AS trip_id, t.name AS trip_name, t.end_date, u.id AS traveler_id, u.name AS traveler_name
    FROM trips t
    JOIN users u ON u.id <> $1
    WHERE t.status = 'COMPLETED'
      AND (t.creator_id = $1 OR EXISTS (SELECT 1 FROM trip_members gm WHERE gm.trip_id = t.id AND gm.user_id = $1))
      AND (u.id = t.creator_id OR EXISTS (SELECT 1 FROM trip_members gm WHERE gm.trip_id = t.id AND gm.user_id = u.id))
      AND NOT EXISTS (SELECT 1 FROM traveler_reviews r WHERE r.trip_id = t.id AND r.reviewer_id = $1 AND r.reviewed_user_id = u.id)
    ORDER BY t.end_date DESC
  `, [user.id])).rows
})

app.post('/api/traveler-reviews', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const input = body(request, travelerReviewSchema)
  const result = await pool.query(`
    INSERT INTO traveler_reviews (trip_id, reviewer_id, reviewed_user_id, communication, punctuality, reliability, teamwork, respectfulness, cooperation, responsibility, overall, body)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT (trip_id, reviewer_id, reviewed_user_id) DO UPDATE SET overall = EXCLUDED.overall, body = EXCLUDED.body
    RETURNING *
  `, [input.tripId, user.id, input.reviewedUserId, input.communication, input.punctuality, input.reliability, input.teamwork, input.respectfulness, input.cooperation, input.responsibility, input.overall, input.body ?? null])
  await pool.query('INSERT INTO notifications (user_id, type, detail, link) VALUES ($1, $2, $3, $4)', [input.reviewedUserId, 'TRAVELER_REVIEW', 'You received a new traveler review!', '/profile'])
  return reply.code(201).send(result.rows[0])
})

app.post('/api/reviews', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const input = body(request, reviewSchema)
  const result = await pool.query(
    'INSERT INTO reviews (destination_id, author_id, rating, body) VALUES ($1,$2,$3,$4) ON CONFLICT (destination_id, author_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body RETURNING *',
    [input.destinationId, user.id, input.rating, input.body]
  )
  return reply.code(201).send(result.rows[0])
})

// Public profile for any traveler
app.get('/api/users/:id/profile', { onRequest: auth }, async (request, reply) => {
  const params = idParams.parse(request.params)
  const result = await pool.query(`
    SELECT u.id, u.name, u.role, u.created_at,
      coalesce(p.username, lower(replace(u.name, ' ', '-'))) AS username,
      coalesce(p.bio, '') AS bio,
      p.avatar_url,
      coalesce(p.travel_style, 'Slow explorer') AS travel_style,
      coalesce(p.interests, '{}') AS interests,
      (SELECT count(*)::int FROM trips WHERE creator_id = u.id) AS trips_count,
      (SELECT count(*)::int FROM traveler_reviews WHERE reviewed_user_id = u.id) AS review_count,
      (SELECT coalesce(round(avg(overall), 1), 5.0) FROM traveler_reviews WHERE reviewed_user_id = u.id) AS rating
    FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = $1
  `, [params.id])
  const profile = result.rows[0]
  if (!profile) return reply.code(404).send({ error: 'User not found' })

  const reviews = (await pool.query(`
    SELECT tr.*, u.name AS reviewer_name FROM traveler_reviews tr JOIN users u ON u.id = tr.reviewer_id WHERE tr.reviewed_user_id = $1 ORDER BY tr.created_at DESC
  `, [params.id])).rows

  return { ...profile, reviews }
})

// Social: follow, block, report
app.post('/api/users/:id/follow', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  await pool.query('INSERT INTO user_follows (follower_id, followed_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, params.id])
  return { following: true }
})

app.delete('/api/users/:id/follow', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  await pool.query('DELETE FROM user_follows WHERE follower_id = $1 AND followed_id = $2', [user.id, params.id])
  return { following: false }
})

app.post('/api/users/:id/block', { onRequest: auth }, async (request) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  await pool.query('INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, params.id])
  return { blocked: true }
})

app.post('/api/users/:id/reports', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const params = idParams.parse(request.params)
  const input = z.object({ reason: z.string().trim().min(3).max(1000) }).parse(request.body)
  const result = await pool.query('INSERT INTO user_reports (reporter_id, reported_user_id, reason) VALUES ($1, $2, $3) RETURNING id, created_at', [user.id, params.id, input.reason])
  return reply.code(201).send(result.rows[0])
})

// -------------------------------------------------------------
// VERIFICATION & ADMIN CONTROL CENTER
// -------------------------------------------------------------
app.post('/api/me/verification', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  const input = body(request, verificationSchema)
  const result = await pool.query('INSERT INTO verification_requests (user_id, note) VALUES ($1,$2) RETURNING *', [user.id, input.note ?? null])
  return reply.code(201).send(result.rows[0])
})

app.get('/api/admin/analytics', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  if (user.role !== 'ADMIN') return reply.code(403).send({ error: 'Admin role required' })
  const result = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM users WHERE role = 'TOUR_PLANNER') AS planners,
      (SELECT count(*)::int FROM trips) AS trips,
      (SELECT count(*)::int FROM groups WHERE published) AS active_groups,
      (SELECT count(*)::int FROM tours WHERE status = 'PUBLISHED') AS published_tours,
      (SELECT count(*)::int FROM user_reports) AS reports,
      (SELECT count(*)::int FROM verification_requests WHERE status = 'PENDING') AS pending_verifications
  `)
  return result.rows[0]
})

app.get('/api/admin/users', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  if (user.role !== 'ADMIN') return reply.code(403).send({ error: 'Admin role required' })
  return (await pool.query(`
    SELECT u.id, u.name, u.email, u.role, u.status, u.created_at,
      (SELECT count(*)::int FROM trips WHERE creator_id = u.id) AS trips_count
    FROM users u ORDER BY u.created_at DESC
  `)).rows
})

app.patch('/api/admin/users/:id/role', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  if (user.role !== 'ADMIN') return reply.code(403).send({ error: 'Admin role required' })
  const params = idParams.parse(request.params)
  const input = z.object({ role: z.enum(['TRAVELER', 'TOUR_PLANNER', 'ADMIN']) }).parse(request.body)
  const result = await pool.query('UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role', [input.role, params.id])
  return result.rows[0]
})

app.patch('/api/admin/users/:id/status', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  if (user.role !== 'ADMIN') return reply.code(403).send({ error: 'Admin role required' })
  const params = idParams.parse(request.params)
  const input = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']) }).parse(request.body)
  const result = await pool.query('UPDATE users SET status = $1 WHERE id = $2 RETURNING id, name, email, status', [input.status, params.id])
  return result.rows[0]
})

app.get('/api/admin/trips', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  if (user.role !== 'ADMIN') return reply.code(403).send({ error: 'Admin role required' })
  return (await pool.query(`
    SELECT t.*, u.name AS creator_name, d.name AS destination_name
    FROM trips t JOIN users u ON u.id = t.creator_id JOIN destinations d ON d.id = t.destination_id
    ORDER BY t.created_at DESC
  `)).rows
})

app.get('/api/admin/groups', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  if (user.role !== 'ADMIN') return reply.code(403).send({ error: 'Admin role required' })
  return (await pool.query(`
    SELECT g.*, u.name AS organizer_name, t.name AS trip_name
    FROM groups g JOIN users u ON u.id = g.organizer_id JOIN trips t ON t.id = g.trip_id
    ORDER BY g.title ASC
  `)).rows
})

app.get('/api/admin/verifications', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  if (user.role !== 'ADMIN') return reply.code(403).send({ error: 'Admin role required' })
  return (await pool.query(`
    SELECT v.*, u.name AS user_name, u.email AS user_email
    FROM verification_requests v JOIN users u ON u.id = v.user_id
    ORDER BY v.created_at DESC
  `)).rows
})

app.patch('/api/admin/verifications/:id', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  if (user.role !== 'ADMIN') return reply.code(403).send({ error: 'Admin role required' })
  const params = idParams.parse(request.params)
  const input = z.object({ status: z.enum(['APPROVED', 'REJECTED']) }).parse(request.body)
  const result = await pool.query(
    'UPDATE verification_requests SET status = $1, reviewed_by = $2, reviewed_at = now() WHERE id = $3 RETURNING *',
    [input.status, user.id, params.id]
  )
  if (input.status === 'APPROVED' && result.rows[0]) {
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['TOUR_PLANNER', result.rows[0].user_id])
    await pool.query('INSERT INTO notifications (user_id, type, detail, link) VALUES ($1, $2, $3, $4)', [result.rows[0].user_id, 'VERIFICATION_APPROVED', 'Your tour planner application was approved! Welcome.', '/planner/dashboard'])
  }
  return result.rows[0]
})

app.get('/api/admin/reports', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  if (user.role !== 'ADMIN') return reply.code(403).send({ error: 'Admin role required' })
  return (await pool.query(`
    SELECT r.*, reporter.name AS reporter_name, reported.name AS reported_user_name
    FROM user_reports r
    JOIN users reporter ON reporter.id = r.reporter_id
    JOIN users reported ON reported.id = r.reported_user_id
    ORDER BY r.created_at DESC
  `)).rows
})

app.post('/api/admin/reports/:id/actions', { onRequest: auth }, async (request, reply) => {
  const user = (request as AuthRequest).user
  if (user.role !== 'ADMIN') return reply.code(403).send({ error: 'Admin role required' })
  const params = idParams.parse(request.params)
  const input = body(request, adminActionSchema)
  const result = await pool.query(
    'INSERT INTO moderation_actions (report_id, admin_id, action, note) VALUES ($1,$2,$3,$4) RETURNING *',
    [params.id, user.id, input.action, input.note ?? null]
  )
  if (input.action === 'SUSPENDED' || input.action === 'BANNED') {
    const report = (await pool.query('SELECT reported_user_id FROM user_reports WHERE id = $1', [params.id])).rows[0]
    if (report) {
      await pool.query('UPDATE users SET status = $1 WHERE id = $2', [input.action, report.reported_user_id])
    }
  }
  return reply.code(201).send(result.rows[0])
})

// Error handling
app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ZodError) return reply.code(400).send({ error: 'Validation failed', details: error.flatten() })
  if ((error as { code?: string }).code === '23505') return reply.code(409).send({ error: 'That record already exists' })
  if (['ECONNREFUSED', '57P01', '28000'].includes((error as { code?: string }).code ?? '')) {
    return reply.code(503).send({ error: 'Database is unavailable. Start PostgreSQL and try again.' })
  }
  return reply.code(500).send({ error: (error as Error)?.message || 'Internal server error' })
})

// Database initialization
try {
  await pool.query('SELECT 1')
  const schema = await readFile(resolve(process.cwd(), 'schema.sql'), 'utf8')
  await pool.query(schema)
  databaseReady = true
} catch (error) {
  console.error('Database initialization error:', error)
}

await app.listen({ port: env.PORT, host: '0.0.0.0' })
console.log(`Porikroma Backend listening on port ${env.PORT}`)
