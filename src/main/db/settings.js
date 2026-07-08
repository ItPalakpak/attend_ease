import { getDbConnection } from './connection.js'
import { logAudit } from './audit.js'

// CHANGED: made getSettings asynchronous and updated SQLite calls to mysql2
export async function getSettings() {
  try {
    const db = getDbConnection()
    const [rows] = await db.execute('SELECT * FROM settings')
    const settings = {}
    for (const row of rows) {
      if (row.key === 'working_days') {
        try {
          settings[row.key] = JSON.parse(row.value)
        } catch {
          settings[row.key] = [1, 2, 3, 4, 5]
        }
      } else {
        settings[row.key] = row.value
      }
    }
    return settings
  } catch (error) {
    console.error('Get settings error:', error)
    return {}
  }
}

// CHANGED: made updateSettings asynchronous and implemented MySQL transactional upsert using ON DUPLICATE KEY UPDATE
export async function updateSettings(settingsObj) {
  const db = getDbConnection()
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    // Key is a reserved keyword in MySQL, so we wrap it in backticks
    for (const [key, value] of Object.entries(settingsObj)) {
      const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value)
      await connection.execute(
        'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
        [key, valStr, valStr]
      )
    }

    await connection.commit()

    await logAudit('SETTINGS_UPDATED', 'settings', null, settingsObj)
    return { success: true }
  } catch (error) {
    await connection.rollback()
    console.error('Update settings error:', error)
    return { success: false, message: 'An error occurred while updating settings' }
  } finally {
    connection.release()
  }
}
