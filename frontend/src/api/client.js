import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Attach JWT token from localStorage if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('odysseus_token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// Public Endpoints
export const getCruises = () => api.get('/cruises').then(r => r.data)
export const getCruiseById = (id) => api.get(`/cruises/${id}`).then(r => r.data)
export const getQuote = (payload) => api.post('/bookings/quote', payload).then(r => r.data)
export const confirmBooking = (payload) => api.post('/bookings/confirm', payload).then(r => r.data)

// Auth Endpoints
export const loginApi = (email, password) => api.post('/auth/login', { email, password }).then(r => r.data)
export const registerApi = (data) => api.post('/auth/register', data).then(r => r.data)
export const getMeApi = () => api.get('/auth/me').then(r => r.data)
export const getRolesApi = () => api.get('/auth/roles').then(r => r.data)

// Admin Endpoints
export const getAdminMetrics = () => api.get('/admin/metrics').then(r => r.data)
export const getAdminCruises = () => api.get('/admin/cruises').then(r => r.data)
export const createAdminCruise = (data) => api.post('/admin/cruises', data).then(r => r.data)
export const updateAdminCruise = (id, data) => api.put(`/admin/cruises/${id}`, data).then(r => r.data)
export const deleteAdminCruise = (id) => api.delete(`/admin/cruises/${id}`).then(r => r.data)

export const getAdminPromos = () => api.get('/admin/promos').then(r => r.data)
export const createAdminPromo = (data) => api.post('/admin/promos', data).then(r => r.data)
export const updateAdminPromo = (id, data) => api.put(`/admin/promos/${id}`, data).then(r => r.data)
export const deleteAdminPromo = (id) => api.delete(`/admin/promos/${id}`).then(r => r.data)

export const getAdminBookings = () => api.get('/admin/bookings').then(r => r.data)
export const updateTaxRateSetting = (taxRate) => api.put('/admin/settings/tax', { taxRate }).then(r => r.data)

export default api
