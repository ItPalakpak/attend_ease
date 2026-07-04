import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Fingerprint, Lock, User, AlertCircle, Loader2, X, Eye } from 'lucide-react'
import logoIcon from '../assets/icon.png'

// CHANGED: added custom SVG component for a closed eye icon (no slash) per requirements
function ClosedEyeIcon({ size = 18, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2 10a12.14 12.14 0 0 0 20 0" />
      <path d="M5 14l-1.5 2.5" />
      <path d="M9 16l-.5 3" />
      <path d="M14 16l.5 3" />
      <path d="M19 14l1.5 2.5" />
    </svg>
  )
}


export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  // CHANGED: Added showPassword state to toggle between text and password types
  const [showPassword, setShowPassword] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields')
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const res = await login(username, password)
      if (res.success) {
        navigate('/dashboard')
      } else {
        setError(res.message || 'Invalid username or password')
      }
    } catch (err) {
      console.error(err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 p-4">
      {/* Background Decorative Blobs */}
      <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="absolute -right-20 -bottom-20 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />

      {/* Card Container */}
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-slate-900/40 p-8 shadow-2xl backdrop-blur-xl transition-all hover:border-white/20">
        <div className="flex flex-col items-center text-center">
          {/* Logo Icon */}
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-blue-500/30 p-2.5">
            <img src={logoIcon} alt="AttendEase Logo" className="w-full h-full object-contain" />
          </div>
          
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-white">
            Attend<span className="bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">Ease</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Staff Attendance Management System
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Username Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
                <User size={18} />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter admin username"
                className="w-full rounded-2xl border border-white/10 bg-white/5 py-3.5 pl-11 pr-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-sky-500/50 focus:bg-white/10 focus:ring-2 focus:ring-sky-500/20"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
                <Lock size={18} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full rounded-2xl border border-white/10 bg-white/5 py-3.5 pl-11 pr-20 text-sm text-white placeholder-slate-500 outline-none transition focus:border-sky-500/50 focus:bg-white/10 focus:ring-2 focus:ring-sky-500/20"
                disabled={isLoading}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 gap-1.5">
                {/* CHANGED: X button to clear input, positioned to the left of the eye toggle */}
                {password && (
                  <button
                    type="button"
                    onClick={() => setPassword('')}
                    className="p-1 text-slate-400 hover:text-white transition focus:outline-none"
                    data-tooltip="Clear password"
                    data-tooltip-pos="bottom"
                    disabled={isLoading}
                  >
                    <X size={16} />
                  </button>
                )}
                {/* CHANGED: Eye / ClosedEye (no slash) toggle to show/hide password */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-400 hover:text-white transition focus:outline-none"
                  data-tooltip={showPassword ? 'Hide password' : 'Show password'}
                  data-tooltip-pos="bottom"
                  disabled={isLoading}
                >
                  {showPassword ? <ClosedEyeIcon size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="group relative flex w-full justify-center rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 py-3.5 text-sm font-bold text-black shadow-lg transition-all hover:from-sky-450 hover:to-blue-550 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:pointer-events-none disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500">
            System running locally and offline. Secured by local SQLite database.
          </p>
        </div>
      </div>
    </div>
  )
}
