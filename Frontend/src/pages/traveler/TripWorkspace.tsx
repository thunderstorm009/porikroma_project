import { useEffect, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { MapPin, ArrowUpRight, Check, ChevronRight, DollarSign, MessageCircle, Sparkles, Camera, Star, X } from "lucide-react"
import { api, getPendingPeerReviews, createPeerReview } from "../../api"
import type { WorkspaceData, PendingReviewCompanion } from "../../types"
import { PageHeader } from "../../components/common/PageHeader"
import { StatusBadge } from "../../components/common/StatusBadge"
import { ItineraryTab } from "../../components/workspace/ItineraryTab"
import { ExpensesTab } from "../../components/workspace/ExpensesTab"
import { NotesTab } from "../../components/workspace/NotesTab"
import { JournalTab } from "../../components/workspace/JournalTab"
import { PhotosTab } from "../../components/workspace/PhotosTab"
import { MapTab } from "../../components/workspace/MapTab"
import { ChecklistTab } from "../../components/workspace/ChecklistTab"
import { SettingsTab } from "../../components/workspace/SettingsTab"
import { GroupChatTab } from "../../components/workspace/GroupChatTab"
import { MembersTab } from "../../components/workspace/MembersTab"
import { WeatherWidget } from "../../components/common/WeatherWidget"

export function TripWorkspace() {
  const { tripId = "" } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [pendingCompanions, setPendingCompanions] = useState<PendingReviewCompanion[]>([])
  const [reviewingCompanion, setReviewingCompanion] = useState<PendingReviewCompanion | null>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewError, setReviewError] = useState("")
  const [reviewSuccess, setReviewSuccess] = useState("")

  // Current tab from URL or default to overview
  const pathParts = location.pathname.split("/")
  const currentTab = pathParts[3] || "overview"

  const loadWorkspace = () => {
    setLoading(true)
    api<WorkspaceData>(`/api/trips/${tripId}/workspace`)
      .then((res) => {
        setData(res)
        if (res.trip.status === "COMPLETED") {
          getPendingPeerReviews(tripId)
            .then(setPendingCompanions)
            .catch(() => {})
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load trip workspace"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadWorkspace() }, [tripId])

  const handleOpenReviewModal = (companion: PendingReviewCompanion) => {
    setReviewingCompanion(companion)
    setRating(5)
    setComment("")
    setReviewError("")
  }

  const handleSubmitReview = async () => {
    if (!reviewingCompanion) return
    setSubmittingReview(true)
    setReviewError("")
    try {
      await createPeerReview({
        tripId,
        revieweeId: reviewingCompanion.id,
        rating,
        comment,
      })
      setPendingCompanions((prev) => prev.filter((c) => c.id !== reviewingCompanion.id))
      setReviewingCompanion(null)
      setComment("")
      setRating(5)
      setReviewSuccess(`Review submitted for ${reviewingCompanion.name}!`)
      setTimeout(() => setReviewSuccess(""), 4000)
    } catch (err: any) {
      setReviewError(err?.message || "Failed to submit review")
    } finally {
      setSubmittingReview(false)
    }
  }

  const tabs = ["overview", "itinerary", "expenses", "notes", "journal", "photos", "map", "checklist", "settings"]
  if (data?.group || (data?.members && data.members.length > 1)) {
    tabs.splice(8, 0, "chat", "members")
  }

  if (loading) {
    return (
      <div className="page">
        <p className="loading-state">
          <span className="spinner" /> Loading trip workspace…
        </p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="page">
        <PageHeader title="Trip Workspace" description="Could not load workspace." />
        <p className="error-text">{error}</p>
        <button className="primary-btn" onClick={() => navigate("/trips")}>Back to all trips</button>
      </div>
    )
  }

  const { trip, itinerary, checklist, notes, expenses, members, mapPlaces, group } = data
  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const budgetUtilization = trip.budget > 0 ? Math.min(Math.round((totalSpent / trip.budget) * 100), 100) : 0

  return (
    <div className="page workspace-page">
      <div className="workspace-hero">
        <img src={trip.destination_image || "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1200&q=85"} alt={trip.name} />
        <div>
          <p className="eyebrow">Trip workspace · <StatusBadge status={trip.status} /></p>
          <h1>{trip.name}</h1>
          <p><MapPin size={14} /> {trip.destination_name} · {trip.start_date} – {trip.end_date}</p>
        </div>
      </div>

      {/* 8 Tab Navigation */}
      <nav className="workspace-nav">
        {tabs.map((tab) => (
          <button
            className={currentTab === tab ? "active" : ""}
            key={tab}
            onClick={() => navigate(`/trips/${tripId}${tab === "overview" ? "" : `/${tab}`}`)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      {/* Tab 1: Overview */}
      {currentTab === "overview" && (
        <div className="workspace-grid">
          {reviewSuccess && (
            <div className="success-box workspace-wide">
              ✓ {reviewSuccess}
            </div>
          )}

          {/* Review travel mates prompt on completed trips */}
          {trip.status === "COMPLETED" && (
            <div className="panel workspace-wide workspace-review-prompt">
              <div className="panel-heading">
                <div>
                  <StatusBadge status="Trip Completed" variant="green" />
                  <h2 className="workspace-review-prompt-title">
                    <Star size={20} className="workspace-star-icon" /> Review travel mates
                  </h2>
                  <p>
                    {pendingCompanions.length > 0
                      ? `You have ${pendingCompanions.length} fellow ${pendingCompanions.length === 1 ? "traveler" : "travelers"} to review from this expedition. Rate their teamwork, punctuality, and help build community trust.`
                      : "All travel companions for this expedition have been reviewed. Thank you for strengthening the Porikroma community!"}
                  </p>
                </div>
              </div>

              {pendingCompanions.length > 0 && (
                <div className="workspace-companion-list">
                  {pendingCompanions.map((comp) => (
                    <div
                      key={comp.id}
                      className="workspace-companion-card"
                    >
                      <div className="avatar workspace-companion-avatar">
                        {comp.name ? comp.name[0].toUpperCase() : "T"}
                      </div>
                      <div className="workspace-companion-info">
                        <strong className="workspace-companion-name">
                          {comp.name}
                        </strong>
                        <small className="workspace-companion-email">{comp.email}</small>
                      </div>
                      <button
                        className="primary-btn workspace-companion-btn"
                        onClick={() => handleOpenReviewModal(comp)}
                      >
                        Review <Star size={12} fill="currentColor" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>Next up</h2>
                <p>Your itinerary at a glance</p>
              </div>
              <button className="text-btn" onClick={() => navigate(`/trips/${tripId}/itinerary`)}>
                Open itinerary <ArrowUpRight size={15} />
              </button>
            </div>
            {itinerary.length > 0 ? (
              <div className="workspace-next">
                <span>{itinerary[0].day_date}</span>
                <div>
                  <strong>{itinerary[0].title}</strong>
                  <small>{itinerary[0].location || trip.destination_name}</small>
                </div>
                <Check size={17} />
              </div>
            ) : (
              <div className="workspace-empty-itinerary">
                No itinerary items scheduled yet. Click below to add your first stop.
              </div>
            )}
          </div>

          <div className="panel">
            <h2>Budget snapshot</h2>
            <div className="workspace-budget">
              <strong className="workspace-budget-value">৳ {totalSpent.toLocaleString()}</strong>
              <span>of ৳ {Number(trip.budget).toLocaleString()} planned ({budgetUtilization}%)</span>
              <div className="progress"><i style={{ width: `${budgetUtilization}%` }} /></div>
            </div>
            <button className="panel-link" onClick={() => navigate(`/trips/${tripId}/expenses`)}>
              Manage expenses ledger <ChevronRight size={15} />
            </button>
          </div>

          <div className="workspace-wide">
            <WeatherWidget
              destinationId={trip.destination_id}
              destinationName={trip.destination_name}
              datesLabel={`${trip.start_date} – ${trip.end_date}`}
            />
          </div>

          <div className="panel workspace-wide">
            <div className="panel-heading">
              <div>
                <h2>Quick actions</h2>
                <p>Perform key trip tasks in one click</p>
              </div>
            </div>
            <div className="quick-actions">
              <button onClick={() => navigate(`/trips/${tripId}/expenses`)}>
                <span><DollarSign size={17} /></span> Add an expense <ArrowUpRight size={14} />
              </button>
              <button onClick={() => navigate(`/trips/${tripId}/notes`)}>
                <span><MessageCircle size={17} /></span> Write a note <ArrowUpRight size={14} />
              </button>
              <button onClick={() => navigate(`/trips/${tripId}/journal`)}>
                <span><Sparkles size={17} /></span> Add a memory <ArrowUpRight size={14} />
              </button>
              <button onClick={() => navigate(`/trips/${tripId}/photos`)}>
                <span><Camera size={17} /></span> Trip photos <ArrowUpRight size={14} />
              </button>
              <button onClick={() => navigate(`/trips/${tripId}/checklist`)}>
                <span><Check size={17} /></span> Packing checklist <ArrowUpRight size={14} />
              </button>
              {trip.status === "COMPLETED" && pendingCompanions.length > 0 && (
                <button onClick={() => handleOpenReviewModal(pendingCompanions[0])}>
                  <span><Star size={17} className="workspace-star-icon" /></span> Review travel mates <ArrowUpRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Itinerary */}
      {currentTab === "itinerary" && (
        <ItineraryTab tripId={tripId} items={itinerary} onRefresh={loadWorkspace} />
      )}

      {/* Tab 3: Expenses */}
      {currentTab === "expenses" && (
        <ExpensesTab tripId={tripId} trip={trip} expenses={expenses} members={members} onRefresh={loadWorkspace} />
      )}

      {/* Tab 4: Notes */}
      {currentTab === "notes" && (
        <NotesTab tripId={tripId} notes={notes} onRefresh={loadWorkspace} />
      )}

      {/* Tab 5: Journal */}
      {currentTab === "journal" && (
        <JournalTab tripId={tripId} notes={notes} onRefresh={loadWorkspace} />
      )}

      {/* Tab 6: Photos */}
      {currentTab === "photos" && (
        <PhotosTab tripId={tripId} trip={trip} members={members} onRefresh={loadWorkspace} />
      )}

      {/* Tab 7: Map */}
      {currentTab === "map" && (
        <MapTab tripId={tripId} destinationName={trip.destination_name || ""} places={mapPlaces} itinerary={itinerary} onRefresh={loadWorkspace} />
      )}

      {/* Tab 7: Checklist */}
      {currentTab === "checklist" && (
        <ChecklistTab tripId={tripId} items={checklist} onRefresh={loadWorkspace} />
      )}

      {/* Tab 8: Settings */}
      {currentTab === "settings" && (
        <SettingsTab trip={trip} onRefresh={loadWorkspace} />
      )}

      {/* Optional Group Chat Tab */}
      {currentTab === "chat" && group && (
        <GroupChatTab groupId={group.id} tripId={tripId} />
      )}

      {/* Optional Group Members Tab */}
      {currentTab === "members" && (
        <MembersTab tripId={tripId} members={members} onRefresh={loadWorkspace} />
      )}

      {/* Review Travel Mate Modal */}
      {reviewingCompanion && (
        <div className="modal-backdrop" onClick={() => !submittingReview && setReviewingCompanion(null)}>
          <div className="modal workspace-review-modal" onClick={(e) => e.stopPropagation()}>
            <div className="workspace-modal-header">
              <div className="workspace-modal-user">
                <div className="avatar workspace-modal-avatar">
                  {reviewingCompanion.name ? reviewingCompanion.name[0].toUpperCase() : "T"}
                </div>
                <div>
                  <h3 className="workspace-modal-title">Review {reviewingCompanion.name}</h3>
                  <small className="workspace-modal-sub">Expedition companion</small>
                </div>
              </div>
              <button
                className="icon-btn"
                onClick={() => setReviewingCompanion(null)}
                disabled={submittingReview}
              >
                <X size={18} />
              </button>
            </div>

            <p className="workspace-modal-desc">
              Rate your travel experience together on <strong>{trip.name}</strong>. Your honest review helps travelers find great companions.
            </p>

            {reviewError && (
              <div className="error-box workspace-review-error">
                {reviewError}
              </div>
            )}

            <div className="workspace-star-rating">
              <label className="workspace-rating-label">
                Rating: {rating} of 5 stars
              </label>
              <div className="workspace-star-row">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="workspace-star-btn"
                    title={`${star} star${star > 1 ? "s" : ""}`}
                  >
                    <Star
                      size={28}
                      className={`workspace-star ${star <= rating ? "active" : ""}`}
                    />
                  </button>
                ))}
                <span className="workspace-rating-text">
                  {rating === 5 ? "Exceptional mate" : rating === 4 ? "Very good" : rating === 3 ? "Good" : rating === 2 ? "Needs improvement" : "Challenging"}
                </span>
              </div>
            </div>

            <div className="workspace-review-field">
              <label className="workspace-review-field-label">
                Comment & Feedback
              </label>
              <textarea
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Mention teamwork, punctuality, communication, or favorite shared moments..."
                className="workspace-review-textarea"
              />
            </div>

            <div className="modal-actions">
              <button
                className="secondary-btn"
                onClick={() => setReviewingCompanion(null)}
                disabled={submittingReview}
              >
                Cancel
              </button>
              <button
                className="primary-btn"
                onClick={handleSubmitReview}
                disabled={submittingReview}
              >
                {submittingReview ? "Submitting…" : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TripWorkspace
