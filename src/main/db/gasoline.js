import { getDbConnection } from './connection.js'
import { getSettings } from './settings.js'
import { logAudit } from './audit.js'
import XLSX from 'xlsx'

// Helper: Calculate week range starting Monday, ending Sunday
export function getWeekRange(dateStr) {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    // Fallback: return today's week range
    const today = new Date()
    return getWeekRange(today.toISOString().split('T')[0])
  }
  const day = date.getDay() // 0 = Sunday, 1 = Monday...
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMonday)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0]
  }
}

// Helper: Parse fractional liter string like "1 & 1/2" or "1/2"
export function parseLiters(val) {
  if (typeof val === 'number') return val
  if (!val || typeof val !== 'string') return 0

  let total = 0
  const normalized = val.trim().toLowerCase()

  // E.g. "1 & 1/2"
  if (normalized.includes('&')) {
    const parts = normalized.split('&')
    total += parseFloat(parts[0]) || 0
    total += parseFraction(parts[1])
  } else if (normalized.includes('/')) {
    total += parseFraction(normalized)
  } else {
    total += parseFloat(normalized) || 0
  }
  return total
}

function parseFraction(str) {
  const clean = str.trim()
  if (clean.includes('/')) {
    const parts = clean.split('/')
    const num = parseFloat(parts[0]) || 0
    const den = parseFloat(parts[1]) || 1
    return num / den
  }
  return parseFloat(clean) || 0
}

// Helper: Excel Serial Date to JS Date String (YYYY-MM-DD)
export function excelDateToJSDate(serial) {
  if (typeof serial === 'string') {
    // If it's already a date-like string
    const d = new Date(serial)
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0]
    }
    return serial
  }
  if (!serial || isNaN(serial)) return new Date().toISOString().split('T')[0]

  const utc_days = Math.floor(serial - 25569)
  const utc_value = utc_days * 86400
  const date_info = new Date(utc_value * 1000)
  return date_info.toISOString().split('T')[0]
}

// ─── CRUD Functions ──────────────────────────────────────────────────────────

export async function getGasolineSubsidies(startDate, endDate) {
  try {
    const db = getDbConnection()
    let query = `
      SELECT gs.*, 
             s.staff_id as formatted_staff_id, 
             s.first_name, 
             s.last_name, 
             r.role_name
      FROM gasoline_subsidies gs
      JOIN staff s ON gs.staff_id = s.id
      LEFT JOIN roles r ON s.role_id = r.id
    `
    const params = []

    if (startDate && endDate) {
      query += ` WHERE gs.date BETWEEN ? AND ?`
      params.push(startDate, endDate)
    }

    query += ` ORDER BY gs.date DESC, gs.created_at DESC`

    const [rows] = await db.execute(query, params)
    return rows.map((r) => ({
      ...r,
      rider_name: `${r.first_name} ${r.last_name}`
    }))
  } catch (error) {
    console.error('getGasolineSubsidies error:', error)
    return []
  }
}

export async function getRiderWeeklyUsage(staffId, dateStr) {
  try {
    const db = getDbConnection()
    const range = getWeekRange(dateStr)
    const [rows] = await db.execute(
      'SELECT SUM(liters) as total FROM gasoline_subsidies WHERE staff_id = ? AND date BETWEEN ? AND ? AND is_promo = 0',
      [staffId, range.start, range.end]
    )
    return parseFloat(rows[0].total) || 0
  } catch (error) {
    console.error('getRiderWeeklyUsage error:', error)
    return 0
  }
}

