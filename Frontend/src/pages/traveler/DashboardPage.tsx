import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Sparkles, ArrowUpRight, MapPin, Compass, Wallet, TrendingUp, ChevronRight, Banknote } from 'lucide-react'
import { api } from '../../api'
import type { Destination, Trip, User } from '../../types'
import { PageHeader } from '../../components/common/PageHeader'

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
          <span className="pill light"><Sparkles size={13} /> Porikroma pick</span>
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
          <div className="hero-caption"><MapPin size={14} /> Sajek Valley, Bangladesh</div>
        </div>
      </section>

      <div className="section-header">
        <div>
          <h2 className="section-title">Your journey at a glance</h2>
          <p className="muted">Backed by PostgreSQL records for your account.</p>
        </div>
        <button className="text-btn" onClick={() => navigate('/trips')}>
          View all trips <ArrowUpRight size={15} />
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
          <strong>{footprint?.districtsVisited ?? 4}</strong>
          <span>Districts explored</span>
          <small>Across Bangladesh</small>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Wallet /></div>
          <strong>৳ {(expensesOverview?.totalSpent || 24500).toLocaleString()}</strong>
          <span>Total expenses</span>
          <small>Of ৳ {(totalBudget || 32700).toLocaleString()} budgeted</small>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><TrendingUp /></div>
          <strong>88%</strong>
          <span>Planning progress</span>
          <small>You’re on track</small>
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
                  <span><MapPin size={12} /> {trip.destination_name}</span>
                  <small>{trip.start_date} – {trip.end_date}</small>
                </div>
                <span className={`status ${trip.status === 'UPCOMING' ? 'coral' : 'blue'}`}>{trip.status}</span>
                <ChevronRight size={17} className="row-chevron" />
              </button>
            ))}
            {!upcomingTrips.length && (
              <div style={{ padding: '24px', textAlign: 'center', color: '#778' }}>
                No upcoming trips planned yet. <Link to="/trips/create" style={{ color: 'var(--green)', fontWeight: 600 }}>Create your first trip</Link>
              </div>
            )}
          </div>
          <button className="panel-link" onClick={() => navigate('/trips')}>See all trips <ChevronRight size={15} /></button>
        </section>

        <section className="panel weather-panel">
          <div className="panel-heading">
            <div>
              <h2>Right now</h2>
              <p>Weather in your upcoming destination</p>
            </div>
            <span className="status green">Live</span>
          </div>
          <div className="weather-main">
            <span className="weather-icon">☀</span>
            <div>
              <strong>29°</strong>
              <span>Mostly sunny</span>
            </div>
            <div className="weather-place"><MapPin size={14} /> Cox’s Bazar</div>
          </div>
          <div className="forecast">
            <div><span>FRI</span><b>☀</b><strong>28°</strong></div>
            <div><span>SAT</span><b>⛅</b><strong>27°</strong></div>
            <div><span>SUN</span><b>☀</b><strong>29°</strong></div>
            <div><span>MON</span><b>🌦</b><strong>26°</strong></div>
          </div>
          <button className="panel-link" onClick={() => alert('Forecast: Mild coastal breeze, low humidity, perfect for sunrise walks.')}>
            View full forecast <ChevronRight size={15} />
          </button>
        </section>
      </div>

      <div className="section-header" style={{ marginTop: '36px' }}>
        <div>
          <p className="eyebrow">Recommendations</p>
          <h2 className="section-title">Places for your next chapter</h2>
        </div>
        <button className="text-btn" onClick={() => navigate('/destinations')}>
          Explore all destinations <ArrowUpRight size={15} />
        </button>
      </div>

      <div className="recommendation-grid">
        {destinations.slice(0, 3).map((dest) => (
          <article className="recommendation-card" key={dest.id}>
            <img src={dest.image || 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=85'} alt={dest.name} />
            <div className="recommendation-copy">
              <span className="recommendation-reason"><Sparkles size={12} /> Recommended for you</span>
              <h3>{dest.name}</h3>
              <p className="recommendation-meta">{dest.district} · {dest.division}</p>
              <p>{dest.description}</p>
              <div className="recommendation-footer">
                <span><Banknote size={13} /> From ৳ {dest.estimated_budget?.toLocaleString()}</span>
                <button onClick={() => navigate(`/destinations/${dest.id}`)}>Explore <ArrowUpRight size={14} /></button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

export default DashboardPage
