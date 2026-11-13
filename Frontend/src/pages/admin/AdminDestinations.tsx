import { useEffect, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { api } from '../../api'
import type { Destination } from '../../types'
import { PageHeader } from '../../components/common/PageHeader'

export function AdminDestinations() {
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', division: 'Chattogram Division', district: '', category: 'Nature', estimatedBudget: 8000, description: '' })

  const load = () => api<Destination[]>('/api/destinations').then(setDestinations).catch(() => undefined)
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!form.name || !form.district) return
    await api('/api/destinations', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    setShowModal(false)
    setForm({ name: '', division: 'Chattogram Division', district: '', category: 'Nature', estimatedBudget: 8000, description: '' })
    load()
  }

  const remove = async (id: string) => {
    if (!window.confirm('Delete this destination?')) return
    await api(`/api/destinations/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="page role-page">
      <PageHeader
        title="Destination management"
        description="Add, edit, or remove destinations discoverable across Bangladesh."
        action={<button className="primary-btn" onClick={() => setShowModal(true)}><Plus size={17} /> Add destination</button>}
      />

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Division</th>
              <th>District</th>
              <th>Category</th>
              <th>Budget (BDT)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {destinations.map((d) => (
              <tr key={d.id}>
                <td><strong>{d.name}</strong></td>
                <td>{d.division}</td>
                <td>{d.district}</td>
                <td><span className="badge badge-blue">{d.category}</span></td>
                <td>৳ {d.estimated_budget?.toLocaleString()}</td>
                <td>
                  <button className="icon-btn" onClick={() => remove(d.id)} aria-label="Delete destination"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)} aria-label="Close dialog"><X size={18} /></button>
            <h2>Add new destination</h2>
            <label>Name<input autoFocus placeholder="e.g. Kuakata Sea Beach" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Division<input value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} /></label>
            <label>District<input placeholder="e.g. Patuakhali" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></label>
            <label>Category
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option>Beach</option>
                <option>Nature</option>
                <option>Culture</option>
                <option>Adventure</option>
                <option>Wildlife</option>
              </select>
            </label>
            <label>Estimated budget (BDT)<input type="number" value={form.estimatedBudget} onChange={(e) => setForm({ ...form, estimatedBudget: Number(e.target.value) })} /></label>
            <label>Description<textarea rows={3} placeholder="Describe the destination..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <div className="modal-actions">
              <button className="outline-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="primary-btn" onClick={add}>Save destination</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDestinations
