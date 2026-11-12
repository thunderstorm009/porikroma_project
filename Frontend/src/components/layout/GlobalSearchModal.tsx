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
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setSearchResults([])
      setSelectedIndex(0)
      return
    }
  }, [isOpen])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setSelectedIndex(0)
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
      setSelectedIndex(0)
    })
  }, [searchQuery])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (searchResults.length ? Math.min(prev + 1, searchResults.length - 1) : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (searchResults.length ? Math.max(prev - 1, 0) : 0))
    } else if (e.key === 'Enter' && searchResults[selectedIndex]) {
      e.preventDefault()
      onClose()
      navigate(searchResults[selectedIndex].link)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="search-modal-backdrop" onClick={onClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-head">
          <Search size={18} />
          <input
            autoFocus
            placeholder="Type to search destinations, trips, expeditions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button onClick={onClose} aria-label="Close search"><X size={18} /></button>
        </div>
        <div className="search-results">
          {searchResults.map((item, idx) => (
            <button
              className={`search-result-item ${selectedIndex === idx ? 'selected' : ''}`}
              key={item.id}
              onMouseEnter={() => setSelectedIndex(idx)}
              onClick={() => {
                onClose()
                navigate(item.link)
              }}
            >
              <div>
                <strong>{item.title}</strong>
                <small>{item.category}</small>
              </div>
              <ArrowUpRight size={14} className="search-result-arrow" />
            </button>
          ))}
          {searchQuery && !searchResults.length && (
            <div className="search-empty">
              No matching destinations or trips found.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
