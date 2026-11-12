import { useEffect, useState } from "react"
import { Send } from "lucide-react"
import { api } from "../../api"

export interface GroupChatTabProps {
  groupId: string
  tripId: string
}

export function GroupChatTab({ groupId }: GroupChatTabProps) {
  const [messages, setMessages] = useState<{ id: string; sender_name?: string; body: string; created_at: string }[]>([])
  const [input, setInput] = useState("")

  const load = () => api<typeof messages>(`/api/groups/${groupId}/messages`).then(setMessages).catch(() => undefined)
  useEffect(() => { load() }, [groupId])

  const send = async () => {
    if (!input.trim()) return
    await api(`/api/groups/${groupId}/messages`, {
      method: "POST",
      body: JSON.stringify({ body: input.trim() }),
    })
    setInput("")
    load()
  }

  return (
    <div className="panel workspace-content group-chat-tab-container">
      <div className="panel-heading">
        <div>
          <h2>Group expedition chat</h2>
          <p>Real-time group messaging for verified participants</p>
        </div>
      </div>

      <div className="group-chat-tab-messages">
        {messages.map((m) => (
          <div key={m.id} className="group-chat-tab-item">
            <div className="group-chat-tab-item-header">
              <div className="avatar group-chat-tab-avatar">{m.sender_name?.[0] || "U"}</div>
              <strong className="group-chat-tab-sender">{m.sender_name || "Traveler"}</strong>
              <small className="group-chat-tab-time">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
            </div>
            <p className="group-chat-tab-body">{m.body}</p>
          </div>
        ))}
        {!messages.length && (
          <div className="group-chat-tab-empty">No messages yet. Send a greeting to your fellow travelers!</div>
        )}
      </div>

      <div className="chat-input group-chat-tab-input-box">
        <input placeholder="Write a message to the group..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button onClick={send}><Send size={16} /></button>
      </div>
    </div>
  )
}

export default GroupChatTab
