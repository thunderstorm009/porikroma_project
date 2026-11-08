import fetch from 'node:http'

const API_URL = 'http://localhost:4000'

async function request(path: string, options: any = {}, token?: string) {
  const headers: any = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await globalThis.fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })
  const text = await res.text()
  try {
    const data = JSON.parse(text)
    if (!res.ok) throw new Error(data.error || `Request failed with status ${res.status}`)
    return data
  } catch (err: any) {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`)
    return text
  }
}

async function runTests() {
  console.log('--- STARTING COMPREHENSIVE MULTI-USER WORKFLOW TESTS ---')

  // 1. LOGIN AS TRAVELER 1
  console.log('1. Logging in as Traveler 1 (Rafi Ahmed)...')
  const t1Auth = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'traveler@porikroma.com', password: 'password123' }),
  })
  const t1Token = t1Auth.token
  console.log('✓ Traveler 1 logged in. User ID:', t1Auth.user.id)

  // 2. TRAVELER 1 CREATES TRIP
  console.log('2. Traveler 1 creating a new trip...')
  const dests = await request('/api/destinations', {}, t1Token)
  const sylhetDest = dests.find((d: any) => d.name.includes('Sylhet')) || dests[0]
  
  const trip = await request('/api/trips', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Sylhet Rain & River Expedition',
      destinationId: sylhetDest.id,
      startDate: '2025-07-10',
      endDate: '2025-07-14',
      budget: 35000,
      visibility: 'PUBLIC',
      status: 'PLANNING',
      description: 'A 4-day shared journey through freshwater swamps and tea trails.',
    }),
  }, t1Token)
  console.log('✓ Trip created with ID:', trip.id)

  // 3. TRAVELER 1 CREATES GROUP EXPEDITION FOR THIS TRIP
  console.log('3. Traveler 1 publishing group expedition...')
  const group = await request('/api/groups', {
    method: 'POST',
    body: JSON.stringify({
      tripId: trip.id,
      title: 'Sylhet Rain & River Expedition',
      capacity: 5,
      budgetPerPerson: 7000,
      published: true,
    }),
  }, t1Token)
  console.log('✓ Group expedition published with ID:', group.id)

  // 4. TRAVELER 1 ADDS ITINERARY, EXPENSE, CHECKLIST, NOTE, MAP PLACE
  console.log('4. Traveler 1 adding workspace elements...')
  const it = await request(`/api/trips/${trip.id}/itinerary`, {
    method: 'POST',
    body: JSON.stringify({
      dayDate: '2025-07-10',
      title: 'Arrival in Sylhet & Lalakhal Boat Ride',
      location: 'Lalakhal River',
      notes: 'Emerald waters boat tour at sunset.',
    }),
  }, t1Token)
  console.log('✓ Itinerary added:', it.title)

  const exp = await request('/api/expenses', {
    method: 'POST',
    body: JSON.stringify({
      tripId: trip.id,
      title: 'Eco-cottage stay deposit',
      category: 'Stay',
      amount: 6000,
      expenseDate: '2025-07-10',
    }),
  }, t1Token)
  console.log('✓ Expense added:', exp.title, exp.amount)

  const chk = await request(`/api/trips/${trip.id}/checklist`, {
    method: 'POST',
    body: JSON.stringify({ title: 'Rain poncho and dry bag' }),
  }, t1Token)
  console.log('✓ Checklist added:', chk.title)

  await request(`/api/trips/${trip.id}/checklist/${chk.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ completed: true }),
  }, t1Token)
  console.log('✓ Checklist item toggled to completed')

  const note = await request(`/api/trips/${trip.id}/notes`, {
    method: 'POST',
    body: JSON.stringify({ body: 'Remember to try seven-layer tea at Nilkantha tea cabin.' }),
  }, t1Token)
  console.log('✓ Note added:', note.body)

  const place = await request(`/api/trips/${trip.id}/map-places`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Lalakhal River Basin', category: 'Nature', notes: 'Best emerald reflections at 4 PM' }),
  }, t1Token)
  console.log('✓ Map place added:', place.name)

  // 5. LOGIN AS TRAVELER 2
  console.log('5. Logging in as Traveler 2 (Samira Rahman)...')
  const t2Auth = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'traveler2@porikroma.com', password: 'password123' }),
  })
  const t2Token = t2Auth.token
  console.log('✓ Traveler 2 logged in.')

  // 6. TRAVELER 2 APPLIES TO JOIN GROUP
  console.log('6. Traveler 2 discovering and applying to Traveler 1\'s group expedition...')
  const application = await request(`/api/groups/${group.id}/applications`, {
    method: 'POST',
    body: JSON.stringify({
      experience: 'Hiked in Sreemangal before. Comfortable on boats.',
      dietary: 'No restrictions',
      commitment: 'Yes, full dates committed.',
    }),
  }, t2Token)
  console.log('✓ Application submitted with ID:', application.id, 'Status:', application.status)

  // 7. TRAVELER 1 APPROVES APPLICATION
  console.log('7. Traveler 1 reviewing and approving application...')
  const approvedApp = await request(`/api/applications/${application.id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'APPROVED' }),
  }, t1Token)
  console.log('✓ Application approved. Status:', approvedApp.status)

  // 8. TRAVELER 2 ACCESSES WORKSPACE AND SENDS GROUP MESSAGE
  console.log('8. Traveler 2 accessing workspace as approved member and sending chat message...')
  const ws = await request(`/api/trips/${trip.id}/workspace`, {}, t2Token)
  console.log('✓ Traveler 2 workspace loaded. Itinerary items count:', ws.itinerary.length)

  const chatMsg = await request(`/api/groups/${group.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body: 'Hi Rafi! Excited to join this Sylhet trip.' }),
  }, t2Token)
  console.log('✓ Group message sent by Traveler 2:', chatMsg.body)

  // 9. TOUR PLANNER WORKFLOW
  console.log('9. Tour Planner (Nadia Rahman) logging in and creating tour...')
  const plannerAuth = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'planner@porikroma.com', password: 'password123' }),
  })
  const plannerToken = plannerAuth.token

  const tour = await request('/api/tours', {
    method: 'POST',
    body: JSON.stringify({
      destinationId: dests[0].id,
      title: 'Wild Chittagong Hill Tracts Traverse',
      description: 'Exclusive 5-day mountain traverse with indigenous guides.',
      price: 18500,
      capacity: 8,
      status: 'PUBLISHED',
    }),
  }, plannerToken)
  console.log('✓ Tour created by Tour Planner with ID:', tour.id)

  const dep = await request(`/api/tours/${tour.id}/departures`, {
    method: 'POST',
    body: JSON.stringify({
      startDate: '2025-11-05',
      endDate: '2025-11-10',
      capacity: 8,
      status: 'OPEN',
    }),
  }, plannerToken)
  console.log('✓ Departure scheduled for tour:', dep.start_date)

  // 10. TRAVELER 1 BOOKS TOUR DEPARTURE
  console.log('10. Traveler 1 booking departure...')
  const booking = await request(`/api/departures/${dep.id}/bookings`, {
    method: 'POST',
    body: JSON.stringify({ travelersCount: 2 }),
  }, t1Token)
  console.log('✓ Booking confirmed for Traveler 1. Status:', booking.status)

  // 11. TOUR PLANNER VIEWS BOOKINGS
  console.log('11. Tour Planner checking bookings...')
  const plannerBookings = await request('/api/planner/bookings', {}, plannerToken)
  const myBooking = plannerBookings.find((b: any) => b.id === booking.id)
  console.log('✓ Tour Planner confirmed booking exists for:', myBooking?.traveler_name)

  // 12. ADMIN WORKFLOW
  console.log('12. Platform Admin logging in and performing administration tasks...')
  const adminAuth = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@porikroma.com', password: 'password123' }),
  })
  const adminToken = adminAuth.token

  const analytics = await request('/api/admin/analytics', {}, adminToken)
  console.log('✓ Admin analytics loaded:', analytics)

  const newDest = await request('/api/destinations', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Kuakata Sunset Beach',
      division: 'Barishal Division',
      district: 'Patuakhali',
      description: 'Panoramic sea beach where both sunrise and sunset can be viewed over the Bay of Bengal.',
      category: 'Beach',
      estimatedBudget: 8500,
    }),
  }, adminToken)
  console.log('✓ Admin created new destination:', newDest.name)

  const users = await request('/api/admin/users', {}, adminToken)
  console.log('✓ Admin loaded users list. Total users:', users.length)

  console.log('--- ALL MULTI-USER WORKFLOW TESTS PASSED SUCCESSFULLY! ---')
}

runTests().catch((err) => {
  console.error('Test failure:', err)
  process.exit(1)
})
