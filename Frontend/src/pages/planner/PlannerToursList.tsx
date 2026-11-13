import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Calendar, ArrowUpRight } from 'lucide-react'
import { api } from '../../api'
import { PageHeader } from '../../components/common/PageHeader'

export function PlannerToursList() {
  const navigate = useNavigate()
  const [tours, setTours] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<any[]>('/api/planner/tours')
      .then(setTours)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page role-page">
      <PageHeader
        title="My published tours"
        description="Tours active in the Porikroma traveler discovery catalog."
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="outline-btn" onClick={() => navigate('/planner/schedules')}>
              <Calendar size={17} /> Departure schedules
            </button>
            <button className="primary-btn" onClick={() => navigate('/planner/tours/create')}>
              <Plus size={17} /> Create tour
            </button>
          </div>
        }
      />

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Destination</th>
              <th>Price</th>
              <th>Departures</th>
              <th>Participants</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tours.map((t) => (
              <tr key={t.id}>
                <td><strong>{t.title}</strong></td>
                <td>{t.destination_name}</td>
                <td>৳ {Number(t.price).toLocaleString()}</td>
                <td>{t.departures_count ?? 0} scheduled</td>
                <td>{t.total_participants ?? 0} booked</td>
                <td><span className="badge badge-green">{t.status}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="outline-btn small"
                      onClick={() => navigate(`/tours/${t.id}`)}
                      title="View public tour dossier"
                      style={{ padding: '4px 8px', fontSize: '12.5px' }}
                    >
                      <ArrowUpRight size={13} /> View
                    </button>
                    <button
                      className="secondary-btn small"
                      onClick={() => navigate('/planner/schedules')}
                      title="Schedule departures for this package"
                      style={{ padding: '4px 8px', fontSize: '12.5px' }}
                    >
                      <Calendar size={13} /> Schedule
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!tours.length && !loading && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px 16px', color: '#5a685e', fontSize: '14px' }}>
                  No tour packages created yet. Click <strong>"Create tour"</strong> to publish your first guided expedition.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PlannerToursList
