import { getDbConnection } from './connection.js'

// CHANGED: made logAudit asynchronous and updated SQLite calls to mysql2
export async function logAudit(action, entityType, entityId, details, performedBy = 'Admin') {
  try {
    const db = getDbConnection()
    await db.execute(`
      INSERT INTO audit_logs (action, entity_type, entity_id, details, performed_by)
      VALUES (?, ?, ?, ?, ?)
    `, [action, entityType, entityId, JSON.stringify(details), performedBy])
  } catch (err) {
    console.error('Failed to log audit event:', err)
  }
}

// CHANGED: made getAuditLogs asynchronous and updated SQLite calls to mysql2
export async function getAuditLogs() {
  const db = getDbConnection()
  const [rows] = await db.execute('SELECT * FROM audit_logs ORDER BY performed_at DESC LIMIT 1000')
  return rows
}
