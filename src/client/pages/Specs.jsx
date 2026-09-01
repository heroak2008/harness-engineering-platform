import { useState, useEffect } from 'react'
import axios from 'axios'
import './Specs.css'

function Specs() {
  const [specs, setSpecs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSpecs()
  }, [])

  const fetchSpecs = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get('/api/spec', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setSpecs(response.data)
    } catch (error) {
      console.error('Failed to fetch specs:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading...</div>

  const getStatusBadgeClass = (status) => {
    const classes = {
      'draft': 'badge-info',
      'review': 'badge-warning',
      'approved': 'badge-success',
      'implemented': 'badge-success',
      'archived': 'badge-danger'
    }
    return classes[status] || 'badge-info'
  }

  return (
    <div className="specs-container">
      <div className="header">
        <h1>SPEC Engineering</h1>
        <button className="btn btn-primary">+ Create Spec</button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Version</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {specs.map(spec => (
              <tr key={spec._id}>
                <td>{spec.title}</td>
                <td><span className="badge badge-info">{spec.specType}</span></td>
                <td><span className={`badge ${getStatusBadgeClass(spec.status)}`}>{spec.status}</span></td>
                <td>{spec.metadata?.priority}</td>
                <td>v{spec.version}</td>
                <td>
                  <button className="btn btn-secondary">Edit</button>
                  <button className="btn btn-primary">Review</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Specs