import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../../api'
import type { WorkspaceData } from '../../types'

export interface MembersTabProps {
  tripId: string
  members: WorkspaceData['members']
  onRefresh: () => void
}

export function MembersTab({ tripId, members, onRefresh }: MembersTabProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const invite = async () => {
    setError('')
    if (!email.trim()) return
    try {
      await api(`/api/trips/${tripId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      })
      setEmail('')
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to invite member')
    }
  }

  const remove = async (userId: string) => {
    await api(`/api/trips/${tripId}/members/${userId}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className="panel workspace-content">
      <div className="panel-heading">
        <div>
          <h2>Trip travelers</h2>
          <p>{members.length} people sharing this journey</p>
        </div>
      </div>

      <div className="inline-add" style={{ margin: '14px 0' }}>
        <input type="email" placeholder="Enter traveler's email to invite..." value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="primary-btn" onClick={invite}><Plus size={17} /> Add member</button>
      </div>
      {error && <p className="error-text">{error}</p>}

      <div style={{ marginTop: '16px' }}>
        {members.map((m) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #edf0ea' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="avatar">{m.name[0]}</div>
              <div>
                <strong>{m.name}</strong>
                <small style={{ display: 'block', color: '#506155' }}>{m.email} · <span className="badge badge-green">{m.role}</span></small>
              </div>
            </div>
            {m.role !== 'OWNER' && (
              <button className="icon-btn" onClick={() => remove(m.id)} title="Remove member" aria-label="Remove member"><Trash2 size={16} /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default MembersTab
