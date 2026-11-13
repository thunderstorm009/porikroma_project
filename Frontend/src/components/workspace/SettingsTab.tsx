import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { api } from '../../api'
import type { Trip } from '../../types'

export interface SettingsTabProps {
  trip: Trip
  onRefresh: () => void
}

export function SettingsTab({ trip, onRefresh }: SettingsTabProps) {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: trip.name,
    startDate: trip.start_date,
    endDate: trip.end_date,
    budget: String(trip.budget),
    visibility: trip.visibility,
    status: trip.status,
    description: trip.description || '',
  })
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  const save = async () => {
    setSaving(true)
    try {
      await api(`/api/trips/${trip.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name,
          startDate: form.startDate,
          endDate: form.endDate,
          budget: Number(form.budget),
          visibility: form.visibility,
          status: form.status,
          description: form.description,
        }),
      })
      setFeedback('Trip settings successfully saved.')
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  const deleteTrip = async () => {
    if (!window.confirm('Are you sure you want to delete this trip permanently? All items, notes, and records will be removed.')) return
    await api(`/api/trips/${trip.id}`, { method: 'DELETE' })
    navigate('/trips')
  }

  return (
    <div className="panel workspace-content">
      <h2>Trip settings</h2>
      <p className="muted">Manage trip details, status, and permissions.</p>

      <div className="form-grid" style={{ marginTop: '16px' }}>
        <label>Trip name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Status
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Trip['status'] })}>
            <option value="DRAFT">DRAFT</option>
            <option value="PLANNING">PLANNING</option>
            <option value="UPCOMING">UPCOMING</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </label>
        <label>Start date<input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
        <label>End date<input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
        <label>Budget (BDT)<input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></label>
        <label>Visibility
          <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as Trip['visibility'] })}>
            <option value="PUBLIC">PUBLIC</option>
            <option value="PRIVATE">PRIVATE</option>
          </select>
        </label>
        <label style={{ gridColumn: '1 / -1' }}>Description
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
      </div>

      {feedback && <p className="positive" style={{ marginTop: '10px' }}>{feedback}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
        <button className="primary-btn" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save changes'}</button>
        <button className="danger-btn" onClick={deleteTrip}><Trash2 size={17} /> Delete trip</button>
      </div>
    </div>
  )
}

export default SettingsTab
