import React from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'

// Layouts
import MainLayout from './components/layout/MainLayout'

// Pages
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import StaffListPage from './pages/StaffListPage'
import StaffFormPage from './pages/StaffFormPage'
import StaffProfilePage from './pages/StaffProfilePage'
import AttendanceScanPage from './pages/AttendanceScanPage'
import AttendanceHistoryPage from './pages/AttendanceHistoryPage'
import GasolineSubsidyPage from './pages/GasolineSubsidyPage'
import ReportsPage from './pages/ReportsPage'
import RolesPage from './pages/RolesPage'

import IDCardPage from './pages/IDCardPage'
import DataImportPage from './pages/DataImportPage'
import DataAnalyticsPage from './pages/DataAnalyticsPage'
import SettingsPage from './pages/SettingsPage'
import BackupRestorePage from './pages/BackupRestorePage'
import AuditLogPage from './pages/AuditLogPage'

// Protected Route Wrapper
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
      <HashRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes inside MainLayout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            {/* Dashboard Redirect */}
            <Route index element={<Navigate to="/dashboard" replace />} />
            
            {/* Main Application Pages */}
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="staff" element={<StaffListPage />} />
            <Route path="staff/new" element={<StaffFormPage />} />
            <Route path="staff/edit/:id" element={<StaffFormPage />} />
            <Route path="staff/:id" element={<StaffProfilePage />} />
            <Route path="scan" element={<AttendanceScanPage />} />
            <Route path="attendance" element={<AttendanceHistoryPage />} />
            <Route path="gasoline" element={<GasolineSubsidyPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="roles" element={<RolesPage />} />

            <Route path="id-cards" element={<IDCardPage />} />
            <Route path="id-cards/:id" element={<IDCardPage />} />
            <Route path="data-import" element={<DataImportPage />} />
            <Route path="analytics" element={<DataAnalyticsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="backup" element={<BackupRestorePage />} />
            <Route path="audit-logs" element={<AuditLogPage />} />
          </Route>

          {/* Fallback Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
    </ThemeProvider>
  )
}
