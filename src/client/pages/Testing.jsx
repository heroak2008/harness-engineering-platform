import { useState, useEffect } from 'react'
import axios from 'axios'
import './Testing.css'

function Testing() {
  const [testCases, setTestCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    fetchTestCases()
  }, [])

  const fetchTestCases = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get('/api/testing', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setTestCases(response.data)
    } catch (error) {
      console.error('Failed to fetch test cases:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExecuteTest = async (testId) => {
    setExecuting(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(`/api/testing/${testId}/execute`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchTestCases()
    } catch (error) {
      console.error('Failed to execute test:', error)
    } finally {
      setExecuting(false)
    }
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="testing-container">
      <div className="header">
        <h1>Quality & Testing</h1>
        <button className="btn btn-primary">+ Create Test Case</button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Executions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {testCases.map(test => (
              <tr key={test._id}>
                <td>{test.name}</td>
                <td><span className="badge badge-info">{test.testType}</span></td>
                <td><span className="badge badge-success">{test.status}</span></td>
                <td>{test.executionRecords?.length || 0}</td>
                <td>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleExecuteTest(test._id)}
                    disabled={executing}
                  >
                    Execute
                  </button>
                  <button className="btn btn-secondary">Report</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Testing