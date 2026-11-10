import { useEffect, useState } from 'react'
import { api } from '../../api'
import { PageHeader } from '../../components/common/PageHeader'

export function AdminReports() {
  const [reports, setReports] = useState<any[]>([])

  const load = () => api<any[]>('/api/admin/reports').then(setReports).catch(() => undefined)
  useEffect(() => { load() }, [])

  const takeAction = async (reportId: string, action: string) => {
    await api(`/api/admin/reports/${reportId}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    })
    alert(`Moderation action "${action}" applied.`)
    load()
  }

  return (
    <div className="page role-page">
      <PageHeader title="Content & user moderation reports" description="Review safety reports and enforce community guidelines." />
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Reporter</th>
              <th>Reported User</th>
              <th>Reason</th>
              <th>Date</th>
              <th>Take Action</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>{r.reporter_name}</td>
                <td><strong>{r.reported_user_name}</strong></td>
                <td>{r.reason}</td>
                <td>{new Date(r.created_at).toLocaleDateString()}</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="secondary-btn" style={{ height: '26px', fontSize: '10px' }} onClick={() => takeAction(r.id, 'DISMISSED')}>Dismiss</button>
                    <button className="outline-btn" style={{ height: '26px', fontSize: '10px' }} onClick={() => takeAction(r.id, 'WARNING')}>Warn</button>
                    <button className="danger-btn" style={{ height: '26px', fontSize: '10px' }} onClick={() => takeAction(r.id, 'SUSPENDED')}>Suspend</button>
                  </div>
                </td>
              </tr>
            ))}
            {!reports.length && (
              <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#889' }}>No reports in the moderation queue.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminReports
