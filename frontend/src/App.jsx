import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Header from './components/Header'
import CruiseList from './pages/CruiseList'
import BookingForm from './pages/BookingForm'
import Confirmation from './pages/Confirmation'
import AdminDashboard from './pages/AdminDashboard'
import MyBookings from './pages/MyBookings'

export default function App() {
  return (
    <AuthProvider>
      <Header />
      <div className="container">
        <Routes>
          <Route path="/" element={<CruiseList />} />
          <Route path="/book/:cruiseId" element={<BookingForm />} />
          <Route path="/confirmation" element={<Confirmation />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/my-bookings" element={<MyBookings />} />
        </Routes>
      </div>
    </AuthProvider>
  )
}
