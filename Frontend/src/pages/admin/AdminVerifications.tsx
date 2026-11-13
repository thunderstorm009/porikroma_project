import { useEffect, useState } from 'react'
import { api } from '../../api'
import { PageHeader } from '../../components/common/PageHeader'

export function AdminVerifications() {
  const [verifs, setVerifs] = useState<any[]>([])

  const load = () => api<any[]>('/api/admin/verifications').then(setVerifs).catch(() => undefined)
  useEffect(() => { load() }, [])

  const decide = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await api(`/api/admin/verifications/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    load()
  }

  return (
    <div className="page role-page">
      <PageHeader title="Planner verifications" description="Review host verification requests and credentials." />
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Applicant</th>
              <th>Email</th>
              <th>Note</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {verifs.map((v) => (
              <tr key={v.id}>
                <td><strong>{v.user_name}</strong></td>
                <td>{v.user_email}</td>
                <td>{v.note || 'None'}</td>
                <td><span className={`badge ${v.status === 'APPROVED' ? 'badge-green' : v.status === 'REJECTED' ? 'badge-red' : 'badge-orange'}`}>{v.status}</span></td>
                <td>
                  {v.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="primary-btn small" onClick={() => decide(v.id, 'APPROVED')}>Approve</button>
                      <button className="danger-btn small" onClick={() => decide(v.id, 'REJECTED')}>Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!verifs.length && (
              <tr>
                <td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: '#5a685e', fontSize: '14px' }}>
                  No pending verification requests.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminVerifications
