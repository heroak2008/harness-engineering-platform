import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import './Dashboard.css'

function Dashboard() {
  const [stats, setStats] = useState(null)
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }

      const [statsRes, activitiesRes] = await Promise.all([
        axios.get('/api/dashboard/stats', { headers }),
        axios.get('/api/dashboard/activities', { headers })
      ])

      setStats(statsRes.data)
      setActivities(activitiesRes.data)
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading...</div>

  const chartData = [
    { name: 'Week 1', workflows: 12, assets: 8, tests: 15 },
    { name: 'Week 2', workflows: 19, assets: 12, tests: 22 },
    { name: 'Week 3', workflows: 15, assets: 14, tests: 18 },
    { name: 'Week 4', workflows: 25, assets: 18, tests: 28 },
  ]

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Workflows</h3>
            <p className="stat-value">{stats.total.workflows}</p>
          </div>
          <div className="stat-card">
            <h3>Assets</h3>
            <p className="stat-value">{stats.total.assets}</p>
          </div>
          <div className="stat-card">
            <h3>Specs</h3>
            <p className="stat-value">{stats.total.specs}</p>
          </div>
          <div className="stat-card">
            <h3>Test Cases</h3>
            <p className="stat-value">{stats.total.testCases}</p>
          </div>
        </div>
      )}

      <div className="charts-grid">
        <div className="card">
          <h2>Activity Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="workflows" stroke={`var(--primary-color)`} />
              <Line type="monotone" dataKey="assets" stroke={`var(--success-color)`} />
              <Line type="monotone" dataKey="tests" stroke={`var(--warning-color)`} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2>Items by Type</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="workflows" fill={`var(--primary-color)`} />
              <Bar dataKey="assets" fill={`var(--success-color)`} />
              <Bar dataKey="tests" fill={`var(--warning-color)`} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>Recent Activities</h2>
        <div className="activities-list">
          {activities.map((activity, index) => (
            <div key={index} className="activity-item">
              <span className="activity-type">{activity.type}</span>
              <p className="activity-name">{activity.name}</p>
              <p className="activity-time">{new Date(activity.updatedAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Dashboard