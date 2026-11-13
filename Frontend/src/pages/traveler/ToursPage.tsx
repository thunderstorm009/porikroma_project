import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MapPin, Banknote, CalendarDays, ArrowUpRight, Clock, ShieldCheck, Sparkles, AlertCircle, Luggage } from 'lucide-react'
import { api } from '../../api'
import type { Tour, Destination } from '../../types'
import { PageHeader } from '../../components/common/PageHeader'
import { formatBDT } from '../../utils/formatters'

export function ToursPage() {
  const navigate = useNavigate()
  const [tours, setTours] = useState<Tour[]>([])
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filter & sort states
  const [search, setSearch] = useState('')
  const [selectedDestination, setSelectedDestination] = useState('All')
  const [priceSort, setPriceSort] = useState<'default' | 'asc' | 'desc'>('default')
  const [durationFilter, setDurationFilter] = useState<'all' | 'short' | 'medium' | 'long'>('all')

  const loadTours = async () => {
    setLoading(true)
    setError('')
    try {
      const [toursData, destsData] = await Promise.all([
        api<Tour[]>('/api/tours'),
        api<Destination[]>('/api/destinations').catch(() => []),
      ])
      setTours(toursData)
      setDestinations(destsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load commercial tours')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTours()
  }, [])

  // Helper to extract or estimate duration in days from tour title or description
  const getTourDays = (tour: Tour): number => {
    if (tour.duration_days && tour.duration_days > 0) return tour.duration_days
    const match = `${tour.title} ${tour.description}`.match(/(\d+)\s*[- ]?day/i)
    if (match) return parseInt(match[1], 10)
    return 3 // sensible default fallback
  }

  const filteredAndSortedTours = useMemo(() => {
    return tours
      .filter((tour) => {
        // Search filter
        const q = search.toLowerCase()
        const matchesSearch =
          !q ||
          tour.title.toLowerCase().includes(q) ||
          (tour.destination_name || '').toLowerCase().includes(q) ||
          (tour.district || '').toLowerCase().includes(q) ||
          (tour.division || '').toLowerCase().includes(q) ||
          (tour.planner_name || '').toLowerCase().includes(q) ||
          tour.description.toLowerCase().includes(q)

        // Destination filter
        const matchesDest =
          selectedDestination === 'All' ||
          tour.destination_name === selectedDestination ||
          tour.destination_id === selectedDestination

        // Duration filter
        const days = getTourDays(tour)
        let matchesDuration = true
        if (durationFilter === 'short') matchesDuration = days <= 3
        else if (durationFilter === 'medium') matchesDuration = days >= 4 && days <= 7
        else if (durationFilter === 'long') matchesDuration = days >= 8

        return matchesSearch && matchesDest && matchesDuration
      })
      .sort((a, b) => {
        if (priceSort === 'asc') return Number(a.price) - Number(b.price)
        if (priceSort === 'desc') return Number(b.price) - Number(a.price)
        return 0 // default order (backend created_at DESC)
      })
  }, [tours, search, selectedDestination, priceSort, durationFilter])

  return (
    <div className="page">
      <PageHeader
        eyebrow="Commercial guided expeditions"
        title="Curated Tours"
        description="Thoughtful multi-day packages led by certified tour planners across Bangladesh."
      />

      {/* Filter and Search Bar */}
      <div className="destination-toolbar" style={{ flexWrap: 'wrap', gap: '10px' }}>
        <div className="group-filter" style={{ flex: '1 1 240px', margin: 0 }}>
          <Search size={16} />
          <input
            placeholder="Search tours, guides, districts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          value={selectedDestination}
          onChange={(e) => setSelectedDestination(e.target.value)}
          style={{ padding: '0 36px 0 14px', height: '44px', borderRadius: '8px', border: '1px solid var(--line-strong)', fontSize: '16px' }}
        >
          <option value="All">All destinations</option>
          {destinations.map((d) => (
            <option key={d.id} value={d.name}>{d.name} ({d.district})</option>
          ))}
        </select>

        <select
          value={priceSort}
          onChange={(e) => setPriceSort(e.target.value as any)}
          style={{ padding: '0 36px 0 14px', height: '44px', borderRadius: '8px', border: '1px solid var(--line-strong)', fontSize: '16px' }}
        >
          <option value="default">Sort by: Default</option>
          <option value="asc">Price: Low to High</option>
          <option value="desc">Price: High to Low</option>
        </select>

        <select
          value={durationFilter}
          onChange={(e) => setDurationFilter(e.target.value as any)}
          style={{ padding: '0 36px 0 14px', height: '44px', borderRadius: '8px', border: '1px solid var(--line-strong)', fontSize: '16px' }}
        >
          <option value="all">Any duration</option>
          <option value="short">Short (1–3 days)</option>
          <option value="medium">Standard (4–7 days)</option>
          <option value="long">Extended (8+ days)</option>
        </select>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#506155' }}>
          <div className="avatar" style={{ width: '40px', height: '40px', margin: '0 auto 14px', background: '#e8efe5', color: 'var(--green)' }}>
            <Sparkles size={20} />
          </div>
          <strong>Discovering curated tour packages…</strong>
          <p style={{ fontSize: '13px', color: '#506155', marginTop: '4px' }}>Connecting to verified tour planners across Bangladesh</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="panel" style={{ margin: '24px 0', textAlign: 'center', padding: '36px', border: '1px solid #f2dede', background: '#fff5f5' }}>
          <AlertCircle size={32} color="#d9534f" style={{ margin: '0 auto 10px' }} />
          <h2 style={{ fontSize: '16px', color: '#a94442' }}>Unable to load tours</h2>
          <p style={{ color: '#506155', fontSize: '13px', margin: '6px 0 16px' }}>{error}</p>
          <button className="primary-btn" onClick={loadTours}>Retry</button>
        </div>
      )}

      {/* Tours Grid */}
      {!loading && !error && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 12px', fontSize: '13px', color: '#506155' }}>
            <span>Showing <strong>{filteredAndSortedTours.length}</strong> available tour package{filteredAndSortedTours.length === 1 ? '' : 's'}</span>
          </div>

          <div className="destination-discovery-grid">
            {filteredAndSortedTours.map((tour) => {
              const days = getTourDays(tour)
              return (
                <article
                  className="destination-discovery-card"
                  key={tour.id}
                  onClick={() => navigate(`/tours/${tour.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <img
                    src={tour.destination_image || 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=85'}
                    alt={tour.title}
                  />
                  <div className="destination-discovery-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="recommendation-reason">
                        <ShieldCheck size={14} /> Verified Planner · {tour.planner_name || 'Expedition Host'}
                      </span>
                      <span className="badge badge-green" style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center' }}>
                        <Clock size={13} style={{ marginRight: '4px' }} /> {days} Day{days > 1 ? 's' : ''}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '17.5px', margin: '4px 0 6px' }}>{tour.title}</h3>
                    <p className="destination-location">
                      <MapPin size={14} /> {tour.destination_name} · {tour.district || tour.division || 'Bangladesh'}
                    </p>
                    <p style={{ fontSize: '13.5px', color: '#4e5e52', margin: '6px 0 12px', lineHeight: 1.5 }}>
                      {tour.description}
                    </p>

                    <div className="destination-facts" style={{ borderTop: '1px solid #edf0ea', paddingTop: '10px' }}>
                      <span>
                        <Banknote size={14} /> {formatBDT(tour.price)} <small style={{ color: '#5a685e', fontSize: '12px' }}>/ person</small>
                      </span>
                      <span>
                        <CalendarDays size={14} /> {tour.departures_count || 0} scheduled departure{(tour.departures_count || 0) === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="destination-card-actions" style={{ marginTop: '12px' }}>
                      <button className="primary-btn small" onClick={() => navigate(`/tours/${tour.id}`)} style={{ width: '100%', justifyContent: 'center' }}>
                        View dossier & dates <ArrowUpRight size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {/* Empty state */}
          {!filteredAndSortedTours.length && (
            <div className="panel" style={{ margin: '30px 0', padding: '48px 24px', textAlign: 'center', color: '#5a685e' }}>
              <Luggage size={36} color="var(--green)" style={{ margin: '0 auto 12px' }} />
              <h2>No tours match your criteria</h2>
              <p style={{ fontSize: '14px', color: '#5a685e', margin: '6px 0 18px' }}>
                Try adjusting your search query, price sort, or destination filter.
              </p>
              <button
                className="outline-btn"
                onClick={() => {
                  setSearch('')
                  setSelectedDestination('All')
                  setPriceSort('default')
                  setDurationFilter('all')
                }}
              >
                Reset all filters
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ToursPage
