import { useState } from 'react'
import { Plus, MapPin, Trash2, X } from 'lucide-react'
import { api } from '../../api'
import type { WorkspaceData } from '../../types'

export interface MapTabProps {
  tripId: string
  destinationName: string
  places: WorkspaceData['mapPlaces']
  onRefresh: () => void
}

export function MapTab({ tripId, destinationName, places, onRefresh }: MapTabProps) {
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Attraction')
  const [notes, setNotes] = useState('')

  const add = async () => {
    if (!name.trim()) return
    await api(`/api/trips/${tripId}/map-places`, {
      method: 'POST',
      body: JSON.stringify({ name, category, notes }),
    })
    setShowModal(false)
    setName(''); setNotes('')
    onRefresh()
  }

  const deletePlace = async (id: string) => {
    await api(`/api/trips/${tripId}/map-places/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className="panel workspace-content">
      <div className="panel-heading">
        <div>
          <h2>Trip map & places of interest</h2>
          <p>Key locations around {destinationName}</p>
        </div>
        <button className="primary-btn" onClick={() => setShowModal(true)}><Plus size={15} /> Add place</button>
      </div>

      <div style={{ margin: '16px 0', background: '#dce8dc', height: '180px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#2d4b3b' }}>
        <MapPin size={32} />
        <strong style={{ marginTop: '8px' }}>Interactive Destination Map</strong>
        <small>{destinationName} Area · {places.length} saved points of interest</small>
      </div>

      <div style={{ marginTop: '16px' }}>
        {places.map((p) => (
          <div className="attraction-row" key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span className="badge badge-green">{p.category}</span>
              <strong style={{ fontSize: '13px', margin: '4px 0' }}>{p.name}</strong>
              {p.notes && <p style={{ fontSize: '11px', color: '#6d7770', margin: 0 }}>{p.notes}</p>}
            </div>
            <button className="icon-btn" onClick={() => deletePlace(p.id)} title="Delete place"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            <h2>Add a point of interest</h2>
            <label>Place name<input autoFocus placeholder="e.g. Inani Beach" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label>Category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>Attraction</option>
                <option>Beach</option>
                <option>Nature</option>
                <option>Dining</option>
                <option>Culture</option>
              </select>
            </label>
            <label>Notes<textarea placeholder="Best time to visit, tips..." value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
            <div className="modal-actions">
              <button className="outline-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="primary-btn" onClick={add}>Save place</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MapTab
