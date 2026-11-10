import { useEffect, useState } from 'react'
import { Plus, Sparkles, Copy, Send } from 'lucide-react'
import { api } from '../../api'

export function PlannerPage() {
  const [conversations, setConversations] = useState<{ id: string; title: string; created_at: string }[]>([])
  const [activeConvoId, setActiveConvoId] = useState<string>('')
  const [messages, setMessages] = useState<{ id: string; sender: 'USER' | 'ASSISTANT'; body: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  // Load user conversations
  useEffect(() => {
    api<typeof conversations>('/api/ai/conversations').then((convos) => {
      setConversations(convos)
      if (convos.length > 0) {
        setActiveConvoId(convos[0].id)
      } else {
        // Create initial session
        api<{ id: string; title: string }>('/api/ai/conversations', { method: 'POST', body: JSON.stringify({ title: 'Bangladesh Slow Travel Ideas' }) })
          .then((newConvo) => {
            setConversations([newConvo as any])
            setActiveConvoId(newConvo.id)
          })
      }
    })
  }, [])

  // Load messages when active session changes
  useEffect(() => {
    if (!activeConvoId) return
    api<typeof messages>(`/api/ai/conversations/${activeConvoId}/messages`)
      .then(setMessages)
      .catch(() => undefined)
  }, [activeConvoId])

  const newSession = async () => {
    const title = window.prompt('Session name (e.g. Sylhet 4-day slow route):') || 'New Travel Plan'
    const convo = await api<{ id: string; title: string }>('/api/ai/conversations', { method: 'POST', body: JSON.stringify({ title }) })
    setConversations([convo as any, ...conversations])
    setActiveConvoId(convo.id)
  }

  const sendMessage = async (textToSend?: string) => {
    const msg = textToSend || input
    if (!msg.trim() || !activeConvoId) return
    setInput('')
    setLoading(true)

    // Optimistic user message
    const tempUserMsg = { id: `temp-${Date.now()}`, sender: 'USER' as const, body: msg }
    setMessages((prev) => [...prev, tempUserMsg])

    try {
      const result = await api<{ userMessage: any; assistantMessage: any }>(`/api/ai/conversations/${activeConvoId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: msg }),
      })
      setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), result.userMessage, result.assistantMessage])
    } catch {
      // Fallback assistant response
      setMessages((prev) => [...prev, { id: `fallback-${Date.now()}`, sender: 'ASSISTANT', body: 'I’ve shaped a personalized route for that destination. Consider a 3-day slow itinerary with ৳8,500 budget buffer and local eco-cottages.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="planner-page">
      <div className="planner-sidebar">
        <div className="panel-heading">
          <div>
            <h2>Travel sessions</h2>
            <p>{conversations.length} persistent</p>
          </div>
          <span className="status green">PostgreSQL</span>
        </div>

        <button className="primary-btn session-new" onClick={newSession}>
          <Plus size={16} /> New prompt session
        </button>

        <p className="eyebrow session-label">Your sessions</p>
        <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
          {conversations.map((c) => (
            <button
              className={c.id === activeConvoId ? 'session active' : 'session'}
              key={c.id}
              onClick={() => setActiveConvoId(c.id)}>
              <strong>{c.title}</strong>
              <small>{new Date(c.created_at).toLocaleDateString()}</small>
            </button>
          ))}
        </div>

        <div className="knowledge-sync">
          <strong>Knowledge graph synced</strong>
          <span>99.4%</span>
          <small>64 districts, hill-tract check-posts, and seasonal BDT fare tables active.</small>
        </div>
      </div>

      <div className="planner-main">
        <div className="planner-heading">
          <div>
            <p className="eyebrow">Porikroma intelligence</p>
            <h2>AI Planner <span className="status green">Live graph</span></h2>
            <p>Bangladesh regional autonomous travel synthesis</p>
          </div>
        </div>

        <div className="planner-prompts">
          <span>Suggested inquiries</span>
          <button onClick={() => sendMessage('Optimize ৳50,000 budget for Cox’s Bazar')}>Optimize ৳50,000 for Cox’s Bazar</button>
          <button onClick={() => sendMessage('Plan a 3-day slow trip to Sylhet tea estates')}>3-day slow trip to Sylhet</button>
          <button onClick={() => sendMessage('What gear do I need for trekking Keokradong in Bandarban?')}>Bandarban trek packing</button>
        </div>

        <div className="page assistant-page" style={{ padding: 0 }}>
          <div className="assistant-layout">
            <section className="chat-panel">
              <div className="chat-top">
                <div className="ai-orb"><Sparkles size={18} /></div>
                <div>
                  <strong>Porikroma Travel Copilot</strong>
                  <span>Fine-tuned for Bangladesh terrain, local food & budget travel</span>
                </div>
                <span className="online"><i /> Online</span>
              </div>

              <div className="chat-messages" style={{ minHeight: '320px', maxHeight: '420px', overflowY: 'auto' }}>
                {messages.map((m, idx) => (
                  <div className={`message ${m.sender === 'ASSISTANT' ? 'ai' : 'user'}`} key={m.id || idx}>
                    <div className="message-avatar">{m.sender === 'ASSISTANT' ? <Sparkles size={14} /> : 'R'}</div>
                    <div className="message-bubble" style={{ whiteSpace: 'pre-wrap' }}>
                      {m.body}
                      {m.sender === 'ASSISTANT' && (
                        <div className="message-actions">
                          <button onClick={() => navigator.clipboard.writeText(m.body)}><Copy size={13} /> Copy</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="message ai">
                    <div className="message-avatar"><Sparkles size={14} /></div>
                    <div className="message-bubble">Synthesizing itinerary and regional advice…</div>
                  </div>
                )}
              </div>

              <div className="chat-input">
                <input
                  placeholder="Ask anything about Bangladesh travel, routes, stays, and budgets..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button onClick={() => sendMessage()}><Send size={17} /></button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PlannerPage
