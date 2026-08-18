import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCruises } from '../api/client'

export default function CruiseList() {
  const [cruises, setCruises] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    getCruises()
      .then(setCruises)
      .catch(() => setError('Failed to load cruises. Is the server running?'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p>Loading cruises…</p>
  if (error) return <div className="error">{error}</div>

  return (
    <div>
      <h2 style={{ marginBottom: '1rem' }}>Available Cruises</h2>
      {cruises.map(cruise => (
        <div className="card" key={cruise._id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3>
                {cruise.cruiseLine} — {cruise.ship}
                {cruise.soldOut && <span className="badge-sold-out">SOLD OUT</span>}
              </h3>
              <p style={{ color: '#718096', marginTop: '0.25rem' }}>
                {cruise.destination} · {cruise.nights} nights
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#2b6cb0' }}>
                ${cruise.adultFare.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#718096' }}>per adult</div>
            </div>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: '#718096' }}>
              {cruise.soldOut ? 'No availability' : `${cruise.capacityLeft} place(s) remaining`}
            </span>
            <button
              className="btn-primary"
              disabled={cruise.soldOut}
              onClick={() => navigate(`/book/${cruise._id}`, { state: { cruise } })}
            >
              Book Now
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
