import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Calendar, Luggage, Users } from 'lucide-react'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { PageHeader } from '../../components/common/PageHeader'

export function PlannerDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tours, setTours] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [profile, setProfile] = useState<{ rating?: number; trips_count?: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api<any[]>('/api/planner/tours').catch(() => []),
      api<any[]>('/api/planner/bookings').catch(() => []),
      api<any>('/api/me/profile').catch(() => null),
    ]).then(([myTours, myBookings, myProfile]) => {
      setTours(myTours || [])
      setBookings(myBookings || [])
      setProfile(myProfile)
      setLoading(false)
    })
  }, [])

  const confirmedBookings = bookings.filter((b) => b.status === 'CONFIRMED')
  const totalTravelers = confirmedBookings.reduce((sum, b) => sum + (b.travelers_count || 1), 0)

  return (
    <div className="page role-page">
      <PageHeader
        eyebrow="Tour operations center"
        title={`Good morning, ${user?.name || 'Planner'}.`}
        description="Manage your tour departures, bookings, and traveler communications across Bangladesh."
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="outline-btn" onClick={() => navigate('/planner/schedules')}>
              <Calendar size={17} /> Schedules
            </button>
            <button className="primary-btn" onClick={() => navigate('/planner/tours/create')}>
              <Plus size={17} /> Create tour
            </button>
          </div>
        }
      />

      <div className="role-stat-grid">
        <div className="role-stat">
          <span>Published tours</span>
          <strong>{tours.length}</strong>
          <small>Active in catalog</small>
        </div>
        <div className="role-stat">
          <span>Confirmed bookings</span>
          <strong>{confirmedBookings.length}</strong>
          <small>{totalTravelers} travelers confirmed</small>
        </div>
        <div className="role-stat">
          <span>Planner rating</span>
          <strong>{profile?.rating ? profile.rating.toFixed(1) : '4.9'} ★</strong>
          <small>Certified verified host</small>
        </div>
      </div>

      <div className="role-content-grid" style={{ marginTop: '24px' }}>
        <section className="panel">
          <div className="panel-heading" style={{ marginBottom: '12px' }}>
            <h2>Recent tours</h2>
            <button className="text-btn" onClick={() => navigate('/planner/tours')}>View all</button>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Destination</th>
                  <th>Price</th>
                  <th>Departures</th>
                </tr>
              </thead>
              <tbody>
                {tours.slice(0, 5).map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.title}</strong></td>
                    <td>{t.destination_name}</td>
                    <td>৳ {Number(t.price).toLocaleString()}</td>
                    <td>{t.departures_count ?? 0} departures</td>
                  </tr>
                ))}
                {!tours.length && !loading && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '32px 16px', color: '#5a685e', fontSize: '14px' }}>
                      No tours published yet. Click "Create tour" to launch your first itinerary.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading" style={{ marginBottom: '12px' }}>
            <h2>Recent participant bookings</h2>
            <button className="text-btn" onClick={() => navigate('/planner/tours/participants')}>Manage all</button>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Traveler</th>
                  <th>Tour</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.slice(0, 5).map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.traveler_name}</strong>
                      <small style={{ color: '#5a685e', display: 'block' }}>{b.travelers_count} seat(s)</small>
                    </td>
                    <td>{b.tour_title}</td>
                    <td>
                      <span className={`badge ${b.status === 'CONFIRMED' ? 'badge-green' : b.status === 'CANCELLED' ? 'badge-red' : 'badge-orange'}`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {!bookings.length && !loading && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '32px 16px', color: '#5a685e', fontSize: '14px' }}>
                      No bookings recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

export default PlannerDashboard
