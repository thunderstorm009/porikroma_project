const API_URL = 'http://localhost:4000'

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('porikroma-token')
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`)
  return payload as T
}
