import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, MapPin, ArrowUpRight } from 'lucide-react'
import { api } from '../../api'
import type { GroupExpedition } from '../../types'
import { PageHeader } from '../../components/common/PageHeader'

export function MyGroupsPage() {
  const navigate = useNavigate()
  const [groups, setGroups] = useState<(GroupExpedition & { is_organizer: boolean })[]>([])

  useEffect(() => {
    api<typeof groups>('/api/groups/my-groups').then(setGroups).catch(() => undefined)
  }, [])

  return (
    <div className="page">
      <PageHeader
        eyebrow="Group travel"
        title="My expeditions"
        description="Groups you organize or have joined as a traveler."
        action={
          <button className="primary-btn" onClick={() => navigate('/group-travel/create')}><Plus size={16} /> Host expedition</button>
        }
      />

      <div className="group-tabs">
        <Link to="/group-travel/explore" className="tab">Explore trips</Link>
        <Link to="/group-travel/my-groups" className="tab active">My groups</Link>
        <Link to="/group-travel/requests" className="tab">Requests & Applications</Link>
      </div>

      <div className="group-grid detailed-group-grid" style={{ marginTop: '20px' }}>
        {groups.map((g) => (
          <div className="panel" key={g.id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <span className={`badge ${g.is_organizer ? 'badge-green' : 'badge-blue'}`}>
                {g.is_organizer ? 'Host / Organizer' : 'Participant'}
              </span>
              <h3 style={{ margin: '10px 0 6px' }}>{g.title}</h3>
              <p><MapPin size={13} /> {g.destination_name} · {g.start_date} – {g.end_date}</p>
              <p style={{ fontSize: '11px', color: '#6d7770' }}>Capacity: {g.member_count} of {g.capacity} spots filled</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className="primary-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => navigate(`/trips/${g.trip_id}`)}>
                Open workspace <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        ))}
        {!groups.length && (
          <div style={{ padding: '30px', color: '#889' }}>You have not joined or organized any group trips yet.</div>
        )}
      </div>
    </div>
  )
}

export default MyGroupsPage
