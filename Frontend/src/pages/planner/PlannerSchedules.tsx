import { useEffect, useState } from 'react'
import { api } from '../../api'
import { PageHeader } from '../../components/common/PageHeader'

export function PlannerSchedules() {
  const [departures, setDepartures] = useState<any[]>([])

  useEffect(() => {
    api<any[]>('/api/planner/departures').then(setDepartures).catch(() => undefined)
  }, [])

  return (
    <div className="page role-page">
      <PageHeader title="Departure schedules" description="All planned departures for your guided tours." />
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tour</th>
              <th>Destination</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Seats</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {departures.map((d) => (
              <tr key={d.id}>
                <td><strong>{d.tour_title}</strong></td>
                <td>{d.destination_name}</td>
                <td>{d.start_date}</td>
                <td>{d.end_date}</td>
                <td>{d.booked_count} / {d.capacity}</td>
                <td><span className="badge badge-green">{d.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PlannerSchedules
