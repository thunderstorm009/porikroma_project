import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { MapPin, ArrowUpRight, Check, ChevronRight, DollarSign, MessageCircle, Sparkles, Camera } from 'lucide-react'
import { api } from '../../api'
import type { WorkspaceData } from '../../types'
import { PageHeader } from '../../components/common/PageHeader'
import { ItineraryTab } from '../../components/workspace/ItineraryTab'
import { ExpensesTab } from '../../components/workspace/ExpensesTab'
import { NotesTab } from '../../components/workspace/NotesTab'
import { JournalTab } from '../../components/workspace/JournalTab'
import { PhotosTab } from '../../components/workspace/PhotosTab'
import { MapTab } from '../../components/workspace/MapTab'
import { ChecklistTab } from '../../components/workspace/ChecklistTab'
import { SettingsTab } from '../../components/workspace/SettingsTab'
import { GroupChatTab } from '../../components/workspace/GroupChatTab'
import { MembersTab } from '../../components/workspace/MembersTab'

export function TripWorkspace() {
  const { tripId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Current tab from URL or default to overview
  const pathParts = location.pathname.split('/')
  const currentTab = pathParts[3] || 'overview'

  const loadWorkspace = () => {
    setLoading(true)
    api<WorkspaceData>(`/api/trips/${tripId}/workspace`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load trip workspace'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadWorkspace() }, [tripId])

  const tabs = ['overview', 'itinerary', 'expenses', 'notes', 'journal', 'photos', 'map', 'checklist', 'settings']
  if (data?.group || (data?.members && data.members.length > 1)) {
    tabs.splice(8, 0, 'chat', 'members')
  }

  if (loading) return <div className="page"><p className="muted">Loading trip workspace…</p></div>
  if (error || !data) {
    return (
      <div className="page">
        <PageHeader title="Trip Workspace" description="Could not load workspace." />
        <p className="error-text">{error}</p>
        <button className="primary-btn" onClick={() => navigate('/trips')}>Back to all trips</button>
      </div>
    )
  }

  const { trip, itinerary, checklist, notes, expenses, members, mapPlaces, group } = data
  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const budgetUtilization = trip.budget > 0 ? Math.min(Math.round((totalSpent / trip.budget) * 100), 100) : 0

  return (
    <div className="page workspace-page">
      <div className="workspace-hero">
        <img src={trip.destination_image || 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1200&q=85'} alt={trip.name} />
        <div>
          <p className="eyebrow">Trip workspace · <span className={`badge ${trip.status === 'UPCOMING' ? 'badge-orange' : trip.status === 'COMPLETED' ? 'badge-green' : 'badge-blue'}`}>{trip.status}</span></p>
          <h1>{trip.name}</h1>
          <p><MapPin size={14} /> {trip.destination_name} · {trip.start_date} – {trip.end_date}</p>
        </div>
      </div>

      {/* 8 Tab Navigation */}
      <nav className="workspace-nav">
        {tabs.map((tab) => (
          <button
            className={currentTab === tab ? 'active' : ''}
            key={tab}
            onClick={() => navigate(`/trips/${tripId}${tab === 'overview' ? '' : `/${tab}`}`)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      {/* Tab 1: Overview */}
      {currentTab === 'overview' && (
        <div className="workspace-grid">
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>Next up</h2>
                <p>Your itinerary at a glance</p>
              </div>
              <button className="text-btn" onClick={() => navigate(`/trips/${tripId}/itinerary`)}>
                Open itinerary <ArrowUpRight size={15} />
              </button>
            </div>
            {itinerary.length > 0 ? (
              <div className="workspace-next">
                <span>{itinerary[0].day_date}</span>
                <div>
                  <strong>{itinerary[0].title}</strong>
                  <small>{itinerary[0].location || trip.destination_name}</small>
                </div>
                <Check size={17} />
              </div>
            ) : (
              <div style={{ padding: '20px', color: '#778', fontSize: '12px' }}>
                No itinerary items scheduled yet. Click below to add your first stop.
              </div>
            )}
          </div>

          <div className="panel">
            <h2>Budget snapshot</h2>
            <div className="workspace-budget">
              <strong>৳ {totalSpent.toLocaleString()}</strong>
              <span>of ৳ {Number(trip.budget).toLocaleString()} planned ({budgetUtilization}%)</span>
              <div className="progress"><i style={{ width: `${budgetUtilization}%` }} /></div>
            </div>
            <button className="panel-link" onClick={() => navigate(`/trips/${tripId}/expenses`)}>
              Manage expenses ledger <ChevronRight size={15} />
            </button>
          </div>

          <div className="panel workspace-wide">
            <div className="panel-heading">
              <div>
                <h2>Quick actions</h2>
                <p>Perform key trip tasks in one click</p>
              </div>
            </div>
            <div className="quick-actions">
              <button onClick={() => navigate(`/trips/${tripId}/expenses`)}>
                <span><DollarSign size={17} /></span> Add an expense <ArrowUpRight size={14} />
              </button>
              <button onClick={() => navigate(`/trips/${tripId}/notes`)}>
                <span><MessageCircle size={17} /></span> Write a note <ArrowUpRight size={14} />
              </button>
              <button onClick={() => navigate(`/trips/${tripId}/journal`)}>
                <span><Sparkles size={17} /></span> Add a memory <ArrowUpRight size={14} />
              </button>
              <button onClick={() => navigate(`/trips/${tripId}/photos`)}>
                <span><Camera size={17} /></span> Trip photos <ArrowUpRight size={14} />
              </button>
              <button onClick={() => navigate(`/trips/${tripId}/checklist`)}>
                <span><Check size={17} /></span> Packing checklist <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Itinerary */}
      {currentTab === 'itinerary' && (
        <ItineraryTab tripId={tripId} items={itinerary} onRefresh={loadWorkspace} />
      )}

      {/* Tab 3: Expenses */}
      {currentTab === 'expenses' && (
        <ExpensesTab tripId={tripId} trip={trip} expenses={expenses} members={members} onRefresh={loadWorkspace} />
      )}

      {/* Tab 4: Notes */}
      {currentTab === 'notes' && (
        <NotesTab tripId={tripId} notes={notes} onRefresh={loadWorkspace} />
      )}

      {/* Tab 5: Journal */}
      {currentTab === 'journal' && (
        <JournalTab tripId={tripId} notes={notes} onRefresh={loadWorkspace} />
      )}

      {/* Tab 6: Photos */}
      {currentTab === 'photos' && (
        <PhotosTab tripId={tripId} trip={trip} members={members} onRefresh={loadWorkspace} />
      )}

      {/* Tab 7: Map */}
      {currentTab === 'map' && (
        <MapTab tripId={tripId} destinationName={trip.destination_name || ''} places={mapPlaces} onRefresh={loadWorkspace} />
      )}

      {/* Tab 7: Checklist */}
      {currentTab === 'checklist' && (
        <ChecklistTab tripId={tripId} items={checklist} onRefresh={loadWorkspace} />
      )}

      {/* Tab 8: Settings */}
      {currentTab === 'settings' && (
        <SettingsTab trip={trip} onRefresh={loadWorkspace} />
      )}

      {/* Optional Group Chat Tab */}
      {currentTab === 'chat' && group && (
        <GroupChatTab groupId={group.id} tripId={tripId} />
      )}

      {/* Optional Group Members Tab */}
      {currentTab === 'members' && (
        <MembersTab tripId={tripId} members={members} onRefresh={loadWorkspace} />
      )}
    </div>
  )
}

export default TripWorkspace
