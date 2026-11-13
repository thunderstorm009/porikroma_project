import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../../api'
import type { WorkspaceData } from '../../types'

export interface ChecklistTabProps {
  tripId: string
  items: WorkspaceData['checklist']
  onRefresh: () => void
}

export function ChecklistTab({ tripId, items, onRefresh }: ChecklistTabProps) {
  const [title, setTitle] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')

  const toggle = async (id: string, completed: boolean) => {
    await api(`/api/trips/${tripId}/checklist/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: !completed }),
    })
    onRefresh()
  }

  const add = async () => {
    if (!title.trim()) return
    await api(`/api/trips/${tripId}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ title: title.trim() }),
    })
    setTitle('')
    onRefresh()
  }

  const deleteItem = async (id: string) => {
    await api(`/api/trips/${tripId}/checklist/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  const visible = items.filter((i) => {
    if (filter === 'pending') return !i.completed
    if (filter === 'completed') return i.completed
    return true
  })

  return (
    <div className="panel workspace-content">
      <div className="panel-heading">
        <div>
          <h2>Packing & preparation checklist</h2>
          <p>{items.filter((i) => i.completed).length} of {items.length} items packed</p>
        </div>
        <div className="tabs" style={{ margin: 0 }}>
          <button className={filter === 'all' ? 'tab active' : 'tab'} onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'pending' ? 'tab active' : 'tab'} onClick={() => setFilter('pending')}>Pending</button>
          <button className={filter === 'completed' ? 'tab active' : 'tab'} onClick={() => setFilter('completed')}>Done</button>
        </div>
      </div>

      <div className="inline-add" style={{ margin: '16px 0' }}>
        <input placeholder="Add item (e.g. Waterproof hiking boots)..." value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="primary-btn" onClick={add}><Plus size={17} /> Add</button>
      </div>

      <div>
        {visible.map((item) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #edf0ea' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0 }}>
              <input type="checkbox" checked={item.completed} onChange={() => toggle(item.id, item.completed)} />
              <span style={{ textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? '#506155' : 'inherit' }}>
                {item.title}
              </span>
            </label>
            <button className="icon-btn" onClick={() => deleteItem(item.id)} aria-label="Delete item"><Trash2 size={16} /></button>
          </div>
        ))}
        {!visible.length && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#506155' }}>No checklist items in this view.</div>
        )}
      </div>
    </div>
  )
}

export default ChecklistTab
