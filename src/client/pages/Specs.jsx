import { useState, useEffect } from 'react'
import axios from 'axios'
import './Specs.css'
import { authHeaders } from '../utils/auth'

const SPEC_TYPE_LABELS = {
  requirement: '需求',
  design: '设计',
  task: '任务',
  contract: '契约',
  rule: '规则',
  standard: '标准'
}

const STATUS_LABELS = {
  draft: '草稿',
  review: '评审中',
  approved: '已批准',
  implemented: '已实现',
  archived: '已归档'
}

function Specs() {
  const [specs, setSpecs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ title: '', description: '', specType: 'requirement' })


  useEffect(() => {
    fetchSpecs()
  }, [])

  const fetchSpecs = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await axios.get('/api/spec', { headers: authHeaders() })
      setSpecs(response.data)
    } catch (err) {
      console.error('Failed to fetch specs:', err)
      setError('SPEC 列表加载失败，请确认后端服务与数据库已启动')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await axios.post('/api/spec', formData, { headers: authHeaders() })
      setShowModal(false)
      setFormData({ title: '', description: '', specType: 'requirement' })
      fetchSpecs()
    } catch (err) {
      console.error('Failed to create spec:', err)
      alert(err.response?.data?.error || '创建 SPEC 失败')
    }
  }

  const getStatusBadgeClass = (status) => {
    const classes = {
      draft: 'badge-info',
      review: 'badge-warning',
      approved: 'badge-success',
      implemented: 'badge-success',
      archived: 'badge-danger'
    }
    return classes[status] || 'badge-info'
  }

  if (loading) {
    return <div className="loading-state">加载中...</div>
  }

  return (
    <div className="specs-container">
      <div className="header">
        <h1>SPEC 工程</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ 新建 SPEC</button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        {specs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-title">暂无 SPEC</div>
            <div className="empty-hint">点击“新建 SPEC”创建需求、设计、任务、契约、规则或标准类文档</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>标题</th>
                <th>类型</th>
                <th>状态</th>
                <th>优先级</th>
                <th>版本</th>
              </tr>
            </thead>
            <tbody>
              {specs.map(spec => (
                <tr key={spec._id}>
                  <td>{spec.title}</td>
                  <td><span className="badge badge-info">{SPEC_TYPE_LABELS[spec.specType] || spec.specType}</span></td>
                  <td><span className={`badge ${getStatusBadgeClass(spec.status)}`}>{STATUS_LABELS[spec.status] || spec.status}</span></td>
                  <td>{spec.metadata?.priority || '-'}</td>
                  <td>v{spec.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>新建 SPEC</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">标题</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">类型</label>
                <select
                  className="form-input"
                  value={formData.specType}
                  onChange={(e) => setFormData({ ...formData, specType: e.target.value })}
                >
                  {Object.entries(SPEC_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
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

export default Specs
