import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X, Users, AlertCircle, Clock, ShieldCheck, Eye } from 'lucide-react'
import { api, groupsApi } from '../../api'
import type { GroupApplication } from '../../types'
import { PageHeader } from '../../components/common/PageHeader'

interface OrganizedGroupApp extends GroupApplication {
  group_title_context?: string
}

export function GroupRequestsPage() {
  const [activeTab, setActiveTab] = useState<'organizer' | 'my-requests'>('organizer')
  const [myApplications, setMyApplications] = useState<{ id: string; group_title: string; organizer_name: string; status: string; destination_name: string; created_at?: string }[]>([])
  const [incomingApplications, setIncomingApplications] = useState<OrganizedGroupApp[]>([])
  const [loadingIncoming, setLoadingIncoming] = useState(true)
  const [loadingOutgoing, setLoadingOutgoing] = useState(true)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [viewingAnswers, setViewingAnswers] = useState<OrganizedGroupApp | null>(null)

  const loadOutgoing = async () => {
    setLoadingOutgoing(true)
    try {
      const data = await groupsApi.getMyApplications()
      setMyApplications(data || [])
    } catch {
      // Ignored
    } finally {
      setLoadingOutgoing(false)
    }
  }

  const loadIncoming = async () => {
    setLoadingIncoming(true)
    try {
      const myGroups = await groupsApi.getMyGroups()
      const organized = myGroups.filter((g) => g.is_organizer)
      
      const allApps: OrganizedGroupApp[] = []
      await Promise.all(
        organized.map(async (group) => {
          try {
            const apps = await groupsApi.getGroupApplications(group.id)
            apps.forEach((a) => {
              allApps.push({
                ...a,
                group_title_context: group.title,
                destination_name: group.destination_name,
              })
            })
          } catch {
            // Ignored if permissions fail
          }
        })
      )
      // Sort newest first
      allApps.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setIncomingApplications(allApps)
      
      // Default to "my-requests" if traveler organizes no groups
      if (organized.length === 0) {
        setActiveTab('my-requests')
      }
    } catch {
      // Ignored
    } finally {
      setLoadingIncoming(false)
    }
  }

  useEffect(() => {
    loadOutgoing()
    loadIncoming()
  }, [])

  const handleOrganizerDecision = async (appId: string, status: 'APPROVED' | 'REJECTED') => {
    setActionMessage('')
    setActionError('')
    try {
      await groupsApi.updateApplicationStatus(appId, status)
      setActionMessage(`Application successfully ${status.toLowerCase()}!`)
      await loadIncoming()
      setTimeout(() => setActionMessage(''), 4000)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to ${status.toLowerCase()} application`)
    }
  }

  const withdraw = async (id: string) => {
    setActionMessage('')
    setActionError('')
    try {
      await groupsApi.updateApplicationStatus(id, 'WITHDRAWN')
      setActionMessage('Your application was withdrawn.')
      await loadOutgoing()
      setTimeout(() => setActionMessage(''), 4000)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to withdraw application')
    }
  }

  const pendingIncomingCount = incomingApplications.filter((a) => a.status === 'PENDING').length

  return (
    <div className="page">
      <PageHeader
        eyebrow="Expeditions"
        title="Group requests & applications"
        description="Review traveler applications for your expeditions, and track requests you submitted."
      />

      <div className="group-tabs">
        <Link to="/group-travel/explore" className="tab">Explore trips</Link>
        <Link to="/group-travel/my-groups" className="tab">My groups</Link>
        <Link to="/group-travel/requests" className="tab active">Requests & Applications</Link>
      </div>

      {actionMessage && (
        <div style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '12px 16px', borderRadius: '8px', margin: '16px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={16} /> {actionMessage}
        </div>
      )}

      {actionError && (
        <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: '8px', margin: '16px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} /> {actionError}
        </div>
      )}

      {/* Sub-view switcher */}
      <div className="tabs" style={{ margin: '20px 0 16px' }}>
        <button
          className={activeTab === 'organizer' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('organizer')}
        >
          Organizer Review (Incoming)
          {pendingIncomingCount > 0 && (
            <span style={{ marginLeft: '8px', background: 'var(--green, #235d3a)', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px' }}>
              {pendingIncomingCount}
            </span>
          )}
        </button>
        <button
          className={activeTab === 'my-requests' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('my-requests')}
        >
          My Submitted Requests (Outgoing)
        </button>
      </div>

      {activeTab === 'organizer' ? (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Expedition</th>
                <th>Questionnaire Answers</th>
                <th>Applied On</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {incomingApplications.map((app) => (
                <tr key={app.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
                        {app.applicant_name ? app.applicant_name[0].toUpperCase() : 'T'}
                      </div>
                      <div>
                        <strong>{app.applicant_name || 'Traveler'}</strong>
                        <small style={{ color: '#5a685e', display: 'block', fontSize: '12px' }}>{app.applicant_email}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong>{app.group_title_context || app.group_title || 'Group Expedition'}</strong>
                    {app.destination_name && (
                      <small style={{ color: '#5a685e', display: 'block', fontSize: '12px' }}>{app.destination_name}</small>
                    )}
                  </td>
                  <td>
                    <button
                      className="outline-btn small"
                      onClick={() => setViewingAnswers(app)}
                      style={{ fontSize: '12.5px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    >
                      <Eye size={13} /> View questionnaire
                    </button>
                  </td>
                  <td>
                    <small style={{ color: '#4e5e52' }}>
                      {app.created_at ? new Date(app.created_at).toLocaleDateString() : 'Recent'}
                    </small>
                  </td>
                  <td>
                    <span className={`badge ${app.status === 'APPROVED' ? 'badge-green' : app.status === 'REJECTED' ? 'badge-red' : app.status === 'WITHDRAWN' ? 'badge-gray' : 'badge-orange'}`}>
                      {app.status}
                    </span>
                  </td>
                  <td>
                    {app.status === 'PENDING' ? (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="primary-btn small"
                          onClick={() => handleOrganizerDecision(app.id, 'APPROVED')}
                          style={{ padding: '4px 10px', fontSize: '12.5px' }}
                        >
                          <Check size={13} /> Approve
                        </button>
                        <button
                          className="danger-btn small"
                          onClick={() => handleOrganizerDecision(app.id, 'REJECTED')}
                          style={{ padding: '4px 10px', fontSize: '12.5px' }}
                        >
                          <X size={13} /> Reject
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#6d7a71' }}>Decided</span>
                    )}
                  </td>
                </tr>
              ))}
              {!incomingApplications.length && !loadingIncoming && (
                <tr>
                  <td colSpan={6} style={{ padding: '36px 16px', textAlign: 'center', color: '#5a685e', fontSize: '14px' }}>
                    No join requests received for your expeditions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Expedition</th>
                <th>Destination</th>
                <th>Organizer</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {myApplications.map((app) => (
                <tr key={app.id}>
                  <td><strong>{app.group_title}</strong></td>
                  <td>{app.destination_name}</td>
                  <td>{app.organizer_name}</td>
                  <td>
                    <span className={`badge ${app.status === 'APPROVED' ? 'badge-green' : app.status === 'REJECTED' ? 'badge-red' : app.status === 'WITHDRAWN' ? 'badge-gray' : 'badge-orange'}`}>
                      {app.status}
                    </span>
                  </td>
                  <td>
                    {app.status === 'PENDING' && (
                      <button className="outline-btn small" onClick={() => withdraw(app.id)}>Withdraw</button>
                    )}
                  </td>
                </tr>
              ))}
              {!myApplications.length && !loadingOutgoing && (
                <tr>
                  <td colSpan={5} style={{ padding: '36px 16px', textAlign: 'center', color: '#5a685e', fontSize: '14px' }}>
                    You have not submitted any join requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* View Questionnaire Modal */}
      {viewingAnswers && (
        <div className="modal-backdrop" onClick={() => setViewingAnswers(null)}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#1a2e22' }}>
                  Applicant Questionnaire
                </h3>
                <small style={{ color: '#5a685e' }}>{viewingAnswers.applicant_name} ({viewingAnswers.applicant_email})</small>
              </div>
              <button className="modal-close" onClick={() => setViewingAnswers(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px', color: '#334155' }}>
              <div>
                <strong style={{ display: 'block', color: '#1e293b', marginBottom: '4px' }}>Relevant Travel Experience:</strong>
                <p style={{ margin: 0, background: '#f8faf6', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2ece0' }}>
                  {viewingAnswers.answers?.experience || 'None provided'}
                </p>
              </div>

              <div>
                <strong style={{ display: 'block', color: '#1e293b', marginBottom: '4px' }}>Dietary Preferences / Restrictions:</strong>
                <p style={{ margin: 0, background: '#f8faf6', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2ece0' }}>
                  {viewingAnswers.answers?.dietary || 'Standard (no restrictions)'}
                </p>
              </div>

              <div>
                <strong style={{ display: 'block', color: '#1e293b', marginBottom: '4px' }}>Schedule & Commitment:</strong>
                <p style={{ margin: 0, background: '#f8faf6', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2ece0' }}>
                  {viewingAnswers.answers?.commitment || 'Confirmed full trip commitment'}
                </p>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              {viewingAnswers.status === 'PENDING' && (
                <>
                  <button
                    className="danger-btn"
                    onClick={() => {
                      handleOrganizerDecision(viewingAnswers.id, 'REJECTED')
                      setViewingAnswers(null)
                    }}
                  >
                    Reject application
                  </button>
                  <button
                    className="primary-btn"
                    onClick={() => {
                      handleOrganizerDecision(viewingAnswers.id, 'APPROVED')
                      setViewingAnswers(null)
                    }}
                  >
                    Approve applicant
                  </button>
                </>
              )}
              {viewingAnswers.status !== 'PENDING' && (
                <button className="primary-btn" onClick={() => setViewingAnswers(null)}>
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GroupRequestsPage
