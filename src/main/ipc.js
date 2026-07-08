import { ipcMain, dialog } from 'electron'
import { readFileSync, existsSync } from 'fs'
import { extname } from 'path'
import { verifyLogin, changePassword } from './db/auth.js'
import { getRoles, getActiveRoles, addRole, updateRole, deleteRole } from './db/roles.js'
import {
  getDepartments,
  getActiveDepartments,
  addDepartment,
  updateDepartment,
  deleteDepartment
} from './db/departments.js'
import {
  getStaffList,
  getStaffById,
  addStaff,
  updateStaff,
  deleteStaff,
  regenerateQRCode
} from './db/staff.js'
import {
  recordClockIn,
  recordClockOut,
  getDailyAttendance,
  getAttendanceRange,
  getDashboardStats
} from './db/attendance.js'
import { getSettings, updateSettings } from './db/settings.js'
import { logAudit, getAuditLogs } from './db/audit.js'
import {
  importDataset,
  getDatasets,
  deleteDataset,
  queryDatasetRows,
  aggregateDataset,
  getFilterDefinitions,
  getActiveFilterDefinitions,
  addFilterDefinition,
  deleteFilterDefinition
} from './db/dataimport.js'
import { createBackup, restoreBackup } from './db/backup.js'
import {
  getGasolineSubsidies,
  saveGasolineEntry,
  deleteGasolineEntry,
  importGasolineFromExcel,
  getRiderWeeklyUsage
} from './db/gasoline.js'

