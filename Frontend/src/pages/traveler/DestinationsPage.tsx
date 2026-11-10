import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Sparkles, MapPin, Banknote, Star, ArrowUpRight, Heart } from 'lucide-react'
import { api } from '../../api'
import type { Destination } from '../../types'
import { PageHeader } from '../../components/common/PageHeader'

export function DestinationsPage() {
  const navigate = useNavigate()
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [wishlist, setWishlist] = useState<string[]>([])

  useEffect(() => {
    api<Destination[]>('/api/destinations').then(setDestinations).catch(() => undefined)
    api<Destination[]>('/api/me/wishlist').then((items) => setWishlist(items.map((i) => i.id))).catch(() => undefined)
  }, [])

  const toggleWishlist = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const res = await api<{ wishlisted: boolean }>(`/api/me/wishlist/${id}`, { method: 'POST' })
    if (res.wishlisted) setWishlist([...wishlist, id])
    else setWishlist(wishlist.filter((x) => x !== id))
  }

  const shown = destinations.filter((d) => {
    const matchesQ = `${d.name} ${d.district} ${d.division}`.toLowerCase().includes(query.toLowerCase())
    const matchesCat = category === 'All' || d.category === category
    return matchesQ && matchesCat
  })

  return (
    <div className="page">
      <PageHeader
        eyebrow="Find your next feeling"
        title="Destinations"
        description="Thoughtful places across Bangladesh, with budget details and community reviews."
      />

      <div className="destination-toolbar">
        <div className="group-filter">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search destinations, districts, or divisions..." />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '12px' }}>
          <option value="All">All categories</option>
          <option value="Beach">Beach</option>
          <option value="Nature">Nature</option>
          <option value="Culture">Culture</option>
          <option value="Adventure">Adventure</option>
          <option value="Wildlife">Wildlife</option>
        </select>
      </div>

      <div className="destination-discovery-grid" style={{ marginTop: '24px' }}>
        {shown.map((d) => (
          <article className="destination-discovery-card" key={d.id} onClick={() => navigate(`/destinations/${d.id}`)} style={{ cursor: 'pointer' }}>
            <img src={d.image || 'https://images.unsplash.com/photo-1528127269322-539801943592?w=700&q=85'} alt={d.name} />
            <div className="destination-discovery-body">
              <span className="recommendation-reason"><Sparkles size={12} /> {d.category} · {d.division}</span>
              <h3>{d.name}</h3>
              <p className="destination-location"><MapPin size={13} /> {d.district}, {d.division}</p>
              <p>{d.description}</p>
              <div className="destination-facts">
                <span><Banknote size={13} /> From ৳ {d.estimated_budget?.toLocaleString()}</span>
                <span><Star size={13} color="#f5a623" /> {d.rating || 4.8} ({d.review_count || 12} reviews)</span>
              </div>
              <div className="destination-card-actions">
                <button onClick={() => navigate(`/destinations/${d.id}`)}>View destination <ArrowUpRight size={14} /></button>
                <button className="icon-btn" onClick={(e) => toggleWishlist(d.id, e)} title="Save to wishlist">
                  <Heart size={16} color={wishlist.includes(d.id) ? '#e04f4f' : '#69736c'} fill={wishlist.includes(d.id) ? '#e04f4f' : 'none'} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

export default DestinationsPage
