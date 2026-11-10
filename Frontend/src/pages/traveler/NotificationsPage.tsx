import { useNavigate } from 'react-router-dom'
import { Bell, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { useNotifications } from '../../context/NotificationsContext'

export function NotificationsPage() {
  const navigate = useNavigate()
  const { notifications: items, markAsRead, markAllAsRead, deleteNotification } = useNotifications()

  const markRead = async (id: string, link?: string) => {
    await markAsRead(id)
    if (link) navigate(link)
  }

  const deleteNotif = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteNotification(id)
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Stay in the loop"
        title="Notifications"
        description="Updates on your trips, applications, and reviews."
        action={
          <button className="outline-btn" onClick={markAllAsRead}>Mark all as read</button>
        }
      />

      <div className="notification-list">
        {items.map((item) => (
          <button
            className={item.read ? 'notification-row' : 'notification-row unread'}
            key={item.id}
            onClick={() => markRead(item.id, item.link)}>
            <span className="notification-icon"><Bell size={16} /></span>
            <div>
              <strong>{item.type}</strong>
              <small>{item.detail}</small>
            </div>
            {!item.read && <i />}
            <span className="icon-btn" onClick={(e) => deleteNotif(item.id, e)} title="Delete notification"><Trash2 size={14} /></span>
          </button>
        ))}
        {!items.length && (
          <div className="panel empty-agenda" style={{ margin: '20px' }}>
            <strong>You’re all caught up.</strong>
            <p>New trip invitations, applications, and reviews will appear here.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationsPage
