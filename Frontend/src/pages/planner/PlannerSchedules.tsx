import { useEffect, useState } from 'react'
import { Plus, X, Calendar, AlertCircle, Check } from 'lucide-react'
import { api, toursApi } from '../../api'
import type { Tour } from '../../types'
import { PageHeader } from '../../components/common/PageHeader'

export function PlannerSchedules() {
  const [departures, setDepartures] = useState<any[]>([])
  const [tours, setTours] = useState<Tour[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    tourId: '',
    startDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
    capacity: 12,
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [deps, myTours] = await Promise.all([
        api<any[]>('/api/planner/departures'),
        api<Tour[]>('/api/planner/tours'),
      ])
      setDepartures(deps || [])
      setTours(myTours || [])
      if (myTours && myTours.length > 0 && !form.tourId) {
        setForm((prev) => ({ ...prev, tourId: myTours[0].id, capacity: myTours[0].capacity || 12 }))
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleTourSelect = (tourId: string) => {
    const selected = tours.find((t) => t.id === tourId)
    setForm((prev) => ({
      ...prev,
      tourId,
      capacity: selected?.capacity || prev.capacity,
    }))
  }

  const handleCreateDeparture = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.tourId || !form.startDate || !form.endDate) return
    if (form.endDate < form.startDate) {
      setError('End date must be on or after start date.')
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      await toursApi.createDeparture(form.tourId, {
        startDate: form.startDate,
        endDate: form.endDate,
        capacity: Number(form.capacity),
        status: 'OPEN',
      })
      setMessage('New departure scheduled successfully!')
      setShowModal(false)
      await loadData()
      setTimeout(() => setMessage(''), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule departure')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page role-page">
      <PageHeader
        title="Departure schedules"
        description="All planned departures for your guided tours across Bangladesh."
        action={
          <button
            className="primary-btn"
            onClick={() => {
              setError('')
              setShowModal(true)
            }}
            disabled={tours.length === 0}
            title={tours.length === 0 ? 'Publish a tour package first' : 'Schedule departure'}
          >
            <Plus size={17} /> Schedule departure
          </button>
        }
      />

      {message && (
        <div style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={16} /> {message}
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tour</th>
              <th>Destination</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Seats Booked</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {departures.map((d) => (
              <tr key={d.id}>
                <td><strong>{d.tour_title}</strong></td>
                <td>{d.destination_name}</td>
                <td>{d.start_date}</td>
                <td>{d.end_date}</td>
                <td>{d.booked_count ?? 0} / {d.capacity}</td>
                <td>
                  <span className={`badge ${d.status === 'OPEN' ? 'badge-green' : d.status === 'FULL' ? 'badge-orange' : 'badge-gray'}`}>
                    {d.status}
                  </span>
                </td>
              </tr>
            ))}
            {!departures.length && !loading && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px 16px', color: '#5a685e', fontSize: '14px' }}>
                  No departures scheduled yet. Click <strong>"Schedule departure"</strong> to open booking dates for travelers.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => !submitting && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#1a2e22' }}>Schedule Tour Departure</h3>
                <small style={{ color: '#5a685e' }}>Make a departure date available for traveler reservations</small>
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)} disabled={submitting}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateDeparture}>
              <label>
                Tour Package
                <select
                  required
                  value={form.tourId}
                  onChange={(e) => handleTourSelect(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line-strong)', marginTop: '4px', fontSize: '15px' }}
                >
                  {tours.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.destination_name})
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <label>
                  Start Date
                  <input
                    required
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </label>
                <label>
                  End Date
                  <input
                    required
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </label>
              </div>

              <label style={{ display: 'block', marginTop: '12px' }}>
                Available Seat Capacity
                <input
                  required
                  type="number"
                  min="1"
                  max="100"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                />
              </label>

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className="outline-btn"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={submitting}
                >
                  {submitting ? 'Scheduling…' : 'Publish Departure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default PlannerSchedules
