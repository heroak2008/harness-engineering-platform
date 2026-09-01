import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './Sidebar.css'

function Sidebar({ user, onLogout }) {
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const menuItems = [
    { name: '工程总览', path: '/', icon: '📊' },
    { name: 'Harness 工作流', path: '/workflows', icon: '⚙️' },
    { name: 'AI 资产市场', path: '/assets', icon: '📦' },
    { name: 'SPEC 工程', path: '/specs', icon: '📋' },
    { name: '评测/质量工程', path: '/testing', icon: '✅' },
  ]

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <h1 className="logo">🚀 Harness 工程平台</h1>
        <button
          className="toggle-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? '→' : '←'}
        </button>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            title={item.name}
          >
            <span className="nav-icon">{item.icon}</span>
            {!isCollapsed && <span className="nav-text">{item.name}</span>}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        {!isCollapsed && user && (
          <div className="user-info">
            <p className="user-name">{user.username}</p>
            <p className="user-role">{user.role}</p>
          </div>
        )}
        <button className="btn btn-secondary" onClick={onLogout}>
          {isCollapsed ? '🚪' : '退出登录'}
        </button>
      </div>
    </aside>
  )
}

export default Sidebar