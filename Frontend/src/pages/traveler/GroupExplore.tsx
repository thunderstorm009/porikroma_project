import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Users, Search, Check, MapPin, ArrowUpRight } from 'lucide-react'
import { api } from '../../api'
import type { GroupExpedition } from '../../types'
import { PageHeader } from '../../components/common/PageHeader'

export function GroupExplore() {
  const navigate = useNavigate()
  const [groups, setGroups] = useState<GroupExpedition[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<GroupExpedition[]>('/api/groups')
      .then(setGroups)
      .finally(() => setLoading(false))
  }, [])

  const shown = groups.filter((g) =>
    `${g.title} ${g.destination_name} ${g.organizer_name}`.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="page">
      <PageHeader
        eyebrow="Travel with people who get it"
        title="Group travel"
        description="Find a shared expedition, or host one of your own."
        action={
          <Link className="primary-btn" to="/group-travel/create">
            <Plus size={17} /> Create group trip
          </Link>
        }
      />

      <div className="group-hero">
        <div>
          <span className="pill dark"><Users size={13} /> Vetted small-group expeditions</span>
          <h2>Find your next<br /><em>shared story.</em></h2>
          <p>Meet thoughtful travelers, follow trusted local leaders, and go further together.</p>
        </div>
        <div className="group-hero-stat">
          <strong>{groups.length}</strong>
          <span>active expeditions</span>
          <small>Across Bangladesh & beyond</small>
        </div>
      </div>

      <div className="group-tabs">
        <Link to="/group-travel/explore" className="tab active">Explore trips</Link>
        <Link to="/group-travel/my-groups" className="tab">My groups</Link>
        <Link to="/group-travel/requests" className="tab">Requests & Applications</Link>
      </div>

      <div className="group-filter detailed-filter">
        <Search size={16} />
        <input placeholder="Search destinations, organizer, or expedition name..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="group-result-header">
        <strong>Discoverable community expeditions</strong>
        <span>{shown.length} journeys found</span>
      </div>

      <div className="group-grid detailed-group-grid">
        {shown.map((g) => (
          <button className="group-card detailed-group-card" key={g.id} onClick={() => navigate(`/group-travel/${g.id}`)}>
            <div className="group-card-image">
              <img src={g.destination_image || 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=85'} alt={g.title} />
              <span className="verified-badge"><Check size={11} /> Verified leader</span>
            </div>
            <div className="group-card-body">
              <div className="organizer">
                <div className="avatar">{g.organizer_name?.[0] || 'O'}</div>
                <div>
                  <strong>{g.organizer_name || 'Organizer'}</strong>
                  <small>✦ 4.9 · Verified Host</small>
                </div>
              </div>
              <h3>{g.title}</h3>
              <p><MapPin size={13} /> {g.destination_name} · {g.start_date} – {g.end_date}</p>
              <div className="capacity">
                <span>Seats filled</span>
                <strong>{g.member_count || 1} of {g.capacity} filled</strong>
                <div className="progress"><i style={{ width: `${Math.round(((g.member_count || 1) / g.capacity) * 100)}%` }} /></div>
              </div>
              <div className="group-card-bottom">
                <div>
                  <small>EST. SHARE BUDGET</small>
                  <strong>৳ {Number(g.budget_per_person).toLocaleString()} <small>/ person</small></strong>
                </div>
                <span className="badge badge-green">Open</span>
              </div>
              <span className="card-link">View dossier & apply <ArrowUpRight size={14} /></span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default GroupExplore
