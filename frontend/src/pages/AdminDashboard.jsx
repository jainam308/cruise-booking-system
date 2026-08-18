import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getAdminMetrics,
  getAdminCruises,
  createAdminCruise,
  updateAdminCruise,
  deleteAdminCruise,
  getAdminPromos,
  createAdminPromo,
  deleteAdminPromo,
  getAdminBookings,
  updateTaxRateSetting
} from '../api/client'

const fmt = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function AdminDashboard() {
  const { user, role } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('cruises')
  const [metrics, setMetrics] = useState(null)
  const [cruises, setCruises] = useState([])
  const [promos, setPromos] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Modals & forms
  const [showAddCruise, setShowAddCruise] = useState(false)
  const [newCruise, setNewCruise] = useState({ cruiseLine: '', ship: '', destination: '', nights: 7, adultFare: 1200, capacityLeft: 10 })

  const [showAddPromo, setShowAddPromo] = useState(false)
  const [newPromo, setNewPromo] = useState({ code: '', type: 'percentage', value: 10, validFrom: '2026-06-01', validTo: '2026-12-31', maxTotalUses: 100, maxUsesPerCustomer: 1, minimumSpend: 1000 })

  const [taxRateInput, setTaxRateInput] = useState('0.12')
  const [selectedBookingSnapshot, setSelectedBookingSnapshot] = useState(null)

  const isOnlyAdmin = role === 'admin'

  useEffect(() => {
    if (role !== 'admin' && role !== 'agent') {
      navigate('/')
      return
    }
    loadAllData()
  }, [role])

  async function loadAllData() {
    setLoading(true)
    setError(null)
    try {
      const [m, b, c, p] = await Promise.all([
        getAdminMetrics(),
        getAdminBookings(),
        isOnlyAdmin ? getAdminCruises() : Promise.resolve([]),
        isOnlyAdmin ? getAdminPromos() : Promise.resolve([])
      ])
      setMetrics(m)
      setBookings(b)
      if (isOnlyAdmin) {
        setCruises(c)
        setPromos(p)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load management data.')
    } finally {
      setLoading(false)
    }
  }

  function flashSuccess(msg) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3500)
  }

  // Cruise Handlers
  async function handleCreateCruise(e) {
    e.preventDefault()
    try {
      await createAdminCruise(newCruise)
      setShowAddCruise(false)
      flashSuccess('New cruise added to catalog!')
      loadAllData()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create cruise.')
    }
  }

  async function handleQuickUpdateCruise(id, patch) {
    try {
      await updateAdminCruise(id, patch)
      flashSuccess('Cruise updated successfully.')
      loadAllData()
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed.')
    }
  }

  async function handleDeleteCruise(id) {
    if (!window.confirm('Are you sure you want to remove this cruise from the catalog?')) return
    try {
      await deleteAdminCruise(id)
      flashSuccess('Cruise removed.')
      loadAllData()
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed.')
    }
  }

  // Promo Handlers
  async function handleCreatePromo(e) {
    e.preventDefault()
    try {
      await createAdminPromo(newPromo)
      setShowAddPromo(false)
      flashSuccess(`Promo ${newPromo.code.toUpperCase()} created!`)
      loadAllData()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create promo.')
    }
  }

  async function handleDeletePromo(id) {
    if (!window.confirm('Delete this promotional code?')) return
    try {
      await deleteAdminPromo(id)
      flashSuccess('Promo code removed.')
      loadAllData()
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed.')
    }
  }

  // Tax Setting Handler
  async function handleUpdateTax(e) {
    e.preventDefault()
    try {
      await updateTaxRateSetting(taxRateInput)
      flashSuccess(`Tax rate updated to ${Number(taxRateInput) * 100}% dynamically!`)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update tax.')
    }
  }

  if (loading) return <p>Loading management interface…</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h2>⚙️ {role === 'admin' ? 'Odysseus Admin & Management Center' : 'Travel Agency Portal'}</h2>
          <p style={{ color: '#718096', fontSize: '0.85rem' }}>
            Logged in as: <strong>{user?.name}</strong> ({role.toUpperCase()})
          </p>
        </div>
        {isOnlyAdmin && (
          <form onSubmit={handleUpdateTax} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#edf2f7', padding: '0.4rem 0.8rem', borderRadius: '6px' }}>
            <label style={{ margin: 0, fontSize: '0.8rem' }}>Tax Rate:</label>
            <input
              type="number" step="0.01" min="0" max="1"
              value={taxRateInput} onChange={e => setTaxRateInput(e.target.value)}
              style={{ width: '70px', padding: '2px 4px', fontSize: '0.85rem' }}
            />
            <button type="submit" className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.8rem' }}>Update</button>
          </form>
        )}
      </div>

      {successMsg && <div style={{ background: '#f0fff4', color: '#276749', border: '1px solid #9ae6b4', padding: '0.6rem 1rem', borderRadius: '6px', marginBottom: '1rem' }}>✅ {successMsg}</div>}
      {error && <div className="error">{error}</div>}

      {/* Metrics Banner */}
      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: '#718096' }}>Total Revenue</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#2b6cb0' }}>{fmt(metrics.totalRevenue)}</div>
          </div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: '#718096' }}>Confirmed Bookings</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#2d3748' }}>{metrics.totalBookings}</div>
          </div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: '#718096' }}>Total Passengers</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#2d3748' }}>{metrics.totalPassengers}</div>
          </div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: '#718096' }}>Fleet Spots Left</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: metrics.totalFleetCapacityLeft <= 5 ? '#dd6b20' : '#38a169' }}>
              {metrics.totalFleetCapacityLeft}
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e2e8f0', marginBottom: '1.5rem' }}>
        {isOnlyAdmin && (
          <button
            onClick={() => setActiveTab('cruises')}
            style={{ padding: '0.6rem 1.2rem', background: activeTab === 'cruises' ? '#2b6cb0' : 'transparent', color: activeTab === 'cruises' ? 'white' : '#4a5568', borderRadius: '6px 6px 0 0', fontWeight: '600' }}
          >
            🚢 Cruises & Fares ({cruises.length})
          </button>
        )}
        {isOnlyAdmin && (
          <button
            onClick={() => setActiveTab('promos')}
            style={{ padding: '0.6rem 1.2rem', background: activeTab === 'promos' ? '#2b6cb0' : 'transparent', color: activeTab === 'promos' ? 'white' : '#4a5568', borderRadius: '6px 6px 0 0', fontWeight: '600' }}
          >
            🎟️ Promo Codes ({promos.length})
          </button>
        )}
        <button
          onClick={() => setActiveTab('bookings')}
          style={{ padding: '0.6rem 1.2rem', background: activeTab === 'bookings' ? '#2b6cb0' : 'transparent', color: activeTab === 'bookings' ? 'white' : '#4a5568', borderRadius: '6px 6px 0 0', fontWeight: '600' }}
        >
          📋 Bookings Audit Trail ({bookings.length})
        </button>
      </div>

      {/* ── TAB 1: CRUISES CRUD ─────────────────────────────────────────── */}
      {activeTab === 'cruises' && isOnlyAdmin && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>Fleet Catalog & Capacity Manager</h3>
            <button className="btn-primary" onClick={() => setShowAddCruise(true)}>+ Add New Cruise</button>
          </div>

          {showAddCruise && (
            <form onSubmit={handleCreateCruise} className="card" style={{ background: '#ebf8ff', border: '1px solid #bee3f8', marginBottom: '1rem' }}>
              <h4>Add New Cruise Route</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                <div>
                  <label>Cruise Line</label>
                  <input required value={newCruise.cruiseLine} onChange={e => setNewCruise({ ...newCruise, cruiseLine: e.target.value })} placeholder="e.g. Celebrity Cruises" />
                </div>
                <div>
                  <label>Ship Name</label>
                  <input required value={newCruise.ship} onChange={e => setNewCruise({ ...newCruise, ship: e.target.value })} placeholder="e.g. Celebrity Edge" />
                </div>
                <div>
                  <label>Destination</label>
                  <input required value={newCruise.destination} onChange={e => setNewCruise({ ...newCruise, destination: e.target.value })} placeholder="e.g. Hawaii" />
                </div>
                <div>
                  <label>Nights</label>
                  <input required type="number" min="1" value={newCruise.nights} onChange={e => setNewCruise({ ...newCruise, nights: Number(e.target.value) })} />
                </div>
                <div>
                  <label>Adult Fare ($)</label>
                  <input required type="number" min="1" value={newCruise.adultFare} onChange={e => setNewCruise({ ...newCruise, adultFare: Number(e.target.value) })} />
                </div>
                <div>
                  <label>Capacity Left</label>
                  <input required type="number" min="0" value={newCruise.capacityLeft} onChange={e => setNewCruise({ ...newCruise, capacityLeft: Number(e.target.value) })} />
                </div>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn-primary">Save Cruise</button>
                <button type="button" className="btn-secondary" onClick={() => setShowAddCruise(false)}>Cancel</button>
              </div>
            </form>
          )}

          <div className="card">
            <table className="breakdown-table" style={{ width: '100%' }}>
              <thead>
                <tr style={{ background: '#f7fafc', textAlign: 'left', fontSize: '0.85rem', color: '#4a5568' }}>
                  <th style={{ padding: '0.5rem' }}>Cruise / Ship</th>
                  <th>Destination</th>
                  <th>Nights</th>
                  <th>Adult Fare</th>
                  <th>Capacity Left</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cruises.map(c => (
                  <tr key={c._id}>
                    <td style={{ padding: '0.5rem' }}><strong>{c.cruiseLine}</strong><br /><span style={{ color: '#718096', fontSize: '0.8rem' }}>{c.ship}</span></td>
                    <td>{c.destination}</td>
                    <td>{c.nights} nights</td>
                    <td>
                      <input
                        type="number"
                        defaultValue={c.adultFare}
                        onBlur={e => handleQuickUpdateCruise(c._id, { adultFare: Number(e.target.value) })}
                        style={{ width: '85px', padding: '2px 4px' }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        defaultValue={c.capacityLeft}
                        onBlur={e => handleQuickUpdateCruise(c._id, { capacityLeft: Number(e.target.value) })}
                        style={{ width: '65px', padding: '2px 4px' }}
                      />
                    </td>
                    <td style={{ textAlign: 'right', padding: '0.5rem' }}>
                      <button onClick={() => handleDeleteCruise(c._id)} style={{ background: '#fff5f5', color: '#c53030', border: '1px solid #feb2b2', padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: PROMOS CRUD ──────────────────────────────────────────── */}
      {activeTab === 'promos' && isOnlyAdmin && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>Promotions & Discount Codes</h3>
            <button className="btn-primary" onClick={() => setShowAddPromo(true)}>+ Create Promo Code</button>
          </div>

          {showAddPromo && (
            <form onSubmit={handleCreatePromo} className="card" style={{ background: '#ebf8ff', border: '1px solid #bee3f8', marginBottom: '1rem' }}>
              <h4>Create Promotional Campaign</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                <div>
                  <label>Promo Code (Uppercase)</label>
                  <input required value={newPromo.code} onChange={e => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })} placeholder="e.g. AUTUMN20" />
                </div>
                <div>
                  <label>Type</label>
                  <select value={newPromo.type} onChange={e => setNewPromo({ ...newPromo, type: e.target.value })}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Dollar ($)</option>
                  </select>
                </div>
                <div>
                  <label>Discount Value</label>
                  <input required type="number" min="1" value={newPromo.value} onChange={e => setNewPromo({ ...newPromo, value: Number(e.target.value) })} />
                </div>
                <div>
                  <label>Min Spend ($)</label>
                  <input required type="number" min="0" value={newPromo.minimumSpend} onChange={e => setNewPromo({ ...newPromo, minimumSpend: Number(e.target.value) })} />
                </div>
                <div>
                  <label>Valid From</label>
                  <input required type="date" value={newPromo.validFrom} onChange={e => setNewPromo({ ...newPromo, validFrom: e.target.value })} />
                </div>
                <div>
                  <label>Valid To</label>
                  <input required type="date" value={newPromo.validTo} onChange={e => setNewPromo({ ...newPromo, validTo: e.target.value })} />
                </div>
                <div>
                  <label>Max Total Uses</label>
                  <input required type="number" min="1" value={newPromo.maxTotalUses} onChange={e => setNewPromo({ ...newPromo, maxTotalUses: Number(e.target.value) })} />
                </div>
                <div>
                  <label>Max Per Customer</label>
                  <input required type="number" min="1" value={newPromo.maxUsesPerCustomer} onChange={e => setNewPromo({ ...newPromo, maxUsesPerCustomer: Number(e.target.value) })} />
                </div>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn-primary">Save Promo Code</button>
                <button type="button" className="btn-secondary" onClick={() => setShowAddPromo(false)}>Cancel</button>
              </div>
            </form>
          )}

          <div className="card">
            <table className="breakdown-table" style={{ width: '100%' }}>
              <thead>
                <tr style={{ background: '#f7fafc', textAlign: 'left', fontSize: '0.85rem', color: '#4a5568' }}>
                  <th style={{ padding: '0.5rem' }}>Code</th>
                  <th>Type & Value</th>
                  <th>Valid Window</th>
                  <th>Min Spend</th>
                  <th>Burn Rate (Used / Max)</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {promos.map(p => (
                  <tr key={p._id}>
                    <td style={{ padding: '0.5rem' }}><strong style={{ color: '#2b6cb0' }}>{p.code}</strong></td>
                    <td>{p.type === 'percentage' ? `${p.value}% Off` : `$${p.value} Flat Off`}</td>
                    <td style={{ fontSize: '0.8rem', color: '#718096' }}>
                      {new Date(p.validFrom).toLocaleDateString()} – {new Date(p.validTo).toLocaleDateString()}
                    </td>
                    <td>{p.minimumSpend > 0 ? fmt(p.minimumSpend) : 'None'}</td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>
                        {p.currentTotalUses} / {p.maxTotalUses} ({Math.round((p.currentTotalUses / p.maxTotalUses) * 100)}%)
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', padding: '0.5rem' }}>
                      <button onClick={() => handleDeletePromo(p._id)} style={{ background: '#fff5f5', color: '#c53030', border: '1px solid #feb2b2', padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: BOOKINGS AUDIT TRAIL ─────────────────────────────────── */}
      {activeTab === 'bookings' && (
        <div>
          <h3>Confirmed Bookings & Snapshot Audit Trail</h3>
          <p style={{ color: '#718096', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Every confirmed order stores a complete immutable pricing snapshot.
          </p>

          <div className="card">
            {bookings.length === 0 ? (
              <p style={{ color: '#718096' }}>No bookings found in database yet.</p>
            ) : (
              <table className="breakdown-table" style={{ width: '100%' }}>
                <thead>
                  <tr style={{ background: '#f7fafc', textAlign: 'left', fontSize: '0.85rem', color: '#4a5568' }}>
                    <th style={{ padding: '0.5rem' }}>Ref #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Cruise Snapshot</th>
                    <th>Passengers</th>
                    <th>Grand Total</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem' }}>Inspection</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b._id}>
                      <td style={{ padding: '0.5rem' }}><strong style={{ color: '#2b6cb0' }}>{b.bookingReference}</strong></td>
                      <td style={{ fontSize: '0.8rem' }}>{new Date(b.createdAt).toLocaleDateString()}</td>
                      <td>{b.customerName}<br /><span style={{ fontSize: '0.75rem', color: '#718096' }}>{b.customerEmail}</span></td>
                      <td>{b.cruiseNameSnapshot}</td>
                      <td>{b.passengers.length} pax</td>
                      <td><strong>{fmt(b.grandTotal)}</strong></td>
                      <td style={{ textAlign: 'right', padding: '0.5rem' }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '2px 8px', fontSize: '0.8rem' }}
                          onClick={() => setSelectedBookingSnapshot(b)}
                        >
                          View Snapshot
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Detail Modal for Snapshot Inspection */}
      {selectedBookingSnapshot && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #edf2f7', paddingBottom: '0.5rem' }}>
              <h3>Snapshot: {selectedBookingSnapshot.bookingReference}</h3>
              <button className="btn-secondary" onClick={() => setSelectedBookingSnapshot(null)}>✕ Close</button>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <p><strong>Customer:</strong> {selectedBookingSnapshot.customerName} ({selectedBookingSnapshot.customerEmail})</p>
              <p><strong>Cruise:</strong> {selectedBookingSnapshot.cruiseNameSnapshot} ({selectedBookingSnapshot.nightsSnapshot} nights)</p>
              <p><strong>Adult Fare at Booking:</strong> {fmt(selectedBookingSnapshot.adultFareSnapshot)}</p>

              <h4 style={{ marginTop: '1rem' }}>Passenger Multipliers & Computed Fares:</h4>
              <table className="breakdown-table">
                <tbody>
                  {selectedBookingSnapshot.passengers.map((p, i) => (
                    <tr key={i}>
                      <td>{p.type === 'adult' ? `Adult ${i + 1}` : `Child (age ${p.age})`} (×{p.fareMultiplier})</td>
                      <td>{fmt(p.computedFare)}</td>
                    </tr>
                  ))}
                  <tr><td>Cruise Fare Subtotal</td><td>{fmt(selectedBookingSnapshot.cruiseFareSubtotal)}</td></tr>
                  {selectedBookingSnapshot.groupDiscountPercentApplied > 0 && (
                    <tr><td>Group Discount ({selectedBookingSnapshot.groupDiscountPercentApplied}%)</td><td>−{fmt(selectedBookingSnapshot.groupDiscountAmount)}</td></tr>
                  )}
                  {selectedBookingSnapshot.promoCodeSnapshot && (
                    <tr><td>Promo Code ({selectedBookingSnapshot.promoCodeSnapshot.code})</td><td style={{ color: '#38a169' }}>−{fmt(selectedBookingSnapshot.promoDiscount)}</td></tr>
                  )}
                  <tr><td>Tax Rate Applied ({selectedBookingSnapshot.taxRateApplied * 100}%)</td><td>{fmt(selectedBookingSnapshot.taxAmount)}</td></tr>
                  <tr className="total-row"><td>Grand Total Charged</td><td>{fmt(selectedBookingSnapshot.grandTotal)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
