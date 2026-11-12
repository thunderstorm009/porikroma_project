import { useState } from "react"
import { Plus, MapPin, Trash2, X } from "lucide-react"
import { api } from "../../api"
import type { WorkspaceData } from "../../types"

export interface ItineraryTabProps {
  tripId: string
  items: WorkspaceData["itinerary"]
  onRefresh: () => void
}

export function ItineraryTab({ tripId, items, onRefresh }: ItineraryTabProps) {
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ dayDate: new Date().toISOString().slice(0, 10), title: "", location: "", notes: "" })

  const add = async () => {
    if (!form.title.trim()) return
    await api(`/api/trips/${tripId}/itinerary`, {
      method: "POST",
      body: JSON.stringify(form),
    })
    setShowModal(false)
    setForm({ dayDate: new Date().toISOString().slice(0, 10), title: "", location: "", notes: "" })
    onRefresh()
  }

  const deleteItem = async (id: string) => {
    await api(`/api/trips/${tripId}/itinerary/${id}`, { method: "DELETE" })
    onRefresh()
  }

  return (
    <div className="panel workspace-content">
      <div className="panel-heading">
        <div>
          <h2>Daily itinerary</h2>
          <p>{items.length} scheduled stops and activities</p>
        </div>
        <button className="primary-btn" onClick={() => setShowModal(true)}><Plus size={16} /> Add stop</button>
      </div>

      <div className="itinerary-tab-list">
        {items.map((item) => (
          <div className="attraction-row itinerary-tab-row" key={item.id}>
            <div>
              <span className="eyebrow">{item.day_date}</span>
              <strong className="itinerary-tab-title">{item.title}</strong>
              {item.location && (
                <small className="itinerary-tab-location">
                  <MapPin size={12} /> {item.location}
                </small>
              )}
              {item.notes && <p className="itinerary-tab-notes">{item.notes}</p>}
            </div>
            <button className="icon-btn" onClick={() => deleteItem(item.id)} title="Delete stop"><Trash2 size={15} /></button>
          </div>
        ))}
        {!items.length && (
          <div className="itinerary-tab-empty">No itinerary stops yet. Add your first day!</div>
        )}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            <h2>Add itinerary item</h2>
            <label>Date<input type="date" value={form.dayDate} onChange={(e) => setForm({ ...form, dayDate: e.target.value })} /></label>
            <label>Title<input autoFocus placeholder="e.g. Sunrise view at Konglak Hill" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label>Location<input placeholder="e.g. Konglak Hilltop" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
            <label>Notes<textarea placeholder="Tips, gear needed, timing..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            <div className="modal-actions">
              <button className="outline-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="primary-btn" onClick={add}>Save stop</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ItineraryTab
