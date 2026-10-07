import { Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home.jsx'
import AdminLogin from './pages/admin/AdminLogin.jsx'
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import Legal from './pages/Legal.jsx'
import { LEGAL_LIST } from './legal.js'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      {LEGAL_LIST.map((p) => (
        <Route key={p.path} path={p.path} element={<Legal page={p} />} />
      ))}
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      {/* /landing is another address for the website */}
      <Route path="/landing" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
