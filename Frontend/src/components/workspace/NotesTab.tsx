import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { api } from "../../api"
import type { WorkspaceData } from "../../types"

export interface NotesTabProps {
  tripId: string
  notes: WorkspaceData["notes"]
  onRefresh: () => void
}

export function NotesTab({ tripId, notes, onRefresh }: NotesTabProps) {
  const [body, setBody] = useState("")

  const save = async () => {
    if (!body.trim()) return
    await api(`/api/trips/${tripId}/notes`, {
      method: "POST",
      body: JSON.stringify({ body: body.trim() }),
    })
    setBody("")
    onRefresh()
  }

  const deleteNote = async (id: string) => {
    await api(`/api/trips/${tripId}/notes/${id}`, { method: "DELETE" })
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

      <div className="notes-tab-form">
        <textarea
          className="notes-tab-textarea"
          placeholder="Write a note, reminder, or transport detail..."
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button className="primary-btn notes-tab-save-btn" onClick={save}><Plus size={15} /> Save note</button>
      </div>

      <div className="notes-tab-list">
        {notes.map((n) => (
          <div key={n.id} className="notes-tab-card">
            <div>
              <p className="notes-tab-body">{n.body}</p>
              <small className="notes-tab-sub">{n.author_name || "You"} · {new Date(n.created_at).toLocaleDateString()}</small>
            </div>
            <button className="icon-btn" onClick={() => deleteNote(n.id)} title="Delete note"><Trash2 size={14} /></button>
          </div>
        ))}
        {!notes.length && (
          <div className="notes-tab-empty">No notes yet. Add your first note above!</div>
        )}
      </div>
    </div>
  )
}

export default NotesTab
