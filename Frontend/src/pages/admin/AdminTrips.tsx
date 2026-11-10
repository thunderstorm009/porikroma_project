import { useEffect, useState } from 'react'
import { api } from '../../api'
import { PageHeader } from '../../components/common/PageHeader'

export function AdminTrips() {
  const [trips, setTrips] = useState<any[]>([])
  useEffect(() => { api<any[]>('/api/admin/trips').then(setTrips).catch(() => undefined) }, [])

  return (
    <div className="page role-page">
      <PageHeader title="Platform trips" description="All trips created by travelers across Porikroma." />
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Destination</th>
              <th>Creator</th>
              <th>Dates</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((t) => (
              <tr key={t.id}>
                <td><strong>{t.name}</strong></td>
                <td>{t.destination_name}</td>
                <td>{t.creator_name}</td>
                <td>{t.start_date} – {t.end_date}</td>
                <td><span className="badge badge-green">{t.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminTrips
