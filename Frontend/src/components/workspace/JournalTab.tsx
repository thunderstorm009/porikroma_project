import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { api } from '../../api'
import type { WorkspaceData } from '../../types'

export interface JournalTabProps {
  tripId: string
  notes: WorkspaceData['notes']
  onRefresh: () => void
}

export function JournalTab({ tripId, notes, onRefresh }: JournalTabProps) {
  const [memory, setMemory] = useState('')

  const saveMemory = async () => {
    if (!memory.trim()) return
    await api(`/api/trips/${tripId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body: `✦ Memory: ${memory.trim()}` }),
    })
    setMemory('')
    onRefresh()
  }

  const memories = notes.filter((n) => n.body.startsWith('✦ Memory:') || n.body.includes('Memory:'))

  return (
    <div className="panel workspace-content">
      <div className="panel-heading">
        <div>
          <h2>Travel journal & memories</h2>
          <p>Preserve stories, sounds, and moments from this journey</p>
        </div>
      </div>

      <div style={{ margin: '14px 0' }}>
        <textarea
          style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--line)', padding: '10px', fontSize: '12px' }}
          placeholder="Capture a memory from today’s journey..."
          rows={3}
          value={memory}
          onChange={(e) => setMemory(e.target.value)}
        />
        <button className="primary-btn" style={{ marginTop: '8px' }} onClick={saveMemory}><Sparkles size={15} /> Save memory</button>
      </div>

      <div style={{ marginTop: '20px' }}>
        {memories.map((m) => (
          <article key={m.id} style={{ background: '#f5f8f3', borderLeft: '4px solid var(--green)', padding: '14px', borderRadius: '4px', marginBottom: '12px' }}>
            <p style={{ margin: 0, fontStyle: 'italic', fontSize: '13px' }}>{m.body.replace('✦ Memory: ', '')}</p>
            <small style={{ color: '#6d7b71', marginTop: '6px', display: 'block' }}>Recorded on {new Date(m.created_at).toLocaleDateString()}</small>
          </article>
        ))}
        {!memories.length && (
          <div style={{ padding: '30px', textAlign: 'center', color: '#889' }}>No journal memories recorded yet. Record the first one!</div>
        )}
      </div>
    </div>
  )
}

export default JournalTab
