import AdmZip from 'adm-zip'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { getDbConnection } from './connection.js'
import { logAudit } from './audit.js'

// CHANGED: made createBackup asynchronous and updated to export MySQL table rows to JSON
export async function createBackup(destPath) {
  try {
    const db = getDbConnection()

    // Get all tables from MySQL database
    const [tables] = await db.execute('SHOW TABLES')
    const tableNames = tables.map((t) => Object.values(t)[0])

    // Export data from all tables
    const backupData = {}
    for (const tableName of tableNames) {
      const [rows] = await db.execute(`SELECT * FROM \`${tableName}\``)
      backupData[tableName] = rows
    }

    const userDataPath = app.getPath('userData')
    const photosDir = join(userDataPath, 'photos')
    const qrDir = join(userDataPath, 'qrcodes')
    const importsDir = join(userDataPath, 'imports')

    const zip = new AdmZip()

    // Add DB data as JSON file
    zip.addFile('database/data_backup.json', Buffer.from(JSON.stringify(backupData), 'utf-8'))

    // Add photos
    if (existsSync(photosDir)) {
      zip.addLocalFolder(photosDir, 'photos')
    }

    // Add QR codes
    if (existsSync(qrDir)) {
      zip.addLocalFolder(qrDir, 'qrcodes')
    }

    // Add imported files
    if (existsSync(importsDir)) {
      zip.addLocalFolder(importsDir, 'imports')
    }

    // Write ZIP
    zip.writeZip(destPath)

    await logAudit('SYSTEM_BACKUP', 'system', null, { destPath })
    return { success: true, message: 'Backup created successfully' }
  } catch (error) {
    console.error('Backup error:', error)
    return { success: false, message: `Backup failed: ${error.message}` }
  }
}

// CHANGED: made restoreBackup asynchronous and updated to import MySQL table rows from JSON under foreign key constraints disabling
export async function restoreBackup(backupPath) {
  try {
    if (!backupPath || !existsSync(backupPath)) {
      return { success: false, message: 'Backup file not found' }
    }

    const zip = new AdmZip(backupPath)

    // Check if database JSON exists inside zip
    const dbEntry = zip.getEntry('database/data_backup.json')
    if (!dbEntry) {
      return {
        success: false,
        message: 'Invalid backup file: Database data not found inside archive'
      }
    }

    const backupData = JSON.parse(dbEntry.getData().toString('utf8'))
    const db = getDbConnection()
    const connection = await db.getConnection()

    try {
      await connection.execute('SET FOREIGN_KEY_CHECKS = 0')

      for (const [tableName, rows] of Object.entries(backupData)) {
        await connection.execute(`TRUNCATE TABLE \`${tableName}\``)
        if (rows.length === 0) continue

        const keys = Object.keys(rows[0])
        const columnsString = keys.map((k) => `\`${k}\``).join(', ')
        const placeholders = keys.map(() => '?').join(', ')
        const sql = `INSERT INTO \`${tableName}\` (${columnsString}) VALUES (${placeholders})`

        for (const row of rows) {
          const values = keys.map((k) => {
            const val = row[k]
            // Format ISO datetime string for MySQL if applicable
            if (typeof val === 'string' && val.includes('T') && val.endsWith('Z')) {
              return val.replace('T', ' ').slice(0, 19)
            }
            return val
          })
          await connection.execute(sql, values)
        }
      }
    } catch (dbErr) {
      throw dbErr
    } finally {
      await connection.execute('SET FOREIGN_KEY_CHECKS = 1')
      connection.release()
    }

    const userDataPath = app.getPath('userData')
    const photosDir = join(userDataPath, 'photos')
    const qrDir = join(userDataPath, 'qrcodes')
    const importsDir = join(userDataPath, 'imports')

    // Helper to safely clear folder
    const clearFolder = (dir) => {
      if (existsSync(dir)) {
        try {
          rmSync(dir, { recursive: true, force: true })
        } catch (e) {
          console.error(`Failed to clean directory ${dir}:`, e)
        }
      }
      mkdirSync(dir, { recursive: true })
    }

    // Clean old files
    clearFolder(photosDir)
    clearFolder(qrDir)
    clearFolder(importsDir)

    // Extract folders if they exist in the zip
    const entries = zip.getEntries()
    entries.forEach((entry) => {
      if (entry.entryName.startsWith('photos/') && !entry.isDirectory) {
        zip.extractEntryTo(entry.entryName, userDataPath, true, true)
      } else if (entry.entryName.startsWith('qrcodes/') && !entry.isDirectory) {
        zip.extractEntryTo(entry.entryName, userDataPath, true, true)
      } else if (entry.entryName.startsWith('imports/') && !entry.isDirectory) {
        zip.extractEntryTo(entry.entryName, userDataPath, true, true)
      }
    })

    await logAudit('SYSTEM_RESTORE', 'system', null, { backupPath })
    return { success: true, message: 'Backup restored successfully' }
  } catch (error) {
    console.error('Restore error:', error)
    return { success: false, message: `Restore failed: ${error.message}` }
  }
}
