import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Compass, Users, Check, ChevronRight, ArrowUpRight } from 'lucide-react'
import { api } from '../../api'
import type { Destination, Trip } from '../../types'
import { PageHeader } from '../../components/common/PageHeader'

export function CreateTrip() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const initialMode = location.pathname.includes('group') || searchParams.get('mode') === 'group' ? 'group' : 'solo'
  const [mode, setMode] = useState<'solo' | 'group' | null>(initialMode)
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [form, setForm] = useState({
    name: searchParams.get('name') || '',
    destinationId: searchParams.get('destinationId') || '',
    startDate: searchParams.get('startDate') || new Date().toISOString().slice(0, 10),
    endDate: searchParams.get('endDate') || new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    budget: searchParams.get('budget') || '25000',
    groupSize: searchParams.get('groupSize') || '4',
    description: searchParams.get('description') || '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api<Destination[]>('/api/destinations').then(setDestinations).catch(() => undefined)
  }, [])

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  const create = async () => {
    setError('')
    if (!form.name.trim() || !form.destinationId || !form.startDate || !form.endDate) {
      setError('Please provide a trip name, destination, and valid dates.')
      return
    }
    if (form.endDate < form.startDate) {
      setError('End date must be on or after start date.')
      return
    }

    setSaving(true)
    try {
      const trip = await api<Trip>('/api/trips', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          destinationId: form.destinationId,
          startDate: form.startDate,
          endDate: form.endDate,
          budget: Number(form.budget || 0),
          visibility: 'PUBLIC',
          status: 'UPCOMING',
          description: form.description || (mode === 'group' ? `Group expedition for ${form.groupSize} travelers` : 'Solo journey'),
        }),
      })

      if (mode === 'group') {
        await api('/api/groups', {
          method: 'POST',
          body: JSON.stringify({
            tripId: trip.id,
            title: form.name.trim(),
            capacity: Number(form.groupSize || 4),
            budgetPerPerson: Math.ceil(Number(form.budget || 0) / Number(form.groupSize || 4)),
            published: true,
          }),
        })
      }

      navigate(`/trips/${trip.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create trip')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Start with the feeling"
        title="Plan a new journey"
        description="Choose the kind of journey you want to make and connect it to a destination."
      />

      <div className="mode-grid">
        <button className={mode === 'solo' ? 'mode-card selected' : 'mode-card'} onClick={() => setMode('solo')}>
          <span className="mode-icon"><Compass size={26} /></span>
          <h2>Solo travel</h2>
          <p>Your pace, your places, your private or shared little adventure.</p>
          <span className="mode-check">{mode === 'solo' ? <Check size={18} /> : <ChevronRight size={18} />}</span>
        </button>

        <button className={mode === 'group' ? 'mode-card selected' : 'mode-card'} onClick={() => setMode('group')}>
          <span className="mode-icon"><Users size={26} /></span>
          <h2>Group expedition</h2>
          <p>Bring travelers together around a shared story, split budget, and seats.</p>
          <span className="mode-check">{mode === 'group' ? <Check size={18} /> : <ChevronRight size={18} />}</span>
        </button>
      </div>

      <div className="trip-form panel">
        <p className="eyebrow">{mode === 'solo' ? 'Private or Shared Journey' : 'Group Expedition'}</p>
        <h2>{mode === 'solo' ? 'Tell us where you want to wander.' : 'Organize your group expedition.'}</h2>

        <div className="form-grid">
          <label>
            Trip name
            <input required placeholder="e.g. A long weekend in Sylhet" value={form.name} onChange={(e) => update('name', e.target.value)} />
          </label>

          <label>
            Destination
            <select required value={form.destinationId} onChange={(e) => update('destinationId', e.target.value)}>
              <option value="">Select a destination</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.district})</option>
              ))}
            </select>
          </label>

          <label>
            Start date
            <input required type="date" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} />
          </label>

          <label>
            End date
            <input required type="date" value={form.endDate} onChange={(e) => update('endDate', e.target.value)} />
          </label>

          <label>
            Total Budget (BDT)
            <input type="number" min="0" placeholder="25000" value={form.budget} onChange={(e) => update('budget', e.target.value)} />
          </label>

          {mode === 'group' && (
            <label>
              Group capacity (travelers)
              <input type="number" min="2" max="30" placeholder="6" value={form.groupSize} onChange={(e) => update('groupSize', e.target.value)} />
            </label>
          )}

          <label style={{ gridColumn: '1 / -1' }}>
            Description / Overview
            <textarea placeholder="Describe the spirit and goals of this trip..." value={form.description} onChange={(e) => update('description', e.target.value)} rows={3} />
          </label>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="modal-actions">
          <button className="outline-btn" onClick={() => navigate('/trips')}>Cancel</button>
          <button className="primary-btn" disabled={saving} onClick={create}>
            {saving ? 'Creating…' : 'Create trip'} <ArrowUpRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateTrip
