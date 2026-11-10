import { useEffect, useState } from 'react'
import { api } from '../../api'
import { PageHeader } from '../../components/common/PageHeader'

export function AdminGroups() {
  const [groups, setGroups] = useState<any[]>([])
  useEffect(() => { api<any[]>('/api/admin/groups').then(setGroups).catch(() => undefined) }, [])

  return (
    <div className="page role-page">
      <PageHeader title="Platform group expeditions" description="All small-group expeditions active on Porikroma." />
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Trip</th>
              <th>Organizer</th>
              <th>Capacity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id}>
                <td><strong>{g.title}</strong></td>
                <td>{g.trip_name}</td>
                <td>{g.organizer_name}</td>
                <td>{g.capacity} travelers</td>
                <td><span className="badge badge-green">Published</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminGroups
