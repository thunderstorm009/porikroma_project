import { useMemo, useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet'
import { Plus, MapPin, Trash2, X, Navigation, Compass, Layers } from 'lucide-react'
import { api } from '../../api'
import type { WorkspaceData } from '../../types'
import { L, createPlaceIcon, createItineraryStopIcon } from '../../utils/leafletSetup'
import { getDestinationCenter, DESTINATION_COORDINATES } from '../../data/bangladeshDistricts'

export interface MapTabProps {
  tripId: string
  destinationName: string
  places: WorkspaceData['mapPlaces']
  itinerary?: WorkspaceData['itinerary']
  onRefresh: () => void
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function MapResizer() {
  const map = useMap()
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 250)
    const handleResize = () => map.invalidateSize()
    window.addEventListener('resize', handleResize)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', handleResize)
    }
  }, [map])
  return null
}

function MapBoundsController({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (!points || points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 13)
    } else {
      const bounds = L.latLngBounds(points)
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }
  }, [map, points])
  return null
}

export function MapTab({ tripId, destinationName, places, itinerary = [], onRefresh }: MapTabProps) {
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Attraction')
  const [notes, setNotes] = useState('')
  const [clickedLat, setClickedLat] = useState<number | null>(null)
  const [clickedLng, setClickedLng] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')

  const destCenter = useMemo(() => getDestinationCenter(destinationName), [destinationName])

  // Resolve coordinates for each place (with deterministic jitter if missing)
  const resolvedPlaces = useMemo(() => {
    return places.map((p, idx) => {
      const lat = typeof p.lat === 'number' && !isNaN(p.lat) ? p.lat : destCenter[0] + (idx + 1) * 0.008 * Math.cos(idx * 1.5)
      const lng = typeof p.lng === 'number' && !isNaN(p.lng) ? p.lng : destCenter[1] + (idx + 1) * 0.008 * Math.sin(idx * 1.5)
      return { ...p, lat, lng }
    })
  }, [places, destCenter])

  // Resolve sorted itinerary waypoints for drawing the route line
  const sortedItinerary = useMemo(() => {
    return [...itinerary].sort((a, b) => {
      if (a.day_date !== b.day_date) return a.day_date.localeCompare(b.day_date)
      return (a.sort_order || 0) - (b.sort_order || 0)
    })
  }, [itinerary])

  const itineraryWaypoints = useMemo(() => {
    return sortedItinerary.map((item, idx) => {
      // 1. Direct coordinates if present
      if (typeof item.lat === 'number' && typeof item.lng === 'number') {
        return { item, coord: [item.lat, item.lng] as [number, number] }
      }
      // 2. Match with saved places
      if (item.location) {
        const locLower = item.location.toLowerCase()
        const matchedPlace = resolvedPlaces.find((p) => p.name.toLowerCase().includes(locLower) || locLower.includes(p.name.toLowerCase()))
        if (matchedPlace) {
          return { item, coord: [matchedPlace.lat, matchedPlace.lng] as [number, number] }
        }
        // 3. Match with known destination coordinates
        for (const [k, c] of Object.entries(DESTINATION_COORDINATES)) {
          if (locLower.includes(k) || k.includes(locLower)) {
            return { item, coord: c }
          }
        }
      }
      // 4. Fallback progressive waypoint around destination
      const offsetLat = destCenter[0] + 0.012 * Math.sin((idx + 1) * 1.4)
      const offsetLng = destCenter[1] + 0.012 * Math.cos((idx + 1) * 1.4)
      return { item, coord: [offsetLat, offsetLng] as [number, number] }
    })
  }, [sortedItinerary, resolvedPlaces, destCenter])

  const polylineCoords = useMemo(() => {
    return itineraryWaypoints.map((w) => w.coord)
  }, [itineraryWaypoints])

  // Combined bounds points (places + itinerary stops + destination center)
  const allPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = []
    resolvedPlaces.forEach((p) => pts.push([p.lat, p.lng]))
    itineraryWaypoints.forEach((w) => pts.push(w.coord))
    if (pts.length === 0) pts.push(destCenter)
    return pts
  }, [resolvedPlaces, itineraryWaypoints, destCenter])

  const handleMapClick = (lat: number, lng: number) => {
    setClickedLat(lat)
    setClickedLng(lng)
    setName('')
    setNotes('')
    setCategory('Attraction')
    setActionError('')
    setShowModal(true)
  }

  const handleOpenAddModal = () => {
    setClickedLat(destCenter[0])
    setClickedLng(destCenter[1])
    setName('')
    setNotes('')
    setCategory('Attraction')
    setActionError('')
    setShowModal(true)
  }

  const handleSavePlace = async () => {
    if (!name.trim()) return
    setSaving(true)
    setActionError('')
    try {
      await api(`/api/trips/${tripId}/map-places`, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          category,
          notes: notes.trim(),
          lat: clickedLat ?? destCenter[0],
          lng: clickedLng ?? destCenter[1],
        }),
      })
      setShowModal(false)
      setName('')
      setNotes('')
      onRefresh()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to save place')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePlace = async (id: string) => {
    try {
      await api(`/api/trips/${tripId}/map-places/${id}`, { method: 'DELETE' })
      onRefresh()
    } catch (err: any) {
      alert(err?.message || 'Failed to delete place')
    }
  }

  return (
    <div className="panel workspace-content">
      <div className="panel-heading">
        <div>
          <h2>Trip map & places of interest</h2>
          <p>
            {destinationName} Area · {resolvedPlaces.length} saved places
            {itineraryWaypoints.length > 0 && ` · ${itineraryWaypoints.length} itinerary stops connected`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="primary-btn" onClick={handleOpenAddModal}>
            <Plus size={15} /> Add place
          </button>
        </div>
      </div>

      <div style={{ margin: '8px 0', fontSize: '12px', color: '#556557', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Compass size={14} color="#15803d" />
        <span>Click anywhere on the map to pin a new place, or click existing markers to view details.</span>
      </div>

      {/* Real Interactive Leaflet Map */}
      <div
        className="porikroma-map-container"
        style={{
          height: '420px',
          width: '100%',
          borderRadius: '10px',
          overflow: 'hidden',
          position: 'relative',
          margin: '12px 0 20px',
          border: '1px solid #c8d7c4',
          zIndex: 0,
        }}
      >
        <MapContainer
          center={destCenter}
          zoom={12}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapResizer />
          <MapBoundsController points={allPoints} />
          <MapClickHandler onMapClick={handleMapClick} />

          {/* Polyline connecting itinerary stops in chronological order */}
          {polylineCoords.length > 1 && (
            <Polyline
              positions={polylineCoords}
              pathOptions={{
                color: '#15803d',
                weight: 4,
                opacity: 0.85,
                dashArray: '6, 8',
              }}
            />
          )}

          {/* Itinerary Waypoints (Stop #1, #2, #3...) */}
          {itineraryWaypoints.map((w, idx) => (
            <Marker
              key={`itin-${w.item.id || idx}`}
              position={w.coord}
              icon={createItineraryStopIcon(idx + 1)}
            >
              <Popup>
                <div style={{ minWidth: '180px', fontFamily: 'inherit' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ background: '#1e3a2b', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                      Stop #{idx + 1}
                    </span>
                    <small style={{ color: '#6d7770' }}>{w.item.day_date}</small>
                  </div>
                  <strong style={{ fontSize: '13px', display: 'block', color: '#1a3324' }}>{w.item.title}</strong>
                  {w.item.location && (
                    <p style={{ fontSize: '11px', color: '#4d5d52', margin: '3px 0', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <MapPin size={11} /> {w.item.location}
                    </p>
                  )}
                  {w.item.notes && <p style={{ fontSize: '11px', color: '#6d7770', margin: '4px 0 0' }}>{w.item.notes}</p>}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Saved Trip Map Places */}
          {resolvedPlaces.map((p) => (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={createPlaceIcon(p.category, p.name)}
            >
              <Popup>
                <div style={{ minWidth: '190px', fontFamily: 'inherit' }}>
                  <span className="badge badge-green" style={{ fontSize: '10px', padding: '2px 6px' }}>{p.category}</span>
                  <strong style={{ display: 'block', fontSize: '13px', margin: '4px 0 2px', color: '#1a3324' }}>{p.name}</strong>
                  {p.notes && <p style={{ fontSize: '11px', color: '#4d5d52', margin: '2px 0 8px' }}>{p.notes}</p>}
                  <div style={{ fontSize: '9px', color: '#889988', margin: '4px 0' }}>
                    Lat: {p.lat.toFixed(4)}, Lng: {p.lng.toFixed(4)}
                  </div>
                  <button
                    onClick={() => handleDeletePlace(p.id)}
                    style={{
                      background: '#fee2e2',
                      color: '#b91c1c',
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '6px',
                    }}
                  >
                    <Trash2 size={12} /> Remove place
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Legend & Summary */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', padding: '10px 14px', background: '#f4f7f2', borderRadius: '8px', fontSize: '12px', color: '#445547' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          <span>Saved Places ({resolvedPlaces.length})</span>
        </div>
        {itineraryWaypoints.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '16px', height: '3px', background: '#15803d', display: 'inline-block', borderStyle: 'dashed' }} />
            <span>Itinerary Route ({itineraryWaypoints.length} stops)</span>
          </div>
        )}
        <div style={{ marginLeft: 'auto', color: '#6d7770', fontSize: '11px' }}>
          Powered by OpenStreetMap
        </div>
      </div>

      {/* Saved Places List */}
      <div style={{ marginTop: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#2d4b3b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Layers size={16} /> Saved Points of Interest
        </h3>
        {resolvedPlaces.length === 0 ? (
          <p className="muted" style={{ fontSize: '12px', padding: '12px 0' }}>
            No custom places pinned yet. Click on the map or the &ldquo;Add place&rdquo; button above to pin beaches, tea stalls, viewpoints, or dining spots.
          </p>
        ) : (
          resolvedPlaces.map((p) => (
            <div className="attraction-row" key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span className="badge badge-green">{p.category}</span>
                <strong style={{ fontSize: '13px', margin: '4px 0' }}>{p.name}</strong>
                {p.notes && <p style={{ fontSize: '11px', color: '#6d7770', margin: 0 }}>{p.notes}</p>}
                <small style={{ fontSize: '10px', color: '#8d9c8c' }}>
                  ({p.lat.toFixed(4)}, {p.lng.toFixed(4)})
                </small>
              </div>
              <button className="icon-btn" onClick={() => handleDeletePlace(p.id)} title="Delete place">
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add Place Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>
              <X size={18} />
            </button>
            <h2>Pin a place of interest</h2>
            <p style={{ fontSize: '12px', color: '#6d7770', margin: '-4px 0 12px' }}>
              {clickedLat && clickedLng
                ? `Pinned at coordinates: ${clickedLat.toFixed(4)}, ${clickedLng.toFixed(4)}`
                : `Adding to ${destinationName}`}
            </p>

            {actionError && (
              <p style={{ color: '#dc2626', fontSize: '12px', background: '#fee2e2', padding: '6px 10px', borderRadius: '4px' }}>
                {actionError}
              </p>
            )}

            <label>
              Place name
              <input
                autoFocus
                placeholder="e.g. Inani Beach, Nilkantha Tea Cabin"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>Attraction</option>
                <option>Beach</option>
                <option>Nature</option>
                <option>Dining</option>
                <option>Culture</option>
                <option>Viewpoint</option>
                <option>Accommodation</option>
              </select>
            </label>
            <label>
              Notes
              <textarea
                placeholder="Best time to visit, tips, entry tickets..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <div className="modal-actions">
              <button className="outline-btn" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="primary-btn" onClick={handleSavePlace} disabled={saving || !name.trim()}>
                {saving ? 'Saving…' : 'Save place'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MapTab
