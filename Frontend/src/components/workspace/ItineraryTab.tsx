import { useState } from 'react'
import { Plus, MapPin, Trash2, Edit2, X } from 'lucide-react'
import { api, tripsApi } from '../../api'
import type { WorkspaceData } from '../../types'

export interface ItineraryTabProps {
  tripId: string
  items: WorkspaceData['itinerary']
  onRefresh: () => void
}

export function ItineraryTab({ tripId, items, onRefresh }: ItineraryTabProps) {
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    dayDate: new Date().toISOString().slice(0, 10),
    title: '',
    location: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const openAddModal = () => {
    setEditingId(null)
    setForm({
      dayDate: new Date().toISOString().slice(0, 10),
      title: '',
      location: '',
      notes: '',
    })
    setShowModal(true)
  }

  const openEditModal = (item: WorkspaceData['itinerary'][0]) => {
    setEditingId(item.id)
    setForm({
      dayDate: item.day_date,
      title: item.title,
      location: item.location || '',
      notes: item.notes || '',
    })
    setShowModal(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return

    setSaving(true)
    try {
      if (editingId) {
        await tripsApi.updateItinerary(tripId, editingId, {
          dayDate: form.dayDate,
          title: form.title.trim(),
          location: form.location.trim() || undefined,
          notes: form.notes.trim() || undefined,
        })
      } else {
        await tripsApi.addItinerary(tripId, {
          dayDate: form.dayDate,
          title: form.title.trim(),
          location: form.location.trim() || undefined,
          notes: form.notes.trim() || undefined,
        })
      }
      setShowModal(false)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  const deleteItem = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}" from the itinerary?`)) return
    await tripsApi.deleteItinerary(tripId, id)
    onRefresh()
  }

  return (
    <div className="panel workspace-content">
      <div className="panel-heading">
        <div>
          <h2>Daily itinerary</h2>
          <p>{items.length} scheduled stops and activities</p>
        </div>
        <button className="primary-btn" onClick={openAddModal}>
          <Plus size={17} /> Add stop
        </button>
      </div>

      <div style={{ marginTop: '16px' }}>
        {items.map((item) => (
          <div
            className="attraction-row"
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px',
              borderBottom: '1px solid #edf0ea',
              background: '#fff',
              borderRadius: '8px',
              marginBottom: '8px',
            }}
          >
            <div>
              <span className="eyebrow" style={{ color: 'var(--green)' }}>{item.day_date}</span>
              <strong style={{ fontSize: '15px', display: 'block', margin: '4px 0' }}>{item.title}</strong>
              {item.location && (
                <small style={{ color: '#5a685e', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <MapPin size={14} /> {item.location}
                </small>
              )}
              {item.notes && (
                <p style={{ fontSize: '13px', color: '#556459', marginTop: '6px', lineHeight: 1.45 }}>{item.notes}</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className="icon-btn"
                onClick={() => openEditModal(item)}
                title="Edit stop"
                aria-label="Edit stop"
              >
                <Edit2 size={16} />
              </button>
              <button
                className="icon-btn"
                onClick={() => deleteItem(item.id, item.title)}
                title="Delete stop"
                aria-label="Delete stop"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {!items.length && (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: '#5a685e', fontSize: '14.5px' }}>
            No itinerary stops yet. Add your first day!
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => !saving && setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#1a2e22' }}>
                  {editingId ? 'Edit Itinerary Stop' : 'Add Itinerary Item'}
                </h3>
                <small style={{ color: '#5a685e' }}>Schedule dates, landmarks, and details</small>
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)} aria-label="Close dialog" disabled={saving}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={save}>
              <label>
                Date
                <input
                  required
                  type="date"
                  value={form.dayDate}
                  onChange={(e) => setForm({ ...form, dayDate: e.target.value })}
                />
              </label>
              <label style={{ marginTop: '10px', display: 'block' }}>
                Title
                <input
                  required
                  autoFocus
                  placeholder="e.g. Sunrise view at Konglak Hill"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label style={{ marginTop: '10px', display: 'block' }}>
                Location
                <input
                  placeholder="e.g. Konglak Hilltop"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </label>
              <label style={{ marginTop: '10px', display: 'block' }}>
                Notes
                <textarea
                  rows={3}
                  placeholder="Tips, gear needed, timing..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
              <div className="modal-actions" style={{ marginTop: '18px' }}>
                <button type="button" className="outline-btn" onClick={() => setShowModal(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Update stop' : 'Save stop'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ItineraryTab
