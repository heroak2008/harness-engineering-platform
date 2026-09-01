import { useState, useEffect } from 'react'
import axios from 'axios'
import './Workflows.css'

function Workflows() {
  const [workflows, setWorkflows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ name: '', description: '', businessScenario: '' })

  useEffect(() => {
    fetchWorkflows()
  }, [])

  const fetchWorkflows = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get('/api/workflow', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setWorkflows(response.data)
    } catch (error) {
      console.error('Failed to fetch workflows:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      await axios.post('/api/workflow', formData, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setShowModal(false)
      setFormData({ name: '', description: '', businessScenario: '' })
      fetchWorkflows()
    } catch (error) {
      console.error('Failed to create workflow:', error)
    }
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="workflows-container">
      <div className="header">
        <h1>Workflows</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Create Workflow
        </button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Business Scenario</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {workflows.map(workflow => (
              <tr key={workflow._id}>
                <td>{workflow.name}</td>
                <td><span className="badge badge-info">{workflow.status}</span></td>
                <td>{workflow.businessScenario}</td>
                <td>
                  <button className="btn btn-secondary">Edit</button>
                  <button className="btn btn-primary">Execute</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create Workflow</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  rows="4"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Business Scenario</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.businessScenario}
                  onChange={(e) => setFormData({ ...formData, businessScenario: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Create</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Workflows