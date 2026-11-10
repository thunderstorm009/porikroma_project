import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { PageHeader } from '../../components/common/PageHeader'

export function GroupRequestsPage() {
  const [myApplications, setMyApplications] = useState<{ id: string; group_title: string; organizer_name: string; status: string; destination_name: string }[]>([])

  useEffect(() => {
    api<typeof myApplications>('/api/me/group-applications').then(setMyApplications).catch(() => undefined)
  }, [])

  const withdraw = async (id: string) => {
    await api(`/api/applications/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'WITHDRAWN' }),
    })
    api<typeof myApplications>('/api/me/group-applications').then(setMyApplications)
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Expeditions"
        title="Group requests & applications"
        description="Track the status of applications submitted to join group trips."
      />

      <div className="group-tabs">
        <Link to="/group-travel/explore" className="tab">Explore trips</Link>
        <Link to="/group-travel/my-groups" className="tab">My groups</Link>
        <Link to="/group-travel/requests" className="tab active">Requests & Applications</Link>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Expedition</th>
              <th>Destination</th>
              <th>Organizer</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {myApplications.map((app) => (
              <tr key={app.id}>
                <td><strong>{app.group_title}</strong></td>
                <td>{app.destination_name}</td>
                <td>{app.organizer_name}</td>
                <td>
                  <span className={`badge ${app.status === 'APPROVED' ? 'badge-green' : app.status === 'REJECTED' ? 'badge-red' : 'badge-orange'}`}>
                    {app.status}
                  </span>
                </td>
                <td>
                  {app.status === 'PENDING' && (
                    <button className="outline-btn small" onClick={() => withdraw(app.id)}>Withdraw</button>
                  )}
                </td>
              </tr>
            ))}
            {!myApplications.length && (
              <tr>
                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#889' }}>No pending applications.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default GroupRequestsPage
