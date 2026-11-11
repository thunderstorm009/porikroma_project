import { api } from './client'

export interface WeatherForecastDay {
  date: string
  day: string
  tempMin: number
  tempMax: number
  description: string
  icon: string
  humidity: number
}

export interface WeatherData {
  location: {
    name: string
    lat: number
    lon: number
  }
  current: {
    temp: number
    feelsLike: number
    humidity: number
    description: string
    icon: string
    windSpeed: number
  }
  forecast: WeatherForecastDay[]
  cached: boolean
  source: string
  message?: string
}

export async function getWeather(params: {
  lat?: number
  lon?: number
  destinationId?: string
  destination?: string
}): Promise<WeatherData> {
  const query = new URLSearchParams()
  if (params.lat !== undefined && params.lon !== undefined) {
    query.set('lat', String(params.lat))
    query.set('lon', String(params.lon))
  }
  if (params.destinationId) {
    query.set('destination_id', params.destinationId)
  }
  if (params.destination) {
    query.set('destination', params.destination)
  }
  return api<WeatherData>(`/api/weather?${query.toString()}`)
}
