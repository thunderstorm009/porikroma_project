import { useEffect, useState } from 'react'
import { api } from '../../api'
import { PageHeader } from '../../components/common/PageHeader'

export function PlannerParticipants() {
  const [bookings, setBookings] = useState<any[]>([])

  useEffect(() => {
    api<any[]>('/api/planner/bookings').then(setBookings).catch(() => undefined)
  }, [])

  const updateStatus = async (id: string, status: string) => {
    await api(`/api/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
    api<any[]>('/api/planner/bookings').then(setBookings)
  }

  return (
    <div className="page role-page">
      <PageHeader title="Tour participants & bookings" description="Confirm and coordinate travelers for your upcoming departures." />
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Traveler</th>
              <th>Email</th>
              <th>Tour</th>
              <th>Travelers</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td><strong>{b.traveler_name}</strong></td>
                <td>{b.traveler_email}</td>
                <td>{b.tour_title}</td>
                <td>{b.travelers_count} person</td>
                <td><span className={`badge ${b.status === 'CONFIRMED' ? 'badge-green' : b.status === 'CANCELLED' ? 'badge-red' : 'badge-orange'}`}>{b.status}</span></td>
                <td>
                  {b.status === 'PENDING' && (
                    <button className="primary-btn small" onClick={() => updateStatus(b.id, 'CONFIRMED')}>Confirm</button>
                  )}
                  {b.status === 'CONFIRMED' && (
                    <button className="danger-btn small" onClick={() => updateStatus(b.id, 'CANCELLED')}>Cancel</button>
                  )}
                </td>
              </tr>
            ))}
            {!bookings.length && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px 16px', color: '#5a685e', fontSize: '14px' }}>
                  No booking reservations received yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PlannerParticipants
