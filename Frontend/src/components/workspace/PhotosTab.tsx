import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Camera, Plus, Trash2, X, ChevronLeft, ChevronRight,
  Maximize2, Calendar, User, Sparkles, AlertCircle, ExternalLink
} from 'lucide-react'
import { tripsApi } from '../../api/trips'
import { useAuth } from '../../context/AuthContext'
import type { Trip, TripPhoto } from '../../types'
import { formatDate } from '../../utils/formatters'

export interface PhotosTabProps {
  tripId: string
  trip: Trip
  members?: { id: string; name: string; email: string; role: string }[]
  onRefresh?: () => void
}

/**
 * Resolves a stored photo URL so it can seamlessly accept:
 * 1. Full external URLs (e.g. Unsplash, external image hosting)
 * 2. Future Amazon S3 or Cloudflare R2 bucket URLs
 * 3. Relative storage paths prefixed with VITE_STORAGE_URL (if configured)
 */
export function resolvePhotoUrl(rawUrl: string): string {
  if (!rawUrl) return ''
  const trimmed = rawUrl.trim()
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed
  }
  const storageBase = ((import.meta as any).env?.VITE_STORAGE_URL || '').replace(/\/$/, '')
  if (storageBase) {
    return `${storageBase}/${trimmed.replace(/^\//, '')}`
  }
  return trimmed
}

