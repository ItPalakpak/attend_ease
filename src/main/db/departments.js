import { getDbConnection } from './connection.js'
import { logAudit } from './audit.js'

// CHANGED: made getDepartments asynchronous and updated SQLite calls to mysql2 execute
export async function getDepartments() {
  const db = getDbConnection()
  const [rows] = await db.execute('SELECT * FROM departments ORDER BY department_name ASC')
  return rows
}

// CHANGED: made getActiveDepartments asynchronous and updated SQLite calls to mysql2 execute
export async function getActiveDepartments() {
  const db = getDbConnection()
  const [rows] = await db.execute("SELECT * FROM departments WHERE status = 'Active' ORDER BY department_name ASC")
  return rows
}

// CHANGED: made addDepartment asynchronous, handled MySQL auto-increment insertId and duplicate constraint
export async function addDepartment(dept) {
  try {
    const db = getDbConnection()
    const [result] = await db.execute(`
      INSERT INTO departments (department_name, description, status)
      VALUES (?, ?, ?)
    `, [dept.department_name, dept.description, dept.status || 'Active'])
    
    const newId = result.insertId
    await logAudit('DEPARTMENT_ADDED', 'departments', newId, dept)
    return { success: true, id: newId }
  } catch (error) {
    console.error('Add department error:', error)
    if (error.code === 'ER_DUP_ENTRY' || error.message.includes('UNIQUE constraint failed')) {
      return { success: false, message: 'Department name already exists' }
    }
    return { success: false, message: 'An error occurred while adding the department' }
  }
}

// CHANGED: made updateDepartment asynchronous, handled updated_at, and mapped duplicate constraints
export async function updateDepartment(id, dept) {
  try {
    const db = getDbConnection()
    await db.execute(`
      UPDATE departments
      SET department_name = ?, description = ?, status = ?
      WHERE id = ?
    `, [dept.department_name, dept.description, dept.status, id])
    
    await logAudit('DEPARTMENT_EDITED', 'departments', id, dept)
    return { success: true }
  } catch (error) {
    console.error('Update department error:', error)
    if (error.code === 'ER_DUP_ENTRY' || error.message.includes('UNIQUE constraint failed')) {
      return { success: false, message: 'Department name already exists' }
    }
    return { success: false, message: 'An error occurred while updating the department' }
  }
}

// CHANGED: made deleteDepartment asynchronous, added staff assignment check using MySQL count query
export async function deleteDepartment(id) {
  try {
    const db = getDbConnection()
    
    // Check if department is used by staff
    const [staffCountRows] = await db.execute('SELECT COUNT(*) as count FROM staff WHERE department_id = ?', [id])
    const staffCount = staffCountRows[0].count
    if (staffCount > 0) {
      return { 
        success: false, 
        message: 'Department is currently assigned to staff and cannot be deleted. Try deactivating it instead.' 
      }
    }
    
    const [deptRows] = await db.execute('SELECT * FROM departments WHERE id = ?', [id])
    const dept = deptRows[0]
    if (!dept) {
      return { success: false, message: 'Department not found' }
    }
    
    await db.execute('DELETE FROM departments WHERE id = ?', [id])
    await logAudit('DEPARTMENT_DELETED', 'departments', id, dept)
    return { success: true }
  } catch (error) {
    console.error('Delete department error:', error)
    return { success: false, message: 'An error occurred while deleting the department' }
  }
}
