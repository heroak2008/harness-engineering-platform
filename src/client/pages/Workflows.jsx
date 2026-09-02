import { useState, useEffect } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import './Workflows.css'
import { authHeaders } from '../utils/auth'
import { buildCommandPreview, findUnboundNodes } from '../utils/commandPreview'

function Workflows() {
  const [workflows, setWorkflows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

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

  // 平台只负责设计，不执行任何工作流：这里展示发布后各 Command 在 Claude Code TUI 中的调用形态
  const handlePreview = async (workflowId) => {
    setPreviewLoading(true)
    try {
      const response = await axios.get(`/api/workflow/${workflowId}`, { headers: authHeaders() })
      setPreview(response.data)
    } catch (err) {
      console.error('Failed to load workflow preview:', err)
      alert(err.response?.data?.error || '加载预览失败')
    } finally {
      setPreviewLoading(false)
    }
  }

  if (loading) {
    return <div className="loading-state">加载中...</div>
  }

  return (
    <div className="workflows-container">
      <div className="header">
        <div>
          <h1>Harness 工作流</h1>
          <p className="page-description">集中查看各业务场景的 Workflow；流程设计请从业务场景进入。</p>
        </div>
        <Link className="btn btn-primary workflow-entry-link" to="/">
          前往场景设计
        </Link>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        {workflows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⚙️</div>
            <div className="empty-title">暂无工作流</div>
            <div className="empty-hint">点击右上角“前往场景设计”，在场景设计台中按向导完成 Workflow 规划 → Command 入口 → Skill / Agent 集成</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>名称</th>
                <th>状态</th>
                <th>所属业务场景</th>
                <th>Command 入口</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map(workflow => (
                <tr key={workflow._id}>
                  <td>{workflow.name}</td>
                  <td><span className="badge badge-info">{workflow.status}</span></td>
                  <td>{workflow.scenarioId?.name || workflow.businessScenario || '未关联场景'}</td>
                  <td>{workflow.commands?.length || 0} 个</td>
                  <td className="workflow-row-actions">
                    <Link
                      className="btn btn-secondary"
                      to={workflow.scenarioId?._id ? `/?scenario=${workflow.scenarioId._id}` : '/'}
                    >
                      设计
                    </Link>
                    <button
                      className="btn btn-primary"
                      onClick={() => handlePreview(workflow._id)}
                      disabled={previewLoading}
                    >
                      预览 CLI 调用
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {preview && (
        <div className="modal" onClick={() => setPreview(null)}>
          <div className="modal-content cli-preview-modal" onClick={event => event.stopPropagation()}>
            <h2>CLI 调用预览：{preview.name}</h2>
            <p className="cli-preview-hint">
              该 Workflow 发布为 Extension 后，以下 Command 可在 Claude Code TUI 中直接输入触发。
            </p>
            {findUnboundNodes(preview).length > 0 && (
              <div className="cli-preview-warning">
                ⚠️ {findUnboundNodes(preview).length} 个节点尚未绑定 Agent / Skill（{findUnboundNodes(preview).map(gap => gap.label).join('、')}），正文未包含其资产信息。
              </div>
            )}
            {preview.commands?.length === 0 ? (
              <div className="empty-hint">该 Workflow 尚未设计 Command 入口，请先在场景设计台第 3 步添加。</div>
            ) : (
              preview.commands.map(command => {
                const item = buildCommandPreview(preview, command)
                return (
                  <div className="cli-preview-command" key={command.id}>
                    <code className="cli-preview-invocation">{item.invocation}</code>
                    {item.customized && <span className="badge badge-warning">正文已自定义</span>}
                    <pre className="cli-preview-body">{item.markdown}</pre>
                  </div>
                )
              })
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setPreview(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Workflows
