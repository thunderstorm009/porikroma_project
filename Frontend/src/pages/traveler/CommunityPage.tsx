import { useEffect, useState } from 'react'
import { Search, Plus, MessageCircle, Heart, Trash2, ShieldCheck, Users } from 'lucide-react'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { PageHeader } from '../../components/common/PageHeader'

interface CommunityPost {
  id: string
  author_id: string
  body: string
  author_name: string
  reaction_count: number
  comment_count: number
  liked_by_me: boolean
  created_at: string
}

export function CommunityPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [body, setBody] = useState('')
  const [query, setQuery] = useState('')
  const [openComments, setOpenComments] = useState<Record<string, { id: string; author_name: string; body: string }[]>>({})
  const [commentInput, setCommentInput] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const load = () =>
    api<CommunityPost[]>('/api/community/posts')
      .then((data) => setPosts(data || []))
      .catch(() => undefined)
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  const createPost = async () => {
    if (!body.trim()) return
    await api('/api/community/posts', {
      method: 'POST',
      body: JSON.stringify({ body: body.trim() }),
    })
    setBody('')
    load()
  }

  const deletePost = async (postId: string) => {
    if (!window.confirm('Delete this community discussion?')) return
    await api(`/api/community/posts/${postId}`, { method: 'DELETE' })
    load()
  }

  const toggleLike = async (postId: string) => {
    await api(`/api/community/posts/${postId}/reactions`, { method: 'POST' })
    load()
  }

  const toggleComments = async (postId: string) => {
    if (openComments[postId]) {
      const next = { ...openComments }
      delete next[postId]
      setOpenComments(next)
    } else {
      const comments = await api<{ id: string; author_name: string; body: string }[]>(`/api/community/posts/${postId}/comments`)
      setOpenComments({ ...openComments, [postId]: comments || [] })
    }
  }

  const addComment = async (postId: string) => {
    const text = commentInput[postId]
    if (!text?.trim()) return
    await api(`/api/community/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: text.trim() }),
    })
    setCommentInput({ ...commentInput, [postId]: '' })
    const comments = await api<{ id: string; author_name: string; body: string }[]>(`/api/community/posts/${postId}/comments`)
    setOpenComments({ ...openComments, [postId]: comments || [] })
    load()
  }

  const filtered = posts.filter(
    (p) =>
      p.body.toLowerCase().includes(query.toLowerCase()) ||
      p.author_name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="page">
      <PageHeader
        eyebrow="Travel with people who get it"
        title="Community"
        description="Share questions, local knowledge, and stories with fellow travelers."
      />

      <div className="community-layout">
        <main>
          <div className="group-filter">
            <Search size={16} />
            <input
              placeholder="Search discussions and tips..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="panel inline-add" style={{ margin: '14px 0' }}>
            <input
              placeholder="Start a travel discussion..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createPost()}
            />
            <button className="primary-btn" onClick={createPost}>
              <Plus size={17} /> Publish
            </button>
          </div>

          {filtered.map((post) => {
            const canDelete =
              user && (String(user.id) === String(post.author_id) || user.role === 'ADMIN')

            return (
              <article className="panel community-post" key={post.id} style={{ display: 'block', position: 'relative' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="post-avatar avatar">
                    {post.author_name ? post.author_name[0].toUpperCase() : 'T'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="status blue">Traveler reflection</span>
                      {canDelete && (
                        <button
                          className="icon-btn"
                          onClick={() => deletePost(post.id)}
                          title="Delete post"
                          aria-label="Delete post"
                          style={{ color: '#b91c1c' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                    <h2 style={{ fontSize: '15px', margin: '6px 0', lineHeight: 1.5 }}>{post.body}</h2>
                    <p style={{ color: '#506155', fontSize: '12px' }}>
                      Posted by <strong>{post.author_name}</strong> · {new Date(post.created_at).toLocaleDateString()}
                    </p>

                    <div className="post-actions" style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                      <button
                        onClick={() => toggleComments(post.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <MessageCircle size={15} /> {post.comment_count} replies
                      </button>
                      <button
                        onClick={() => toggleLike(post.id)}
                        style={{
                          color: post.liked_by_me ? '#e04f4f' : 'inherit',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <Heart size={15} fill={post.liked_by_me ? '#e04f4f' : 'none'} color={post.liked_by_me ? '#e04f4f' : 'currentColor'} />
                        {post.reaction_count}
                      </button>
                    </div>
                  </div>
                </div>

                {openComments[post.id] && (
                  <div style={{ marginTop: '14px', borderTop: '1px solid #edf0ea', paddingTop: '10px' }}>
                    {openComments[post.id].map((c) => (
                      <div key={c.id} style={{ padding: '6px 0', fontSize: '13px' }}>
                        <strong style={{ color: '#1a2e22' }}>{c.author_name}:</strong> {c.body}
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                      <input
                        style={{
                          flex: 1,
                          padding: '0 14px',
                          height: '38px',
                          borderRadius: '8px',
                          border: '1px solid var(--line-strong)',
                          fontSize: '14px',
                        }}
                        placeholder="Write a reply..."
                        value={commentInput[post.id] || ''}
                        onChange={(e) => setCommentInput({ ...commentInput, [post.id]: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && addComment(post.id)}
                      />
                      <button className="primary-btn small" onClick={() => addComment(post.id)}>
                        Reply
                      </button>
                    </div>
                  </div>
                )}
              </article>
            )
          })}

          {!filtered.length && !loading && (
            <div className="panel" style={{ textAlign: 'center', padding: '40px 16px', color: '#5a685e', fontSize: '14px' }}>
              No discussions found. Start a new travel discussion above!
            </div>
          )}
        </main>

        <aside className="community-sidebar">
          <div className="panel">
            <h2>Community guidelines</h2>
            <p className="muted">Respect local cultures, share honest advice, and keep recommendations thoughtful and friendly.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default CommunityPage
