import { Routes, Route } from 'react-router-dom'
import CruiseList from './pages/CruiseList'
import BookingForm from './pages/BookingForm'
import Confirmation from './pages/Confirmation'

export default function App() {
  return (
    <>
      <header>
        <h1>⚓ Odysseus Cruise Holidays</h1>
      </header>
      <div className="container">
        <Routes>
          <Route path="/" element={<CruiseList />} />
          <Route path="/book/:cruiseId" element={<BookingForm />} />
          <Route path="/confirmation" element={<Confirmation />} />
        </Routes>
      </div>
    </>
  )
}
