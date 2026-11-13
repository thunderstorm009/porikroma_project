import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Plus, X, MapPin, Search, CheckCircle2, Circle, Trash2 } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'
import type { Destination } from '../../types'
import { PageHeader } from '../../components/common/PageHeader'
import { createDistrictIcon } from '../../utils/leafletSetup'
import { BANGLADESH_DISTRICTS, normalizeDistrict } from '../../data/bangladeshDistricts'

export interface FootprintPageProps {
  subpage?: 'overview' | 'passport' | 'achievements' | 'timeline'
}

function MapResizer() {
  const map = useMap()
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 250)
    const handleResize = () => map.invalidateSize()
    window.addEventListener('resize', handleResize)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', handleResize)
    }
  }, [map])
  return null
}

export function FootprintPage({ subpage = 'overview' }: FootprintPageProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [footprint, setFootprint] = useState<{ districtsVisited: number; visitedDistricts: string[]; travelDays: number; timeline: any[] } | null>(null)
  const [passport, setPassport] = useState<{ id: string; destination_name: string; district: string; division: string; visited_on?: string }[]>([])
  const [achievements, setAchievements] = useState<{ id: string; title: string; description: string; unlocked: boolean }[]>([])
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [showAddStamp, setShowAddStamp] = useState(false)
  const [stampDestId, setStampDestId] = useState('')
  const [stampVisitedOn, setStampVisitedOn] = useState(new Date().toISOString().slice(0, 10))
  const [districtSearch, setDistrictSearch] = useState('')
  const [districtFilter, setDistrictFilter] = useState<'all' | 'visited' | 'unexplored'>('all')

  useEffect(() => {
    api<typeof footprint>('/api/me/footprint').then(setFootprint).catch(() => undefined)
    api<typeof passport>('/api/me/passport').then(setPassport).catch(() => undefined)
    api<typeof achievements>('/api/me/achievements').then(setAchievements).catch(() => undefined)
    api<Destination[]>('/api/destinations').then(setDestinations).catch(() => undefined)
  }, [])

  // Set of normalized visited district names
  const visitedSet = useMemo(() => {
    const set = new Set<string>()
    if (footprint?.visitedDistricts) {
      footprint.visitedDistricts.forEach((d) => set.add(normalizeDistrict(d)))
    }
    passport.forEach((p) => {
      if (p.district) set.add(normalizeDistrict(p.district))
    })
    return set
  }, [footprint, passport])

  const visitedCount = useMemo(() => {
    const count = BANGLADESH_DISTRICTS.filter((d) => visitedSet.has(normalizeDistrict(d.name))).length
    return Math.max(count, footprint?.districtsVisited || 0)
  }, [visitedSet, footprint])

  const districtPercent = Math.round((visitedCount / 64) * 100)

  // Filtered district list
  const filteredDistricts = useMemo(() => {
    return BANGLADESH_DISTRICTS.filter((d) => {
      const isVisited = visitedSet.has(normalizeDistrict(d.name))
      if (districtFilter === 'visited' && !isVisited) return false
      if (districtFilter === 'unexplored' && isVisited) return false
      if (districtSearch.trim()) {
        const q = districtSearch.toLowerCase().trim()
        return d.name.toLowerCase().includes(q) || d.division.toLowerCase().includes(q)
      }
      return true
    })
  }, [visitedSet, districtFilter, districtSearch])

  const addStamp = async () => {
    if (!stampDestId) return
    await api('/api/me/passport', {
      method: 'POST',
      body: JSON.stringify({ destinationId: stampDestId, visitedOn: stampVisitedOn }),
    })
    setShowAddStamp(false)
    setStampDestId('')
    setStampVisitedOn(new Date().toISOString().slice(0, 10))
    api<typeof passport>('/api/me/passport').then(setPassport)
    api<typeof footprint>('/api/me/footprint').then(setFootprint)
  }

  const deleteStamp = async (stampId: string) => {
    if (!window.confirm('Remove this stamp from your passport?')) return
    await api(`/api/me/passport/${stampId}`, { method: 'DELETE' })
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-12px', marginBottom: '16px' }}>
        <button className="primary-btn" onClick={() => setShowAddStamp(true)}><Plus size={16} /> Add visited place</button>
      </div>

      <div className="group-tabs">
        <Link to="/travel-footprint" className={`tab ${subpage === 'overview' ? 'active' : ''}`}>Overview</Link>
        <Link to="/travel-footprint/passport" className={`tab ${subpage === 'passport' ? 'active' : ''}`}>Passport</Link>
        <Link to="/travel-footprint/achievements" className={`tab ${subpage === 'achievements' ? 'active' : ''}`}>Achievements</Link>
        <Link to="/travel-footprint/timeline" className={`tab ${subpage === 'timeline' ? 'active' : ''}`}>Timeline</Link>
      </div>

      {subpage === 'overview' && (
        <>
          <section className="footprint-intro" style={{ marginTop: '20px' }}>
            <div className="avatar footprint-avatar">
              {user?.name ? user.name[0].toUpperCase() : 'T'}
            </div>
            <div>
              <h2>{user?.name || 'Traveler'}</h2>
              <p>{user?.travel_style ? `${user.travel_style} · Bangladesh explorer` : 'Curious wanderer · Bangladesh explorer'}</p>
            </div>
            <div className="footprint-summary">
              <div><strong>{passport.length}</strong><span>stamps</span></div>
              <div><strong>{visitedCount}</strong><span>districts</span></div>
              <div><strong>{footprint?.travelDays ?? 0}</strong><span>travel days</span></div>
            </div>
          </section>

          <div className="footprint-grid">
            <section className="panel footprint-map-panel">
              <div className="panel-heading">
                <div>
                  <h2>Bangladesh exploration map</h2>
                  <p>{visitedCount} of 64 districts · {districtPercent}% explored</p>
                </div>
                <div className="progress-ring" style={{ '--progress': `${districtPercent * 3.6}deg` } as React.CSSProperties}>
                  <strong>{districtPercent}%</strong>
                </div>
              </div>

              {/* Real Interactive Leaflet District Map */}
              <div
                className="porikroma-map-container"
                style={{
                  height: '380px',
                  width: '100%',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  position: 'relative',
                  margin: '16px 0 12px',
                  border: '1px solid #c8d7c4',
                  zIndex: 0,
                }}
              >
                <MapContainer
                  center={[23.6850, 90.3563]}
                  zoom={7}
                  scrollWheelZoom={false}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapResizer />

                  {BANGLADESH_DISTRICTS.map((district) => {
                    const isVisited = visitedSet.has(normalizeDistrict(district.name))
                    return (
                      <Marker
                        key={district.id}
                        position={[district.lat, district.lng]}
                        icon={createDistrictIcon(isVisited, district.name)}
                      >
                        <Popup>
                          <div style={{ minWidth: '160px', fontFamily: 'inherit' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <strong style={{ fontSize: '14px', color: '#1f3d2b' }}>{district.name}</strong>
                              <span
                                className={`badge ${isVisited ? 'badge-green' : 'badge-gray'}`}
                                style={{ fontSize: '12px', padding: '2px 8px' }}
                              >
                                {isVisited ? 'Visited ✓' : 'Unexplored'}
                              </span>
                            </div>
                            <small style={{ color: '#4e5e52', fontSize: '12.5px', display: 'block', marginTop: '2px' }}>
                              {district.division} Division
                            </small>
                            {isVisited ? (
                              <div style={{ marginTop: '6px', fontSize: '12.5px', color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={14} /> Stamped in your passport
                              </div>
                            ) : (
                              <div style={{ marginTop: '6px', fontSize: '12.5px', color: '#5a685e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Circle size={13} /> Plan a trip to unlock
                              </div>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    )
                  })}
                </MapContainer>
              </div>

              {/* Map Legend */}
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', padding: '10px 14px', background: '#f4f7f2', borderRadius: '8px', fontSize: '13px', color: '#445547' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '8px', fontWeight: 'bold' }}>✓</span>
                  <strong>Visited Districts ({visitedCount})</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#64748b', display: 'inline-block' }} />
                  <span>Unexplored ({64 - visitedCount})</span>
                </div>
                <div style={{ marginLeft: 'auto', color: '#5a685e', fontSize: '12px' }}>
                  OpenStreetMap tiles
                </div>
              </div>

              {/* Filter & Search District List */}
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: '1', minWidth: '180px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '11px', top: '11px', color: '#6d7870' }} />
                    <input
                      placeholder="Search district or division…"
                      value={districtSearch}
                      onChange={(e) => setDistrictSearch(e.target.value)}
                      style={{ paddingLeft: '34px', height: '38px', width: '100%', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '14px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className={`tab ${districtFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setDistrictFilter('all')}
                      style={{ padding: '0 12px', fontSize: '13px', height: '38px', borderRadius: '6px' }}
                    >
                      All (64)
                    </button>
                    <button
                      className={`tab ${districtFilter === 'visited' ? 'active' : ''}`}
                      onClick={() => setDistrictFilter('visited')}
                      style={{ padding: '0 12px', fontSize: '13px', height: '38px', borderRadius: '6px' }}
                    >
                      Visited ({visitedCount})
                    </button>
                    <button
                      className={`tab ${districtFilter === 'unexplored' ? 'active' : ''}`}
                      onClick={() => setDistrictFilter('unexplored')}
                      style={{ padding: '0 12px', fontSize: '13px', height: '38px', borderRadius: '6px' }}
                    >
                      Unexplored ({64 - visitedCount})
                    </button>
                  </div>
                </div>

                <div className="district-list" style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #edf0ea', borderRadius: '8px' }}>
                  {filteredDistricts.map((district) => {
                    const isVisited = visitedSet.has(normalizeDistrict(district.name))
                    return (
                      <div
                        key={district.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderBottom: '1px solid #f2f5f0',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`district-dot ${isVisited ? 'visited' : ''}`} />
                          <strong>{district.name}</strong>
                          <small style={{ color: '#5a685e', fontSize: '12px' }}>({district.division})</small>
                        </span>
                        <small className={isVisited ? 'positive' : 'muted'} style={{ fontWeight: isVisited ? 600 : 400 }}>
                          {isVisited ? 'Visited ✓' : 'Unexplored'}
                        </small>
                      </div>
                    )
                  })}
                  {filteredDistricts.length === 0 && (
                    <p className="muted" style={{ padding: '16px', textAlign: 'center', fontSize: '13.5px', color: '#5a685e' }}>
                      No matching districts found.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <aside className="footprint-side">
              <div className="panel">
                <h2>Explore deeper</h2>
                <p className="muted">Your milestones and memory booklet.</p>
                <div className="footprint-links">
                  <Link to="/travel-footprint/passport">Open passport <ArrowUpRight size={15} /></Link>
                  <Link to="/travel-footprint/achievements">See achievements <ArrowUpRight size={15} /></Link>
                  <Link to="/travel-footprint/timeline">View timeline <ArrowUpRight size={15} /></Link>
                </div>
              </div>

              <div className="panel" style={{ marginTop: '16px', background: '#f8faf7', border: '1px solid #e1ebe0' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1a2e22', marginBottom: '6px' }}>District Milestones</h3>
                <p style={{ fontSize: '13px', color: '#4e5e52', lineHeight: 1.5 }}>
                  Visit destinations across Bangladesh to earn official passport stamps and unlock regional badges.
                </p>
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', color: '#334438' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>First Destination</span>
                    <strong>{visitedCount >= 1 ? '✓ Unlocked' : 'Pending'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>5 Districts Explorer</span>
                    <strong>{visitedCount >= 5 ? '✓ Unlocked' : `${visitedCount}/5`}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>10 Districts Wanderer</span>
                    <strong>{visitedCount >= 10 ? '✓ Unlocked' : `${visitedCount}/10`}</strong>
                  </div>
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
            <button className="outline-btn" onClick={() => setShowAddStamp(true)}><Plus size={16} /> Add stamp</button>
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
                <h2>{user?.name || 'Traveler'}</h2>
                <p>Verified explorer of Bangladesh</p>
              </div>
              <div className="stamp-grid">
                {passport.map((p) => (
                  <div className="stamp" key={p.id} style={{ position: 'relative' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteStamp(p.id)
                      }}
                      title="Remove stamp"
                      aria-label="Remove stamp"
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        background: 'rgba(255,255,255,0.7)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '3px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#b91c1c',
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                    <span>VISITED</span>
                    <strong>{p.destination_name}</strong>
                    <small>{p.district}</small>
                  </div>
                ))}
                {!passport.length && (
                  <p style={{ color: '#5a685e', fontSize: '14px', padding: '16px 0' }}>No stamps collected yet. Click Add stamp!</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddStamp && (
            <div className="modal-backdrop" onClick={() => setShowAddStamp(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={() => setShowAddStamp(false)} aria-label="Close add stamp modal"><X size={18} /></button>
                <h2>Collect a new stamp</h2>
                <label>Select destination
                  <select value={stampDestId} onChange={(e) => setStampDestId(e.target.value)}>
                    <option value="">Choose place</option>
                    {destinations.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.district})</option>
                    ))}
                  </select>
                </label>
                <label style={{ marginTop: '12px' }}>Date visited
                  <input type="date" value={stampVisitedOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setStampVisitedOn(e.target.value)} />
                </label>
                <div className="modal-actions">
                  <button className="outline-btn" onClick={() => setShowAddStamp(false)}>Cancel</button>
                  <button className="primary-btn" onClick={addStamp}>Stamp passport</button>
                </div>
              </div>
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
              <p style={{ color: '#506155' }}>Loading achievements…</p>
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
                  <p><MapPin size={15} /> {item.place}</p>
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
