import { getDbConnection } from './connection.js'
import { logAudit } from './audit.js'

// CHANGED: made getRoles asynchronous and updated SQLite calls to mysql2 execute
export async function getRoles() {
  const db = getDbConnection()
  const [rows] = await db.execute('SELECT * FROM roles ORDER BY role_name ASC')
  return rows
}

// CHANGED: made getActiveRoles asynchronous and updated SQLite calls to mysql2 execute
export async function getActiveRoles() {
  const db = getDbConnection()
  const [rows] = await db.execute("SELECT * FROM roles WHERE status = 'Active' ORDER BY role_name ASC")
  return rows
}

// CHANGED: made addRole asynchronous, handled MySQL auto-increment insertId and duplicate role name constraint
export async function addRole(role) {
  try {
    const db = getDbConnection()
    const [result] = await db.execute(`
      INSERT INTO roles (role_name, description, status)
      VALUES (?, ?, ?)
    `, [role.role_name, role.description, role.status || 'Active'])
    
    const newId = result.insertId
    await logAudit('ROLE_ADDED', 'roles', newId, role)
    return { success: true, id: newId }
  } catch (error) {
    console.error('Add role error:', error)
    if (error.code === 'ER_DUP_ENTRY' || error.message.includes('UNIQUE constraint failed')) {
      return { success: false, message: 'Role name already exists' }
    }
    return { success: false, message: 'An error occurred while adding the role' }
  }
}

// CHANGED: made updateRole asynchronous, handled updated_at, and mapped duplicate constraints
export async function updateRole(id, role) {
  try {
    const db = getDbConnection()
    await db.execute(`
      UPDATE roles
      SET role_name = ?, description = ?, status = ?
      WHERE id = ?
    `, [role.role_name, role.description, role.status, id])
    
    await logAudit('ROLE_EDITED', 'roles', id, role)
    return { success: true }
  } catch (error) {
    console.error('Update role error:', error)
    if (error.code === 'ER_DUP_ENTRY' || error.message.includes('UNIQUE constraint failed')) {
      return { success: false, message: 'Role name already exists' }
    }
    return { success: false, message: 'An error occurred while updating the role' }
  }
}

// CHANGED: made deleteRole asynchronous, added staff assignment check using MySQL count query
export async function deleteRole(id) {
  try {
    const db = getDbConnection()
    
    // Check if role is used by staff
    const [staffCountRows] = await db.execute('SELECT COUNT(*) as count FROM staff WHERE role_id = ?', [id])
    const staffCount = staffCountRows[0].count
    if (staffCount > 0) {
      return { 
        success: false, 
        message: 'Role is currently assigned to staff and cannot be deleted. Try deactivating it instead.' 
      }
    }
    
    const [roleRows] = await db.execute('SELECT * FROM roles WHERE id = ?', [id])
    const role = roleRows[0]
    if (!role) {
      return { success: false, message: 'Role not found' }
    }
    
    await db.execute('DELETE FROM roles WHERE id = ?', [id])
    await logAudit('ROLE_DELETED', 'roles', id, role)
    return { success: true }
  } catch (error) {
    console.error('Delete role error:', error)
    return { success: false, message: 'An error occurred while deleting the role' }
  }
}
