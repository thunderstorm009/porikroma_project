import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, ArrowUpRight } from 'lucide-react'
import { api, toursApi } from '../../api'
import type { Destination, Tour } from '../../types'
import { PageHeader } from '../../components/common/PageHeader'

export function CreateTourPage() {
  const navigate = useNavigate()
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [form, setForm] = useState({
    title: '',
    destinationId: '',
    description: '',
    price: '8500',
    capacity: '12',
    scheduleFirstDeparture: true,
    startDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api<Destination[]>('/api/destinations')
      .then((dests) => {
        setDestinations(dests || [])
        if (dests && dests.length > 0 && !form.destinationId) {
          setForm((prev) => ({ ...prev, destinationId: dests[0].id }))
        }
      })
      .catch(() => undefined)
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.destinationId) {
      setError('Please provide a tour title and select a destination.')
      return
    }
    if (form.scheduleFirstDeparture && form.endDate < form.startDate) {
      setError('Departure end date must be on or after start date.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const tour = await api<Tour>('/api/tours', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          destinationId: form.destinationId,
          description: form.description.trim() || 'Guided expedition through local terrain.',
          price: Number(form.price),
          capacity: Number(form.capacity),
          status: 'PUBLISHED',
        }),
      })

      if (form.scheduleFirstDeparture && tour?.id) {
        await toursApi.createDeparture(tour.id, {
          startDate: form.startDate,
          endDate: form.endDate,
          capacity: Number(form.capacity),
          status: 'OPEN',
        })
      }

      navigate('/planner/tours')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish tour package')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page role-page">
      <PageHeader title="Create a new tour" description="Publish an official tour package for travelers to book." />
      
      {error && (
        <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: '8px', maxWidth: '640px', marginBottom: '16px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div className="panel" style={{ maxWidth: '640px' }}>
        <form onSubmit={submit}>
          <label>
            Tour Title
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Sylhet Tea Trail Odyssey"
            />
          </label>

          <label style={{ marginTop: '12px', display: 'block' }}>
            Destination
            <select
              required
              value={form.destinationId}
              onChange={(e) => setForm({ ...form, destinationId: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line-strong)', marginTop: '4px', fontSize: '15px' }}
            >
              <option value="">Select destination</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.district}, {d.division})
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <label>
              Price per person (BDT)
              <input
                required
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </label>
            <label>
              Capacity (travelers)
              <input
                required
                type="number"
                min="1"
                max="100"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </label>
          </div>

          <label style={{ marginTop: '12px', display: 'block' }}>
            Description
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the experience, inclusions, terrain, and pacing..."
            />
          </label>

          <div style={{ marginTop: '18px', padding: '14px', background: '#f8faf6', borderRadius: '8px', border: '1px solid #e2ece0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, color: '#1a2e22', margin: 0 }}>
              <input
                type="checkbox"
                checked={form.scheduleFirstDeparture}
                onChange={(e) => setForm({ ...form, scheduleFirstDeparture: e.target.checked })}
              />
              Schedule first departure date immediately
            </label>
            <small style={{ color: '#5a685e', display: 'block', marginTop: '4px' }}>
              Allows travelers to discover and reserve seats right away.
            </small>

            {form.scheduleFirstDeparture && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <label>
                  Departure Start Date
                  <input
                    required={form.scheduleFirstDeparture}
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </label>
                <label>
                  Departure End Date
                  <input
                    required={form.scheduleFirstDeparture}
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </label>
              </div>
            )}
          </div>

          <button
            className="primary-btn"
            style={{ marginTop: '20px', width: '100%', justifyContent: 'center' }}
            disabled={saving}
            type="submit"
          >
            {saving ? 'Publishing…' : 'Publish tour package'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default CreateTourPage
