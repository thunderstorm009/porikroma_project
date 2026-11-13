import { useEffect, useState } from 'react'
import { api } from '../../api'
import { PageHeader } from '../../components/common/PageHeader'

export function SettingsPage() {
  const [tab, setTab] = useState<'privacy' | 'account'>('privacy')
  const [privacy, setPrivacy] = useState({
    profileVisibility: 'PUBLIC',
    travelHistoryVisibility: 'PUBLIC',
    footprintVisibility: 'PUBLIC',
    reviewsVisibility: 'PUBLIC',
  })
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '' })
  const [verifNote, setVerifNote] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    api<typeof privacy>('/api/me/privacy').then(setPrivacy).catch(() => undefined)
  }, [])

  const savePrivacy = async () => {
    await api('/api/me/privacy', { method: 'PUT', body: JSON.stringify(privacy) })
    setMessage('Privacy settings successfully updated.')
  }

  const changePassword = async () => {
    if (!passForm.currentPassword || !passForm.newPassword) return
    try {
      await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify(passForm) })
      setMessage('Password updated successfully.')
      setPassForm({ currentPassword: '', newPassword: '' })
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Password update failed')
    }
  }

  const requestVerification = async () => {
    await api('/api/me/verification', { method: 'POST', body: JSON.stringify({ note: verifNote }) })
    setMessage('Tour planner verification request submitted for review.')
    setVerifNote('')
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Account & Preferences"
        title="Settings"
        description="Manage your privacy, account credentials, and platform verification."
      />

      <div className="tab-header">
        <button className={`tab-item ${tab === 'privacy' ? 'active' : ''}`} onClick={() => setTab('privacy')}>Privacy</button>
        <button className={`tab-item ${tab === 'account' ? 'active' : ''}`} onClick={() => setTab('account')}>Account & Security</button>
      </div>

      {tab === 'privacy' && (
        <section className="panel" style={{ maxWidth: '640px' }}>
          <h2>Privacy controls</h2>
          <p className="muted">Choose what other travelers can discover about your journeys.</p>

          <div style={{ marginTop: '16px' }}>
            {Object.entries(privacy).map(([key, val]) => (
              <label key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span>{key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}</span>
                <select
                  value={val}
                  onChange={(e) => setPrivacy({ ...privacy, [key]: e.target.value })}
                  style={{ width: '140px', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--line-strong)', fontSize: '16px', background: '#fff' }}>
                  <option value="PUBLIC">PUBLIC</option>
                  <option value="PRIVATE">PRIVATE</option>
                </select>
              </label>
            ))}
          </div>

          {message && <p className="positive">{message}</p>}
          <button className="primary-btn" style={{ marginTop: '14px' }} onClick={savePrivacy}>Save privacy settings</button>
        </section>
      )}

      {tab === 'account' && (
        <section className="panel" style={{ maxWidth: '640px' }}>
          <h2>Change password</h2>
          <label>Current password<input type="password" value={passForm.currentPassword} onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })} /></label>
          <label style={{ marginTop: '10px' }}>New password<input type="password" minLength={6} value={passForm.newPassword} onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })} /></label>
          <button className="primary-btn" style={{ marginTop: '12px' }} onClick={changePassword}>Update password</button>

          <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid #edf0ea' }} />

          <h2>Tour Planner Verification</h2>
          <p className="muted">Apply for official verified host badge to publish commercial group expeditions.</p>
          <textarea rows={3} placeholder="Describe your experience guiding or organizing tours..." value={verifNote} onChange={(e) => setVerifNote(e.target.value)} />
          <button className="secondary-btn" style={{ marginTop: '10px' }} onClick={requestVerification}>Submit verification request</button>

          {message && <p className="positive" style={{ marginTop: '12px' }}>{message}</p>}
        </section>
      )}
    </div>
  )
}

export default SettingsPage
