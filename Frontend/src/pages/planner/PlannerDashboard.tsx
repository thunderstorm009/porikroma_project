import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { api } from '../../api'
import { PageHeader } from '../../components/common/PageHeader'

export function PlannerDashboard() {
  const navigate = useNavigate()
  const [tours, setTours] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])

  useEffect(() => {
    api<any[]>('/api/planner/tours').then(setTours).catch(() => undefined)
    api<any[]>('/api/planner/bookings').then(setBookings).catch(() => undefined)
  }, [])

  return (
    <div className="page role-page">
      <PageHeader
        eyebrow="Tour operations center"
        title="Good morning, Nadia."
        description="Manage your tour departures, bookings, and traveler communications."
        action={<button className="primary-btn" onClick={() => navigate('/planner/tours/create')}><Plus size={16} /> Create tour</button>}
      />

      <div className="role-stat-grid">
        <div className="role-stat">
          <span>Published tours</span>
          <strong>{tours.length}</strong>
          <small>Active in catalog</small>
        </div>
        <div className="role-stat">
          <span>Active bookings</span>
          <strong>{bookings.length}</strong>
          <small>Travelers confirmed</small>
        </div>
        <div className="role-stat">
          <span>Average rating</span>
          <strong>4.9</strong>
          <small>From 48 traveler reviews</small>
        </div>
      </div>

      <div className="role-content-grid" style={{ marginTop: '24px' }}>
        <section className="panel">
          <h2>Recent tours</h2>
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
                {tours.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.title}</strong></td>
                    <td>{t.destination_name}</td>
                    <td>৳ {Number(t.price).toLocaleString()}</td>
                    <td>{t.departures_count || 1} departures</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <h2>Recent participant bookings</h2>
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
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>{b.traveler_name}</td>
                    <td>{b.tour_title}</td>
                    <td><span className="badge badge-green">{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

export default PlannerDashboard