export function PhotosTab({ tripId, trip, onRefresh }: PhotosTabProps) {
  const { user: currentUser } = useAuth()
  const [photos, setPhotos] = useState<TripPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Add Photo Modal / Form
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const loadPhotos = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await tripsApi.getPhotos(tripId)
      setPhotos(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load trip photos')
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    loadPhotos()
  }, [loadPhotos])

  const canDeletePhoto = (photo: TripPhoto): boolean => {
    if (!currentUser) return false
    const currentUserId = String(currentUser.id)
    const photoOwnerId = String(photo.user_id || photo.uploaded_by || '')
    const tripOrganizerId = String(trip.creator_id || '')
    return (
      currentUserId === photoOwnerId ||
      currentUserId === tripOrganizerId ||
      currentUser.role === 'ADMIN'
    )
  }

  const handleAddPhoto = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) {
      setFormError('Please enter a valid image URL')
      return
    }

    setIsSubmitting(true)
    setFormError('')
    try {
      await tripsApi.addPhoto(tripId, {
        url: url.trim(),
        caption: caption.trim(),
      })
      setUrl('')
      setCaption('')
      setIsAddOpen(false)
      await loadPhotos()
      if (onRefresh) onRefresh()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add photo')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeletePhoto = async (photoId: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this photo from the trip?')
    if (!confirmed) return

    try {
      await tripsApi.deletePhoto(tripId, photoId)
      if (lightboxIndex !== null) {
        setLightboxIndex(null)
      }
      await loadPhotos()
      if (onRefresh) onRefresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete photo')
    }
  }

  // Lightbox navigation
  const activePhoto = lightboxIndex !== null ? photos[lightboxIndex] : null

  const handlePrev = useCallback(() => {
    if (lightboxIndex === null || photos.length === 0) return
    setLightboxIndex((lightboxIndex - 1 + photos.length) % photos.length)
  }, [lightboxIndex, photos.length])

  const handleNext = useCallback(() => {
    if (lightboxIndex === null || photos.length === 0) return
    setLightboxIndex((lightboxIndex + 1) % photos.length)
  }, [lightboxIndex, photos.length])

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return
      if (e.key === 'Escape') setLightboxIndex(null)
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'ArrowRight') handleNext()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxIndex, handlePrev, handleNext])

  return (
    <div className="workspace-tab-content">
      {/* Tab Header & Action */}
      <div
        className="panel-heading"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '20px', margin: 0 }}>Trip Photos</h2>
          <p style={{ margin: '4px 0 0', color: '#506155', fontSize: '13px' }}>
            Shared visual expedition album for trip members.
          </p>
        </div>

        <button className="primary-btn" onClick={() => setIsAddOpen(true)}>
          <Plus size={17} /> Add Photo
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#506155' }}>
          <div
            className="avatar"
            style={{
              width: '40px',
              height: '40px',
              margin: '0 auto 14px',
              background: '#e8efe5',
              color: 'var(--green)',
            }}
          >
            <Sparkles size={20} />
          </div>
          <strong>Loading expedition photos…</strong>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div
          className="panel"
          style={{
            margin: '20px 0',
            textAlign: 'center',
            padding: '30px',
            background: '#fff5f5',
            border: '1px solid #f2dede',
          }}
        >
          <AlertCircle size={28} color="#d9534f" style={{ margin: '0 auto 8px' }} />
          <h3 style={{ fontSize: '15px', color: '#a94442' }}>Unable to load photos</h3>
          <p style={{ fontSize: '13px', color: '#506155', margin: '6px 0 14px' }}>{error}</p>
          <button className="primary-btn small" onClick={loadPhotos}>
            Retry
          </button>
        </div>
      )}

      {/* Photos Grid */}
      {!loading && !error && (
        <>
          {photos.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '18px',
              }}
            >
              {photos.map((photo, index) => {
                const canDelete = canDeletePhoto(photo)
                const resolved = resolvePhotoUrl(photo.url)

                return (
                  <article
                    key={photo.id}
                    className="panel"
                    style={{
                      padding: 0,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      border: '1px solid var(--line)',
                      borderRadius: '12px',
                      background: '#fff',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    {/* Image Thumbnail with Lightbox Trigger */}
                    <div
                      style={{
                        position: 'relative',
                        height: '190px',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        background: '#1a2721',
                      }}
                      onClick={() => setLightboxIndex(index)}
                    >
                      <img
                        src={resolved}
                        alt={photo.caption || 'Trip photograph'}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                          transition: 'transform 0.25s ease',
                        }}
                        onError={(e) => {
                          // Fallback placeholder on image load error
                          const target = e.currentTarget
                          target.onerror = null
                          target.src =
                            'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=600&q=80'
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          display: 'flex',
                          gap: '6px',
                        }}
                      >
                        <button
                          className="icon-btn"
                          style={{
                            background: 'rgba(0,0,0,0.5)',
                            color: '#fff',
                            width: '30px',
                            height: '30px',
                            borderRadius: '6px',
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setLightboxIndex(index)
                          }}
                          title="Open full preview"
                          aria-label="Open full preview"
                        >
                          <Maximize2 size={16} />
                        </button>
                        {canDelete && (
                          <button
                            className="icon-btn"
                            style={{
                              background: 'rgba(217, 83, 79, 0.85)',
                              color: '#fff',
                              width: '32px',
                              height: '32px',
                              borderRadius: '6px',
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeletePhoto(photo.id)
                            }}
                            title="Delete photo"
                            aria-label="Delete photo"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Metadata & Caption */}
                    <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <p
                        style={{
                          fontSize: '13px',
                          color: photo.caption ? 'var(--ink)' : '#506155',
                          margin: 0,
                          fontWeight: photo.caption ? 500 : 400,
                          lineHeight: 1.4,
                        }}
                      >
                        {photo.caption || 'No caption'}
                      </p>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '12px',
                          color: '#506155',
                          marginTop: '10px',
                          borderTop: '1px solid #f0f3ee',
                          paddingTop: '8px',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <User size={13} /> {photo.user_name || 'Trip member'}
                        </span>
                        <span>
                          {photo.taken_at
                            ? formatDate(photo.taken_at)
                            : formatDate(photo.created_at)}
                        </span>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div
              className="panel"
              style={{
                textAlign: 'center',
                padding: '48px 20px',
                color: '#506155',
                border: '1px dashed var(--line)',
                background: '#fafbf9',
              }}
            >
              <Camera size={38} color="var(--green)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '16px', margin: '0 0 6px' }}>No photos added yet</h3>
              <p style={{ fontSize: '13px', margin: '0 0 18px', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' }}>
                Capture moments from your expedition across Bangladesh. Add photos by URL to share with all trip members.
              </p>
              <button className="primary-btn" onClick={() => setIsAddOpen(true)}>
                <Plus size={17} /> Add First Photo
              </button>
            </div>
          )}
        </>
      )}

      {/* Add Photo Modal */}
      {isAddOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <button className="modal-close" onClick={() => setIsAddOpen(false)} aria-label="Close add photo modal">
              <X size={18} />
            </button>

            <span className="eyebrow" style={{ color: 'var(--green)' }}>Trip Album</span>
            <h2>Add Photo to Gallery</h2>
            <p className="modal-description">
              Provide an image URL (such as from Unsplash, cloud storage, or external hosting).
            </p>

            <form onSubmit={handleAddPhoto}>
              <label>
                Image URL
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </label>

              <label>
                Caption (optional)
                <input
                  type="text"
                  placeholder="e.g., Sunrise over Nilgiri Hill, Bandarban"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
              </label>

              {/* Live Image Preview */}
              {url.trim() && (
                <div style={{ marginTop: '14px' }}>
                  <small style={{ color: '#5a685e', fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
                    Preview:
                  </small>
                  <div
                    style={{
                      height: '160px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: '#eee',
                      border: '1px solid var(--line)',
                    }}
                  >
                    <img
                      src={resolvePhotoUrl(url)}
                      alt="Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        const target = e.currentTarget
                        target.style.display = 'none'
                      }}
                    />
                  </div>
                </div>
              )}

              {formError && <p className="error-text">{formError}</p>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="outline-btn"
                  onClick={() => setIsAddOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={isSubmitting || !url.trim()}
                >
                  {isSubmitting ? 'Adding…' : 'Add to Gallery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {activePhoto && lightboxIndex !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 18, 14, 0.92)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '24px',
          }}
          onClick={() => setLightboxIndex(null)}
        >
          {/* Top Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: '#fff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '13px', color: '#c4d1c8' }}>
              Photo {lightboxIndex + 1} of {photos.length}
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <a
                href={resolvePhotoUrl(activePhoto.url)}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#c4d1c8', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontSize: '12px' }}
                title="Open original image"
              >
                <ExternalLink size={16} /> Original
              </a>

              {canDeletePhoto(activePhoto) && (
                <button
                  onClick={() => handleDeletePhoto(activePhoto.id)}
                  style={{
                    color: '#ff7d75',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  title="Delete photo"
                  aria-label="Delete photo"
                >
                  <Trash2 size={16} /> Delete
                </button>
              )}

              <button
                onClick={() => setLightboxIndex(null)}
                style={{
                  color: '#fff',
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  marginLeft: '8px',
                }}
                title="Close (Esc)"
                aria-label="Close preview"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Central Image View with Navigation Arrows */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'relative',
              margin: '16px 0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Prev Arrow */}
            {photos.length > 1 ? (
              <button
                onClick={handlePrev}
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '44px',
                  height: '44px',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  zIndex: 2,
                }}
                title="Previous photo (Left arrow)"
                aria-label="Previous photo"
              >
                <ChevronLeft size={24} />
              </button>
            ) : <div style={{ width: '44px' }} />}

            {/* Photo */}
            <div
              style={{
                maxWidth: '85vw',
                maxHeight: '74vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={resolvePhotoUrl(activePhoto.url)}
                alt={activePhoto.caption || 'Full photograph'}
                style={{
                  maxWidth: '100%',
                  maxHeight: '74vh',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                }}
              />
            </div>

            {/* Next Arrow */}
            {photos.length > 1 ? (
              <button
                onClick={handleNext}
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '44px',
                  height: '44px',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  zIndex: 2,
                }}
                title="Next photo (Right arrow)"
                aria-label="Next photo"
              >
                <ChevronRight size={24} />
              </button>
            ) : <div style={{ width: '44px' }} />}
          </div>

          {/* Bottom Caption & Info */}
          <div
            style={{
              textAlign: 'center',
              color: '#fff',
              maxWidth: '680px',
              margin: '0 auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {activePhoto.caption && (
              <h3 style={{ fontSize: '16px', fontWeight: 500, margin: '0 0 6px' }}>
                {activePhoto.caption}
              </h3>
            )}
            <p style={{ fontSize: '13px', color: '#d4dfd7', margin: 0 }}>
              Uploaded by <strong>{activePhoto.user_name || 'Trip member'}</strong> ·{' '}
              {formatDate(activePhoto.taken_at || activePhoto.created_at)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default PhotosTab
