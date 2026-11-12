import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'

export function PublicLanding() {
  const navigate = useNavigate()

  // Live decorative digital clock (HH:MM:SS) in local time
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date()
    return now.toTimeString().split(' ')[0]
  })

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      setCurrentTime(now.toTimeString().split(' ')[0])
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <main className="public-landing">
      <header className="public-landing-header">
        <div className="brand">
          <span className="brand-mark">p</span>
          <span>porikroma</span>
        </div>
        <div className="public-landing-nav">
          <button className="outline-btn small" onClick={() => navigate('/destinations')}>
            Explore destinations
          </button>
          <button className="secondary-btn small" onClick={() => navigate('/login')}>
            Sign in
          </button>
        </div>
      </header>

      {/* Hero: Large neumorphic card */}
      <section className="landing-hero-card">
        <div className="landing-hero-copy">
          <div className="landing-hero-eyebrow-row">
            <p className="eyebrow">Travel, thoughtfully planned</p>
            <div className="landing-clock-card" title="Local Time">
              <span className="landing-clock-dot" />
              <span className="landing-clock-digits">{currentTime}</span>
            </div>
          </div>
          <h1>
            Go where the<br />
            <em>air feels different.</em>
          </h1>
          <p>
            Plan journeys that feel like you, from the first spark of an idea to the
            stories you bring home. Discover slow travel, small-group expeditions, and
            transparent ledgers across Bangladesh.
          </p>
          <div className="landing-hero-actions">
            <button className="primary-btn" onClick={() => navigate('/register')}>
              Start planning <ArrowUpRight size={16} />
            </button>
            <button className="outline-btn" onClick={() => navigate('/destinations')}>
              Explore destinations
            </button>
            <button className="secondary-btn" onClick={() => navigate('/login')}>
              Sign in
            </button>
          </div>
        </div>

        {/* Artwork slot: Replace this placeholder with your own black-and-white manga illustration (keep the same filename at /art/anime-placeholder.svg or update the path here) */}
        <img
          className="anime-art"
          src="/art/anime-placeholder.svg"
          alt=""
          aria-hidden="true"
        />
      </section>

      {/* Feature sections: Rounded cards with alternating light cards and one charcoal card */}
      <section className="landing-features-grid">
        <div className="landing-feature-card">
          <div>
            <span className="landing-feature-tag">01 / Curated Journeys</span>
            <h3>Handcrafted Expeditions</h3>
            <p>
              Slow, scenic itineraries built by experienced travelers who know the hidden
              trails, river crossings, and mountain passes across Bangladesh.
            </p>
          </div>
          <div className="landing-stat-row">
            <span className="landing-stat-number">64</span>
            <span className="landing-stat-label">Districts mapped</span>
          </div>
        </div>

        <div className="landing-feature-card dark">
          <div>
            <span className="landing-feature-tag">02 / Shared Ledgers</span>
            <h3>Transparent Splits</h3>
            <p>
              Track group expenses, split costs in real-time, and settle transparently
              with zero ambiguity or awkward math at the end of the trip.
            </p>
          </div>
          <div className="landing-stat-row">
            <span className="landing-stat-number">100%</span>
            <span className="landing-stat-label">Real-time ledger audit</span>
          </div>
        </div>

        <div className="landing-feature-card">
          <div>
            <span className="landing-feature-tag">03 / Community</span>
            <h3>Small Group Trust</h3>
            <p>
              Connect with verified fellow travelers, join community expeditions, and
              build lasting memories with thoughtful companionship.
            </p>
          </div>
          <div className="landing-stat-row">
            <span className="landing-stat-number">1.2k+</span>
            <span className="landing-stat-label">Journeys completed</span>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="brand">
          <span className="brand-mark">p</span>
          <span>porikroma</span>
        </div>
        <p>© {new Date().getFullYear()} Porikroma. Thoughtfully planned travel.</p>
      </footer>
    </main>
  )
}

export default PublicLanding
