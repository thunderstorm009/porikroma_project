import { useNavigate } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'

export function PublicLanding() {
  const navigate = useNavigate()
  return (
    <main className="public-landing">
      <div className="brand">
        <span className="brand-mark">p</span>
        <span>porikroma</span>
      </div>
      <div className="public-landing-copy">
        <p className="eyebrow">Travel, thoughtfully planned</p>
        <h1>Go where the<br /><em>air feels different.</em></h1>
        <p>Plan journeys that feel like you, from the first spark of an idea to the stories you bring home. Discover slow travel, small-group expeditions, and transparent ledgers across Bangladesh.</p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="primary-btn" onClick={() => navigate('/register')}>Start planning <ArrowUpRight size={16} /></button>
          <button className="outline-btn" onClick={() => navigate('/destinations')}>Explore destinations</button>
          <button className="secondary-btn" onClick={() => navigate('/login')}>Sign in</button>
        </div>
      </div>
    </main>
  )
}

export default PublicLanding
