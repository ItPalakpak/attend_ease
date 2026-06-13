import { getDbConnection } from './connection.js'
import { logAudit } from './audit.js'
import { app } from 'electron'
import { join, extname } from 'path'
import { existsSync, mkdirSync, copyFileSync, unlinkSync } from 'fs'
import QRCode from 'qrcode'

export function getStoragePaths() {
  const userDataPath = app.getPath('userData')
  const photosDir = join(userDataPath, 'photos')
  const qrDir = join(userDataPath, 'qrcodes')
  
  if (!existsSync(photosDir)) mkdirSync(photosDir, { recursive: true })
  if (!existsSync(qrDir)) mkdirSync(qrDir, { recursive: true })
  
  return { photosDir, qrDir }
}

// CHANGED: made generateNextStaffId asynchronous to run database queries
async function generateNextStaffId(db) {
  const [rows] = await db.execute("SELECT staff_id FROM staff ORDER BY id DESC LIMIT 1")
  const lastStaff = rows[0]
  if (!lastStaff) return "EMP0001"
  const match = lastStaff.staff_id.match(/EMP(\d+)/)
  if (!match) return "EMP0001"
  const nextNum = parseInt(match[1], 10) + 1
  return `EMP${String(nextNum).padStart(4, '0')}`
}

async function generateAndSaveQRCode(staffId, qrDir) {
  const qrData = JSON.stringify({ staffId })
  const qrPath = join(qrDir, `${staffId}_qr.png`)
  await QRCode.toFile(qrPath, qrData, {
    width: 300,
    margin: 2
  })
  return qrPath
}

// CHANGED: made getStaffList asynchronous and updated SQLite calls to mysql2
export async function getStaffList() {
  const db = getDbConnection()
  const [rows] = await db.execute(`
    SELECT s.*, 
           r.role_name, 
           d.department_name
    FROM staff s
    LEFT JOIN roles r ON s.role_id = r.id
    LEFT JOIN departments d ON s.department_id = d.id
    ORDER BY s.staff_id DESC
  `)
  return rows
}

// CHANGED: made getStaffById asynchronous and updated SQLite calls to mysql2
export async function getStaffById(id) {
  const db = getDbConnection()
  const [staffRows] = await db.execute(`
    SELECT s.*, 
           r.role_name, 
           d.department_name
    FROM staff s
    LEFT JOIN roles r ON s.role_id = r.id
    LEFT JOIN departments d ON s.department_id = d.id
    WHERE s.id = ?
  `, [id])
  
  const staff = staffRows[0]
  if (!staff) return null

  // Fetch role history
  const [historyRows] = await db.execute(`
    SELECT rh.changed_at, rh.changed_by, 
           r_old.role_name as old_role_name, 
           r_new.role_name as new_role_name
    FROM role_history rh
    LEFT JOIN roles r_old ON rh.old_role_id = r_old.id
    LEFT JOIN roles r_new ON rh.new_role_id = r_new.id
    WHERE rh.staff_id = ?
    ORDER BY rh.changed_at DESC
  `, [id])

  staff.role_history = historyRows
  return staff
}

