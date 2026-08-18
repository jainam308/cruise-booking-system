import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const getCruises = () => api.get('/cruises').then(r => r.data)

export const getQuote = (payload) => api.post('/bookings/quote', payload).then(r => r.data)

export const confirmBooking = (payload) => api.post('/bookings/confirm', payload).then(r => r.data)

export default api
