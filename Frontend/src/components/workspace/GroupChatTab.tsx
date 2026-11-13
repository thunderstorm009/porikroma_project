import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { api } from '../../api'

export interface GroupChatTabProps {
  groupId: string
  tripId: string
}

export function GroupChatTab({ groupId }: GroupChatTabProps) {
  const [messages, setMessages] = useState<{ id: string; sender_name?: string; body: string; created_at: string }[]>([])
  const [input, setInput] = useState('')
  const chatScrollRef = useRef<HTMLDivElement>(null)

  const load = () =>
    api<typeof messages>(`/api/groups/${groupId}/messages`)
      .then((data) => {
        if (data) setMessages(data)
      })
      .catch(() => undefined)

  useEffect(() => {
    load()
    const interval = setInterval(load, 3500)
    return () => clearInterval(interval)
  }, [groupId])

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [messages])

  const send = async () => {
    if (!input.trim()) return
    const text = input.trim()
    setInput('')
    await api(`/api/groups/${groupId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body: text }),
    })
    load()
  }

  return (
    <div className="panel workspace-content" style={{ display: 'flex', flexDirection: 'column', height: '480px' }}>
      <div className="panel-heading">
        <div>
          <h2>Group expedition chat</h2>
          <p>Real-time group messaging for verified participants (auto-synced)</p>
        </div>
      </div>

      <div ref={chatScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div className="avatar" style={{ width: '22px', height: '22px', fontSize: '10px' }}>{m.sender_name?.[0] || 'U'}</div>
              <strong style={{ fontSize: '12px' }}>{m.sender_name || 'Traveler'}</strong>
              <small style={{ color: '#506155' }}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
            </div>
            <p style={{ margin: '4px 0 0 30px', fontSize: '13px' }}>{m.body}</p>
          </div>
        ))}
        {!messages.length && (
          <div style={{ padding: '30px', textAlign: 'center', color: '#506155' }}>No messages yet. Send a greeting to your fellow travelers!</div>
        )}
      </div>

      <div className="chat-input" style={{ borderTop: '1px solid var(--line)', paddingTop: '12px' }}>
        <input placeholder="Write a message to the group..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button onClick={send} aria-label="Send message"><Send size={17} /></button>
      </div>
    </div>
  )
}

export default GroupChatTab
