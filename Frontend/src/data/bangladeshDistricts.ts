export interface DistrictInfo {
  id: string
  name: string
  division: string
  lat: number
  lng: number
}

export const BANGLADESH_DISTRICTS: DistrictInfo[] = [
  // Dhaka Division (13)
  { id: 'dhaka', name: 'Dhaka', division: 'Dhaka', lat: 23.8103, lng: 90.4125 },
  { id: 'gazipur', name: 'Gazipur', division: 'Dhaka', lat: 23.9999, lng: 90.4203 },
  { id: 'narayanganj', name: 'Narayanganj', division: 'Dhaka', lat: 23.6238, lng: 90.5000 },
  { id: 'tangail', name: 'Tangail', division: 'Dhaka', lat: 24.2513, lng: 89.9167 },
  { id: 'kishoreganj', name: 'Kishoreganj', division: 'Dhaka', lat: 24.4449, lng: 90.7766 },
  { id: 'manikganj', name: 'Manikganj', division: 'Dhaka', lat: 23.8617, lng: 90.0003 },
  { id: 'munshiganj', name: 'Munshiganj', division: 'Dhaka', lat: 23.5422, lng: 90.5305 },
  { id: 'narsingdi', name: 'Narsingdi', division: 'Dhaka', lat: 23.9193, lng: 90.7176 },
  { id: 'faridpur', name: 'Faridpur', division: 'Dhaka', lat: 23.6071, lng: 89.8429 },
  { id: 'gopalganj', name: 'Gopalganj', division: 'Dhaka', lat: 23.0051, lng: 89.8266 },
  { id: 'madaripur', name: 'Madaripur', division: 'Dhaka', lat: 23.1641, lng: 90.1897 },
  { id: 'rajbari', name: 'Rajbari', division: 'Dhaka', lat: 23.7574, lng: 89.6445 },
  { id: 'shariatpur', name: 'Shariatpur', division: 'Dhaka', lat: 23.2423, lng: 90.4348 },

  // Chattogram Division (11)
  { id: 'chattogram', name: 'Chattogram', division: 'Chattogram', lat: 22.3569, lng: 91.7832 },
  { id: 'coxs-bazar', name: "Cox's Bazar", division: 'Chattogram', lat: 21.4272, lng: 92.0058 },
  { id: 'bandarban', name: 'Bandarban', division: 'Chattogram', lat: 22.1953, lng: 92.2184 },
  { id: 'rangamati', name: 'Rangamati', division: 'Chattogram', lat: 22.6533, lng: 92.1753 },
  { id: 'khagrachari', name: 'Khagrachari', division: 'Chattogram', lat: 23.1193, lng: 91.9847 },
  { id: 'cumilla', name: 'Cumilla', division: 'Chattogram', lat: 23.4682, lng: 91.1788 },
  { id: 'brahmanbaria', name: 'Brahmanbaria', division: 'Chattogram', lat: 23.9571, lng: 91.1119 },
  { id: 'chandpur', name: 'Chandpur', division: 'Chattogram', lat: 23.2333, lng: 90.6667 },
  { id: 'feni', name: 'Feni', division: 'Chattogram', lat: 23.0159, lng: 91.3976 },
  { id: 'lakshmipur', name: 'Lakshmipur', division: 'Chattogram', lat: 22.9425, lng: 90.8412 },
  { id: 'noakhali', name: 'Noakhali', division: 'Chattogram', lat: 22.8696, lng: 91.0994 },

  // Sylhet Division (4)
  { id: 'sylhet', name: 'Sylhet', division: 'Sylhet', lat: 24.8949, lng: 91.8687 },
  { id: 'moulvibazar', name: 'Moulvibazar', division: 'Sylhet', lat: 24.4829, lng: 91.7774 },
  { id: 'habiganj', name: 'Habiganj', division: 'Sylhet', lat: 24.3750, lng: 91.4167 },
  { id: 'sunamganj', name: 'Sunamganj', division: 'Sylhet', lat: 25.0658, lng: 91.3950 },

  // Rajshahi Division (8)
  { id: 'rajshahi', name: 'Rajshahi', division: 'Rajshahi', lat: 24.3745, lng: 88.6042 },
  { id: 'bogura', name: 'Bogura', division: 'Rajshahi', lat: 24.8465, lng: 89.3777 },
  { id: 'joypurhat', name: 'Joypurhat', division: 'Rajshahi', lat: 25.1011, lng: 89.0275 },
  { id: 'naogaon', name: 'Naogaon', division: 'Rajshahi', lat: 24.7936, lng: 88.9318 },
  { id: 'natore', name: 'Natore', division: 'Rajshahi', lat: 24.4206, lng: 88.9324 },
  { id: 'chapainawabganj', name: 'Chapainawabganj', division: 'Rajshahi', lat: 24.5965, lng: 88.2775 },
  { id: 'pabna', name: 'Pabna', division: 'Rajshahi', lat: 24.0064, lng: 89.2372 },
  { id: 'sirajganj', name: 'Sirajganj', division: 'Rajshahi', lat: 24.4534, lng: 89.7008 },

  // Khulna Division (10)
  { id: 'khulna', name: 'Khulna', division: 'Khulna', lat: 22.8456, lng: 89.5403 },
  { id: 'bagerhat', name: 'Bagerhat', division: 'Khulna', lat: 22.6516, lng: 89.7859 },
  { id: 'chuadanga', name: 'Chuadanga', division: 'Khulna', lat: 23.6402, lng: 88.8418 },
  { id: 'jashore', name: 'Jashore', division: 'Khulna', lat: 23.1664, lng: 89.2081 },
  { id: 'jhenaidah', name: 'Jhenaidah', division: 'Khulna', lat: 23.5448, lng: 89.1539 },
  { id: 'kushtia', name: 'Kushtia', division: 'Khulna', lat: 23.9013, lng: 89.1205 },
  { id: 'magura', name: 'Magura', division: 'Khulna', lat: 23.4873, lng: 89.4198 },
  { id: 'meherpur', name: 'Meherpur', division: 'Khulna', lat: 23.7725, lng: 88.6318 },
  { id: 'narail', name: 'Narail', division: 'Khulna', lat: 23.1725, lng: 89.5127 },
  { id: 'satkhira', name: 'Satkhira', division: 'Khulna', lat: 22.7185, lng: 89.0705 },

  // Barishal Division (6)
  { id: 'barishal', name: 'Barishal', division: 'Barishal', lat: 22.7010, lng: 90.3535 },
  { id: 'barguna', name: 'Barguna', division: 'Barishal', lat: 22.1570, lng: 90.1264 },
  { id: 'bhola', name: 'Bhola', division: 'Barishal', lat: 22.6859, lng: 90.6481 },
  { id: 'jhalokati', name: 'Jhalokati', division: 'Barishal', lat: 22.6406, lng: 90.1987 },
  { id: 'patuakhali', name: 'Patuakhali', division: 'Barishal', lat: 22.3596, lng: 90.3299 },
  { id: 'pirojpur', name: 'Pirojpur', division: 'Barishal', lat: 22.5841, lng: 89.9720 },

  // Rangpur Division (8)
  { id: 'rangpur', name: 'Rangpur', division: 'Rangpur', lat: 25.7439, lng: 89.2752 },
  { id: 'dinajpur', name: 'Dinajpur', division: 'Rangpur', lat: 25.6217, lng: 88.6355 },
  { id: 'gaibandha', name: 'Gaibandha', division: 'Rangpur', lat: 25.3288, lng: 89.5406 },
  { id: 'kurigram', name: 'Kurigram', division: 'Rangpur', lat: 25.8054, lng: 89.6362 },
  { id: 'lalmonirhat', name: 'Lalmonirhat', division: 'Rangpur', lat: 25.9923, lng: 89.2847 },
  { id: 'nilphamari', name: 'Nilphamari', division: 'Rangpur', lat: 25.9318, lng: 88.8560 },
  { id: 'panchagarh', name: 'Panchagarh', division: 'Rangpur', lat: 26.3411, lng: 88.5542 },
  { id: 'thakurgaon', name: 'Thakurgaon', division: 'Rangpur', lat: 26.0337, lng: 88.4617 },

  // Mymensingh Division (4)
  { id: 'mymensingh', name: 'Mymensingh', division: 'Mymensingh', lat: 24.7471, lng: 90.4203 },
  { id: 'jamalpur', name: 'Jamalpur', division: 'Mymensingh', lat: 24.9375, lng: 89.9378 },
  { id: 'netrokona', name: 'Netrokona', division: 'Mymensingh', lat: 24.8778, lng: 90.7275 },
  { id: 'sherpur', name: 'Sherpur', division: 'Mymensingh', lat: 25.0205, lng: 90.0153 },
]

