import { useState, useEffect } from 'react'
import axios from 'axios'
import './Testing.css'
import { authHeaders } from '../utils/auth'

const TYPE_LABELS = {
  unit: '单元测试',
  integration: '集成测试',
  e2e: '端到端测试',
  performance: '性能测试',
  security: '安全测试',
  regression: '回归测试'
}

const STATUS_LABELS = {
  draft: '草稿',
  active: '启用',
  archived: '已归档'
}

function Testing() {
  const [testCases, setTestCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [executingId, setExecutingId] = useState(null)
  const [executionResults, setExecutionResults] = useState({})


  useEffect(() => {
    fetchTestCases()
  }, [])

  const fetchTestCases = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await axios.get('/api/testing', { headers: authHeaders() })
      setTestCases(response.data)
    } catch (err) {
      console.error('Failed to fetch test cases:', err)
      setError('测试集加载失败，请确认后端服务与数据库已启动')
    } finally {
      setLoading(false)
    }
  }

  const handleExecuteTest = async (testId) => {
    setExecutingId(testId)
    try {
      const response = await axios.post(`/api/testing/${testId}/execute`, {}, { headers: authHeaders() })
      setExecutionResults((prev) => ({ ...prev, [testId]: response.data }))
      fetchTestCases()
    } catch (err) {
      console.error('Failed to execute test:', err)
      alert(err.response?.data?.error || '执行测试失败')
    } finally {
      setExecutingId(null)
    }
  }

  if (loading) {
    return <div className="loading-state">加载中...</div>
  }

  return (
    <div className="testing-container">
      <div className="header">
        <h1>评测/质量工程</h1>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        {testCases.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <div className="empty-title">暂无测试集</div>
            <div className="empty-hint">通过 API 创建测试集（评测集/质量门禁）后，可在此执行并查看结果</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>名称</th>
                <th>类型</th>
                <th>状态</th>
                <th>历史执行次数</th>
                <th>最近执行结果</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {testCases.map(test => {
                const result = executionResults[test._id]
                return (
                  <tr key={test._id}>
                    <td>{test.name}</td>
                    <td><span className="badge badge-info">{TYPE_LABELS[test.testType] || test.testType}</span></td>
                    <td><span className="badge badge-success">{STATUS_LABELS[test.status] || test.status}</span></td>
                    <td>{test.executionRecords?.length || 0}</td>
                    <td>
                      {result
                        ? `${result.status === 'passed' ? '通过' : '失败'}（${result.passedCases}/${result.totalCases} 通过，质量分 ${result.qualityMetrics?.overallScore?.toFixed(1) ?? '-'}）`
                        : '-'}
                    </td>
                    <td>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleExecuteTest(test._id)}
                        disabled={executingId === test._id}
                      >
                        {executingId === test._id ? '执行中...' : '执行'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default Testing
