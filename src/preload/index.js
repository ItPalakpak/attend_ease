import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  platform: process.platform,
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onWindowMaximized: (callback) => {
    const subscription = (_, isMax) => callback(isMax)
    ipcRenderer.on('window:maximized-state', subscription)
    return () => {
      ipcRenderer.removeListener('window:maximized-state', subscription)
    }
  },

  // Dialogs
  openFileDialog: (options) => ipcRenderer.invoke('dialog:open-file', options),
  saveFileDialog: (options) => ipcRenderer.invoke('dialog:save-file', options),

  // File System (reads a local file as base64 data URL for safe display)
  readFileAsBase64: (filePath) => ipcRenderer.invoke('fs:read-file-base64', filePath),

  // Auth
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  changePassword: (data) => ipcRenderer.invoke('auth:change-password', data),

  // Roles
  getRoles: () => ipcRenderer.invoke('roles:get-all'),
  getActiveRoles: () => ipcRenderer.invoke('roles:get-active'),
  addRole: (role) => ipcRenderer.invoke('roles:add', role),
  updateRole: (id, role) => ipcRenderer.invoke('roles:update', { id, role }),
  deleteRole: (id) => ipcRenderer.invoke('roles:delete', id),

  // Departments
  getDepartments: () => ipcRenderer.invoke('depts:get-all'),
  getActiveDepartments: () => ipcRenderer.invoke('depts:get-active'),
  addDepartment: (dept) => ipcRenderer.invoke('depts:add', dept),
  updateDepartment: (id, dept) => ipcRenderer.invoke('depts:update', { id, dept }),
  deleteDepartment: (id) => ipcRenderer.invoke('depts:delete', id),

  // Staff
  getStaffList: () => ipcRenderer.invoke('staff:get-all'),
  getStaffById: (id) => ipcRenderer.invoke('staff:get-by-id', id),
  addStaff: (staffData) => ipcRenderer.invoke('staff:add', staffData),
  updateStaff: (id, staffData) => ipcRenderer.invoke('staff:update', { id, staffData }),
  deleteStaff: (id) => ipcRenderer.invoke('staff:delete', id),
  regenerateQRCode: (id) => ipcRenderer.invoke('staff:regenerate-qr', id),

  // Attendance
  clockIn: (data) => ipcRenderer.invoke('attendance:clock-in', data),
  clockOut: (data) => ipcRenderer.invoke('attendance:clock-out', data),
  getDailyAttendance: (dateStr) => ipcRenderer.invoke('attendance:get-daily', dateStr),
  getAttendanceRange: (range) => ipcRenderer.invoke('attendance:get-range', range),
  getDashboardStats: (dateStr) => ipcRenderer.invoke('attendance:get-stats', dateStr),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),

  // Data Import & Analytics
  importDataset: (data) => ipcRenderer.invoke('dataimport:import', data),
  getDatasets: () => ipcRenderer.invoke('dataimport:get-datasets'),
  deleteDataset: (id) => ipcRenderer.invoke('dataimport:delete-dataset', id),
  queryDatasetRows: (data) => ipcRenderer.invoke('dataimport:query-rows', data),
  aggregateDataset: (data) => ipcRenderer.invoke('dataimport:aggregate', data),
  getFilterDefinitions: () => ipcRenderer.invoke('dataimport:get-filters'),
  getActiveFilterDefinitions: () => ipcRenderer.invoke('dataimport:get-active-filters'),
  addFilterDefinition: (filter) => ipcRenderer.invoke('dataimport:add-filter', filter),
  updateFilterDefinition: (id, filter) =>
    ipcRenderer.invoke('dataimport:update-filter', { id, filter }),
  deleteFilterDefinition: (id) => ipcRenderer.invoke('dataimport:delete-filter', id),
  getDatasetMetadata: (datasetId) => ipcRenderer.invoke('dataimport:get-metadata', datasetId),
  writeFileBase64: (filePath, base64Data) =>
    ipcRenderer.invoke('fs:write-file-base64', { filePath, base64Data }),

  // Backup & Restore
  backupSystem: (destPath) => ipcRenderer.invoke('system:backup', destPath),
  restoreSystem: (backupPath) => ipcRenderer.invoke('system:restore', backupPath),

  // Audit Logs
  getAuditLogs: () => ipcRenderer.invoke('system:get-audits'),

  // Gasoline Subsidies
  getGasolineSubsidies: (params) => ipcRenderer.invoke('gasoline:get-all', params),
  saveGasolineEntry: (entry) => ipcRenderer.invoke('gasoline:save', entry),
  deleteGasolineEntry: (id) => ipcRenderer.invoke('gasoline:delete', id),
  importGasolineExcel: (filePath) => ipcRenderer.invoke('gasoline:import-excel', filePath),
  getWeeklyGasolineUsage: (params) => ipcRenderer.invoke('gasoline:get-weekly-usage', params)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
