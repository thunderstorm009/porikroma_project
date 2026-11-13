import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, Star, Lock } from 'lucide-react'
import { api, getUserPeerReviews, createPeerReview } from '../../api'
import type { PeerReviewsResponse } from '../../types'
import { PageHeader } from '../../components/common/PageHeader'

export function ProfilePage() {
  const { userId } = useParams()
  const [profile, setProfile] = useState<{
    id: string
    name: string
    email: string
    username: string
    bio: string
    travel_style: string
    interests: string[]
    rating: number
    trips_count: number
    is_private?: boolean
    admin_warnings?: { id: string; note?: string; created_at: string }[]
  } | null>(null)
  const [reviewsData, setReviewsData] = useState<PeerReviewsResponse | null>(null)
  const [loadingReviews, setLoadingReviews] = useState(true)
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [travelStyle, setTravelStyle] = useState('')
  const [newTag, setNewTag] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [reviewableTrips, setReviewableTrips] = useState<{ id: string; name: string }[]>([])
  const [reviewTripId, setReviewTripId] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewMessage, setReviewMessage] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  const isSelf = !userId

  useEffect(() => {
    const endpoint = isSelf ? '/api/me/profile' : `/api/users/${userId}/profile`
    api<typeof profile>(endpoint).then((res) => {
      if (res) {
        setProfile(res)
        setName(res.name)
        setBio(res.bio)
        setTravelStyle(res.travel_style || 'Slow explorer')
        setInterests(res.interests || [])
      }
    }).catch(() => setMessage('Unable to load profile'))

    setLoadingReviews(true)
    getUserPeerReviews(userId)
      .then(setReviewsData)
      .catch(() => {})
      .finally(() => setLoadingReviews(false))
    if (userId) {
      api<{ id: string; name: string }[]>(`/api/users/${userId}/reviewable-trips`)
        .then((trips) => { setReviewableTrips(trips); setReviewTripId(trips[0]?.id || '') })
        .catch(() => setReviewableTrips([]))
    } else {
      setReviewableTrips([])
    }
  }, [userId, isSelf])

  const save = async () => {
    setSaving(true)
    try {
      await api('/api/me/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, bio, travelStyle, interests }),
      })
      setMessage('Profile successfully updated!')
    } finally {
      setSaving(false)
    }
  }

  const addTag = () => {
    if (newTag.trim() && !interests.includes(newTag.trim())) {
      setInterests([...interests, newTag.trim()])
      setNewTag('')
    }
  }

  const removeTag = (tag: string) => {
    setInterests(interests.filter((t) => t !== tag))
  }

  const submitProfileReview = async () => {
    if (!profile || !reviewTripId) return
    setSubmittingReview(true)
    setReviewMessage('')
    try {
      await createPeerReview({ tripId: reviewTripId, revieweeId: profile.id, rating: reviewRating, comment: reviewComment })
      setReviewableTrips((trips) => trips.filter((trip) => trip.id !== reviewTripId))
      setReviewComment('')
      setReviewMessage('Your review has been submitted.')
      getUserPeerReviews(userId).then(setReviewsData).catch(() => undefined)
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : 'Could not submit your review.')
    } finally {
      setSubmittingReview(false)
    }
  }

  if (!profile) {
    return (
      <div className="page">
        {message ? (
          <div className="empty-card" style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
            <p style={{ color: 'var(--red, #b91c1c)', fontWeight: 600, marginBottom: '12px' }}>{message}</p>
            <button className="primary-btn" onClick={() => window.location.reload()}>Retry</button>
          </div>
        ) : (
          <p className="muted">Loading profile…</p>
        )}
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Your public traveler identity"
        title={profile.name}
        description="Share your travel style, pace, and interests with the community."
      />

      <section className="panel" style={{ maxWidth: '780px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
          <div className="avatar" style={{ width: '48px', height: '48px', fontSize: '20px' }}>
            {profile.name ? profile.name[0].toUpperCase() : 'T'}
          </div>
          <div>
            <h2 style={{ margin: 0 }}>{profile.name}</h2>
            <small style={{ color: '#778' }}>@{profile.username} · {profile.email}</small>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <strong>{profile.trips_count || 0} trips</strong>
            <small style={{ display: 'block', color: 'var(--green)', marginTop: '2px' }}>
              {reviewsData?.privacy === 'PRIVATE'
                ? '★ Private rating'
                : reviewsData && reviewsData.count > 0 && reviewsData.average_rating !== null
                ? `★ ${reviewsData.average_rating.toFixed(1)} (${reviewsData.count} ${reviewsData.count === 1 ? 'review' : 'reviews'})`
                : profile.rating && profile.rating > 0
                ? `★ ${profile.rating.toFixed(1)} rating`
                : '★ New traveler'}
            </small>
          </div>
        </div>

        {profile.is_private && !isSelf ? (
          <div style={{ padding: '30px', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', margin: '20px 0' }}>
            <Lock size={32} style={{ margin: '0 auto 12px', display: 'block', color: '#94a3b8' }} />
            <h3 style={{ margin: '0 0 6px' }}>This profile is private</h3>
            <p style={{ color: '#64748b', maxWidth: '400px', margin: '0 auto', fontSize: '13px' }}>
              This traveler has set their profile to private. Detailed travel history and style are hidden.
            </p>
          </div>
        ) : isSelf ? (
          <>
            <label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label style={{ marginTop: '12px' }}>Travel style<input value={travelStyle} onChange={(e) => setTravelStyle(e.target.value)} /></label>
            <label style={{ marginTop: '12px' }}>Bio<textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} /></label>

            <div style={{ marginTop: '14px' }}>
              <label>Travel interests</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '8px 0' }}>
                {interests.map((t) => (
                  <span className="tag-chip" key={t}>
                    {t} <button type="button" onClick={() => removeTag(t)}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input placeholder="Add interest (e.g. Photography)..." value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()} />
                <button className="secondary-btn" onClick={addTag}>Add</button>
              </div>
            </div>

            {message && <p className="positive" style={{ marginTop: '12px' }}>{message}</p>}

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="primary-btn" disabled={saving} onClick={save}>
                {saving ? 'Saving…' : 'Save profile'} <Check size={15} />
              </button>
            </div>
          </>
        ) : (
          <div>
            <p>{profile.bio || 'No bio shared yet.'}</p>
            {profile.travel_style && <p><strong>Travel style:</strong> {profile.travel_style}</p>}
            {interests.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                {interests.map((t) => (
                  <span className="tag-chip" key={t}>{t}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {isSelf && (profile.admin_warnings?.length ?? 0) > 0 && (
        <section className="panel" style={{ maxWidth: '780px', marginTop: '20px', border: '1px solid #f3c76b', background: '#fffbeb' }}>
          <h3 style={{ marginTop: 0, color: '#92400e' }}>Admin notices</h3>
          {profile.admin_warnings?.map((warning) => (
            <div key={warning.id} style={{ padding: '10px 0', borderTop: '1px solid #f3dfb0' }}>
              <strong>Warning issued {new Date(warning.created_at).toLocaleDateString()}</strong>
              {warning.note && <p style={{ margin: '6px 0 0' }}>{warning.note}</p>}
            </div>
          ))}
        </section>
      )}

      {/* Traveler Reviews Section */}
      {!isSelf && !profile.is_private && reviewableTrips.length > 0 && (
        <section className="panel" style={{ maxWidth: '780px', marginTop: '24px' }}>
          <h3 style={{ marginTop: 0 }}>Rate and review {profile.name}</h3>
          <p className="muted">Reviews are available for travelers you shared a completed trip with.</p>
          <label>Completed trip
            <select value={reviewTripId} onChange={(event) => setReviewTripId(event.target.value)}>
              {reviewableTrips.map((trip) => <option key={trip.id} value={trip.id}>{trip.name}</option>)}
            </select>
          </label>
          <label style={{ marginTop: '12px' }}>Rating
            <select value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))}>
              {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5 stars</option>)}
            </select>
          </label>
          <label style={{ marginTop: '12px' }}>Review
            <textarea rows={3} maxLength={2000} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Share what it was like traveling together…" />
          </label>
          {reviewMessage && <p className="muted">{reviewMessage}</p>}
          <button className="primary-btn" style={{ marginTop: '12px' }} disabled={!reviewTripId || submittingReview} onClick={submitProfileReview}>
            {submittingReview ? 'Submitting…' : 'Submit review'} <Star size={16} />
          </button>
        </section>
      )}

      <section className="panel" style={{ maxWidth: '780px', marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Traveler Reviews</h3>
            <small style={{ color: '#64748b' }}>Peer reviews from completed group expeditions</small>
          </div>
          {reviewsData?.privacy === 'PUBLIC' && reviewsData.count > 0 && reviewsData.average_rating !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ecfdf5', padding: '6px 12px', borderRadius: '20px', border: '1px solid #a7f3d0' }}>
              <Star size={16} color="#059669" fill="#059669" />
              <strong style={{ color: '#065f46', fontSize: '13px' }}>
                {reviewsData.average_rating.toFixed(1)} / 5.0
              </strong>
              <small style={{ color: '#047857', fontSize: '11px' }}>
                ({reviewsData.count} {reviewsData.count === 1 ? 'review' : 'reviews'})
              </small>
            </div>
          )}
        </div>

        {loadingReviews ? (
          <p className="muted">Loading reviews…</p>
        ) : reviewsData?.privacy === 'PRIVATE' ? (
          <div style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
            <Lock size={20} style={{ margin: '0 auto 8px', display: 'block', color: '#94a3b8' }} />
            <strong style={{ display: 'block', fontSize: '13px', color: '#475569' }}>Reviews are private</strong>
            <small style={{ color: '#94a3b8', fontSize: '12px' }}>
              This traveler has set their reviews visibility to private.
            </small>
          </div>
        ) : !reviewsData || reviewsData.reviews.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
            <Star size={20} style={{ margin: '0 auto 8px', display: 'block', color: '#f59e0b' }} />
            <strong style={{ display: 'block', fontSize: '13px', color: '#475569' }}>No reviews yet</strong>
            <small style={{ color: '#94a3b8', fontSize: '12px' }}>
              Reviews will appear here after completing trips with fellow travelers.
            </small>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {reviewsData.reviews.map((rev) => (
              <div
                key={rev.id}
                style={{
                  padding: '16px',
                  background: 'white',
                  border: '1px solid var(--line, #e2e8f0)',
                  borderRadius: '10px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
                      {rev.reviewer_name ? rev.reviewer_name[0].toUpperCase() : 'T'}
                    </div>
                    <div>
                      <strong style={{ fontSize: '13px', display: 'block' }}>{rev.reviewer_name}</strong>
                      <small style={{ color: '#64748b', fontSize: '11px' }}>
                        Expedition: {rev.trip_name || 'Group Trip'}
                      </small>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '2px', color: '#f59e0b' }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={14}
                          color="#f59e0b"
                          fill={s <= rev.rating ? '#f59e0b' : 'none'}
                        />
                      ))}
                    </div>
                    <small style={{ color: '#94a3b8', fontSize: '10px', display: 'block', marginTop: '3px' }}>
                      {new Date(rev.created_at).toLocaleDateString()}
                    </small>
                  </div>
                </div>
                {rev.comment && (
                  <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                    "{rev.comment}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default ProfilePage