/**
 * Normalizes district names to handle alternate spellings:
 * e.g. "Cox's Bazar" / "Cox’s Bazar" / "Coxs Bazar"
 * "Chittagong" / "Chattogram"
 * "Bogra" / "Bogura"
 * "Jessore" / "Jashore"
 * "Comilla" / "Cumilla"
 * "Barisal" / "Barishal"
 */
export function normalizeDistrict(input: string): string {
  if (!input) return ''
  const clean = input
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]/g, '')

  if (clean === 'chittagong') return 'chattogram'
  if (clean === 'bogra') return 'bogura'
  if (clean === 'jessore') return 'jashore'
  if (clean === 'comilla') return 'cumilla'
  if (clean === 'barisal') return 'barishal'
  if (clean === 'coxsbazar') return 'coxsbazar'
  return clean
}

export function isDistrictVisited(
  districtName: string,
  visitedList: string[] = []
): boolean {
  const target = normalizeDistrict(districtName)
  return visitedList.some((v) => normalizeDistrict(v) === target)
}

/**
 * Approximate coordinate lookup for common Bangladesh travel destinations
 */
export const DESTINATION_COORDINATES: Record<string, [number, number]> = {
  "cox's bazar": [21.4272, 92.0058],
  "cox’s bazar": [21.4272, 92.0058],
  'sylhet': [24.8949, 91.8687],
  'sreemangal': [24.3065, 91.7296],
  'bandarban': [22.1953, 92.2184],
  'sajek': [23.3820, 92.2938],
  'sajek valley': [23.3820, 92.2938],
  'dhaka': [23.8103, 90.4125],
  'saint martin': [20.6277, 92.3223],
  "st. martin's island": [20.6277, 92.3223],
  'chattogram': [22.3569, 91.7832],
  'chittagong': [22.3569, 91.7832],
  'rangamati': [22.6533, 92.1753],
  'khagrachari': [23.1193, 91.9847],
  'sundarbans': [21.9497, 89.1833],
  'kuakata': [21.8167, 90.1167],
  'rajshahi': [24.3745, 88.6042],
  'khulna': [22.8456, 89.5403],
  'barishal': [22.7010, 90.3535],
  'tanguar haor': [25.1328, 91.0772],
}

export function getDestinationCenter(name: string): [number, number] {
  const key = (name || '').toLowerCase().trim()
  for (const [dest, coords] of Object.entries(DESTINATION_COORDINATES)) {
    if (key.includes(dest) || dest.includes(key)) {
      return coords
    }
  }
  return [23.6850, 90.3563] // Bangladesh geographical center
}
