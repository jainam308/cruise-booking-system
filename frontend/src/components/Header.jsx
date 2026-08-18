import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Header() {
  const { user, role, quickSwitchRole, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <header style={{ background: '#1a365d', color: 'white', padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>
            <h1 style={{ fontSize: '1.4rem', margin: 0 }}>⚓ Odysseus Cruise Holidays</h1>
          </Link>
          <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Luxury Holidays & Booking System</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to="/" style={{ color: 'white', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500' }}>
            Explore Cruises
          </Link>

          {(role === 'admin' || role === 'agent') && (
            <Link to="/admin" style={{ color: '#fed7d7', background: '#9b2c2c', padding: '0.3rem 0.8rem', borderRadius: '4px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 'bold' }}>
              ⚙️ {role === 'admin' ? 'Admin Panel' : 'Agent Dashboard'}
            </Link>
          )}

          {user && (
            <Link to="/my-bookings" style={{ color: 'white', textDecoration: 'none', fontSize: '0.9rem' }}>
              My Bookings
            </Link>
          )}

          {/* Quick Role Switcher for Evaluation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#2c5282', padding: '0.3rem 0.6rem', borderRadius: '6px' }}>
            <label style={{ fontSize: '0.75rem', margin: 0, color: '#e2e8f0', whiteSpace: 'nowrap' }}>
              Role:
            </label>
            <select
              value={user ? user.role : ''}
              onChange={(e) => quickSwitchRole(e.target.value)}
              style={{ padding: '2px 6px', fontSize: '0.8rem', background: 'white', color: '#1a202c', border: 'none', borderRadius: '4px', cursor: 'pointer', width: 'auto' }}
            >
              <option value="">Guest (Public)</option>
              <option value="customer">Customer (David)</option>
              <option value="agent">Agent (Elena)</option>
              <option value="admin">Admin (Full Access)</option>
            </select>
          </div>

          {user && (
            <button
              onClick={() => { logout(); navigate('/'); }}
              style={{ background: 'transparent', border: '1px solid #a0aec0', color: 'white', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
