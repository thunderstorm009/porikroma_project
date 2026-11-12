import { useEffect, useState, useMemo, useCallback } from "react"
import {
  Camera, Plus, Trash2, X, ChevronLeft, ChevronRight,
  Maximize2, User, ExternalLink
} from "lucide-react"
import { tripsApi } from "../../api/trips"
import { useAuth } from "../../context/AuthContext"
import type { Trip, TripPhoto } from "../../types"
import { formatDate } from "../../utils/formatters"

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
  if (!rawUrl) return ""
  const trimmed = rawUrl.trim()
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed
  }
  const storageBase = ((import.meta as any).env?.VITE_STORAGE_URL || "").replace(/\/$/, "")
  if (storageBase) {
    return `${storageBase}/${trimmed.replace(/^\//, "")}`
  }
  return trimmed
}

export function PhotosTab({ tripId, trip, onRefresh }: PhotosTabProps) {
  const { user: currentUser } = useAuth()
  const [photos, setPhotos] = useState<TripPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Add Photo Modal / Form
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [caption, setCaption] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

  // Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const loadPhotos = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const data = await tripsApi.getPhotos(tripId)
      setPhotos(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load trip photos")
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
    const photoOwnerId = String(photo.user_id || photo.uploaded_by || "")
    const tripOrganizerId = String(trip.creator_id || "")
    return (
      currentUserId === photoOwnerId ||
      currentUserId === tripOrganizerId ||
      currentUser.role === "ADMIN"
    )
  }

  const handleAddPhoto = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) {
      setFormError("Please enter a valid image URL")
      return
    }

    setIsSubmitting(true)
    setFormError("")
    try {
      await tripsApi.addPhoto(tripId, {
        url: url.trim(),
        caption: caption.trim(),
      })
      setUrl("")
      setCaption("")
      setIsAddOpen(false)
      await loadPhotos()
      if (onRefresh) onRefresh()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add photo")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeletePhoto = async (photoId: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this photo from the trip?")
    if (!confirmed) return

    try {
      await tripsApi.deletePhoto(tripId, photoId)
      if (lightboxIndex !== null) {
        setLightboxIndex(null)
      }
      await loadPhotos()
      if (onRefresh) onRefresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete photo")
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
      if (e.key === "Escape") setLightboxIndex(null)
      if (e.key === "ArrowLeft") handlePrev()
      if (e.key === "ArrowRight") handleNext()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [lightboxIndex, handlePrev, handleNext])

  return (
    <div className="workspace-tab-content">
      {/* Tab Header & Action */}
      <div className="panel-heading photos-tab-heading">
        <div>
          <h2 className="photos-tab-title">Trip Photos</h2>
          <p className="photos-tab-subheading">
            Shared visual expedition album for trip members.
          </p>
        </div>

        <button className="primary-btn" onClick={() => setIsAddOpen(true)}>
          <Plus size={16} /> Add Photo
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <p className="loading-state">
          <span className="spinner" /> Loading expedition photos…
        </p>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="error-box">
          <p className="error-text">{error}</p>
          <button className="primary-btn small" onClick={loadPhotos}>
            Retry
          </button>
        </div>
      )}

      {/* Photos Grid */}
      {!loading && !error && (
        <>
          {photos.length > 0 ? (
            <div className="photos-tab-grid">
              {photos.map((photo, index) => {
                const canDelete = canDeletePhoto(photo)
                const resolved = resolvePhotoUrl(photo.url)

                return (
                  <article key={photo.id} className="panel photos-tab-card">
                    {/* Image Thumbnail with Lightbox Trigger */}
                    <div
                      className="photos-tab-thumb"
                      onClick={() => setLightboxIndex(index)}
                    >
                      <img
                        src={resolved}
                        alt={photo.caption || "Trip photograph"}
                        onError={(e) => {
                          const target = e.currentTarget
                          target.onerror = null
                          target.src =
                            "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=600&q=80"
                        }}
                      />
                      <div className="photos-tab-thumb-actions">
                        <button
                          className="photos-tab-thumb-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            setLightboxIndex(index)
                          }}
                          title="Open full preview"
                        >
                          <Maximize2 size={14} />
                        </button>
                        {canDelete && (
                          <button
                            className="photos-tab-thumb-btn danger"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeletePhoto(photo.id)
                            }}
                            title="Delete photo"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Metadata & Caption */}
                    <div className="photos-tab-meta">
                      <p className={`photos-tab-caption ${photo.caption ? "" : "empty"}`}>
                        {photo.caption || "No caption"}
                      </p>

                      <div className="photos-tab-details">
                        <span className="photos-tab-user">
                          <User size={11} /> {photo.user_name || "Trip member"}
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
            <div className="panel photos-tab-empty">
              <Camera size={38} className="photos-tab-empty-icon" />
              <h3 className="photos-tab-empty-title">No photos added yet</h3>
              <p className="photos-tab-empty-desc">
                Capture moments from your expedition across Bangladesh. Add photos by URL to share with all trip members.
              </p>
              <button className="primary-btn" onClick={() => setIsAddOpen(true)}>
                <Plus size={16} /> Add First Photo
              </button>
            </div>
          )}
        </>
      )}

      {/* Add Photo Modal */}
      {isAddOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddOpen(false)}>
          <div
            className="modal photos-tab-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setIsAddOpen(false)}>
              <X size={18} />
            </button>

            <span className="eyebrow">Trip Album</span>
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
                <div className="photos-tab-preview">
                  <small className="photos-tab-preview-label">
                    Preview:
                  </small>
                  <div className="photos-tab-preview-box">
                    <img
                      src={resolvePhotoUrl(url)}
                      alt="Preview"
                      className="photos-tab-preview-img"
                      onError={(e) => {
                        const target = e.currentTarget
                        target.style.display = "none"
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
                  {isSubmitting ? "Adding…" : "Add to Gallery"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {activePhoto && lightboxIndex !== null && (
        <div
          className="photos-tab-lightbox"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Top Bar */}
          <div
            className="photos-tab-lightbox-top"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="photos-tab-lightbox-counter">
              Photo {lightboxIndex + 1} of {photos.length}
            </div>

            <div className="photos-tab-lightbox-actions">
              <a
                href={resolvePhotoUrl(activePhoto.url)}
                target="_blank"
                rel="noreferrer"
                className="photos-tab-lightbox-link"
                title="Open original image"
              >
                <ExternalLink size={15} /> Original
              </a>

              {canDeletePhoto(activePhoto) && (
                <button
                  onClick={() => handleDeletePhoto(activePhoto.id)}
                  className="photos-tab-lightbox-delete"
                  title="Delete photo"
                >
                  <Trash2 size={15} /> Delete
                </button>
              )}

              <button
                onClick={() => setLightboxIndex(null)}
                className="photos-tab-lightbox-close"
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Central Image View with Navigation Arrows */}
          <div
            className="photos-tab-lightbox-body"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Prev Arrow */}
            {photos.length > 1 ? (
              <button
                onClick={handlePrev}
                className="photos-tab-lightbox-nav"
                title="Previous photo (Left arrow)"
              >
                <ChevronLeft size={24} />
              </button>
            ) : <div className="photos-tab-lightbox-nav-spacer" />}

            {/* Photo */}
            <div className="photos-tab-lightbox-img-wrap">
              <img
                src={resolvePhotoUrl(activePhoto.url)}
                alt={activePhoto.caption || "Full photograph"}
                className="photos-tab-lightbox-img"
              />
            </div>

            {/* Next Arrow */}
            {photos.length > 1 ? (
              <button
                onClick={handleNext}
                className="photos-tab-lightbox-nav"
                title="Next photo (Right arrow)"
              >
                <ChevronRight size={24} />
              </button>
            ) : <div className="photos-tab-lightbox-nav-spacer" />}
          </div>

          {/* Bottom Caption & Info */}
          <div
            className="photos-tab-lightbox-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            {activePhoto.caption && (
              <h3 className="photos-tab-lightbox-caption">
                {activePhoto.caption}
              </h3>
            )}
            <p className="photos-tab-lightbox-meta">
              Uploaded by <strong>{activePhoto.user_name || "Trip member"}</strong> ·{" "}
              {formatDate(activePhoto.taken_at || activePhoto.created_at)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default PhotosTab
