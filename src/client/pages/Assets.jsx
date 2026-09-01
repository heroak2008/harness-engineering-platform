import { useState, useEffect } from 'react'
import axios from 'axios'
import './Assets.css'

function Assets() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchAssets()
  }, [filter])

  const fetchAssets = async () => {
    try {
      const token = localStorage.getItem('token')
      const query = filter === 'all' ? '' : `?assetType=${filter}`
      const response = await axios.get(`/api/asset${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setAssets(response.data)
    } catch (error) {
      console.error('Failed to fetch assets:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="assets-container">
      <div className="header">
        <h1>Asset Marketplace</h1>
        <button className="btn btn-primary">+ Upload Asset</button>
      </div>

      <div className="card">
        <div className="filter-bar">
          {['all', 'Agent', 'Skill', 'MCP', 'Extension'].map(type => (
            <button
              key={type}
              className={`filter-btn ${filter === type ? 'active' : ''}`}
              onClick={() => setFilter(type)}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="assets-grid">
          {assets.map(asset => (
            <div key={asset._id} className="asset-card">
              <div className="asset-header">
                <h3>{asset.name}</h3>
                <span className="badge badge-success">{asset.assetType}</span>
              </div>
              <p className="asset-description">{asset.description}</p>
              <div className="asset-meta">
                <span>⭐ {(asset.marketplace?.rating || 0).toFixed(1)}</span>
                <span>📥 {asset.marketplace?.downloads || 0}</span>
                <span>v{asset.version}</span>
              </div>
              <div className="asset-actions">
                <button className="btn btn-secondary">View</button>
                {asset.status === 'draft' && (
                  <button className="btn btn-primary">Publish</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Assets