import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Plus, X, MapPin } from 'lucide-react'
import { api } from '../../api'
import type { Destination } from '../../types'
import { PageHeader } from '../../components/common/PageHeader'

export interface FootprintPageProps {
  subpage?: 'overview' | 'passport' | 'achievements' | 'timeline'
}

export function FootprintPage({ subpage = 'overview' }: FootprintPageProps) {
  const navigate = useNavigate()
  const [footprint, setFootprint] = useState<{ districtsVisited: number; visitedDistricts: string[]; travelDays: number; timeline: any[] } | null>(null)
  const [passport, setPassport] = useState<{ id: string; destination_name: string; district: string; division: string; visited_on?: string }[]>([])
  const [achievements, setAchievements] = useState<{ id: string; title: string; description: string; unlocked: boolean }[]>([])
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [showAddStamp, setShowAddStamp] = useState(false)
  const [stampDestId, setStampDestId] = useState('')

  useEffect(() => {
    api<typeof footprint>('/api/me/footprint').then(setFootprint).catch(() => undefined)
    api<typeof passport>('/api/me/passport').then(setPassport).catch(() => undefined)
    api<typeof achievements>('/api/me/achievements').then(setAchievements).catch(() => undefined)
    api<Destination[]>('/api/destinations').then(setDestinations).catch(() => undefined)
  }, [])

  const allDistricts = ['Cox’s Bazar', 'Sylhet', 'Bandarban', 'Dhaka', 'Rangamati', 'Chattogram', 'Rajshahi', 'Khulna', 'Moulvibazar', 'Bagerhat', 'Bogura', 'Barishal']
  const visited = footprint?.districtsVisited || passport.length || 4
  const districtPercent = Math.round((visited / 64) * 100)

  const addStamp = async () => {
    if (!stampDestId) return
    await api('/api/me/passport', {
      method: 'POST',
      body: JSON.stringify({ destinationId: stampDestId }),
    })
    setShowAddStamp(false)
    api<typeof passport>('/api/me/passport').then(setPassport)
    api<typeof footprint>('/api/me/footprint').then(setFootprint)
  }

  return (
    <div className="page footprint-page">
      <PageHeader
        eyebrow="Your story across Bangladesh"
        title="Travel footprint"
        description="See the places, districts, and memories that have become part of your story."
      />

      <div className="group-tabs">
        <Link to="/travel-footprint" className={`tab ${subpage === 'overview' ? 'active' : ''}`}>Overview</Link>
        <Link to="/travel-footprint/passport" className={`tab ${subpage === 'passport' ? 'active' : ''}`}>Passport</Link>
        <Link to="/travel-footprint/achievements" className={`tab ${subpage === 'achievements' ? 'active' : ''}`}>Achievements</Link>
        <Link to="/travel-footprint/timeline" className={`tab ${subpage === 'timeline' ? 'active' : ''}`}>Timeline</Link>
      </div>

      {subpage === 'overview' && (
        <>
          <section className="footprint-intro" style={{ marginTop: '20px' }}>
            <div className="avatar footprint-avatar">R</div>
            <div>
              <h2>Rafi Ahmed</h2>
              <p>The curious wanderer · Bangladesh explorer</p>
            </div>
            <div className="footprint-summary">
              <div><strong>{passport.length}</strong><span>stamps</span></div>
              <div><strong>{visited}</strong><span>districts</span></div>
              <div><strong>{footprint?.travelDays || 24}</strong><span>travel days</span></div>
            </div>
          </section>

          <div className="footprint-grid">
            <section className="panel footprint-map-panel">
              <div className="panel-heading">
                <div>
                  <h2>Bangladesh exploration</h2>
                  <p>{visited} of 64 districts · {districtPercent}% explored</p>
                </div>
                <div className="progress-ring" style={{ '--progress': `${districtPercent * 3.6}deg` } as React.CSSProperties}>
                  <strong>{districtPercent}%</strong>
                </div>
              </div>

              <div className="map-visual">
                <div className="map-outline">
                  <span className="map-label label-north">SYLHET</span>
                  <span className="map-label label-east">BANDARBAN</span>
                  <span className="map-label label-south">COX’S BAZAR</span>
                  <span className="map-label label-center">DHAKA</span>
                  {allDistricts.map((d, index) => (
                    <i className={index < visited ? 'visited-dot' : 'unvisited-dot'} key={d} title={d} />
                  ))}
                </div>
              </div>

              <div className="district-list" style={{ marginTop: '16px' }}>
                {allDistricts.map((district, idx) => {
                  const isVisited = idx < visited
                  return (
                    <div key={district} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #edf0ea' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`district-dot ${isVisited ? 'visited' : ''}`} />
                        {district}
                      </span>
                      <small className={isVisited ? 'positive' : 'muted'}>{isVisited ? 'Visited' : 'Unexplored'}</small>
                    </div>
                  )
                })}
              </div>
            </section>

            <aside className="footprint-side">
              <div className="panel">
                <h2>Explore deeper</h2>
                <p className="muted">Your milestones and memory booklet.</p>
                <div className="footprint-links">
                  <Link to="/travel-footprint/passport">Open passport <ArrowUpRight size={14} /></Link>
                  <Link to="/travel-footprint/achievements">See achievements <ArrowUpRight size={14} /></Link>
                  <Link to="/travel-footprint/timeline">View timeline <ArrowUpRight size={14} /></Link>
                </div>
              </div>
            </aside>
          </div>
        </>
      )}

      {subpage === 'passport' && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2>Official Travel Passport</h2>
            <button className="primary-btn" onClick={() => setShowAddStamp(true)}><Plus size={15} /> Add stamp</button>
          </div>

          <div className="passport">
            <div className="passport-cover">
              <span className="brand-mark">p</span>
              <strong>PORIKROMA</strong>
              <small>OFFICIAL TRAVEL PASSPORT</small>
              <div className="passport-seal">✦</div>
            </div>
            <div className="passport-pages">
              <div>
                <span className="eyebrow">Holder</span>
                <h2>Rafi Ahmed</h2>
                <p>Verified explorer of Bangladesh</p>
              </div>
              <div className="stamp-grid">
                {passport.map((p) => (
                  <div className="stamp" key={p.id}>
                    <span>VISITED</span>
                    <strong>{p.destination_name}</strong>
                    <small>{p.district}</small>
                  </div>
                ))}
                {!passport.length && (
                  <p style={{ color: '#889' }}>No stamps collected yet. Click Add stamp!</p>
                )}
              </div>
            </div>
          </div>

          {showAddStamp && (
            <div className="modal-backdrop" onClick={() => setShowAddStamp(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={() => setShowAddStamp(false)}><X size={18} /></button>
                <h2>Collect a new stamp</h2>
                <label>Select destination
                  <select value={stampDestId} onChange={(e) => setStampDestId(e.target.value)}>
                    <option value="">Choose place</option>
                    {destinations.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.district})</option>
                    ))}
                  </select>
                </label>
                <div className="modal-actions">
                  <button className="outline-btn" onClick={() => setShowAddStamp(false)}>Cancel</button>
                  <button className="primary-btn" onClick={addStamp}>Stamp passport</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {subpage === 'achievements' && (
        <div style={{ marginTop: '20px' }}>
          <div className="achievement-grid">
            {achievements.map((a) => (
              <div className={a.unlocked ? 'achievement unlocked' : 'achievement'} key={a.id}>
                <span>{a.unlocked ? '✦' : '○'}</span>
                <div>
                  <strong>{a.title}</strong>
                  <small>{a.description}</small>
                </div>
                <em>{a.unlocked ? 'Unlocked' : 'Locked'}</em>
              </div>
            ))}
            {!achievements.length && (
              <p style={{ color: '#889' }}>Loading achievements…</p>
            )}
          </div>
        </div>
      )}

      {subpage === 'timeline' && (
        <div style={{ marginTop: '20px' }}>
          <div className="timeline">
            {footprint?.timeline?.map((item, index) => (
              <article className="timeline-item" key={index}>
                <div className="timeline-dot" />
                <img src={item.image} alt="" />
                <div>
                  <span className="eyebrow">{item.type} · {item.date}</span>
                  <h2>{item.title}</h2>
                  <p><MapPin size={14} /> {item.place}</p>
                  <small>Status: {item.status}</small>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default FootprintPage
