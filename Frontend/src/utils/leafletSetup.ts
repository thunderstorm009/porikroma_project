import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Vite default marker icon URL resolution
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as any)._getIconUrl

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
})

export { L }

/**
 * Custom SVG DivIcon generator for trip map places with category colors
 */
export function createPlaceIcon(category: string = 'Attraction', label?: string) {
  const cat = category.toLowerCase()
  let color = '#2d4b3b' // forest green (default)
  let bgGradient = 'linear-gradient(135deg, #34d399, #059669)'

  if (cat.includes('beach') || cat.includes('sea') || cat.includes('water')) {
    color = '#0284c7'
    bgGradient = 'linear-gradient(135deg, #38bdf8, #0284c7)'
  } else if (cat.includes('nature') || cat.includes('park') || cat.includes('hill')) {
    color = '#15803d'
    bgGradient = 'linear-gradient(135deg, #4ade80, #15803d)'
  } else if (cat.includes('food') || cat.includes('dining') || cat.includes('cafe')) {
    color = '#d97706'
    bgGradient = 'linear-gradient(135deg, #fbbf24, #d97706)'
  } else if (cat.includes('culture') || cat.includes('historic') || cat.includes('temple')) {
    color = '#7c3aed'
    bgGradient = 'linear-gradient(135deg, #a78bfa, #7c3aed)'
  }

  const html = `
    <div style="
      background: ${bgGradient};
      color: #fff;
      width: 28px;
      height: 28px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 6px rgba(0,0,0,0.3);
      border: 2px solid #ffffff;
      cursor: pointer;
    ">
      <span style="
        transform: rotate(45deg);
        font-size: 11px;
        font-weight: 700;
        font-family: system-ui, sans-serif;
      ">${label ? label.slice(0, 2) : '•'}</span>
    </div>
  `

  return L.divIcon({
    className: 'custom-leaflet-place-icon',
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  })
}

/**
 * Numbered waypoint icon for itinerary stops
 */
export function createItineraryStopIcon(stopNumber: number) {
  const html = `
    <div style="
      background: #1e3a2b;
      color: #f6f7f2;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 11px;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 5px rgba(0,0,0,0.35);
      font-family: system-ui, sans-serif;
    ">
      ${stopNumber}
    </div>
  `

  return L.divIcon({
    className: 'custom-itinerary-stop-icon',
    html,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  })
}

/**
 * District pin for the Footprint explorer (visited vs unvisited)
 */
export function createDistrictIcon(visited: boolean, title?: string) {
  if (visited) {
    const html = `
      <div style="
        background: #10b981;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 2px solid #ffffff;
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.4), 0 2px 4px rgba(0,0,0,0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 10px;
        font-weight: bold;
      ">✓</div>
    `
    return L.divIcon({
      className: 'district-icon-visited',
      html,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -9],
    })
  }

  const html = `
    <div style="
      background: #94a3b8;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    "></div>
  `
  return L.divIcon({
    className: 'district-icon-unvisited',
    html,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
    popupAnchor: [0, -5],
  })
}
