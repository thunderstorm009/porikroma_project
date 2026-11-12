import L from "leaflet"
import "leaflet/dist/leaflet.css"

// Fix Vite default marker icon URL resolution
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png"
import iconUrl from "leaflet/dist/images/marker-icon.png"
import shadowUrl from "leaflet/dist/images/marker-shadow.png"

delete (L.Icon.Default.prototype as any)._getIconUrl

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
})

export { L }

/**
 * Custom SVG DivIcon generator for trip map places with monochrome styling.
 * Default: charcoal #283130
 * Active / Selected: muted blue #536C87
 * Category variants distinguished by shape and light-gray fill with charcoal outline.
 */
export function createPlaceIcon(category: string = "Attraction", label?: string, isSelected: boolean = false) {
  const cat = category.toLowerCase()

  let bg = "#283130" // charcoal default
  let text = "#E8E8E8" // light-gray / on-primary
  let borderRadius = "50% 50% 50% 0" // teardrop pin default
  let border = "2px solid #283130"

  if (isSelected) {
    bg = "#536C87" // muted blue for active/selected
    text = "#FFFFFF"
    border = "2px solid #283130"
  } else if (cat.includes("beach") || cat.includes("sea") || cat.includes("water")) {
    // Water/Beach: light-gray fill with charcoal outline
    bg = "#EAEAEA"
    text = "#283130"
    borderRadius = "50% 50% 50% 0"
  } else if (cat.includes("nature") || cat.includes("park") || cat.includes("hill")) {
    // Nature: circular charcoal pin
    bg = "#283130"
    text = "#E8E8E8"
    borderRadius = "50%"
  } else if (cat.includes("food") || cat.includes("dining") || cat.includes("cafe")) {
    // Food/Dining: circular light-gray pin with charcoal outline
    bg = "#EAEAEA"
    text = "#283130"
    borderRadius = "50%"
  } else if (cat.includes("culture") || cat.includes("historic") || cat.includes("temple")) {
    // Culture: rounded square/diamond shape
    bg = "#283130"
    text = "#E8E8E8"
    borderRadius = "6px"
  } else if (cat.includes("viewpoint") || cat.includes("view")) {
    // Viewpoint: rounded square shape, light-gray fill
    bg = "#EAEAEA"
    text = "#283130"
    borderRadius = "6px"
  }

  const isTeardrop = borderRadius === "50% 50% 50% 0"

  const html = `
    <div style="
      background: ${bg};
      color: ${text};
      width: 28px;
      height: 28px;
      border-radius: ${borderRadius};
      ${isTeardrop ? "transform: rotate(-45deg);" : ""}
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 2px 3px 5px rgba(0,0,0,0.25);
      border: ${border};
      cursor: pointer;
    ">
      <span style="
        ${isTeardrop ? "transform: rotate(45deg);" : ""}
        font-size: 11px;
        font-weight: 700;
        font-family: system-ui, -apple-system, sans-serif;
      ">${label ? label.slice(0, 2) : "•"}</span>
    </div>
  `

  return L.divIcon({
    className: "custom-leaflet-place-icon",
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  })
}

/**
 * Numbered waypoint icon for itinerary stops (charcoal monochrome, digital font)
 */
export function createItineraryStopIcon(stopNumber: number) {
  const html = `
    <div style="
      background: #283130;
      color: #E8E8E8;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 11px;
      border: 2px solid #283130;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      font-family: "Orbitron", monospace, sans-serif;
    ">
      ${stopNumber}
    </div>
  `

  return L.divIcon({
    className: "custom-itinerary-stop-icon",
    html,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  })
}

/**
 * District pin for the Footprint explorer (visited vs unvisited monochrome)
 */
export function createDistrictIcon(visited: boolean, _title?: string) {
  if (visited) {
    const html = `
      <div style="
        background: #283130;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 2px solid #283130;
        box-shadow: 0 0 0 2px #536C87, 0 2px 4px rgba(0,0,0,0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #E8E8E8;
        font-size: 10px;
        font-weight: bold;
      ">✓</div>
    `
    return L.divIcon({
      className: "district-icon-visited",
      html,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -9],
    })
  }

  const html = `
    <div style="
      background: #B8B8B8;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 1.5px solid #283130;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    "></div>
  `
  return L.divIcon({
    className: "district-icon-unvisited",
    html,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
    popupAnchor: [0, -5],
  })
}
