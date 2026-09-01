import { useState, useEffect } from 'react'
import axios from 'axios'
import './Assets.css'

const TYPE_LABELS = {
  all: '全部',
  Agent: 'Agent',
  Skill: 'Skill',
  MCP: 'MCP',
  Extension: 'Extension'
}

function Assets() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [publishingId, setPublishingId] = useState(null)
  const [formData, setFormData] = useState({ name: '', description: '', assetType: 'Agent' })

  const authHeaders = () => {
    const token = localStorage.getItem('token')
    return token ? { Authorization: 'Bearer ' + token } : {}
  }

  useEffect(() => {
    fetchAssets()
  }, [filter])

  const fetchAssets = async () => {
    setLoading(true)
    setError('')
    try {
      const query = filter === 'all' ? '' : `?assetType=${filter}`
      const response = await axios.get(`/api/asset${query}`, { headers: authHeaders() })
      setAssets(response.data)
    } catch (err) {
      console.error('Failed to fetch assets:', err)
      setError('资产列表加载失败，请确认后端服务与数据库已启动')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await axios.post('/api/asset', formData, { headers: authHeaders() })
      setShowModal(false)
      setFormData({ name: '', description: '', assetType: 'Agent' })
      fetchAssets()
    } catch (err) {
      console.error('Failed to create asset:', err)
      alert(err.response?.data?.error || '创建资产失败')
    }
  }

  const handlePublish = async (assetId) => {
    setPublishingId(assetId)
    try {
      await axios.post(`/api/asset/${assetId}/publish`, {}, { headers: authHeaders() })
      fetchAssets()
    } catch (err) {
      console.error('Failed to publish asset:', err)
      alert(err.response?.data?.error || '发布资产失败')
    } finally {
      setPublishingId(null)
    }
  }

  if (loading) {
    return <div className="loading-state">加载中...</div>
  }

  return (
    <div className="assets-container">
      <div className="header">
        <h1>AI 资产市场</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ 新建资产</button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div className="filter-bar">
          {['all', 'Agent', 'Skill', 'MCP', 'Extension'].map(type => (
            <button
              key={type}
              className={`filter-btn ${filter === type ? 'active' : ''}`}
              onClick={() => setFilter(type)}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        {assets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <div className="empty-title">暂无资产</div>
            <div className="empty-hint">点击“新建资产”添加 Agent / Skill / MCP / Extension，发布后即可在市场中展示</div>
          </div>
        ) : (
          <div className="assets-grid">
            {assets.map(asset => (
              <div key={asset._id} className="asset-card">
                <div className="asset-header">
                  <h3>{asset.name}</h3>
                  <span className="badge badge-info">{asset.assetType}</span>
                </div>
                <p className="asset-description">{asset.description || '暂无描述'}</p>
                <div className="asset-meta">
                  <span>⭐ {(asset.marketplace?.rating || 0).toFixed(1)}</span>
                  <span>📥 {asset.marketplace?.downloads || 0}</span>
                  <span>v{asset.version}</span>
                  <span className={`badge ${asset.status === 'published' ? 'badge-success' : 'badge-warning'}`}>
                    {asset.status === 'published' ? '已发布' : asset.status === 'deprecated' ? '已下架' : '草稿'}
                  </span>
                </div>
                <div className="asset-actions">
                  {asset.status === 'draft' && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handlePublish(asset._id)}
                      disabled={publishingId === asset._id}
                    >
                      {publishingId === asset._id ? '发布中...' : '发布'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>新建资产</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">名称</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">类型</label>
                <select
                  className="form-input"
                  value={formData.assetType}
                  onChange={(e) => setFormData({ ...formData, assetType: e.target.value })}
                >
                  <option value="Agent">Agent</option>
                  <option value="Skill">Skill</option>
                  <option value="MCP">MCP</option>
                  <option value="Extension">Extension</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">描述</label>
                <textarea
                  className="form-input"
                  rows="4"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">创建</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>取消</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Assets
