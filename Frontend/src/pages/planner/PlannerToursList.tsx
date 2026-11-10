import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { api } from '../../api'
import { PageHeader } from '../../components/common/PageHeader'

export function PlannerToursList() {
  const navigate = useNavigate()
  const [tours, setTours] = useState<any[]>([])

  useEffect(() => {
    api<any[]>('/api/planner/tours').then(setTours).catch(() => undefined)
  }, [])

  return (
    <div className="page role-page">
      <PageHeader
        title="My published tours"
        description="Tours active in the Porikroma traveler discovery catalog."
        action={<button className="primary-btn" onClick={() => navigate('/planner/tours/create')}><Plus size={16} /> Create tour</button>}
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
            </tr>
          </thead>
          <tbody>
            {tours.map((t) => (
              <tr key={t.id}>
                <td><strong>{t.title}</strong></td>
                <td>{t.destination_name}</td>
                <td>৳ {Number(t.price).toLocaleString()}</td>
                <td>{t.departures_count}</td>
                <td>{t.total_participants} booked</td>
                <td><span className="badge badge-green">{t.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PlannerToursList
