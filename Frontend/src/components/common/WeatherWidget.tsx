import { useEffect, useState } from 'react'
import { CloudSun, Droplets, Wind, Thermometer, Calendar } from 'lucide-react'
import { getWeather, type WeatherData } from '../../api/weather'

export interface WeatherWidgetProps {
  destinationId?: string
  destinationName?: string
  datesLabel?: string
  compact?: boolean
  className?: string
}

export function WeatherWidget({
  destinationId,
  destinationName,
  datesLabel,
  compact = false,
  className = '',
}: WeatherWidgetProps) {
  const [data, setData] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setFailed(false)

    getWeather({ destinationId, destination: destinationName })
      .then((res) => {
        if (isMounted) {
          setData(res)
          setFailed(false)
        }
      })
      .catch(() => {
        if (isMounted) {
          setFailed(true)
          setData(null)
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [destinationId, destinationName])

  // Quiet fallback when the weather API fails or is unreachable
  if (failed) {
    return (
      <div className={`weather-quiet-fallback ${className}`}>
        <CloudSun size={18} className="weather-icon-primary" />
        <div>
          <span className="weather-fallback-title">
            Weather forecast unavailable
          </span>
          <span className="weather-fallback-desc">
            Live weather could not be retrieved for {destinationName || 'this destination'}.
          </span>
        </div>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className={`weather-loading-box ${className}`}>
        <p className="weather-loading-text">Checking regional weather forecast…</p>
      </div>
    )
  }

  if (!data) return null

  const { current, forecast, location, source } = data

  if (compact) {
    return (
      <div className={`weather-widget-compact ${className}`}>
        {current.icon ? (
          <img
            src={`https://openweathermap.org/img/wn/${current.icon}.png`}
            alt={current.description}
            className="weather-compact-img"
            onError={(e) => {
              ;(e.target as HTMLElement).style.display = 'none'
            }}
          />
        ) : (
          <CloudSun size={18} className="weather-icon-primary" />
        )}
        <div className="weather-compact-info">
          <strong className="weather-temp-number">
            {Math.round(current.temp)}°C
          </strong>{' '}
          <span className="weather-compact-desc">· {current.description}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`weather-widget-panel panel ${className}`}>
      <div className="weather-panel-header">
        <div>
          <span className="badge badge-green weather-panel-badge">
            {location.name || destinationName || 'Regional Forecast'}
          </span>
          <h3 className="weather-panel-title">
            <CloudSun size={18} className="weather-icon-primary" /> Destination Weather
          </h3>
          {datesLabel && (
            <small className="weather-dates-label">
              <Calendar size={13} className="weather-icon-primary" /> {datesLabel}
            </small>
          )}
        </div>

        {source === 'fallback' && (
          <span className="weather-source-badge">
            Seasonal estimate
          </span>
        )}
      </div>

      {/* Current Conditions Bar */}
      <div className="weather-current-bar">
        <div className="weather-current-main">
          <img
            src={`https://openweathermap.org/img/wn/${current.icon}@2x.png`}
            alt={current.description}
            className="weather-current-icon"
            onError={(e) => {
              ;(e.target as HTMLElement).style.display = 'none'
            }}
          />
          <div>
            <span className="weather-current-temp weather-temp-number">
              {Math.round(current.temp)}°C
            </span>
            <p className="weather-current-desc">
              {current.description}
            </p>
          </div>
        </div>

        <div className="weather-current-metrics">
          <div className="weather-metric-item">
            <Thermometer size={14} className="weather-icon-primary" />
            <span>Feels: <strong className="weather-temp-number">{Math.round(current.feelsLike)}°C</strong></span>
          </div>
          <div className="weather-metric-item">
            <Droplets size={14} className="weather-icon-primary" />
            <span>Humidity: <strong className="weather-temp-number">{current.humidity}%</strong></span>
          </div>
          <div className="weather-metric-item">
            <Wind size={14} className="weather-icon-primary" />
            <span>Wind: <strong className="weather-temp-number">{current.windSpeed} m/s</strong></span>
          </div>
        </div>
      </div>

      {/* 5-Day Forecast Grid */}
      {forecast.length > 0 && (
        <div className="weather-forecast-section">
          <p className="weather-forecast-title">
            5-Day Outlook
          </p>
          <div
            className="weather-forecast-grid"
            style={{
              gridTemplateColumns: `repeat(${Math.min(forecast.length, 5)}, 1fr)`,
            }}
          >
            {forecast.map((day) => (
              <div key={day.date} className="weather-forecast-day-card">
                <strong className="weather-forecast-day-name">
                  {day.day}
                </strong>
                <small className="weather-forecast-date">
                  {day.date.slice(5)}
                </small>
                <div className="weather-forecast-icon-wrap">
                  <img
                    src={`https://openweathermap.org/img/wn/${day.icon}.png`}
                    alt={day.description}
                    className="weather-forecast-img"
                    onError={(e) => {
                      ;(e.target as HTMLElement).style.display = 'none'
                    }}
                  />
                </div>
                <div className="weather-forecast-temps">
                  <strong className="weather-temp-number">{Math.round(day.tempMax)}°</strong>{' '}
                  <span className="weather-forecast-temp-min weather-temp-number">{Math.round(day.tempMin)}°</span>
                </div>
                <small className="weather-forecast-desc" title={day.description}>
                  {day.description}
                </small>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default WeatherWidget
