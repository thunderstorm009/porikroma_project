import { useEffect, useState } from 'react'
import { Search, Plus, MessageCircle, ShieldCheck, Users } from 'lucide-react'
import { api } from '../../api'
import { PageHeader } from '../../components/common/PageHeader'

export function CommunityPage() {
  const [posts, setPosts] = useState<{ id: string; body: string; author_name: string; reaction_count: number; comment_count: number; liked_by_me: boolean; created_at: string }[]>([])
  const [body, setBody] = useState('')
  const [query, setQuery] = useState('')
  const [openComments, setOpenComments] = useState<Record<string, { id: string; author_name: string; body: string }[]>>({})
  const [commentInput, setCommentInput] = useState<Record<string, string>>({})

  const load = () => api<typeof posts>('/api/community/posts').then(setPosts).catch(() => undefined)
  useEffect(() => { load() }, [])

  const createPost = async () => {
    if (!body.trim()) return
    await api('/api/community/posts', { method: 'POST', body: JSON.stringify({ body }) })
    setBody('')
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
      setOpenComments({ ...openComments, [postId]: comments })
    }
  }

  const addComment = async (postId: string) => {
    const text = commentInput[postId]
    if (!text?.trim()) return
    await api(`/api/community/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ body: text.trim() }) })
    setCommentInput({ ...commentInput, [postId]: '' })
    const comments = await api<{ id: string; author_name: string; body: string }[]>(`/api/community/posts/${postId}/comments`)
    setOpenComments({ ...openComments, [postId]: comments })
    load()
  }

  const filtered = posts.filter((p) => p.body.toLowerCase().includes(query.toLowerCase()) || p.author_name.toLowerCase().includes(query.toLowerCase()))

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
            <input placeholder="Search discussions and tips..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          <div className="panel inline-add" style={{ margin: '14px 0' }}>
            <input placeholder="Start a travel discussion..." value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createPost()} />
            <button className="primary-btn" onClick={createPost}><Plus size={15} /> Publish</button>
          </div>

          {filtered.map((post) => (
            <article className="panel community-post" key={post.id} style={{ display: 'block' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="post-avatar avatar">{post.author_name[0]}</div>
                <div style={{ flex: 1 }}>
                  <span className="status blue">Traveler reflection</span>
                  <h2 style={{ fontSize: '15px', margin: '6px 0' }}>{post.body}</h2>
                  <p style={{ color: '#778', fontSize: '11px' }}>Posted by <strong>{post.author_name}</strong> · {new Date(post.created_at).toLocaleDateString()}</p>

                  <div className="post-actions">
                    <button onClick={() => toggleComments(post.id)}>
                      <MessageCircle size={14} /> {post.comment_count} replies
                    </button>
                    <button onClick={() => toggleLike(post.id)} style={{ color: post.liked_by_me ? '#e04f4f' : 'inherit' }}>
                      ♡ {post.reaction_count}
                    </button>
                  </div>
                </div>
              </div>

              {openComments[post.id] && (
                <div style={{ marginTop: '14px', borderTop: '1px solid #edf0ea', paddingTop: '10px' }}>
                  {openComments[post.id].map((c) => (
                    <div key={c.id} style={{ padding: '6px 0', fontSize: '12px' }}>
                      <strong>{c.author_name}:</strong> {c.body}
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <input
                      style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '11px' }}
                      placeholder="Write a reply..."
                      value={commentInput[post.id] || ''}
                      onChange={(e) => setCommentInput({ ...commentInput, [post.id]: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && addComment(post.id)}
                    />
                    <button className="outline-btn small" onClick={() => addComment(post.id)}>Reply</button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </main>

        <aside className="panel community-guidelines">
          <p className="eyebrow">Porikroma pact</p>
          <h2>Travel kindly.</h2>
          <p>Share useful details, credit local knowledge, and respect quiet places.</p>
          <div className="guideline-row"><ShieldCheck size={15} /> Verified profiles marked clearly</div>
          <div className="guideline-row"><Users size={15} /> Respect indigenous regulations</div>
        </aside>
      </div>
    </div>
  )
}

export default CommunityPage
