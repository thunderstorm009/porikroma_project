import { useEffect, useState } from 'react'
import { Plus, CalendarDays } from 'lucide-react'
import { api } from '../../api'
import type { Trip } from '../../types'
import { PageHeader } from '../../components/common/PageHeader'

export function CalendarPage() {
  const today = new Date()
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()))
  const [events, setEvents] = useState<Record<string, string[]>>({
    [`${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`]: ['Today · Personal planning'],
  })

  // Load real user trips to populate on calendar
  useEffect(() => {
    api<Trip[]>('/api/trips').then((trips) => {
      const tripEvents: Record<string, string[]> = {}
      trips.forEach((t) => {
        // Use date-only parsing to avoid timezone shifts, and mark every day
        // of the trip so joined expeditions are visible throughout their dates.
        const start = new Date(`${t.start_date.slice(0, 10)}T12:00:00`)
        const end = new Date(`${(t.end_date || t.start_date).slice(0, 10)}T12:00:00`)
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
            const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
            const event = `${t.name} (${t.status})`
            tripEvents[key] = [...(tripEvents[key] || []), event]
          }
        }
      })
      setEvents((prev) => ({ ...prev, ...tripEvents }))
    }).catch(() => undefined)
  }, [])

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay()
  const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => {
    const date = index - firstDay + 1
    return date > 0 && date <= daysInMonth ? new Date(month.getFullYear(), month.getMonth(), date) : null
  })

  const keyFor = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  const selectedEvents = events[keyFor(selected)] || []
  const shiftMonth = (amount: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1))

  const addEvent = () => {
    const name = window.prompt(`Add event for ${selected.toLocaleDateString()}:`)
    if (name?.trim()) {
      setEvents((current) => ({
        ...current,
        [keyFor(selected)]: [...(current[keyFor(selected)] || []), name.trim()],
      }))
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Make room for the good stuff"
        title="Calendar"
        description="Your travels, departures, and milestones aligned in one place."
        action={<button className="primary-btn" onClick={addEvent}><Plus size={17} /> Add event</button>}
      />

      <div className="calendar-layout">
        <section className="panel calendar-panel">
          <div className="calendar-nav">
            <button className="round-btn" onClick={() => shiftMonth(-1)}>←</button>
            <h2>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
            <button className="round-btn" onClick={() => shiftMonth(1)}>→</button>
            <button className="outline-btn small" onClick={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(new Date(today)) }}>Today</button>
          </div>
          <div className="calendar-week">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="calendar-days">
            {cells.map((date, index) =>
              date ? (
                <button
                  className={`calendar-day ${keyFor(date) === keyFor(selected) ? 'today' : ''} ${events[keyFor(date)] ? 'trip-day' : ''}`}
                  key={index}
                  onClick={() => setSelected(date)}>
                  {date.getDate()}
                  {events[keyFor(date)]?.map((event) => (
                    <span className="calendar-event" key={event}>{event}</span>
                  ))}
                </button>
              ) : (
                <div className="calendar-day empty-day" key={index} />
              )
            )}
          </div>
        </section>

        <aside className="panel day-agenda">
          <div className="panel-heading">
            <div>
              <h2>{selected.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
              <p>{selectedEvents.length ? `${selectedEvents.length} event${selectedEvents.length > 1 ? 's' : ''}` : 'Nothing scheduled'}</p>
            </div>
            <CalendarDays size={20} />
          </div>
          {selectedEvents.length ? (
            <div className="selected-events">
              {selectedEvents.map((event) => (
                <div className="workspace-list-row" key={event}>
                  <span className="list-marker"><CalendarDays size={13} /></span>
                  <strong>{event}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-agenda">
              <span>☕</span>
              <strong>A little breathing room.</strong>
              <p>Use today to dream up where you’ll go next.</p>
            </div>
          )}
          <button className="panel-link" onClick={addEvent}>Add personal note or stop <Plus size={15} /></button>
        </aside>
      </div>
    </div>
  )
}

export default CalendarPage
