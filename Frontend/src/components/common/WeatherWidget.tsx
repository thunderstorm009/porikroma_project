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
      <div
        className={`weather-quiet-fallback ${className}`}
        style={{
          padding: '12px 14px',
          background: '#f8faf6',
          borderRadius: '10px',
          border: '1px solid #e2ece0',
          fontSize: '12px',
          color: '#6d7770',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <CloudSun size={18} color="#889988" />
        <div>
          <span style={{ fontWeight: 600, color: '#3d4d42', display: 'block' }}>
            Weather forecast unavailable
          </span>
          <span style={{ fontSize: '11px' }}>
            Live weather could not be retrieved for {destinationName || 'this destination'}.
          </span>
        </div>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div
        className={`weather-loading-box ${className}`}
        style={{
          padding: '14px',
          background: '#f8faf6',
          borderRadius: '10px',
          border: '1px solid #e2ece0',
          fontSize: '12px',
          color: '#889988',
        }}
      >
        <p style={{ margin: 0 }}>Checking regional weather forecast…</p>
      </div>
    )
  }

  if (!data) return null

  const { current, forecast, location, source } = data

  if (compact) {
    return (
      <div
        className={`weather-widget-compact ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 12px',
          background: 'rgba(255, 255, 255, 0.85)',
          borderRadius: '8px',
          border: '1px solid #dbe6d9',
          fontSize: '12px',
        }}
      >
        {current.icon ? (
          <img
            src={`https://openweathermap.org/img/wn/${current.icon}.png`}
            alt={current.description}
            style={{ width: '32px', height: '32px' }}
            onError={(e) => {
              ;(e.target as HTMLElement).style.display = 'none'
            }}
          />
        ) : (
          <CloudSun size={18} color="#15803d" />
        )}
        <div>
          <strong style={{ fontSize: '13px', color: '#1a3324' }}>
            {Math.round(current.temp)}°C
          </strong>{' '}
          <span style={{ color: '#556557' }}>· {current.description}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`weather-widget-panel panel ${className}`}
      style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f7faf5 100%)',
        border: '1px solid #d5e3d2',
        borderRadius: '10px',
        padding: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '14px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div>
          <span
            className="badge badge-green"
            style={{ fontSize: '10px', padding: '2px 8px', marginBottom: '4px' }}
          >
            {location.name || destinationName || 'Regional Forecast'}
          </span>
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: '#1a3324',
              margin: '3px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <CloudSun size={17} color="#15803d" /> Destination Weather
          </h3>
          {datesLabel && (
            <small
              style={{
                color: '#6d7770',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '3px',
              }}
            >
              <Calendar size={12} /> {datesLabel}
            </small>
          )}
        </div>

        {source === 'fallback' && (
          <span style={{ fontSize: '10px', color: '#889988', fontStyle: 'italic' }}>
            Seasonal estimate
          </span>
        )}
      </div>

      {/* Current Conditions Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '8px',
          border: '1px solid #e1ebe0',
          marginBottom: '14px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src={`https://openweathermap.org/img/wn/${current.icon}@2x.png`}
            alt={current.description}
            style={{ width: '48px', height: '48px', margin: '-6px 0' }}
            onError={(e) => {
              ;(e.target as HTMLElement).style.display = 'none'
            }}
          />
          <div>
            <span style={{ fontSize: '26px', fontWeight: 800, color: '#163824', lineHeight: 1 }}>
              {Math.round(current.temp)}°C
            </span>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#445547', fontWeight: 500 }}>
              {current.description}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#6d7770' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Thermometer size={14} color="#059669" />
            <span>Feels: <strong>{Math.round(current.feelsLike)}°C</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Droplets size={14} color="#0284c7" />
            <span>Humidity: <strong>{current.humidity}%</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Wind size={14} color="#64748b" />
            <span>Wind: <strong>{current.windSpeed} m/s</strong></span>
          </div>
        </div>
      </div>

      {/* 5-Day Forecast Grid */}
      {forecast.length > 0 && (
        <div>
          <p
            style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              color: '#6d7770',
              margin: '0 0 8px',
              letterSpacing: '0.5px',
            }}
          >
            5-Day Outlook
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(forecast.length, 5)}, 1fr)`,
              gap: '8px',
              overflowX: 'auto',
            }}
          >
            {forecast.map((day) => (
              <div
                key={day.date}
                style={{
                  background: 'white',
                  borderRadius: '8px',
                  padding: '8px',
                  textAlign: 'center',
                  border: '1px solid #e5ede3',
                }}
              >
                <strong style={{ fontSize: '11px', display: 'block', color: '#1f3d2b' }}>
                  {day.day}
                </strong>
                <small style={{ fontSize: '9px', color: '#889988' }}>
                  {day.date.slice(5)}
                </small>
                <div style={{ margin: '2px 0' }}>
                  <img
                    src={`https://openweathermap.org/img/wn/${day.icon}.png`}
                    alt={day.description}
                    style={{ width: '32px', height: '32px', margin: '0 auto', display: 'block' }}
                    onError={(e) => {
                      ;(e.target as HTMLElement).style.display = 'none'
                    }}
                  />
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#1a3324' }}>
                  {Math.round(day.tempMax)}° <span style={{ color: '#889988', fontWeight: 400 }}>{Math.round(day.tempMin)}°</span>
                </div>
                <small
                  style={{
                    fontSize: '9px',
                    color: '#6d7770',
                    display: 'block',
                    marginTop: '2px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={day.description}
                >
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
