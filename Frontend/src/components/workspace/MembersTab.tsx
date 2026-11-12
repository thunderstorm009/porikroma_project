import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { api } from "../../api"
import type { WorkspaceData } from "../../types"

export interface MembersTabProps {
  tripId: string
  members: WorkspaceData["members"]
  onRefresh: () => void
}

export function MembersTab({ tripId, members, onRefresh }: MembersTabProps) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")

  const invite = async () => {
    setError("")
    if (!email.trim()) return
    try {
      await api(`/api/trips/${tripId}/members`, {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      })
      setEmail("")
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to invite member")
    }
  }

  const remove = async (userId: string) => {
    await api(`/api/trips/${tripId}/members/${userId}`, { method: "DELETE" })
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

      <div className="inline-add members-tab-add">
        <input type="email" placeholder="Enter traveler's email to invite..." value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="primary-btn" onClick={invite}><Plus size={15} /> Add member</button>
      </div>
      {error && <p className="error-text">{error}</p>}

      <div className="members-tab-list">
        {members.map((m) => (
          <div key={m.id} className="members-tab-row">
            <div className="members-tab-user">
              <div className="avatar">{m.name[0]}</div>
              <div>
                <strong>{m.name}</strong>
                <small className="members-tab-sub">{m.email} · <span className="badge badge-green">{m.role}</span></small>
              </div>
            </div>
            {m.role !== "OWNER" && (
              <button className="icon-btn" onClick={() => remove(m.id)} title="Remove member"><Trash2 size={14} /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default MembersTab
