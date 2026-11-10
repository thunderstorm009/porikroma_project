import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import { api } from '../../api'
import { PageHeader } from '../../components/common/PageHeader'

export function ProfilePage() {
  const { userId } = useParams()
  const [profile, setProfile] = useState<{ id: string; name: string; email: string; username: string; bio: string; travel_style: string; interests: string[]; rating: number; trips_count: number; reviews?: any[] } | null>(null)
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [travelStyle, setTravelStyle] = useState('')
  const [newTag, setNewTag] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

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

  if (!profile) return <div className="page"><p className="muted">Loading profile…</p></div>

  return (
    <div className="page">
      <PageHeader
        eyebrow="Your public traveler identity"
        title={profile.name}
        description="Share your travel style, pace, and interests with the community."
      />

      <section className="panel" style={{ maxWidth: '780px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
          <div className="avatar" style={{ width: '48px', height: '48px', fontSize: '20px' }}>{profile.name[0]}</div>
          <div>
            <h2 style={{ margin: 0 }}>{profile.name}</h2>
            <small style={{ color: '#778' }}>@{profile.username} · {profile.email}</small>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <strong>{profile.trips_count || 3} trips</strong>
            <small style={{ display: 'block', color: 'var(--green)' }}>★ {profile.rating || 4.9} rating</small>
          </div>
        </div>

        {isSelf ? (
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
            <p>{profile.bio}</p>
            <p><strong>Travel style:</strong> {profile.travel_style}</p>
          </div>
        )}
      </section>
    </div>
  )
}

export default ProfilePage
