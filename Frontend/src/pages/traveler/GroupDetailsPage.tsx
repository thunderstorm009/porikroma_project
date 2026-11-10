import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ShieldCheck, Clock3, ArrowUpRight, Users, CheckCircle2, FileText, Banknote, X, Send } from 'lucide-react'
import { api } from '../../api'
import type { GroupExpedition, User, WorkspaceData } from '../../types'
import { PageHeader } from '../../components/common/PageHeader'

export function GroupDetailsPage() {
  const { groupId = '' } = useParams()
  const [group, setGroup] = useState<GroupExpedition & { members?: User[]; itinerary?: WorkspaceData['itinerary']; trip_description?: string } | null>(null)
  const [drawer, setDrawer] = useState(false)
  const [answers, setAnswers] = useState({ experience: '', dietary: 'No restrictions', commitment: 'Yes, full schedule' })
  const [applied, setApplied] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    // If preview or specific ID
    const targetId = groupId === 'preview' ? 'first' : groupId
    api<GroupExpedition[]>('/api/groups').then((list) => {
      const match = targetId === 'first' ? list[0] : list.find((g) => g.id === targetId)
      if (match) {
        api<typeof group>(`/api/groups/${match.id}`).then(setGroup).catch(() => setGroup(match as any))
      }
    })
  }, [groupId])

  const submitApplication = async () => {
    if (!group) return
    await api(`/api/groups/${group.id}/applications`, {
      method: 'POST',
      body: JSON.stringify(answers),
    })
    setApplied(true)
    setDrawer(false)
    setFeedback('Your join request has been submitted to the organizer.')
  }

  if (!group) return <div className="page"><p className="muted">Loading expedition dossier…</p></div>

  return (
    <div className="page">
      <PageHeader
        eyebrow="Expedition dossier · Verified organizer"
        title={group.title}
        description="A thoughtful, small-group journey crafted with local respect."
        action={<span className="status green"><ShieldCheck size={12} /> Verified expedition</span>}
      />

      <div className="expedition-detail-layout">
        <main>
          <div className="panel group-detail">
            <div className="group-detail-cover">
              <img src={group.destination_image || 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200&q=85'} alt={group.title} />
              <span className="status green">{group.capacity - (group.member_count || 1)} seats left</span>
            </div>
            <div className="group-detail-body">
              <div>
                <div className="organizer">
                  <div className="avatar">{group.organizer_name?.[0] || 'N'}</div>
                  <div>
                    <strong>{group.organizer_name || 'Nadia Rahman'}</strong>
                    <small>✦ 4.9 · 12 expeditions led</small>
                  </div>
                </div>
                <h2>{group.destination_name}</h2>
                <p>{group.start_date} – {group.end_date} · Max {group.capacity} travelers</p>
                <p>{group.trip_description || 'We are looking for curious, easygoing travelers who enjoy discovering a place slowly and sharing the small moments.'}</p>
              </div>
              <div className="group-detail-side">
                <strong>৳ {Number(group.budget_per_person).toLocaleString()}</strong>
                <small>estimated share / person</small>
                {feedback ? (
                  <p className="positive" style={{ margin: '8px 0', fontSize: '12px' }}>{feedback}</p>
                ) : (
                  <button className="primary-btn" onClick={() => setDrawer(true)} disabled={applied}>
                    {applied ? 'Request submitted' : 'Request to join'} <ArrowUpRight size={14} />
                  </button>
                )}
                <small><Clock3 size={11} /> Application reviewed by organizer</small>
              </div>
            </div>
          </div>

          {/* Itinerary */}
          {group.itinerary && group.itinerary.length > 0 && (
            <section className="panel detail-section">
              <div className="panel-heading">
                <div>
                  <h2>Day-by-day itinerary</h2>
                  <p>What the journey feels like</p>
                </div>
                <span className="status blue">Planned</span>
              </div>
              {group.itinerary.map((item, idx) => (
                <div className="itinerary-row" key={item.id}>
                  <span className="itinerary-day">Day {idx + 1}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.notes || item.location || 'Local sights and culture'}</p>
                  </div>
                  <small>{item.day_date}</small>
                </div>
              ))}
            </section>
          )}
        </main>

        <aside className="detail-sidebar">
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>People going</h2>
                <p>{group.member_count || 1} of {group.capacity} spots filled</p>
              </div>
              <Users size={18} />
            </div>
            {group.members?.map((m) => (
              <div className="member-row" key={m.id}>
                <div className="avatar">{m.name[0]}</div>
                <div>
                  <strong>{m.name}</strong>
                  <small>Expedition member</small>
                </div>
                <CheckCircle2 size={15} color="var(--green)" />
              </div>
            ))}
          </div>

          <div className="panel requirements">
            <h2>Before you apply</h2>
            <p><FileText size={13} /> Comfortable with walking and outdoor trails</p>
            <p><ShieldCheck size={13} /> Answers reviewed privately by organizer</p>
            <p><Banknote size={13} /> Deposit requested only after application approval</p>
          </div>
        </aside>
      </div>

      {drawer && (
        <div className="drawer-backdrop" onClick={() => setDrawer(false)}>
          <aside className="join-drawer" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDrawer(false)}><X size={19} /></button>
            <p className="eyebrow">Expedition dossier</p>
            <h2>Join request application</h2>
            <p className="drawer-intro">Answer a few quick questions so the group travels well together.</p>

            <div style={{ marginTop: '16px' }}>
              <label>What is your previous travel or trekking experience?
                <textarea rows={3} placeholder="e.g. Hiked in Bandarban, comfortable walking 4-5 hours..." value={answers.experience} onChange={(e) => setAnswers({ ...answers, experience: e.target.value })} />
              </label>

              <label style={{ marginTop: '12px' }}>Dietary requirements
                <select value={answers.dietary} onChange={(e) => setAnswers({ ...answers, dietary: e.target.value })}>
                  <option>No restrictions</option>
                  <option>Vegetarian</option>
                  <option>Halal only</option>
                  <option>Other</option>
                </select>
              </label>

              <label style={{ marginTop: '12px' }}>Can you commit to the complete travel dates?
                <select value={answers.commitment} onChange={(e) => setAnswers({ ...answers, commitment: e.target.value })}>
                  <option>Yes, fully committed</option>
                  <option>Tentative pending schedule</option>
                </select>
              </label>

              <button className="primary-btn drawer-next" style={{ marginTop: '20px', width: '100%', justifyContent: 'center' }} onClick={submitApplication}>
                Submit application <Send size={15} />
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

export default GroupDetailsPage
