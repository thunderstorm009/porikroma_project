import { useMemo, useState, useEffect } from "react"
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet"
import { Plus, MapPin, Trash2, X, Compass, Layers } from "lucide-react"
import { api } from "../../api"
import type { WorkspaceData } from "../../types"
import { L, createPlaceIcon, createItineraryStopIcon } from "../../utils/leafletSetup"
import { getDestinationCenter, DESTINATION_COORDINATES } from "../../data/bangladeshDistricts"

export interface MapTabProps {
  tripId: string
  destinationName: string
  places: WorkspaceData["mapPlaces"]
  itinerary?: WorkspaceData["itinerary"]
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
    window.addEventListener("resize", handleResize)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("resize", handleResize)
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
  const [name, setName] = useState("")
  const [category, setCategory] = useState("Attraction")
  const [notes, setNotes] = useState("")
  const [clickedLat, setClickedLat] = useState<number | null>(null)
  const [clickedLng, setClickedLng] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState("")

  const destCenter = useMemo(() => getDestinationCenter(destinationName), [destinationName])

  // Resolve coordinates for each place (with deterministic jitter if missing)
  const resolvedPlaces = useMemo(() => {
    return places.map((p, idx) => {
      const lat = typeof p.lat === "number" && !isNaN(p.lat) ? p.lat : destCenter[0] + (idx + 1) * 0.008 * Math.cos(idx * 1.5)
      const lng = typeof p.lng === "number" && !isNaN(p.lng) ? p.lng : destCenter[1] + (idx + 1) * 0.008 * Math.sin(idx * 1.5)
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
      if (typeof item.lat === "number" && typeof item.lng === "number") {
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
    setName("")
    setNotes("")
    setCategory("Attraction")
    setActionError("")
    setShowModal(true)
  }

  const handleOpenAddModal = () => {
    setClickedLat(destCenter[0])
    setClickedLng(destCenter[1])
    setName("")
    setNotes("")
    setCategory("Attraction")
    setActionError("")
    setShowModal(true)
  }

  const handleSavePlace = async () => {
    if (!name.trim()) return
    setSaving(true)
    setActionError("")
    try {
      await api(`/api/trips/${tripId}/map-places`, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          category,
          notes: notes.trim(),
          lat: clickedLat ?? destCenter[0],
          lng: clickedLng ?? destCenter[1],
        }),
      })
      setShowModal(false)
      setName("")
      setNotes("")
      onRefresh()
    } catch (err: any) {
      setActionError(err?.message || "Failed to save place")
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePlace = async (id: string) => {
    try {
      await api(`/api/trips/${tripId}/map-places/${id}`, { method: "DELETE" })
      onRefresh()
    } catch (err: any) {
      alert(err?.message || "Failed to delete place")
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
        <div className="map-tab-heading-actions">
          <button className="primary-btn" onClick={handleOpenAddModal}>
            <Plus size={15} /> Add place
          </button>
        </div>
      </div>

      <div className="map-tab-hint">
        <Compass size={14} className="map-tab-hint-icon" />
        <span>Click anywhere on the map to pin a new place, or click existing markers to view details.</span>
      </div>

      {/* Real Interactive Leaflet Map */}
      <div className="porikroma-map-container">
        <MapContainer
          center={destCenter}
          zoom={12}
          scrollWheelZoom={true}
          className="map-tab-leaflet-map"
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
                color: "#283130",
                weight: 3,
                opacity: 0.9,
                dashArray: "6, 8",
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
                <div className="map-tab-popup">
                  <div className="map-tab-popup-header">
                    <span className="map-tab-popup-stop">
                      Stop #{idx + 1}
                    </span>
                    <small className="map-tab-popup-date">{w.item.day_date}</small>
                  </div>
                  <strong className="map-tab-popup-title">{w.item.title}</strong>
                  {w.item.location && (
                    <p className="map-tab-popup-loc">
                      <MapPin size={11} /> {w.item.location}
                    </p>
                  )}
                  {w.item.notes && <p className="map-tab-popup-notes">{w.item.notes}</p>}
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
                <div className="map-tab-popup">
                  <span className="badge badge-green">{p.category}</span>
                  <strong className="map-tab-place-name">{p.name}</strong>
                  {p.notes && <p className="map-tab-popup-notes">{p.notes}</p>}
                  <div className="map-tab-popup-coords">
                    Lat: {p.lat.toFixed(4)}, Lng: {p.lng.toFixed(4)}
                  </div>
                  <button
                    onClick={() => handleDeletePlace(p.id)}
                    className="map-tab-popup-delete"
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
      <div className="map-tab-legend">
        <div className="map-tab-legend-item">
          <span className="map-tab-legend-dot" />
          <span>Saved Places ({resolvedPlaces.length})</span>
        </div>
        {itineraryWaypoints.length > 0 && (
          <div className="map-tab-legend-item">
            <span className="map-tab-legend-line" />
            <span>Itinerary Route ({itineraryWaypoints.length} stops)</span>
          </div>
        )}
        <div className="map-tab-legend-attr">
          Powered by OpenStreetMap
        </div>
      </div>

      {/* Saved Places List */}
      <div className="map-tab-places-list">
        <h3 className="map-tab-places-heading">
          <Layers size={16} /> Saved Points of Interest
        </h3>
        {resolvedPlaces.length === 0 ? (
          <p className="map-tab-empty-text">
            No custom places pinned yet. Click on the map or the &ldquo;Add place&rdquo; button above to pin beaches, tea stalls, viewpoints, or dining spots.
          </p>
        ) : (
          resolvedPlaces.map((p) => (
            <div className="attraction-row map-tab-place-row" key={p.id}>
              <div>
                <span className="badge badge-green">{p.category}</span>
                <strong className="map-tab-place-name">{p.name}</strong>
                {p.notes && <p className="map-tab-place-notes">{p.notes}</p>}
                <small className="map-tab-place-coords">
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
            <p className="map-tab-modal-coords">
              {clickedLat && clickedLng
                ? `Pinned at coordinates: ${clickedLat.toFixed(4)}, ${clickedLng.toFixed(4)}`
                : `Adding to ${destinationName}`}
            </p>

            {actionError && (
              <p className="error-box">
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
                {saving ? "Saving…" : "Save place"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MapTab