// CHANGED: made addStaff asynchronous and implemented MySQL transaction handling
export async function addStaff(staffData) {
  const db = getDbConnection()
  const { photosDir, qrDir } = getStoragePaths()
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    const staffId = await generateNextStaffId(connection)
    
    // Handle photo copy if provided
    let localPhotoPath = null
    if (staffData.photo_path && existsSync(staffData.photo_path)) {
      const fileExt = extname(staffData.photo_path)
      localPhotoPath = join(photosDir, `${staffId}${fileExt}`)
      copyFileSync(staffData.photo_path, localPhotoPath)
    }

    // Generate QR code
    const localQrPath = await generateAndSaveQRCode(staffId, qrDir)

    const [result] = await connection.execute(`
      INSERT INTO staff (
        staff_id, employee_number, first_name, middle_name, last_name, 
        gender, birth_date, role_id, department_id, contact_number, 
        email, address, date_hired, employment_status, photo_path, 
        qr_code_path, emergency_contact_name, emergency_contact_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      staffId,
      staffData.employee_number || null,
      staffData.first_name,
      staffData.middle_name || null,
      staffData.last_name,
      staffData.gender || 'Male',
      staffData.birth_date || null,
      staffData.role_id || null,
      staffData.department_id || null,
      staffData.contact_number || null,
      staffData.email || null,
      staffData.address || null,
      staffData.date_hired || null,
      staffData.employment_status || 'Active',
      localPhotoPath,
      localQrPath,
      staffData.emergency_contact_name || null,
      staffData.emergency_contact_number || null
    ])

    const newStaffId = result.insertId

    // Log to history if role is assigned
    if (staffData.role_id) {
      await connection.execute(`
        INSERT INTO role_history (staff_id, old_role_id, new_role_id, changed_by)
        VALUES (?, NULL, ?, ?)
      `, [newStaffId, staffData.role_id, 'Admin'])
    }

    await logAudit('STAFF_ADDED', 'staff', newStaffId, { staffId, name: `${staffData.first_name} ${staffData.last_name}` })
    
    await connection.commit()
    return { success: true, id: newStaffId, staffId }
  } catch (error) {
    await connection.rollback()
    console.error('Add staff error:', error)
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes('employee_number')) {
      return { success: false, message: 'Employee number already exists' }
    }
    return { success: false, message: error.message || 'An error occurred while adding the staff member' }
  } finally {
    connection.release()
  }
}

// CHANGED: made updateStaff asynchronous and implemented MySQL transaction handling
export async function updateStaff(id, staffData) {
  const db = getDbConnection()
  const { photosDir, qrDir } = getStoragePaths()
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    // Fetch current staff
    const [staffRows] = await connection.execute('SELECT * FROM staff WHERE id = ?', [id])
    const current = staffRows[0]
    if (!current) {
      connection.release()
      return { success: false, message: 'Staff member not found' }
    }

    const staffId = current.staff_id

    // Check if role changed
    const roleChanged = staffData.role_id !== undefined && Number(staffData.role_id) !== current.role_id
    if (roleChanged) {
      await connection.execute(`
        INSERT INTO role_history (staff_id, old_role_id, new_role_id, changed_by)
        VALUES (?, ?, ?, ?)
      `, [id, current.role_id, staffData.role_id || null, 'Admin'])
    }

    // Handle photo copy if changed
    let localPhotoPath = current.photo_path
    if (staffData.photo_path && staffData.photo_path !== current.photo_path && existsSync(staffData.photo_path)) {
      // Delete old photo if it exists
      if (current.photo_path && existsSync(current.photo_path)) {
        try { unlinkSync(current.photo_path) } catch (e) { console.error(e) }
      }
      const fileExt = extname(staffData.photo_path)
      localPhotoPath = join(photosDir, `${staffId}${fileExt}`)
      copyFileSync(staffData.photo_path, localPhotoPath)
    }

    // Verify/regenerate QR code if deleted or missing
    let localQrPath = current.qr_code_path
    if (!localQrPath || !existsSync(localQrPath)) {
      localQrPath = await generateAndSaveQRCode(staffId, qrDir)
    }

    await connection.execute(`
      UPDATE staff 
      SET employee_number = ?, first_name = ?, middle_name = ?, last_name = ?, 
          gender = ?, birth_date = ?, role_id = ?, department_id = ?, 
          contact_number = ?, email = ?, address = ?, date_hired = ?, 
          employment_status = ?, photo_path = ?, qr_code_path = ?, 
          emergency_contact_name = ?, emergency_contact_number = ?
      WHERE id = ?
    `, [
      staffData.employee_number || null,
      staffData.first_name,
      staffData.middle_name || null,
      staffData.last_name,
      staffData.gender || 'Male',
      staffData.birth_date || null,
      staffData.role_id || null,
      staffData.department_id || null,
      staffData.contact_number || null,
      staffData.email || null,
      staffData.address || null,
      staffData.date_hired || null,
      staffData.employment_status || 'Active',
      localPhotoPath,
      localQrPath,
      staffData.emergency_contact_name || null,
      staffData.emergency_contact_number || null,
      id
    ])

    await logAudit('STAFF_EDITED', 'staff', id, { staffId, name: `${staffData.first_name} ${staffData.last_name}` })
    
    await connection.commit()
    return { success: true }
  } catch (error) {
    await connection.rollback()
    console.error('Update staff error:', error)
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes('employee_number')) {
      return { success: false, message: 'Employee number already exists' }
    }
    return { success: false, message: error.message || 'An error occurred while updating the staff member' }
  } finally {
    connection.release()
  }
}

// CHANGED: made deleteStaff asynchronous and updated SQLite calls to mysql2
export async function deleteStaff(id) {
  try {
    const db = getDbConnection()
    const [staffRows] = await db.execute('SELECT * FROM staff WHERE id = ?', [id])
    const staff = staffRows[0]
    if (!staff) return { success: false, message: 'Staff member not found' }

    // Delete local files
    if (staff.photo_path && existsSync(staff.photo_path)) {
      try { unlinkSync(staff.photo_path) } catch (e) { console.error('Error deleting photo:', e) }
    }
    if (staff.qr_code_path && existsSync(staff.qr_code_path)) {
      try { unlinkSync(staff.qr_code_path) } catch (e) { console.error('Error deleting QR:', e) }
    }

    await db.execute('DELETE FROM staff WHERE id = ?', [id])

    await logAudit('STAFF_DELETED', 'staff', id, { staffId: staff.staff_id, name: `${staff.first_name} ${staff.last_name}` })
    return { success: true }
  } catch (error) {
    console.error('Delete staff error:', error)
    return { success: false, message: 'An error occurred while deleting the staff member' }
  }
}

// CHANGED: made regenerateQRCode asynchronous and updated SQLite calls to mysql2
export async function regenerateQRCode(id) {
  try {
    const db = getDbConnection()
    const [staffRows] = await db.execute('SELECT staff_id, qr_code_path FROM staff WHERE id = ?', [id])
    const staff = staffRows[0]
    if (!staff) return { success: false, message: 'Staff member not found' }

    const { qrDir } = getStoragePaths()

    // Delete old QR code if exists
    if (staff.qr_code_path && existsSync(staff.qr_code_path)) {
      try { unlinkSync(staff.qr_code_path) } catch (e) { console.error(e) }
    }

    const newQrPath = await generateAndSaveQRCode(staff.staff_id, qrDir)

    await db.execute('UPDATE staff SET qr_code_path = ? WHERE id = ?', [newQrPath, id])
    
    await logAudit('QR_REGENERATED', 'staff', id, { staffId: staff.staff_id })
    return { success: true, qr_code_path: newQrPath }
  } catch (error) {
    console.error('Regenerate QR error:', error)
    return { success: false, message: 'An error occurred while regenerating the QR code' }
  }
}
