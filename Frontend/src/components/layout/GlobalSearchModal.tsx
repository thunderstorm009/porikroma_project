import React, { useEffect, useState } from 'react'
import { ArrowUpRight, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import type { Destination, GroupExpedition, Trip } from '../../types'

export interface GlobalSearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; title: string; category: string; link: string }[]>([])

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setSearchResults([])
      return
    }
  }, [isOpen])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const q = searchQuery.toLowerCase()
    Promise.all([
      api<Destination[]>(`/api/destinations?q=${encodeURIComponent(q)}`).catch(() => []),
      api<Trip[]>('/api/trips').catch(() => []),
      api<GroupExpedition[]>('/api/groups').catch(() => []),
    ]).then(([dests, trips, groups]) => {
      const res: { id: string; title: string; category: string; link: string }[] = []
      dests.slice(0, 3).forEach((d) => res.push({ id: d.id, title: d.name, category: `Destination · ${d.district}`, link: `/destinations/${d.id}` }))
      trips.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 3).forEach((t) => res.push({ id: t.id, title: t.name, category: `Trip · ${t.status}`, link: `/trips/${t.id}` }))
      groups.filter((g) => g.title.toLowerCase().includes(q)).slice(0, 3).forEach((g) => res.push({ id: g.id, title: g.title, category: 'Expedition', link: `/group-travel/${g.id}` }))
      setSearchResults(res)
    })
  }, [searchQuery])

  if (!isOpen) return null

  return (
    <div className="search-modal-backdrop" onClick={onClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-head">
          <Search size={18} color="#6d7a71" />
          <input
            autoFocus
            placeholder="Type to search destinations, trips, expeditions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="search-results">
          {searchResults.map((item) => (
            <button
              className="search-result-item"
              key={item.id}
              onClick={() => {
                onClose()
                navigate(item.link)
              }}
            >
              <div>
                <strong>{item.title}</strong>
                <small>{item.category}</small>
              </div>
              <ArrowUpRight size={14} style={{ marginLeft: 'auto', color: '#889' }} />
            </button>
          ))}
          {searchQuery && !searchResults.length && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#889', fontSize: '12px' }}>
              No matching destinations or trips found.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
