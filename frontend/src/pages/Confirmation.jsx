import { useLocation, useNavigate } from 'react-router-dom'

const fmt = (n) => `$${Number(n).toFixed(2)}`

export default function Confirmation() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const c = state?.confirmation

  if (!c) {
    return (
      <div className="error">
        No booking found. <button className="btn-secondary" onClick={() => navigate('/')}>Go home</button>
      </div>
    )
  }

  return (
    <div>
      <div className="card success-box">
        <div style={{ fontSize: '3rem' }}>✅</div>
        <h2 style={{ marginTop: '1rem' }}>Booking Confirmed!</h2>
        <p>Your booking reference is:</p>
        <div className="booking-ref">{c.bookingReference}</div>
        <p>Please quote this reference for any enquiries.</p>
        <p style={{ marginTop: '1rem', fontSize: '1.1rem' }}>
          <strong>Total Charged: {fmt(c.grandTotal)}</strong>
        </p>
      </div>

      {/* Summary breakdown */}
      <div className="card">
        <h3>Booking Summary</h3>
        <table className="breakdown-table">
          <tbody>
            {c.breakdown.passengers.map((p, i) => (
              <tr key={i}>
                <td>{p.type === 'adult' ? `Adult ${i + 1}` : `Child (age ${p.age})`}</td>
                <td>{fmt(p.computedFare)}</td>
              </tr>
            ))}
            <tr><td>Cruise Fare Subtotal</td><td>{fmt(c.breakdown.cruiseFareSubtotal)}</td></tr>
            {c.breakdown.groupDiscountPercent > 0 && (
              <tr>
                <td>Group Discount ({c.breakdown.groupDiscountPercent}%)</td>
                <td>−{fmt(c.breakdown.groupDiscountAmount)}</td>
              </tr>
            )}
            {c.breakdown.extras.map(ex => (
              <tr key={ex.key}>
                <td>{ex.label}</td>
                <td>{fmt(ex.totalCost)}</td>
              </tr>
            ))}
            <tr><td>Pre-Tax Subtotal</td><td>{fmt(c.breakdown.preTaxSubtotal)}</td></tr>
            {c.breakdown.promoApplied && (
              <tr>
                <td>Promo ({c.breakdown.promoApplied.code})</td>
                <td style={{ color: '#38a169' }}>−{fmt(c.breakdown.promoApplied.discountAmount)}</td>
              </tr>
            )}
            <tr><td>Tax ({c.breakdown.taxRatePercent}%)</td><td>{fmt(c.breakdown.taxAmount)}</td></tr>
            <tr className="total-row">
              <td>Grand Total</td>
              <td>{fmt(c.breakdown.grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <button className="btn-primary" onClick={() => navigate('/')} style={{ width: '100%', padding: '0.8rem', marginTop: '1rem' }}>
        Book Another Cruise
      </button>
    </div>
  )
}
