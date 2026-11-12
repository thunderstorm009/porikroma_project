import { useState } from "react"
import { Sparkles } from "lucide-react"
import { api } from "../../api"
import type { WorkspaceData } from "../../types"

export interface JournalTabProps {
  tripId: string
  notes: WorkspaceData["notes"]
  onRefresh: () => void
}

export function JournalTab({ tripId, notes, onRefresh }: JournalTabProps) {
  const [memory, setMemory] = useState("")

  const saveMemory = async () => {
    if (!memory.trim()) return
    await api(`/api/trips/${tripId}/notes`, {
      method: "POST",
      body: JSON.stringify({ body: `✦ Memory: ${memory.trim()}` }),
    })
    setMemory("")
    onRefresh()
  }

  const memories = notes.filter((n) => n.body.startsWith("✦ Memory:") || n.body.includes("Memory:"))

  return (
    <div className="panel workspace-content">
      <div className="panel-heading">
        <div>
          <h2>Travel journal & memories</h2>
          <p>Preserve stories, sounds, and moments from this journey</p>
        </div>
      </div>

      <div className="journal-tab-form">
        <textarea
          className="journal-tab-textarea"
          placeholder="Capture a memory from today’s journey..."
          rows={3}
          value={memory}
          onChange={(e) => setMemory(e.target.value)}
        />
        <button className="primary-btn journal-tab-save-btn" onClick={saveMemory}><Sparkles size={15} /> Save memory</button>
      </div>

      <div className="journal-tab-list">
        {memories.map((m) => (
          <article key={m.id} className="journal-tab-memory">
            <p className="journal-tab-memory-body">{m.body.replace("✦ Memory: ", "")}</p>
            <small className="journal-tab-memory-date">Recorded on {new Date(m.created_at).toLocaleDateString()}</small>
          </article>
        ))}
        {!memories.length && (
          <div className="journal-tab-empty">No journal memories recorded yet. Record the first one!</div>
        )}
      </div>
    </div>
  )
}

export default JournalTab