export function registerIpcHandlers() {
  // --- Native Dialogs ---
  ipcMain.handle('dialog:open-file', async (event, options) => {
    return await dialog.showOpenDialog(options)
  })

  ipcMain.handle('dialog:save-file', async (event, options) => {
    return await dialog.showSaveDialog(options)
  })

  // --- File System ---
  // Reads a local file and returns it as a base64 data URL for safe display in renderer
  ipcMain.handle('fs:read-file-base64', async (event, filePath) => {
    try {
      if (!filePath || !existsSync(filePath)) return null
      const ext = extname(filePath).toLowerCase().replace('.', '')
      const mimeMap = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        gif: 'image/gif'
      }
      const mime = mimeMap[ext] || 'image/jpeg'
      const data = readFileSync(filePath)
      return `data:${mime};base64,${data.toString('base64')}`
    } catch (err) {
      console.error('fs:read-file-base64 error:', err)
      return null
    }
  })

  // --- Auth ---
  ipcMain.handle('auth:login', async (event, { username, password }) => {
    return verifyLogin(username, password)
  })

  ipcMain.handle('auth:change-password', async (event, { username, oldPassword, newPassword }) => {
    return changePassword(username, oldPassword, newPassword)
  })

  // --- Roles ---
  ipcMain.handle('roles:get-all', async () => {
    return getRoles()
  })

  ipcMain.handle('roles:get-active', async () => {
    return getActiveRoles()
  })

  ipcMain.handle('roles:add', async (event, role) => {
    return addRole(role)
  })

  ipcMain.handle('roles:update', async (event, { id, role }) => {
    return updateRole(id, role)
  })

  ipcMain.handle('roles:delete', async (event, id) => {
    return deleteRole(id)
  })

  // --- Departments ---
  ipcMain.handle('depts:get-all', async () => {
    return getDepartments()
  })

  ipcMain.handle('depts:get-active', async () => {
    return getActiveDepartments()
  })

  ipcMain.handle('depts:add', async (event, dept) => {
    return addDepartment(dept)
  })

  ipcMain.handle('depts:update', async (event, { id, dept }) => {
    return updateDepartment(id, dept)
  })

  ipcMain.handle('depts:delete', async (event, id) => {
    return deleteDepartment(id)
  })

  // --- Staff ---
  ipcMain.handle('staff:get-all', async () => {
    return getStaffList()
  })

  ipcMain.handle('staff:get-by-id', async (event, id) => {
    return getStaffById(id)
  })

  ipcMain.handle('staff:add', async (event, staffData) => {
    return addStaff(staffData)
  })

  ipcMain.handle('staff:update', async (event, { id, staffData }) => {
    return updateStaff(id, staffData)
  })

  ipcMain.handle('staff:delete', async (event, id) => {
    return deleteStaff(id)
  })

  ipcMain.handle('staff:regenerate-qr', async (event, id) => {
    return regenerateQRCode(id)
  })

  // --- Attendance ---
  ipcMain.handle('attendance:clock-in', async (event, { staffId, dateStr, timeStr }) => {
    return recordClockIn(staffId, dateStr, timeStr)
  })

  ipcMain.handle('attendance:clock-out', async (event, { staffId, dateStr, timeStr }) => {
    return recordClockOut(staffId, dateStr, timeStr)
  })

  ipcMain.handle('attendance:get-daily', async (event, dateStr) => {
    return getDailyAttendance(dateStr)
  })

  ipcMain.handle('attendance:get-range', async (event, { startDate, endDate }) => {
    return getAttendanceRange(startDate, endDate)
  })

  ipcMain.handle('attendance:get-stats', async (event, dateStr) => {
    return getDashboardStats(dateStr)
  })

  // --- Settings ---
  ipcMain.handle('settings:get', async () => {
    return getSettings()
  })

  ipcMain.handle('settings:update', async (event, settingsObj) => {
    return updateSettings(settingsObj)
  })

  // --- Data Import & Analytics ---
  ipcMain.handle('dataimport:import', async (event, { filePath, description }) => {
    return importDataset(filePath, description)
  })

  ipcMain.handle('dataimport:get-datasets', async () => {
    return getDatasets()
  })

  ipcMain.handle('dataimport:delete-dataset', async (event, id) => {
    return deleteDataset(id)
  })

  ipcMain.handle(
    'dataimport:query-rows',
    async (event, { datasetId, activeFilters, limit, offset }) => {
      return queryDatasetRows(datasetId, activeFilters, limit, offset)
    }
  )

  ipcMain.handle(
    'dataimport:aggregate',
    async (event, { datasetId, activeFilters, aggregateConfig }) => {
      return aggregateDataset(datasetId, activeFilters, aggregateConfig)
    }
  )

  ipcMain.handle('dataimport:get-filters', async () => {
    return getFilterDefinitions()
  })

  ipcMain.handle('dataimport:get-active-filters', async () => {
    return getActiveFilterDefinitions()
  })

  ipcMain.handle('dataimport:add-filter', async (event, filter) => {
    return addFilterDefinition(filter)
  })

  ipcMain.handle('dataimport:update-filter', async (event, { id, filter }) => {
    return updateFilterDefinition(id, filter)
  })

  ipcMain.handle('dataimport:delete-filter', async (event, id) => {
    return deleteFilterDefinition(id)
  })

  // --- Backup & Restore ---
  ipcMain.handle('system:backup', async (event, destPath) => {
    return createBackup(destPath)
  })

  ipcMain.handle('system:restore', async (event, backupPath) => {
    return restoreBackup(backupPath)
  })

  // --- Audit Logs ---
  ipcMain.handle('system:get-audits', async () => {
    return getAuditLogs()
  })

  // --- Gasoline Subsidies ---
  ipcMain.handle('gasoline:get-all', async (event, { startDate, endDate }) => {
    return getGasolineSubsidies(startDate, endDate)
  })

  ipcMain.handle('gasoline:save', async (event, entry) => {
    return saveGasolineEntry(entry)
  })

  ipcMain.handle('gasoline:delete', async (event, id) => {
    return deleteGasolineEntry(id)
  })

  ipcMain.handle('gasoline:import-excel', async (event, filePath) => {
    return importGasolineFromExcel(filePath)
  })

  ipcMain.handle('gasoline:get-weekly-usage', async (event, { staffId, dateStr }) => {
    return getRiderWeeklyUsage(staffId, dateStr)
  })
}
