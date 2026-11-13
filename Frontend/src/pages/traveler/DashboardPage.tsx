import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Sparkles, ArrowUpRight, MapPin, Compass, Wallet, TrendingUp, ChevronRight, Banknote } from 'lucide-react'
import { api } from '../../api'
import type { Destination, Trip, User } from '../../types'
import { PageHeader } from '../../components/common/PageHeader'
import { WeatherWidget } from '../../components/common/WeatherWidget'

export function DashboardPage() {
  const navigate = useNavigate()
  const [trips, setTrips] = useState<Trip[]>([])
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [footprint, setFootprint] = useState<{ districtsVisited: number; visitedDistricts: string[] } | null>(null)
  const [expensesOverview, setExpensesOverview] = useState<{ totalSpent: number } | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api<User>('/api/me').catch(() => null),
      api<Trip[]>('/api/trips').catch(() => []),
      api<Destination[]>('/api/destinations').catch(() => []),
      api<{ districtsVisited: number; visitedDistricts: string[] }>('/api/me/footprint').catch(() => null),
      api<{ totalSpent: number }>('/api/expenses/overview').catch(() => null),
    ]).then(([userData, tripsData, destsData, footData, expData]) => {
      setUser(userData)
      setTrips(tripsData)
      setDestinations(destsData)
      setFootprint(footData)
      setExpensesOverview(expData)
      setLoading(false)
    })
  }, [])

  const upcomingTrips = trips.filter((t) => t.status === 'UPCOMING' || t.status === 'PLANNING')
  const totalBudget = trips.reduce((sum, t) => sum + Number(t.budget || 0), 0)
  const totalSpent = expensesOverview?.totalSpent ?? 0
  const planningProgress = totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 100) : 0
  const nextTrip = upcomingTrips[0]

  return (
    <div className="page">
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        title={`Good morning, ${user?.name || 'Traveler'}.`}
        description="Your next adventure is closer than you think. Everything is tracked in real-time."
        action={
          <button className="primary-btn" onClick={() => navigate('/trips/create')}>
            <Plus size={17} /> Plan a trip
          </button>
        }
      />

      <section className="hero-card">
        <div className="hero-copy">
          <span className="pill light"><Sparkles size={14} /> Porikroma pick</span>
          <h2>Go where the<br /><em>air feels different.</em></h2>
          <p>Let a little curiosity lead the way. Explore slow travel, hidden trails, and plans made just for you.</p>
          <button className="light-btn" onClick={() => navigate('/destinations')}>
            Explore destinations <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="hero-art">
          <div className="sun" />
          <div className="mountain mountain-back" />
          <div className="mountain mountain-front" />
          <div className="hero-caption"><MapPin size={15} /> Sajek Valley, Bangladesh</div>
        </div>
      </section>

      <div className="section-header">
        <div>
          <h2 className="section-title">Your journey at a glance</h2>
          <p className="muted">Live records for your account.</p>
        </div>
        <button className="text-btn" onClick={() => navigate('/trips')}>
          View all trips <ArrowUpRight size={16} />
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon orange"><Compass /></div>
          <strong>{trips.length}</strong>
          <span>Trips planned</span>
          <small>{upcomingTrips.length} upcoming / active</small>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><MapPin /></div>
          <strong>{footprint?.districtsVisited ?? 0}</strong>
          <span>Districts explored</span>
          <small>Across 64 Bangladesh districts</small>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Wallet /></div>
          <strong>৳ {totalSpent.toLocaleString()}</strong>
          <span>Total expenses</span>
          <small>Of ৳ {totalBudget.toLocaleString()} budgeted</small>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><TrendingUp /></div>
          <strong>{planningProgress}%</strong>
          <span>Budget utilized</span>
          <small>{totalBudget > 0 ? 'Tracking smoothly' : 'Add a trip budget'}</small>
        </div>
      </div>

      <div className="content-grid">
        <section className="panel upcoming-panel">
          <div className="panel-heading">
            <div>
              <h2>Coming up next</h2>
              <p>Your upcoming itineraries.</p>
            </div>
            <button className="text-btn" onClick={() => navigate('/trips/create')}>+ Add</button>
          </div>
          <div className="trip-list">
            {upcomingTrips.slice(0, 3).map((trip) => (
              <button className="trip-row" key={trip.id} onClick={() => navigate(`/trips/${trip.id}`)}>
                <img src={trip.destination_image || 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=85'} alt="" />
                <div className="trip-row-copy">
                  <strong>{trip.name}</strong>
                  <span><MapPin size={14} /> {trip.destination_name}</span>
                  <small>{trip.start_date} – {trip.end_date}</small>
                </div>
                <span className={`status ${trip.status === 'UPCOMING' ? 'coral' : 'blue'}`}>{trip.status}</span>
                <ChevronRight size={17} className="row-chevron" />
              </button>
            ))}
            {!upcomingTrips.length && (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: '#5a685e', fontSize: '14px' }}>
                No upcoming trips planned yet. <Link to="/trips/create" style={{ color: 'var(--green)', fontWeight: 600 }}>Create your first trip</Link>
              </div>
            )}
          </div>
          <button className="panel-link" onClick={() => navigate('/trips')}>See all trips <ChevronRight size={16} /></button>
        </section>

        {/* Live Weather Forecast Panel */}
        <section className="panel" style={{ padding: '20px' }}>
          <div className="panel-heading" style={{ marginBottom: '14px' }}>
            <div>
              <h2>Right now</h2>
              <p>
                {nextTrip
                  ? `Weather for your upcoming trip to ${nextTrip.destination_name || 'destination'}`
                  : 'Live regional weather overview'}
              </p>
            </div>
            <span className="status green">Live</span>
          </div>

          <WeatherWidget
            destinationId={nextTrip?.destination_id}
            destinationName={nextTrip?.destination_name || 'Cox’s Bazar'}
            datesLabel={nextTrip ? `${nextTrip.start_date} – ${nextTrip.end_date}` : 'Current seasonal conditions'}
          />

          {nextTrip && (
            <button
              className="panel-link"
              style={{ marginTop: '14px' }}
              onClick={() => navigate(`/trips/${nextTrip.id}`)}
            >
              Open {nextTrip.name} workspace <ChevronRight size={16} />
            </button>
          )}
        </section>
      </div>

      <div className="section-header" style={{ marginTop: '36px' }}>
        <div>
          <p className="eyebrow">Recommendations</p>
          <h2 className="section-title">Places for your next chapter</h2>
        </div>
        <button className="text-btn" onClick={() => navigate('/destinations')}>
          Explore all destinations <ArrowUpRight size={16} />
        </button>
      </div>

      <div className="recommendation-grid">
        {destinations.slice(0, 3).map((dest) => (
          <article className="recommendation-card" key={dest.id}>
            <img src={dest.image || 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=85'} alt={dest.name} />
            <div className="recommendation-copy">
              <span className="recommendation-reason"><Sparkles size={14} /> Recommended for you</span>
              <h3>{dest.name}</h3>
              <p className="recommendation-meta">{dest.district} · {dest.division}</p>
              <div className="recommendation-footer">
                <span><Banknote size={14} /> From ৳ {dest.estimated_budget?.toLocaleString()}</span>
                <button onClick={() => navigate(`/destinations/${dest.id}`)}>Explore place <ArrowUpRight size={15} /></button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

export default DashboardPage
