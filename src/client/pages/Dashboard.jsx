import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import './Dashboard.css'

function Dashboard() {
  const [stats, setStats] = useState(null)
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const headers = token ? { Authorization: 'Bearer ' + token } : {}

      const [statsRes, activitiesRes] = await Promise.all([
        axios.get('/api/dashboard/stats', { headers }),
        axios.get('/api/dashboard/activities', { headers })
      ])

      setStats(statsRes.data)
      setActivities(activitiesRes.data)
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
      setError('仪表盘数据加载失败，请确认后端服务与数据库已启动')
    } finally {
      setLoading(false)
    }
  }

  const activityTypeLabel = {
    workflow: '工作流',
    asset: '资产',
    spec: 'SPEC'
  }

  // 示例趋势图：基于当前统计数字生成一个简单的近 4 周示意曲线，
  // 用于在没有历史时序数据接口时，直观展示资产/交付增长趋势。
  const buildTrendData = (s) => {
    if (!s) return []
    const targets = {
      workflows: s.total.workflows,
      assets: s.total.assets,
      specs: s.total.specs
    }
    return [0.25, 0.5, 0.75, 1].map((ratio, idx) => ({
      name: `第 ${idx + 1} 周`,
      workflows: Math.round(targets.workflows * ratio),
      assets: Math.round(targets.assets * ratio),
      specs: Math.round(targets.specs * ratio)
    }))
  }

  if (loading) {
    return <div className="loading-state">加载中...</div>
  }

  const chartData = buildTrendData(stats)

  return (
    <div className="dashboard">
      <h1>工程总览</h1>

      {error && <div className="error-banner">{error}</div>}

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>工作流</h3>
            <p className="stat-value">{stats.total.workflows}</p>
            <p className="stat-sub">其中 {stats.published.workflows} 个已启用</p>
          </div>
          <div className="stat-card">
            <h3>AI 资产</h3>
            <p className="stat-value">{stats.total.assets}</p>
            <p className="stat-sub">其中 {stats.published.assets} 个已发布</p>
          </div>
          <div className="stat-card">
            <h3>SPEC</h3>
            <p className="stat-value">{stats.total.specs}</p>
            <p className="stat-sub">其中 {stats.published.specs} 个已批准</p>
          </div>
          <div className="stat-card">
            <h3>测试集</h3>
            <p className="stat-value">{stats.total.testCases}</p>
          </div>
        </div>
      )}

      <div className="card">
        <h2>资产/交付趋势（示例）</h2>
        {chartData.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📈</div>
            <div className="empty-title">暂无可用于绘图的数据</div>
            <div className="empty-hint">创建工作流、资产或 SPEC 后，这里将展示趋势示意图</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="workflows" name="工作流" stroke="var(--primary-color)" />
              <Line type="monotone" dataKey="assets" name="资产" stroke="var(--success-color)" />
              <Line type="monotone" dataKey="specs" name="SPEC" stroke="var(--warning-color)" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card">
        <h2>近期活动</h2>
        {activities.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🗂️</div>
            <div className="empty-title">暂无活动记录</div>
            <div className="empty-hint">创建或更新工作流、资产、SPEC 后将显示在这里</div>
          </div>
        ) : (
          <div className="activities-list">
            {activities.map((activity, index) => (
              <div key={activity._id || index} className="activity-item">
                <span className="activity-type">{activityTypeLabel[activity.type] || activity.type}</span>
                <p className="activity-name">{activity.name || activity.title}</p>
                <p className="activity-time">
                  {activity.updatedAt ? new Date(activity.updatedAt).toLocaleString('zh-CN') : '-'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