export async function saveGasolineEntry(entry) {
  const db = getDbConnection()
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    const settings = await getSettings()
    const price = parseFloat(settings.gasoline_price) || 80
    const discountRate = parseFloat(settings.gasoline_discount) || 0.6

    const liters = parseFloat(entry.liters) || 0
    const isPromo = entry.is_promo ? 1 : 0
    const status = entry.status || 'unpaid'

    let amount = 0
    let subsidy = 0
    let promoValue = 0

    if (isPromo) {
      promoValue = liters * price
      amount = 0
      subsidy = promoValue // Employer covers 100% of price
    } else {
      // Normal transaction math
      amount = liters * (price * (1 - discountRate)) // Rider copay

      if (status === 'PAID') {
        subsidy = liters * (price * discountRate) // Employer portion only
      } else {
        subsidy = liters * price // Employer covers full cost initially
      }
    }

    if (entry.id) {
      // Update
      await connection.execute(
        `
        UPDATE gasoline_subsidies
        SET staff_id = ?, liters = ?, date = ?, amount = ?, subsidy = ?, status = ?, is_promo = ?, promo_value = ?
        WHERE id = ?
      `,
        [entry.staff_id, liters, entry.date, amount, subsidy, status, isPromo, promoValue, entry.id]
      )

      await logAudit('GASOLINE_UPDATE', 'gasoline_subsidies', entry.id, {
        liters,
        date: entry.date,
        status
      })
    } else {
      // Insert
      const [res] = await connection.execute(
        `
        INSERT INTO gasoline_subsidies (staff_id, liters, date, amount, subsidy, status, is_promo, promo_value)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [entry.staff_id, liters, entry.date, amount, subsidy, status, isPromo, promoValue]
      )

      await logAudit('GASOLINE_CREATE', 'gasoline_subsidies', res.insertId, {
        liters,
        date: entry.date,
        status
      })
    }

    await connection.commit()
    return { success: true }
  } catch (error) {
    await connection.rollback()
    console.error('saveGasolineEntry error:', error)
    return { success: false, message: error.message || 'Failed to save gasoline subsidy entry' }
  } finally {
    connection.release()
  }
}

export async function deleteGasolineEntry(id) {
  try {
    const db = getDbConnection()
    await db.execute('DELETE FROM gasoline_subsidies WHERE id = ?', [id])
    await logAudit('GASOLINE_DELETE', 'gasoline_subsidies', id, null)
    return { success: true }
  } catch (error) {
    console.error('deleteGasolineEntry error:', error)
    return { success: false, message: error.message || 'Failed to delete entry' }
  }
}

// Import helper: Fuzzy matches name string to active staff members
async function matchStaffByName(riderName, connection) {
  const cleanName = riderName.trim().toLowerCase().replace(/\s+/g, ' ')
  const [rows] = await connection.execute(
    "SELECT id, first_name, last_name FROM staff WHERE employment_status = 'Active'"
  )

  // Try direct match
  for (const s of rows) {
    const dbFull = `${s.first_name} ${s.last_name}`.toLowerCase()
    if (dbFull === cleanName) return s.id
  }

  // Try matching parts of the name
  for (const s of rows) {
    const first = s.first_name.toLowerCase()
    const last = s.last_name.toLowerCase()
    if (cleanName.includes(first) && cleanName.includes(last)) return s.id
  }

  return null
}

export async function importGasolineFromExcel(filePath) {
  const db = getDbConnection()
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    const workbook = XLSX.readFile(filePath)
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

    // Parse dynamic settings if we find them, otherwise default
    let price = 80
    let discountRate = 0.6

    // Scan top rows for price configuration
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i]
      if (!row) continue
      row.forEach((cell, idx) => {
        if (typeof cell === 'string' && cell.toLowerCase().includes('price of gasoline')) {
          // Look for number in subsequent cells
          for (let j = idx + 1; j < row.length; j++) {
            if (typeof row[j] === 'number') {
              price = row[j]
              break
            }
          }
        }
      })
    }

    let importCount = 0
    let skipCount = 0

    // Start scanning transactions (normally starts from Row 3/index 3 down)
    for (let i = 3; i < rows.length; i++) {
      const row = rows[i]
      if (!row || !row[0] || row[0] === 'LEGEND' || String(row[0]).includes('WEEK')) continue

      const riderName = String(row[0])
      const litersRaw = row[1]
      const dateRaw = row[2]
      const statusRaw = row[4] ? String(row[4]).toUpperCase().trim() : 'PAID'

      // Match staff member in database
      const staffId = await matchStaffByName(riderName, connection)
      if (!staffId) {
        console.warn(
          `Excel import: Rider '${riderName}' not found in staff database, skipping row ${i}`
        )
        skipCount++
        continue
      }

      const liters = parseLiters(litersRaw)
      const date = excelDateToJSDate(dateRaw)
      const status = statusRaw.includes('UNPAID') ? 'unpaid' : 'PAID'

      // Check if it's a free promo row (REDEEMED / Free 1ltr)
      const rowStr = JSON.stringify(row).toLowerCase()
      const isPromo = rowStr.includes('redeemed') || rowStr.includes('free 1') ? 1 : 0

      let amount = 0
      let subsidy = 0
      let promoValue = 0

      if (isPromo) {
        promoValue = liters * price
        amount = 0
        subsidy = promoValue
      } else {
        amount = liters * (price * (1 - discountRate))
        if (status === 'PAID') {
          subsidy = liters * (price * discountRate)
        } else {
          subsidy = liters * price
        }
      }

      // Check if record already exists to prevent duplicate imports
      const [existing] = await connection.execute(
        'SELECT id FROM gasoline_subsidies WHERE staff_id = ? AND date = ? AND liters = ? AND is_promo = ?',
        [staffId, date, liters, isPromo]
      )

      if (existing.length === 0) {
        await connection.execute(
          `
          INSERT INTO gasoline_subsidies (staff_id, liters, date, amount, subsidy, status, is_promo, promo_value)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [staffId, liters, date, amount, subsidy, status, isPromo, promoValue]
        )
        importCount++
      } else {
        skipCount++
      }
    }

    await connection.commit()
    await logAudit('GASOLINE_EXCEL_IMPORT', 'gasoline_subsidies', null, {
      file: filePath,
      imported: importCount
    })
    return { success: true, imported: importCount, skipped: skipCount }
  } catch (error) {
    await connection.rollback()
    console.error('importGasolineFromExcel error:', error)
    return { success: false, message: error.message || 'Excel parsing failed' }
  } finally {
    connection.release()
  }
}
