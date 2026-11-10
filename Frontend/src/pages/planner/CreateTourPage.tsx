import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import type { Destination } from '../../types'
import { PageHeader } from '../../components/common/PageHeader'

export function CreateTourPage() {
  const navigate = useNavigate()
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [form, setForm] = useState({ title: '', destinationId: '', description: '', price: '8500', capacity: '12' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api<Destination[]>('/api/destinations').then(setDestinations).catch(() => undefined)
  }, [])

  const submit = async () => {
    if (!form.title || !form.destinationId) return
    setSaving(true)
    try {
      await api('/api/tours', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          destinationId: form.destinationId,
          description: form.description || 'Guided expedition through local terrain.',
          price: Number(form.price),
          capacity: Number(form.capacity),
          status: 'PUBLISHED',
        }),
      })
      navigate('/planner/tours')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page role-page">
      <PageHeader title="Create a new tour" description="Publish an official tour package for travelers to book." />
      <div className="panel" style={{ maxWidth: '640px' }}>
        <label>Tour Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Sylhet Tea Trail Odyssey" /></label>
        <label style={{ marginTop: '10px' }}>Destination
          <select value={form.destinationId} onChange={(e) => setForm({ ...form, destinationId: e.target.value })}>
            <option value="">Select destination</option>
            {destinations.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.district})</option>)}
          </select>
        </label>
        <label style={{ marginTop: '10px' }}>Price per person (BDT)<input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
        <label style={{ marginTop: '10px' }}>Capacity (travelers)<input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></label>
        <label style={{ marginTop: '10px' }}>Description<textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <button className="primary-btn" style={{ marginTop: '16px' }} disabled={saving} onClick={submit}>
          {saving ? 'Publishing…' : 'Publish tour'}
        </button>
      </div>
    </div>
  )
}

export default CreateTourPage
