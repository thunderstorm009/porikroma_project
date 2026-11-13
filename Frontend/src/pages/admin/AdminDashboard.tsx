import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { PageHeader } from '../../components/common/PageHeader'

export function AdminDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<any>(null)
  const [reports, setReports] = useState<any[]>([])

  useEffect(() => {
    api<any>('/api/admin/analytics').then(setStats).catch(() => undefined)
    api<any[]>('/api/admin/reports').then(setReports).catch(() => undefined)
  }, [])

  return (
    <div className="page role-page">
      <PageHeader
        eyebrow="Platform control center"
        title={`Good morning, ${user?.name || 'Admin'}.`}
        description="A real-time overview of Porikroma platform scale and moderation."
      />

      <div className="role-stat-grid">
        <div className="role-stat">
          <span>Total users</span>
          <strong>{stats?.users ?? 0}</strong>
          <small>Across Bangladesh</small>
        </div>
        <div className="role-stat">
          <span>Tour planners</span>
          <strong>{stats?.planners ?? 0}</strong>
          <small>{stats?.pending_verifications ?? 0} pending verification</small>
        </div>
        <div className="role-stat">
          <span>Trips created</span>
          <strong>{stats?.trips ?? 0}</strong>
          <small>{stats?.active_groups ?? 0} active groups</small>
        </div>
        <div className="role-stat">
          <span>Reports queue</span>
          <strong>{stats?.reports ?? 0}</strong>
          <small>Needs attention</small>
        </div>
      </div>

      <div className="panel" style={{ marginTop: '24px' }}>
        <h2>User reports queue</h2>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reporter</th>
                <th>Reported User</th>
                <th>Reason</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{r.reporter_name}</td>
                  <td><strong>{r.reported_user_name}</strong></td>
                  <td>{r.reason}</td>
                  <td>{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {!reports.length && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '32px 16px', color: '#5a685e', fontSize: '14px' }}>
                    No reports in the queue. All clear!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
