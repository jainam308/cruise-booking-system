import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAdminBookings } from '../api/client'

const fmt = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function MyBookings() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/')
      return
    }

    getAdminBookings()
      .then(all => {
        // Filter by user email if customer, or show all if agent/admin
        const relevant = user.role === 'customer'
          ? all.filter(b => b.customerEmail.toLowerCase() === user.email.toLowerCase())
          : all
        setBookings(relevant)
      })
      .catch(() => setBookings([]))
      .finally(() => setLoading(false))
  }, [user, isAuthenticated])

  if (loading) return <p>Loading your bookings…</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>My Cruise Bookings</h2>
        <button className="btn-primary" onClick={() => navigate('/')}>+ Book Another Cruise</button>
      </div>

      {bookings.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#718096' }}>No bookings found for <strong>{user?.email}</strong>.</p>
          <button className="btn-primary" onClick={() => navigate('/')} style={{ marginTop: '1rem' }}>Browse Available Cruises</button>
        </div>
      ) : (
        bookings.map(b => (
          <div className="card" key={b._id} style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', background: '#ebf8ff', color: '#2b6cb0', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                  REF: {b.bookingReference}
                </span>
                <h3 style={{ marginTop: '0.5rem' }}>{b.cruiseNameSnapshot}</h3>
                <p style={{ color: '#718096', fontSize: '0.85rem' }}>
                  {b.destinationSnapshot} · {b.nightsSnapshot} nights · Booked on {new Date(b.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#2b6cb0' }}>{fmt(b.grandTotal)}</div>
                <div style={{ fontSize: '0.75rem', color: '#718096' }}>{b.passengers.length} passenger(s)</div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
