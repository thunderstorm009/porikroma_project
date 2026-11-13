import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  ChevronRight, MapPin, Banknote, Users, CalendarDays,
  ShieldCheck, Clock, CheckCircle2, ArrowUpRight, AlertCircle, Sparkles, Check, X
} from 'lucide-react'
import { api } from '../../api'
import type { Tour, TourDeparture } from '../../types'
import { useAuth } from '../../context/AuthContext'
import { formatBDT, formatDate } from '../../utils/formatters'

export function TourDetailsPage() {
  const { id: tourId = '' } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  const [tour, setTour] = useState<Tour | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Booking drawer / modal state
  const [selectedDeparture, setSelectedDeparture] = useState<TourDeparture | null>(null)
  const [travelersCount, setTravelersCount] = useState(1)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingSuccess, setBookingSuccess] = useState('')
  const [bookingError, setBookingError] = useState('')

  const loadTour = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api<Tour>(`/api/tours/${tourId}`)
      setTour(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load tour details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTour()
  }, [tourId])

  const handleBook = async () => {
    if (!selectedDeparture) return
    setBookingLoading(true)
    setBookingError('')
    try {
      await api(`/api/departures/${selectedDeparture.id}/bookings`, {
        method: 'POST',
        body: JSON.stringify({ travelersCount }),
      })
      setBookingSuccess(`Your booking for ${travelersCount} traveler(s) has been submitted!`)
      // Reload tour to reflect updated seats
      loadTour()
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Failed to confirm booking')
    } finally {
      setBookingLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="page" style={{ padding: '60px 20px', textAlign: 'center', color: '#506155' }}>
        <div className="avatar" style={{ width: '40px', height: '40px', margin: '0 auto 14px', background: '#e8efe5', color: 'var(--green)' }}>
          <Sparkles size={20} />
        </div>
        <strong>Loading tour dossier…</strong>
        <p style={{ fontSize: '13px', color: '#506155', marginTop: '4px' }}>Fetching itinerary, departures, and operator details</p>
      </div>
    )
  }

  if (error || !tour) {
    return (
      <div className="page">
        <button className="back-link" onClick={() => navigate('/tours')}>
          <ChevronRight size={16} className="back-arrow" /> Back to tours
        </button>
        <div className="panel" style={{ margin: '24px 0', textAlign: 'center', padding: '36px', border: '1px solid #f2dede', background: '#fff5f5' }}>
          <AlertCircle size={32} color="#d9534f" style={{ margin: '0 auto 10px' }} />
          <h2 style={{ fontSize: '16px', color: '#a94442' }}>Tour not found</h2>
          <p style={{ color: '#506155', fontSize: '13px', margin: '6px 0 16px' }}>{error || 'The requested tour does not exist or has been unpublished.'}</p>
          <button className="primary-btn" onClick={() => navigate('/tours')}>Browse available tours</button>
        </div>
      </div>
    )
  }

  const departures = tour.departures || []

  return (
    <div className="page">
      <button className="back-link" onClick={() => navigate('/tours')}>
        <ChevronRight size={16} className="back-arrow" /> Back to all tours
      </button>

      {/* Tour Hero Banner */}
      <div className="destination-detail-hero" style={{ minHeight: '260px' }}>
        <img
          src={tour.destination_image || 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1400&q=85'}
          alt={tour.title}
        />
        <div>
          <span className="pill dark">
            <ShieldCheck size={14} style={{ marginRight: '5px' }} /> Verified Tour Package · {tour.destination_name}
          </span>
          <h1>{tour.title}</h1>
          <p style={{ maxWidth: '680px', marginTop: '8px' }}>{tour.description}</p>
        </div>
      </div>

      <div className="destination-detail-grid" style={{ marginTop: '24px' }}>
        <main>
          {/* Key Facts Section */}
          <section className="panel detail-section">
            <div className="panel-heading">
              <div>
                <h2>Tour overview & details</h2>
                <p>Curated commercial package for authentic regional immersion</p>
              </div>
              <span className="status green">Active package</span>
            </div>

            <div className="destination-info-grid" style={{ margin: '16px 0 20px' }}>
              <div>
                <span>Destination</span>
                <strong>{tour.destination_name}</strong>
              </div>
              <div>
                <span>Region</span>
                <strong>{tour.district || tour.division || 'Bangladesh'}</strong>
              </div>
              <div>
                <span>Package price</span>
                <strong>{formatBDT(tour.price)}</strong>
              </div>
              <div>
                <span>Group capacity</span>
                <strong>Up to {tour.capacity} travelers</strong>
              </div>
            </div>

            <p className="long-copy" style={{ lineHeight: 1.6, fontSize: '14.5px', color: '#334438' }}>
              {tour.description}
            </p>
          </section>

          {/* Upcoming Departures Section */}
          <section className="panel detail-section">
            <div className="panel-heading">
              <div>
                <h2>Upcoming departure dates</h2>
                <p>Choose an upcoming departure and reserve your seats</p>
              </div>
              <span className="badge badge-green">{departures.length} scheduled</span>
            </div>

            <div style={{ marginTop: '16px' }}>
              {departures.map((dep) => {
                const booked = dep.booked_count || 0
                const seatsLeft = Math.max(0, dep.capacity - booked)
                const isFull = seatsLeft <= 0 || dep.status === 'FULL'

                return (
                  <div
                    key={dep.id}
                    style={{
                      border: '1px solid #edf0ea',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '12px',
                      background: '#fff',
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <CalendarDays size={15} color="var(--green)" />
                        <strong style={{ fontSize: '15px' }}>
                          {formatDate(dep.start_date)} – {formatDate(dep.end_date)}
                        </strong>
                        <span className={`badge ${isFull ? 'badge-red' : 'badge-green'}`} style={{ fontSize: '12px' }}>
                          {isFull ? 'Sold Out' : `${seatsLeft} seats left`}
                        </span>
                      </div>
                      <small style={{ color: '#5a685e', fontSize: '13px' }}>
                        Capacity: {dep.capacity} travelers · {booked} currently booked
                      </small>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '12px', textTransform: 'uppercase', color: '#5a685e', display: 'block', fontWeight: 500 }}>Package Price</span>
                        <strong style={{ fontSize: '16.5px', color: 'var(--green-dark)' }}>{formatBDT(tour.price)}</strong>
                      </div>

                      {isAuthenticated ? (
                        <button
                          className="primary-btn small"
                          disabled={isFull}
                          onClick={() => {
                            setSelectedDeparture(dep)
                            setTravelersCount(1)
                            setBookingSuccess('')
                            setBookingError('')
                          }}
                        >
                          {isFull ? 'Full' : 'Book seats'}
                        </button>
                      ) : (
                        <button
                          className="outline-btn small"
                          onClick={() => navigate('/login')}
                        >
                          Sign in to book
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {!departures.length && (
                <div style={{ padding: '36px 20px', textAlign: 'center', color: '#5a685e' }}>
                  <CalendarDays size={28} style={{ margin: '0 auto 8px', color: 'var(--green)' }} />
                  <p style={{ fontSize: '14.5px', fontWeight: 500, margin: '4px 0' }}>No upcoming departures currently scheduled for this tour.</p>
                  <small style={{ fontSize: '13px', color: '#5a685e' }}>Check back soon or message the tour planner below.</small>
                </div>
              )}
            </div>
          </section>
        </main>

        {/* Sidebar: Planner info & Booking card */}
        <aside className="detail-sidebar">
          {/* Planner Profile Card */}
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>Tour planner & host</h2>
                <p>Verified professional operator</p>
              </div>
              <ShieldCheck size={18} color="var(--green)" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '14px 0' }}>
              <div className="avatar" style={{ width: '42px', height: '42px', fontSize: '16px' }}>
                {tour.planner_name?.[0] || 'N'}
              </div>
              <div>
                <strong style={{ fontSize: '15.5px', display: 'block' }}>{tour.planner_name || 'Expedition Host'}</strong>
                <small style={{ color: '#3b5f3f', fontSize: '13px', fontWeight: 500 }}>✦ 4.9 · Certified Tour Planner</small>
              </div>
            </div>

            <p style={{ fontSize: '13.5px', color: '#4e5e52', lineHeight: 1.5, margin: '8px 0 16px' }}>
              {tour.planner_bio || 'Experienced guide committed to sustainable exploration, local cultural respect, and safety across Bangladesh.'}
            </p>

            <div style={{ borderTop: '1px solid #edf0ea', paddingTop: '12px', fontSize: '13px', color: '#3b5a41' }}>
              <p style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' }}>
                <CheckCircle2 size={15} color="var(--green)" /> Identity & credentials verified
              </p>
              <p style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' }}>
                <CheckCircle2 size={15} color="var(--green)" /> Transparent pricing in BDT
              </p>
            </div>
          </div>

          {/* Guest CTA if logged out */}
          {!isAuthenticated && (
            <div className="panel destination-action-panel" style={{ background: '#f5f8f3' }}>
              <h2>Reserve your journey</h2>
              <p>Sign in to select departure dates, book seats with transparent BDT pricing, and manage your tickets.</p>
              <button className="primary-btn" onClick={() => navigate('/login')}>
                Sign in to book <ArrowUpRight size={16} />
              </button>
              <button className="outline-btn" onClick={() => navigate('/register')}>
                Create free account
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* Booking Modal */}
      {selectedDeparture && (
        <div className="modal-backdrop" onClick={() => setSelectedDeparture(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedDeparture(null)} aria-label="Close reservation modal">
              <X size={18} />
            </button>

            <span className="eyebrow" style={{ color: 'var(--green)' }}>Confirm Reservation</span>
            <h2>Book Tour Departure</h2>
            <p style={{ fontSize: '13.5px', color: '#4e5e52', margin: '4px 0 16px', lineHeight: 1.5 }}>
              {tour.title} · {formatDate(selectedDeparture.start_date)} to {formatDate(selectedDeparture.end_date)}
            </p>

            {bookingSuccess ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div className="modal-icon" style={{ margin: '0 auto 12px' }}><Check size={20} /></div>
                <h3 style={{ color: 'var(--green)', fontSize: '18px', fontWeight: 600 }}>Booking Successful!</h3>
                <p style={{ fontSize: '14px', margin: '6px 0 18px', color: '#2d5538', lineHeight: 1.5 }}>{bookingSuccess}</p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button className="primary-btn" onClick={() => navigate('/my-bookings')}>View My Bookings</button>
                  <button className="outline-btn" onClick={() => setSelectedDeparture(null)}>Done</button>
                </div>
              </div>
            ) : (
              <>
                <label>Number of travelers
                  <input
                    type="number"
                    min="1"
                    max={Math.max(1, selectedDeparture.capacity - (selectedDeparture.booked_count || 0))}
                    value={travelersCount}
                    onChange={(e) => setTravelersCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                </label>

                <div style={{ background: '#f6faf4', padding: '14px', borderRadius: '8px', margin: '16px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', marginBottom: '8px', color: '#4e5e52' }}>
                    <span>Price per traveler:</span>
                    <strong style={{ color: '#1a2e22' }}>{formatBDT(tour.price)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', borderTop: '1px solid #dfe7dc', paddingTop: '8px' }}>
                    <strong>Total BDT:</strong>
                    <strong style={{ color: 'var(--green-dark)' }}>{formatBDT(tour.price * travelersCount)}</strong>
                  </div>
                </div>

                {bookingError && <p className="error-text">{bookingError}</p>}

                <div className="modal-actions" style={{ marginTop: '20px' }}>
                  <button className="outline-btn" onClick={() => setSelectedDeparture(null)}>Cancel</button>
                  <button className="primary-btn" disabled={bookingLoading} onClick={handleBook}>
                    {bookingLoading ? 'Reserving…' : 'Confirm reservation'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default TourDetailsPage
