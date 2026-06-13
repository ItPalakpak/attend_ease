import { getDbConnection } from './connection.js'
import bcrypt from 'bcryptjs'
import { logAudit } from './audit.js'

// CHANGED: made verifyLogin asynchronous and converted SQLite calls to mysql2 Pool queries
export async function verifyLogin(username, password) {
  try {
    const db = getDbConnection()
    const [rows] = await db.execute('SELECT * FROM admin WHERE username = ?', [username])
    const user = rows[0]
    
    if (!user) return { success: false, message: 'Invalid credentials' }
    
    const matches = bcrypt.compareSync(password, user.password_hash)
    if (!matches) return { success: false, message: 'Invalid credentials' }
    
    // Log successful login
    await logAudit('LOGIN_SUCCESS', 'admin', user.id, { username }, username)
    
    return { success: true, user: { id: user.id, username: user.username } }
  } catch (error) {
    console.error('Login error:', error)
    return { success: false, message: 'An error occurred during login' }
  }
}

// CHANGED: made changePassword asynchronous and converted SQLite calls to mysql2 Pool queries
export async function changePassword(username, oldPassword, newPassword) {
  try {
    const db = getDbConnection()
    const [rows] = await db.execute('SELECT * FROM admin WHERE username = ?', [username])
    const user = rows[0]
    
    if (!user) return { success: false, message: 'User not found' }
    
    const matches = bcrypt.compareSync(oldPassword, user.password_hash)
    if (!matches) return { success: false, message: 'Incorrect current password' }
    
    const salt = bcrypt.genSaltSync(10)
    const newHash = bcrypt.hashSync(newPassword, salt)
    
    await db.execute(`
      UPDATE admin 
      SET password_hash = ?
      WHERE username = ?
    `, [newHash, username])
    
    await logAudit('PASSWORD_CHANGED', 'admin', user.id, { username }, username)
    
    return { success: true, message: 'Password updated successfully' }
  } catch (error) {
    console.error('Change password error:', error)
    return { success: false, message: 'An error occurred while updating the password' }
  }
}
