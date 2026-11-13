import { useEffect, useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  CalendarDays, MapPin, Banknote, Users, ArrowUpRight,
  AlertCircle, Sparkles, Ticket, XCircle, CheckCircle2, Clock
} from 'lucide-react'
import { toursApi } from '../../api/tours'
import type { TourBooking } from '../../types'
import { PageHeader } from '../../components/common/PageHeader'
import { formatBDT, formatDate } from '../../utils/formatters'

export function MyBookingsPage() {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState<TourBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'CANCELLED'>('ALL')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState('')

  const loadBookings = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await toursApi.getMyBookings()
      setBookings(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load tour reservations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBookings()
  }, [])

  const handleCancelBooking = async (bookingId: string, tourTitle: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to cancel your booking for "${tourTitle}"? This will release your reserved seats.`
    )
    if (!confirmed) return

    setActionLoadingId(bookingId)
    setActionMessage('')
    try {
      await toursApi.cancelBooking(bookingId)
      setActionMessage(`Your booking for "${tourTitle}" has been cancelled.`)
      await loadBookings()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel booking')
    } finally {
      setActionLoadingId(null)
    }
  }

  const isCancellable = (booking: TourBooking) => {
    if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') return false
    if (!booking.start_date) return true
    const depDate = new Date(booking.start_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return depDate >= today
  }

  const filteredBookings = useMemo(() => {
    if (filter === 'ALL') return bookings
    return bookings.filter((b) => b.status === filter)
  }, [bookings, filter])

  // Summary stats
  const stats = useMemo(() => {
    const totalCount = bookings.length
    const confirmedCount = bookings.filter((b) => b.status === 'CONFIRMED').length
    const pendingCount = bookings.filter((b) => b.status === 'PENDING').length
    const totalSpent = bookings
      .filter((b) => b.status !== 'CANCELLED')
      .reduce((sum, b) => {
        const cost = b.total_price ?? ((b.price ?? b.tour_price ?? 0) * (b.travelers_count ?? b.seats ?? 1))
        return sum + Number(cost)
      }, 0)
    return { totalCount, confirmedCount, pendingCount, totalSpent }
  }, [bookings])

  return (
    <div className="page">
      <PageHeader
        eyebrow="Your reserved journeys"
        title="My Tour Bookings"
        description="Review booking confirmations, departure schedules, and manage seat reservations."
        action={
          <button className="primary-btn" onClick={() => navigate('/tours')}>
            <Ticket size={16} /> Explore more tours
          </button>
        }
      />

      {/* Stats row */}
      <div className="kpi-grid" style={{ marginBottom: '20px' }}>
        <div className="kpi-card">
          <small>Total Bookings</small>
          <strong>{stats.totalCount}</strong>
          <span>Across all expeditions</span>
        </div>
        <div className="kpi-card">
          <small>Confirmed Departures</small>
          <strong style={{ color: 'var(--green)' }}>{stats.confirmedCount}</strong>
          <span>Ready for travel</span>
        </div>
        <div className="kpi-card">
          <small>Awaiting Confirmation</small>
          <strong style={{ color: 'var(--coral)' }}>{stats.pendingCount}</strong>
          <span>Pending operator review</span>
        </div>
        <div className="kpi-card">
          <small>Total Committed</small>
          <strong>{formatBDT(stats.totalSpent)}</strong>
          <span>Active expeditions</span>
        </div>
      </div>

      {actionMessage && (
        <div className="panel" style={{ background: '#f5faf4', border: '1px solid #c9e2c6', padding: '12px 18px', marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--green-dark)' }}>{actionMessage}</span>
          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#688' }} onClick={() => setActionMessage('')}>✕</button>
        </div>
      )}

      {/* Tabs Filter */}
      <div className="filter-row">
        <div className="tabs">
          <button className={filter === 'ALL' ? 'tab active' : 'tab'} onClick={() => setFilter('ALL')}>
            All ({bookings.length})
          </button>
          <button className={filter === 'CONFIRMED' ? 'tab active' : 'tab'} onClick={() => setFilter('CONFIRMED')}>
            Confirmed ({bookings.filter((b) => b.status === 'CONFIRMED').length})
          </button>
          <button className={filter === 'PENDING' ? 'tab active' : 'tab'} onClick={() => setFilter('PENDING')}>
            Pending ({bookings.filter((b) => b.status === 'PENDING').length})
          </button>
          <button className={filter === 'CANCELLED' ? 'tab active' : 'tab'} onClick={() => setFilter('CANCELLED')}>
            Cancelled ({bookings.filter((b) => b.status === 'CANCELLED').length})
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#506155' }}>
          <div className="avatar" style={{ width: '40px', height: '40px', margin: '0 auto 14px', background: '#e8efe5', color: 'var(--green)' }}>
            <Sparkles size={20} />
          </div>
          <strong>Loading your tour bookings…</strong>
          <p style={{ fontSize: '13px', color: '#506155', marginTop: '4px' }}>Fetching confirmed tickets, dates, and operator coordination</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="panel" style={{ margin: '24px 0', textAlign: 'center', padding: '36px', border: '1px solid #f2dede', background: '#fff5f5' }}>
          <AlertCircle size={32} color="#d9534f" style={{ margin: '0 auto 10px' }} />
          <h2 style={{ fontSize: '16px', color: '#a94442' }}>Unable to load bookings</h2>
          <p style={{ color: '#506155', fontSize: '13px', margin: '6px 0 16px' }}>{error}</p>
          <button className="primary-btn" onClick={loadBookings}>Retry</button>
        </div>
      )}

      {/* Bookings Table / List */}
      {!loading && !error && (
        <>
          {filteredBookings.length > 0 ? (
            <div className="table-container" style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--line)', overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tour & Destination</th>
                    <th>Departure Dates</th>
                    <th>Travelers</th>
                    <th>Total Price</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((b) => {
                    const travelers = b.travelers_count ?? b.seats ?? 1
                    const unitPrice = b.price ?? b.tour_price ?? 0
                    const totalBDT = b.total_price ?? (unitPrice * travelers)
                    const cancellable = isCancellable(b)
                    const isActionBusy = actionLoadingId === b.id

                    return (
                      <tr key={b.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {b.destination_image ? (
                              <img
                                src={b.destination_image}
                                alt={b.tour_title || 'Tour'}
                                style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }}
                              />
                            ) : (
                              <div className="avatar" style={{ width: '48px', height: '48px', borderRadius: '8px', background: '#edf3ec', color: 'var(--green)' }}>
                                <Ticket size={20} />
                              </div>
                            )}
                            <div>
                              {b.tour_id ? (
                                <Link to={`/tours/${b.tour_id}`} style={{ fontWeight: 600, color: 'var(--ink)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {b.tour_title || 'Commercial Tour Expedition'} <ArrowUpRight size={14} color="var(--green)" />
                                </Link>
                              ) : (
                                <strong style={{ color: 'var(--ink)' }}>{b.tour_title || 'Commercial Tour Expedition'}</strong>
                              )}
                              <p style={{ fontSize: '13px', color: '#5a685e', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <MapPin size={13} /> {b.destination_name || 'Bangladesh'}
                                {b.district && ` · ${b.district}`}
                              </p>
                              {b.planner_name && (
                                <small style={{ fontSize: '12px', color: '#506155' }}>Host: {b.planner_name}</small>
                              )}
                            </div>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CalendarDays size={15} color="var(--green)" />
                            <div>
                              <strong>{b.start_date ? formatDate(b.start_date) : 'Flexible'}</strong>
                              {b.end_date && (
                                <div style={{ fontSize: '12px', color: '#506155' }}>
                                  to {formatDate(b.end_date)}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px' }}>
                            <Users size={15} color="#506155" />
                            <strong>{travelers}</strong> {travelers === 1 ? 'seat' : 'seats'}
                          </span>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Banknote size={15} color="var(--green)" />
                            <strong style={{ color: 'var(--green-dark)', fontSize: '15px' }}>
                              {formatBDT(totalBDT)}
                            </strong>
                          </div>
                          {travelers > 1 && unitPrice > 0 && (
                            <small style={{ fontSize: '12px', color: '#506155' }}>
                              ({formatBDT(unitPrice)}/seat)
                            </small>
                          )}
                        </td>

                        <td>
                          {b.status === 'CONFIRMED' && (
                            <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <CheckCircle2 size={13} /> Confirmed
                            </span>
                          )}
                          {b.status === 'PENDING' && (
                            <span className="badge badge-orange" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <Clock size={13} /> Pending confirmation
                            </span>
                          )}
                          {b.status === 'CANCELLED' && (
                            <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <XCircle size={13} /> Cancelled
                            </span>
                          )}
                          {b.status === 'COMPLETED' && (
                            <span className="badge badge-blue">Completed</span>
                          )}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
                            {b.tour_id && (
                              <button
                                className="outline-btn small"
                                onClick={() => navigate(`/tours/${b.tour_id}`)}
                                title="View tour dossier"
                              >
                                View Tour
                              </button>
                            )}

                            {cancellable && (
                              <button
                                className="outline-btn small"
                                style={{ color: '#d9534f', borderColor: '#f2dede' }}
                                disabled={isActionBusy}
                                onClick={() => handleCancelBooking(b.id, b.tour_title || 'Tour')}
                              >
                                {isActionBusy ? 'Cancelling…' : 'Cancel booking'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="panel" style={{ margin: '30px 0', padding: '48px 24px', textAlign: 'center', color: '#5a685e' }}>
              <Ticket size={40} color="var(--green)" style={{ margin: '0 auto 12px' }} />
              <h2>No reservations found</h2>
              <p style={{ fontSize: '14.5px', color: '#5a685e', margin: '6px 0 20px', maxWidth: '460px', marginLeft: 'auto', marginRight: 'auto' }}>
                {filter === 'ALL'
                  ? 'You have not booked any scheduled commercial tour departures yet.'
                  : `No ${filter.toLowerCase()} tour bookings found.`}
              </p>
              <button className="primary-btn" onClick={() => navigate('/tours')}>
                Explore curated tours <ArrowUpRight size={15} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default MyBookingsPage
