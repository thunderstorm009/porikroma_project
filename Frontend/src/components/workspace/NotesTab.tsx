import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../../api'
import type { WorkspaceData } from '../../types'

export interface NotesTabProps {
  tripId: string
  notes: WorkspaceData['notes']
  onRefresh: () => void
}

export function NotesTab({ tripId, notes, onRefresh }: NotesTabProps) {
  const [body, setBody] = useState('')

  const save = async () => {
    if (!body.trim()) return
    await api(`/api/trips/${tripId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body: body.trim() }),
    })
    setBody('')
    onRefresh()
  }

  const deleteNote = async (id: string) => {
    await api(`/api/trips/${tripId}/notes/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className="panel workspace-content">
      <div className="panel-heading">
        <div>
          <h2>Trip notes</h2>
          <p>Useful little details, tickets, and directions</p>
        </div>
      </div>

      <div style={{ margin: '14px 0' }}>
        <textarea
          style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--line)', padding: '12px 14px', fontSize: '16px', boxSizing: 'border-box' }}
          placeholder="Write a note, reminder, or transport detail..."
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button className="primary-btn" style={{ marginTop: '8px' }} onClick={save}><Plus size={17} /> Save note</button>
      </div>

      <div style={{ marginTop: '20px' }}>
        {notes.map((n) => (
          <div key={n.id} style={{ background: '#fcfdfa', border: '1px solid #edf0ea', borderRadius: '8px', padding: '14px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5 }}>{n.body}</p>
              <small style={{ color: '#506155', marginTop: '6px', display: 'block' }}>{n.author_name || 'You'} · {new Date(n.created_at).toLocaleDateString()}</small>
            </div>
            <button className="icon-btn" onClick={() => deleteNote(n.id)} title="Delete note" aria-label="Delete note"><Trash2 size={16} /></button>
          </div>
        ))}
        {!notes.length && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#506155' }}>No notes yet. Add your first note above!</div>
        )}
      </div>
    </div>
  )
}

export default NotesTab
