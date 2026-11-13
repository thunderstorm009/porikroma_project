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
          <button className="primary-btn" onClick={() => navigate('/group-travel/create')}><Plus size={17} /> Host expedition</button>
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
              <h3 style={{ margin: '10px 0 6px', fontSize: '17.5px', fontWeight: 600, color: '#1a2e22' }}>{g.title}</h3>
              <p style={{ fontSize: '13.5px', color: '#4e5e52', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <MapPin size={15} /> {g.destination_name} · {g.start_date} – {g.end_date}
              </p>
              <p style={{ fontSize: '13px', color: '#5a685e', marginTop: '4px' }}>Capacity: {g.member_count} of {g.capacity} spots filled</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className="primary-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => navigate(`/trips/${g.trip_id}`)}>
                Open workspace <ArrowUpRight size={15} />
              </button>
            </div>
          </div>
        ))}
        {!groups.length && (
          <div style={{ padding: '36px 20px', color: '#5a685e', fontSize: '14.5px', textAlign: 'center' }}>
            You have not joined or organized any group trips yet.
          </div>
        )}
      </div>
    </div>
  )
}

export default MyGroupsPage
