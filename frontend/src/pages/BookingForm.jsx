import { useEffect, useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { getQuote, confirmBooking, getCruiseById } from '../api/client'

const fmt = (n) => `$${Number(n).toFixed(2)}`

const EXTRAS = [
  { key: 'insurance', label: 'Travel Insurance ($80/person)' },
  { key: 'wifi',      label: 'Wi-Fi ($15/person/night)' },
  { key: 'excursion', label: 'Shore Excursion ($120/person)' },
]

export default function BookingForm() {
  const { cruiseId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const [cruise, setCruise] = useState(state?.cruise || null)

  const [adultCount, setAdultCount]       = useState(1)
  const [children, setChildren]           = useState([])       // [{age}]
  const [selectedExtras, setSelectedExtras] = useState([])
  const [promoCode, setPromoCode]         = useState('')
  const [customerName, setCustomerName]   = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [quote, setQuote]                 = useState(null)
  const [error, setError]                 = useState(null)
  const [loading, setLoading]             = useState(false)
  const [confirming, setConfirming]       = useState(false)

  // Fetch or refresh cruise to guarantee accurate capacity
  useEffect(() => {
    if (cruiseId) {
      getCruiseById(cruiseId)
        .then(setCruise)
        .catch(() => {
          if (!cruise) setError('Failed to load cruise details.')
        })
    }
  }, [cruiseId])

  const totalPassengers = adultCount + children.length
  const isOverCapacity = cruise && totalPassengers > cruise.capacityLeft

  function buildPassengers() {
    const adults = Array.from({ length: adultCount }, () => ({ type: 'adult' }))
    const kids   = children.map(c => ({ type: 'child', age: Number(c.age) }))
    return [...adults, ...kids]
  }

  function addChild() {
    if (totalPassengers >= 6) return
    setChildren(prev => [...prev, { age: '' }])
    setQuote(null)
  }

  function removeChild(i) {
    setChildren(prev => prev.filter((_, idx) => idx !== i))
    setQuote(null)
  }

  function updateChildAge(i, age) {
    setChildren(prev => prev.map((c, idx) => idx === i ? { age } : c))
    setQuote(null)
  }

  function toggleExtra(key) {
    setSelectedExtras(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
    setQuote(null)
  }

  function validateForm() {
    if (totalPassengers < 1) return 'At least one passenger is required.'
    if (totalPassengers > 6) return 'A booking cannot have more than 6 passengers.'
    if (adultCount < 1) return 'At least 1 adult is required per booking.'
    
    for (let i = 0; i < children.length; i++) {
      const ageVal = children[i].age
      if (ageVal === '' || ageVal === undefined || ageVal === null) {
        return `Please enter an age for Child ${i + 1}.`
      }
      const ageNum = Number(ageVal)
      if (isNaN(ageNum) || !Number.isInteger(ageNum) || ageNum < 1 || ageNum > 17) {
        return ageNum >= 18
          ? `Child ${i + 1} is aged 18+ and must be booked as an Adult.`
          : `Child ${i + 1} age must be an integer between 1 and 17 (age 0 is not permitted).`
      }
    }

    if (cruise && totalPassengers > cruise.capacityLeft) {
      return `Not enough capacity: You selected ${totalPassengers} passenger(s), but only ${cruise.capacityLeft} spot(s) are left.`
    }

    return null
  }

  async function handleGetQuote() {
    const clientErr = validateForm()
    if (clientErr) {
      setError(clientErr)
      return
    }
    setError(null)
    setLoading(true)
    try {
      const data = await getQuote({
        cruiseId,
        passengers: buildPassengers(),
        selectedExtras,
        promoCode: promoCode.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
      })
      setQuote(data.breakdown)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to get quote.')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!customerName.trim()) {
      setError('Customer full name is required.')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!customerEmail.trim() || !emailRegex.test(customerEmail.trim())) {
      setError('Please provide a valid email address.')
      return
    }

    const clientErr = validateForm()
    if (clientErr) {
      setError(clientErr)
      return
    }

    setError(null)
    setConfirming(true)
    try {
      const data = await confirmBooking({
        cruiseId,
        passengers: buildPassengers(),
        selectedExtras,
        promoCode: promoCode.trim() || undefined,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
      })
      navigate('/confirmation', { state: { confirmation: data } })
    } catch (e) {
      setError(e.response?.data?.error || 'Booking failed. Please try again.')
      setQuote(null)
    } finally {
      setConfirming(false)
    }
  }

  if (!cruise) return <div className="error">Loading cruise information…</div>

  return (
    <div>
      <button className="btn-secondary" onClick={() => navigate('/')} style={{ marginBottom: '1rem' }}>
        ← Back to cruises
      </button>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2>{cruise.cruiseLine} — {cruise.ship}</h2>
            <p style={{ color: '#718096', marginTop: '0.25rem' }}>
              📍 {cruise.destination} · 🌙 {cruise.nights} nights · 💵 ${cruise.adultFare.toLocaleString()}/adult
            </p>
          </div>
          <div>
            {cruise.soldOut ? (
              <span className="badge-sold-out">Sold Out (0 spots left)</span>
            ) : cruise.capacityLeft <= 4 ? (
              <span className="badge-capacity-low">⚠️ Only {cruise.capacityLeft} spot(s) remaining!</span>
            ) : (
              <span className="badge-capacity-good">✅ {cruise.capacityLeft} spot(s) available</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Passengers ──────────────────────────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Passengers</h3>
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isOverCapacity ? '#e53e3e' : '#4a5568' }}>
            Total: {totalPassengers} / 6 pax
          </span>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#718096', marginTop: '0.25rem' }}>
          Min 1 adult · Max 6 total passengers · Child age must be 1–17
        </p>

        {isOverCapacity && (
          <div className="error" style={{ marginTop: '0.5rem' }}>
            ⚠️ Capacity exceeded: {totalPassengers} passengers selected, but this cruise only has {cruise.capacityLeft} spot(s) left.
          </div>
        )}

        <label>Adults (18+)</label>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
          <button className="btn-secondary" onClick={() => { setAdultCount(a => Math.max(1, a - 1)); setQuote(null) }}>−</button>
          <span style={{ minWidth: '2rem', textAlign: 'center', fontWeight: 'bold' }}>{adultCount}</span>
          <button className="btn-secondary" onClick={() => { if (totalPassengers < 6) { setAdultCount(a => a + 1); setQuote(null) } }}>+</button>
        </div>

        <label style={{ marginTop: '1rem' }}>Children (ages 1–17 only)</label>
        {children.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#4a5568', minWidth: '60px' }}>Child {i + 1}:</span>
            <input
              type="number"
              min="1"
              max="17"
              step="1"
              placeholder="Age (1-17)"
              value={c.age}
              onChange={e => updateChildAge(i, e.target.value)}
              style={{ width: '120px' }}
            />
            <button className="btn-secondary" onClick={() => removeChild(i)}>Remove</button>
          </div>
        ))}
        {totalPassengers < 6 && (
          <button className="btn-secondary" onClick={addChild} style={{ marginTop: '0.5rem' }}>
            + Add child
          </button>
        )}
        {totalPassengers >= 6 && (
          <p style={{ fontSize: '0.8rem', color: '#e53e3e', marginTop: '0.5rem' }}>Maximum 6 passengers reached.</p>
        )}
      </div>

      {/* ── Extras ──────────────────────────────────────────────────────── */}
      <div className="card">
        <h3>Optional Extras</h3>
        {EXTRAS.map(ex => (
          <label key={ex.key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', marginTop: '0.5rem' }}>
            <input
              type="checkbox"
              style={{ width: 'auto' }}
              checked={selectedExtras.includes(ex.key)}
              onChange={() => toggleExtra(ex.key)}
            />
            {ex.label}
          </label>
        ))}
      </div>

      {/* ── Promo code ──────────────────────────────────────────────────── */}
      <div className="card">
        <h3>Promo Code</h3>
        <input
          type="text" placeholder="e.g. SUMMER10" style={{ marginTop: '0.5rem' }}
          value={promoCode}
          onChange={e => { setPromoCode(e.target.value); setQuote(null) }}
        />
      </div>

      {/* ── Customer info ───────────────────────────────────────────────── */}
      <div className="card">
        <h3>Your Details</h3>
        <label>Full Name *</label>
        <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} />
        <label>Email *</label>
        <input type="email" value={customerEmail} onChange={e => { setCustomerEmail(e.target.value); setQuote(null) }} />
        <label>Phone (optional)</label>
        <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
      </div>

      {error && <div className="error">{error}</div>}

      {/* ── Quote button ────────────────────────────────────────────────── */}
      {!quote && (
        <button className="btn-primary" onClick={handleGetQuote} disabled={loading} style={{ width: '100%', padding: '0.8rem' }}>
          {loading ? 'Calculating…' : 'Get Price Breakdown'}
        </button>
      )}

      {/* ── Breakdown ───────────────────────────────────────────────────── */}
      {quote && (
        <div className="card">
          <h3>Price Breakdown</h3>
          <table className="breakdown-table">
            <tbody>
              {/* Passengers */}
              {quote.passengers.map((p, i) => (
                <tr key={i}>
                  <td>{p.type === 'adult' ? `Adult ${i + 1}` : `Child (age ${p.age})`}</td>
                  <td>{fmt(p.computedFare)}</td>
                </tr>
              ))}
              <tr><td>Cruise Fare Subtotal</td><td>{fmt(quote.cruiseFareSubtotal)}</td></tr>

              {/* Group discount */}
              {quote.groupDiscountPercent > 0 && (
                <tr>
                  <td>Group Discount ({quote.groupDiscountPercent}%)</td>
                  <td>−{fmt(quote.groupDiscountAmount)}</td>
                </tr>
              )}
              <tr><td><strong>Discounted Cruise Fare</strong></td><td><strong>{fmt(quote.discountedCruiseFare)}</strong></td></tr>

              {/* Extras */}
              {quote.extras.map(ex => (
                <tr key={ex.key}>
                  <td>{ex.label} ({ex.passengerCount} pax{ex.perNight ? ` × ${ex.nights} nights` : ''})</td>
                  <td>{fmt(ex.totalCost)}</td>
                </tr>
              ))}
              {quote.optionalServicesTotal > 0 && (
                <tr><td>Optional Services Total</td><td>{fmt(quote.optionalServicesTotal)}</td></tr>
              )}

              {/* Pre-tax */}
              <tr><td><strong>Pre-Tax Subtotal</strong></td><td><strong>{fmt(quote.preTaxSubtotal)}</strong></td></tr>

              {/* Promo */}
              {quote.promoApplied && (
                <tr>
                  <td>Promo ({quote.promoApplied.code})</td>
                  <td style={{ color: '#38a169' }}>−{fmt(quote.promoApplied.discountAmount)}</td>
                </tr>
              )}

              {/* Tax */}
              <tr><td>Tax ({quote.taxRatePercent}%)</td><td>{fmt(quote.taxAmount)}</td></tr>

              {/* Total */}
              <tr className="total-row">
                <td>Grand Total</td>
                <td>{fmt(quote.grandTotal)}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button className="btn-secondary" onClick={() => setQuote(null)} style={{ flex: 1 }}>
              Edit
            </button>
            <button className="btn-primary" onClick={handleConfirm} disabled={confirming} style={{ flex: 2, padding: '0.8rem' }}>
              {confirming ? 'Confirming…' : `Confirm & Pay ${fmt(quote.grandTotal)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
