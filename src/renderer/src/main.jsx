import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

if (typeof window !== 'undefined' && !window.api) {
  // Initialize mock database in localStorage if empty
  if (!localStorage.getItem('mock_staff')) {
    localStorage.setItem(
      'mock_staff',
      JSON.stringify([
        {
          id: 1,
          staff_id: 'EMP0001',
          employee_number: '1004543',
          first_name: 'Rex Dominic',
          middle_name: 'Beronilla',
          last_name: 'Sihay',
          gender: 'Male',
          birth_date: '1995-08-15',
          role_id: 1,
          role_name: 'COURIER',
          department_id: 1,
          department_name: 'Operations',
          date_hired: '2022-03-01',
          employment_status: 'Active',
          contact_number: '+63 912 345 6789',
          email: 'rex.sihay@flashexpress.com',
          address: 'Manila, Philippines',
          photo_path: 'mock_photo.png',
          qr_code_path: 'mock_qr.png',
          emergency_contact_name: 'Jane Sihay',
          emergency_contact_number: '+63 999 888 7777',
          role_history: []
        }
      ])
    )
  }
  if (!localStorage.getItem('mock_roles')) {
    localStorage.setItem(
      'mock_roles',
      JSON.stringify([
        { id: 1, role_name: 'COURIER', status: 'Active', description: 'Delivery courier' }
      ])
    )
  }
  if (!localStorage.getItem('mock_departments')) {
    localStorage.setItem(
      'mock_departments',
      JSON.stringify([
        { id: 1, department_name: 'Operations', status: 'Active', description: 'Operations team' }
      ])
    )
  }
  if (!localStorage.getItem('mock_settings')) {
    localStorage.setItem(
      'mock_settings',
      JSON.stringify({
        org_name: 'Flash Express',
        org_address: 'Manila, Philippines',
        present_cutoff: '08:00',
        late_cutoff: '08:15',
        work_start: '08:00',
        working_days: [1, 2, 3, 4, 5]
      })
    )
  }

  window.api = {
    login: async () => ({ success: true, user: { username: 'admin' } }),
    changePassword: async () => ({ success: true }),

    getStaffList: async () => {
      return JSON.parse(localStorage.getItem('mock_staff'))
    },
    getStaffById: async (id) => {
      const staffList = JSON.parse(localStorage.getItem('mock_staff'))
      return staffList.find((s) => String(s.id) === String(id)) || null
    },
    addStaff: async (staffData) => {
      const staffList = JSON.parse(localStorage.getItem('mock_staff'))
      const id = staffList.length > 0 ? Math.max(...staffList.map((s) => s.id)) + 1 : 1
      const staffId = `EMP${String(id).padStart(4, '0')}`
      const newStaff = {
        ...staffData,
        id,
        staff_id: staffId,
        photo_path: staffData.photo_path || `mock_photo_${id}.png`,
        qr_code_path: `mock_qr_${id}.png`,
        role_history: staffData.role_id
          ? [
              {
                changed_at: new Date().toISOString(),
                changed_by: 'Admin',
                old_role_name: '(Initial)',
                new_role_name: 'COURIER'
              }
            ]
          : []
      }
      staffList.push(newStaff)
      localStorage.setItem('mock_staff', JSON.stringify(staffList))
      return { success: true, id, staffId }
    },
    updateStaff: async (id, staffData) => {
      const staffList = JSON.parse(localStorage.getItem('mock_staff'))
      const idx = staffList.findIndex((s) => String(s.id) === String(id))
      if (idx !== -1) {
        staffList[idx] = { ...staffList[idx], ...staffData }
        localStorage.setItem('mock_staff', JSON.stringify(staffList))
        return { success: true }
      }
      return { success: false, message: 'Staff member not found' }
    },
    deleteStaff: async (id) => {
      const staffList = JSON.parse(localStorage.getItem('mock_staff'))
      const filtered = staffList.filter((s) => String(s.id) !== String(id))
      localStorage.setItem('mock_staff', JSON.stringify(filtered))
      return { success: true }
    },
    regenerateQRCode: async (id) => {
      const staffList = JSON.parse(localStorage.getItem('mock_staff'))
      const idx = staffList.findIndex((s) => String(s.id) === String(id))
      if (idx !== -1) {
        staffList[idx].qr_code_path = `mock_qr_${id}_new.png`
        localStorage.setItem('mock_staff', JSON.stringify(staffList))
        return { success: true, qr_code_path: staffList[idx].qr_code_path }
      }
      return { success: false, message: 'Staff member not found' }
    },

    getRoles: async () => JSON.parse(localStorage.getItem('mock_roles')),
    getActiveRoles: async () => {
      const roles = JSON.parse(localStorage.getItem('mock_roles'))
      return roles.filter((r) => r.status === 'Active')
    },
    addRole: async (role) => {
      const roles = JSON.parse(localStorage.getItem('mock_roles'))
      const id = roles.length > 0 ? Math.max(...roles.map((r) => r.id)) + 1 : 1
      roles.push({ ...role, id })
      localStorage.setItem('mock_roles', JSON.stringify(roles))
      return { success: true, id }
    },
    updateRole: async (id, role) => {
      const roles = JSON.parse(localStorage.getItem('mock_roles'))
      const idx = roles.findIndex((r) => String(r.id) === String(id))
      if (idx !== -1) {
        roles[idx] = { ...roles[idx], ...role }
        localStorage.setItem('mock_roles', JSON.stringify(roles))
        return { success: true }
      }
      return { success: false }
    },
    deleteRole: async (id) => {
      const roles = JSON.parse(localStorage.getItem('mock_roles'))
      const filtered = roles.filter((r) => String(r.id) !== String(id))
      localStorage.setItem('mock_roles', JSON.stringify(filtered))
      return { success: true }
    },

    getDepartments: async () => JSON.parse(localStorage.getItem('mock_departments')),
    getActiveDepartments: async () => {
      const depts = JSON.parse(localStorage.getItem('mock_departments'))
      return depts.filter((d) => d.status === 'Active')
    },
    addDepartment: async (dept) => {
      const depts = JSON.parse(localStorage.getItem('mock_departments'))
      const id = depts.length > 0 ? Math.max(...depts.map((d) => d.id)) + 1 : 1
      depts.push({ ...dept, id })
      localStorage.setItem('mock_departments', JSON.stringify(depts))
      return { success: true, id }
    },
    updateDepartment: async (id, dept) => {
      const depts = JSON.parse(localStorage.getItem('mock_departments'))
      const idx = depts.findIndex((d) => String(d.id) === String(id))
      if (idx !== -1) {
        depts[idx] = { ...depts[idx], ...dept }
        localStorage.setItem('mock_departments', JSON.stringify(depts))
        return { success: true }
      }
      return { success: false }
    },
    deleteDepartment: async (id) => {
      const depts = JSON.parse(localStorage.getItem('mock_departments'))
      const filtered = depts.filter((d) => String(d.id) !== String(id))
      localStorage.setItem('mock_departments', JSON.stringify(filtered))
      return { success: true }
    },

    getSettings: async () => JSON.parse(localStorage.getItem('mock_settings')),
    updateSettings: async (settings) => {
      localStorage.setItem('mock_settings', JSON.stringify(settings))
      return { success: true }
    },

    getDailyAttendance: async () => [],
    getAttendanceRange: async () => [],
    getDashboardStats: async () => ({
      totalStaff: 1,
      activeStaff: 1,
      presentToday: 0,
      lateToday: 0,
      absentToday: 1,
      attendanceRate: 0
    }),
    clockIn: async () => ({ success: true }),
    clockOut: async () => ({ success: true }),

    openFileDialog: async () => ({ canceled: false, filePaths: ['mock_selected_photo.png'] }),
    saveFileDialog: async () => ({ canceled: false, filePath: 'mock_save_path.png' }),

    readFileAsBase64: async (path) => {
      if (!path) return null
      if (path.includes('qr')) {
        return `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ3aGl0ZSIvPjxyZWN0IHg9IjEwIiB5PSIxMCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjE0IiB5PSIxNCIgd2lkdGg9IjEyIiBoZWlnaHQ9IjEyIiBmaWxsPSJ3aGl0ZSIvPjxyZWN0IHg9IjE3IiB5PSIxNyIgd2lkdGg9IjYiIGhlaWdodD0iNiIgZmlsbD0iYmxhY2siLz48cmVjdCB4PSI3MCIgeT0iMTAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iYmxhY2siLz48cmVjdCB4PSI3NCIgeT0iMTQiIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSI3NyIgeT0iMTciIHdpZHRoPSI2IiBoZWlnaHQ9IjYiIGZpbGw9ImJsYWNrIi8+PHJlY3QgeD0iMTAiIHk9IjcwIiB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIGZpbGw9ImJsYWNrIi8+PHJlY3QgeD0iMTQiIHk9Ijc0IiB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIGZpbGw9IndoaXRlIi8+PHJlY3QgeD0iMTciIHk9Ijc3IiB3aWR0aD0iNiIgaGVpZ2h0PSI2IiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjQwIiB5PSIxNSIgd2lkdGg9IjUiIGhlaWdodD0iNSIgZmlsbD0iYmxhY2siLz48cmVjdCB4PSI1MCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSI1IiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjQ1IiB5PSIyNSIgd2lkdGg9IjUiIGhlaWdodD0iMTAiIGZpbGw9ImJsYWNrIi8+PHJlY3QgeD0iNTUiIHk9IjMwIiB3aWR0aD0iNSIgaGVpZ2h0PSI1IiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjEwIiB5PSI0MCIgd2lkdGg9IjE1IiBoZWlnaHQ9IjUiIGZpbGw9ImJsYWNrIi8+PHJlY3QgeD0iMjAiIHk9IjUwIiB3aWR0aD0iNSIgaGVpZ2h0PSIxNSIgZmlsbD0iYmxhY2siLz48cmVjdCB4PSUzNSIgeT0iNDUiIHdpZHRoPSIyMCIgaGVpZ2h0PSI1IiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjQ1IiB5PSI1NSIgd2lkdGg9IjUiIGhlaWdodD0iMTAiIGZpbGw9ImJsYWNrIi8+PHJlY3QgeD0iNjAiIHk9IjYwIiB3aWR0aD0iMTUiIGhlaWdodD0iNSIgZmlsbD0iYmxhY2siLz48cmVjdCB4PSI3NSIgeT0iNTAiIHdpZHRoPSI1IiBoZWlnaHQ9IjE1IiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjgwIiB5PSI3MCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSJibGFjayIvPjxyZWN0IHg9Ijg1IiB5PSI4NSIgd2lkdGg9IjUiIGhlaWdodD0iNSIgZmlsbD0iYmxhY2siLz48L3N2Zz4=`
      }
      return `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjY2JkNWUxIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSIzNSIgcj0iMjAiIGZpbGw9IiM0NzU1NjkiLz48cGF0aCBkPSJNMjAgODVjMC0xNSAxMC0yNSAzMC0yNXMzMCAxMCAzMCAyNXoiIGZpbGw9IiM0NzU1NjkiLz48L3N2Zz4=`
    }
  }
  localStorage.setItem('admin_user', JSON.stringify({ username: 'admin' }))
}

// Global click listener to automatically show the native date picker when clicking anywhere on a date input.
// This supports date inputs that hide their native webkit calendar indicator to suppress native hover tooltips.
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const targetInput = e.target.closest('input[type="date"]')
    if (targetInput) {
      try {
        targetInput.showPicker()
      } catch (err) {
        // Fallback
      }
    }
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
