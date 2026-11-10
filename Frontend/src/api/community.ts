import { api } from './client'

export const communityApi = {
  getPosts: () =>
    api<{
      id: string
      body: string
      author_name: string
      reaction_count: number
      comment_count: number
      liked_by_me: boolean
      created_at: string
    }[]>('/api/community/posts'),

  createPost: (body: string) =>
    api('/api/community/posts', {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  toggleReaction: (postId: string) =>
    api(`/api/community/posts/${postId}/reactions`, { method: 'POST' }),

  getComments: (postId: string) =>
    api<{ id: string; author_name: string; body: string }[]>(`/api/community/posts/${postId}/comments`),

  addComment: (postId: string, body: string) =>
    api(`/api/community/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
}
