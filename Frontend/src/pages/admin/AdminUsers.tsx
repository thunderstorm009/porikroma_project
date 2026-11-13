import { useEffect, useState } from 'react'
import { api } from '../../api'
import { PageHeader } from '../../components/common/PageHeader'

export function AdminUsers() {
  const [users, setUsers] = useState<any[]>([])

  const load = () => api<any[]>('/api/admin/users').then(setUsers).catch(() => undefined)
  useEffect(() => { load() }, [])

  const changeRole = async (id: string, role: string) => {
    await api(`/api/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) })
    load()
  }

  const changeStatus = async (id: string, status: string) => {
    await api(`/api/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
    load()
  }

  return (
    <div className="page role-page">
      <PageHeader title="User directory" description="Manage user roles, platform permissions, and account status." />
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Trips</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.name}</strong></td>
                <td>{u.email}</td>
                <td>
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--line-strong)', fontSize: '14px', background: '#fff', height: '38px', minHeight: '38px' }}>
                    <option value="TRAVELER">TRAVELER</option>
                    <option value="TOUR_PLANNER">TOUR_PLANNER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
                <td>
                  <span className={`badge ${u.status === 'ACTIVE' ? 'badge-green' : 'badge-red'}`}>{u.status || 'ACTIVE'}</span>
                </td>
                <td>{u.trips_count}</td>
                <td>
                  {u.status !== 'SUSPENDED' ? (
                    <button className="danger-btn small" onClick={() => changeStatus(u.id, 'SUSPENDED')}>Suspend</button>
                  ) : (
                    <button className="primary-btn small" onClick={() => changeStatus(u.id, 'ACTIVE')}>Activate</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminUsers
