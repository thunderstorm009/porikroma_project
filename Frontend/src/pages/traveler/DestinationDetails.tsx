import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Plus, Bot } from 'lucide-react'
import { api } from '../../api'
import type { Destination } from '../../types'
import { WeatherWidget } from '../../components/common/WeatherWidget'

export function DestinationDetails() {
  const { destinationId = '' } = useParams()
  const navigate = useNavigate()
  const [dest, setDest] = useState<Destination & { reviews?: { id: string; author_name: string; rating: number; body: string; created_at: string }[] } | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewBody, setReviewBody] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewSuccess, setReviewSuccess] = useState('')

  const load = () => {
    api<typeof dest>(`/api/destinations/${destinationId}`).then(setDest).catch(() => undefined)
  }

  useEffect(() => { load() }, [destinationId])

  const submitReview = async () => {
    if (!reviewBody.trim()) return
    setSubmittingReview(true)
    try {
      await api('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({ destinationId, rating: reviewRating, body: reviewBody.trim() }),
      })
      setReviewBody('')
      setReviewSuccess('Thank you! Your review has been saved.')
      load()
    } finally {
      setSubmittingReview(false)
    }
  }

  if (!dest) return <div className="page"><p className="muted">Loading destination details…</p></div>

  return (
    <div className="page">
      <button className="back-link" onClick={() => navigate('/destinations')}><ChevronRight size={14} className="back-arrow" /> Back to destinations</button>
      <div className="destination-detail-hero">
        <img src={dest.image || 'https://images.unsplash.com/photo-1528127269322-539801943592?w=1400&q=85'} alt={dest.name} />
        <div>
          <span className="pill dark">{dest.district} · {dest.division}</span>
          <h1>{dest.name}</h1>
          <p>{dest.description}</p>
        </div>
      </div>

      <div className="destination-detail-grid">
        <main>
          <section className="panel detail-section">
            <div className="panel-heading">
              <div>
                <h2>Overview & Travel Information</h2>
                <p>Authentic local insights before you go</p>
              </div>
              <span className="status green">Recommended</span>
            </div>
            <p className="long-copy">{dest.description} Perfect for travelers seeking authentic cultural and natural connections across Bangladesh.</p>
            <div className="destination-info-grid">
              <div><span>Best time</span><strong>October – March</strong></div>
              <div><span>Suggested stay</span><strong>2–4 days</strong></div>
              <div><span>Est. Budget</span><strong>৳ {dest.estimated_budget?.toLocaleString()}</strong></div>
              <div><span>Category</span><strong>{dest.category}</strong></div>
            </div>
          </section>

          <section className="panel detail-section">
            <div className="panel-heading">
              <div>
                <h2>Community Reviews</h2>
                <p>What fellow travelers say about {dest.name}</p>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              {dest.reviews?.map((r) => (
                <div key={r.id} style={{ borderBottom: '1px solid #edf0ea', padding: '12px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{r.author_name}</strong>
                    <span style={{ color: '#f5a623' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '13px' }}>{r.body}</p>
                </div>
              ))}
              {!dest.reviews?.length && (
                <p style={{ color: '#889', fontSize: '12px' }}>Be the first traveler to review this place!</p>
              )}
            </div>

            <div style={{ background: '#f8faf6', padding: '16px', borderRadius: '8px', border: '1px solid #edf0ea' }}>
              <h3>Add your review</h3>
              <div style={{ display: 'flex', gap: '8px', margin: '8px 0' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} type="button" onClick={() => setReviewRating(star)} style={{ fontSize: '18px', color: star <= reviewRating ? '#f5a623' : '#ccc' }}>
                    ★
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Share advice, favorite food spots, or seasonal tips..."
                rows={3}
                style={{ width: '100%', borderRadius: '6px', border: '1px solid var(--line)', padding: '8px', fontSize: '12px' }}
                value={reviewBody}
                onChange={(e) => setReviewBody(e.target.value)}
              />
              {reviewSuccess && <p className="positive">{reviewSuccess}</p>}
              <button className="primary-btn" style={{ marginTop: '8px' }} disabled={submittingReview} onClick={submitReview}>
                {submittingReview ? 'Submitting…' : 'Submit review'}
              </button>
            </div>
          </section>
        </main>

        <aside className="detail-sidebar">
          <WeatherWidget destinationId={destinationId} destinationName={dest.name} />

          <div className="panel destination-action-panel" style={{ marginTop: '16px' }}>
            <h2>Make it yours</h2>
            <p>Add this destination to an upcoming trip or plan a new one.</p>
            <button className="primary-btn" onClick={() => navigate('/trips/create')}>
              <Plus size={16} /> Plan a trip here
            </button>
            <button className="outline-btn" onClick={() => navigate('/ai-assistant')}>
              <Bot size={16} /> Plan with AI
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default DestinationDetails
