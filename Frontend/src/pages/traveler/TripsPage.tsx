import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, MapPin, CalendarDays, Banknote, ArrowUpRight } from 'lucide-react'
import { api } from '../../api'
import type { Trip } from '../../types'
import { PageHeader } from '../../components/common/PageHeader'

export function TripsPage() {
  const navigate = useNavigate()
  const [trips, setTrips] = useState<Trip[]>([])
  const [filter, setFilter] = useState('All trips')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const loadTrips = () => {
    setLoading(true)
    api<Trip[]>('/api/trips')
      .then(setTrips)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadTrips() }, [])

  const deleteTrip = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return
    await api(`/api/trips/${id}`, { method: 'DELETE' })
    loadTrips()
  }

  const filtered = trips.filter((t) => {
    const matchesFilter = filter === 'All trips' ||
      (filter === 'Upcoming' && t.status === 'UPCOMING') ||
      (filter === 'Planning' && t.status === 'PLANNING') ||
      (filter === 'Past' && t.status === 'COMPLETED')
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || (t.destination_name || '').toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  return (
    <div className="page">
      <PageHeader
        eyebrow="Your travel collection"
        title="Trips"
        description="Every journey you are planning, taking, or cherishing."
        action={
          <button className="primary-btn" onClick={() => navigate('/trips/create')}>
            <Plus size={17} /> New trip
          </button>
        }
      />

      <div className="filter-row">
        <div className="tabs">
          {['All trips', 'Upcoming', 'Planning', 'Past'].map((tab) => (
            <button className={filter === tab ? 'tab active' : 'tab'} key={tab} onClick={() => setFilter(tab)}>
              {tab}
            </button>
          ))}
        </div>
        <div className="group-filter" style={{ maxWidth: '300px' }}>
          <Search size={15} />
          <input placeholder="Search trips or places..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="trip-cards">
        {filtered.map((trip) => (
          <article className="trip-card" key={trip.id} onClick={() => navigate(`/trips/${trip.id}`)}>
            <div className="trip-card-image">
              <img src={trip.destination_image || 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=85'} alt={trip.name} />
              <span className={`status ${trip.status === 'UPCOMING' ? 'coral' : trip.status === 'COMPLETED' ? 'green' : 'blue'}`}>
                {trip.status}
              </span>
              <button className="image-more" onClick={(e) => { e.stopPropagation(); deleteTrip(trip.id, trip.name) }} title="Delete trip">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="trip-card-body">
              <h3>{trip.name}</h3>
              <p><MapPin size={14} /> {trip.destination_name}</p>
              <div className="trip-card-meta">
                <span><CalendarDays size={14} /> {trip.start_date} – {trip.end_date}</span>
                <span><Banknote size={14} /> ৳ {Number(trip.budget).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span className="card-link">Open workspace <ArrowUpRight size={15} /></span>
                <span style={{ fontSize: '11px', color: '#79857c' }}>{trip.member_count || 1} traveler{(trip.member_count || 1) > 1 ? 's' : ''}</span>
              </div>
            </div>
          </article>
        ))}

        <button className="new-trip-card" onClick={() => navigate('/trips/create')}>
          <span><Plus size={21} /></span>
          <strong>Start planning something new</strong>
          <small>Turn a daydream into a real journey.</small>
        </button>
      </div>

      {!loading && !filtered.length && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#778' }}>
          No trips found matching the selected filter.
        </div>
      )}
    </div>
  )
}

export default TripsPage
