import { useState, useEffect } from 'react'
import axios from 'axios'
import './Workflows.css'

const STAGE_LABELS = {
  command: 'Command 入口',
  understanding: '场景理解',
  design: '方案设计',
  execution: '任务执行',
  verification: '结果验证',
  extension: 'Extension 构建'
}

function Workflows() {
  const [workflows, setWorkflows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ name: '', description: '', businessScenario: '' })
  const [executingId, setExecutingId] = useState(null)
  const [executionResults, setExecutionResults] = useState({})

  const authHeaders = () => {
    const token = localStorage.getItem('token')
    return token ? { Authorization: 'Bearer ' + token } : {}
  }

  useEffect(() => {
    fetchWorkflows()
  }, [])

  const fetchWorkflows = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await axios.get('/api/workflow', { headers: authHeaders() })
      setWorkflows(response.data)
    } catch (err) {
      console.error('Failed to fetch workflows:', err)
      setError('工作流列表加载失败，请确认后端服务与数据库已启动')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await axios.post('/api/workflow', formData, { headers: authHeaders() })
      setShowModal(false)
      setFormData({ name: '', description: '', businessScenario: '' })
      fetchWorkflows()
    } catch (err) {
      console.error('Failed to create workflow:', err)
      alert(err.response?.data?.error || '创建工作流失败')
    }
  }

  const handleExecute = async (workflowId) => {
    setExecutingId(workflowId)
    try {
      const response = await axios.post(`/api/workflow/${workflowId}/execute`, {}, { headers: authHeaders() })
      setExecutionResults((prev) => ({ ...prev, [workflowId]: response.data }))
      fetchWorkflows()
    } catch (err) {
      console.error('Failed to execute workflow:', err)
      alert(err.response?.data?.error || '执行工作流失败')
    } finally {
      setExecutingId(null)
    }
  }

  if (loading) {
    return <div className="loading-state">加载中...</div>
  }

  return (
    <div className="workflows-container">
      <div className="header">
        <h1>Harness 工作流</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + 新建工作流
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        {workflows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⚙️</div>
            <div className="empty-title">暂无工作流</div>
            <div className="empty-hint">点击右上角“新建工作流”，从业务场景出发编排场景理解 → 方案设计 → 任务执行 → 结果验证 → Extension 构建</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>名称</th>
                <th>状态</th>
                <th>业务场景</th>
                <th>最近执行结果</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map(workflow => {
                const lastResult = executionResults[workflow._id]
                return (
                  <tr key={workflow._id}>
                    <td>{workflow.name}</td>
                    <td><span className="badge badge-info">{workflow.status}</span></td>
                    <td>{workflow.businessScenario || '-'}</td>
                    <td>
                      {lastResult
                        ? `${lastResult.status}（执行ID: ${lastResult.executionId.slice(0, 8)}...）`
                        : '-'}
                    </td>
                    <td>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleExecute(workflow._id)}
                        disabled={executingId === workflow._id}
                      >
                        {executingId === workflow._id ? '执行中...' : '执行'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>新建工作流</h2>
            <form onSubmit={handleSubmit}>
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
                <label className="form-label">描述</label>
                <textarea
                  className="form-input"
                  rows="4"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">业务场景</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.businessScenario}
                  onChange={(e) => setFormData({ ...formData, businessScenario: e.target.value })}
                  placeholder="例如：客户工单自动分类与派单"
                />
              </div>
              <p className="form-hint">
                创建后可在阶段配置中补充 {Object.values(STAGE_LABELS).join(' / ')} 等阶段，并关联 Agent/Skill/MCP 资产。
              </p>
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

export default Workflows
