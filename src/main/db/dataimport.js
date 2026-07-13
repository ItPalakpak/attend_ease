import XLSX from 'xlsx'
import { getDbConnection } from './connection.js'
import { logAudit } from './audit.js'
import { app } from 'electron'
import { join, basename, extname } from 'path'
import { existsSync, mkdirSync, copyFileSync, unlinkSync } from 'fs'

export function getImportStoragePath() {
  const userDataPath = app.getPath('userData')
  const importsDir = join(userDataPath, 'imports')
  if (!existsSync(importsDir)) mkdirSync(importsDir, { recursive: true })
  return importsDir
}

// CHANGED: importDataset now only stores file metadata in DB and saves file on disk (no database row inserts)
export async function importDataset(filePath, description) {
  const db = getDbConnection()
  const importsDir = getImportStoragePath()

  if (!existsSync(filePath)) {
    return { success: false, message: 'Source file not found' }
  }

  const fileName = basename(filePath)
  const timestamp = Date.now()
  const ext = extname(filePath)
  const storedFileName = `${timestamp}_${fileName}`
  const storedFilePath = join(importsDir, storedFileName)

  // Copy original file to local app data folder
  copyFileSync(filePath, storedFilePath)

  try {
    // Read and parse file with SheetJS to verify formatting and row count
    const workbook = XLSX.readFile(storedFilePath)
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    // Parse as JSON array of objects with header row detection
    const headerIdx = findHeaderRowIndex(worksheet)
    const rows = XLSX.utils.sheet_to_json(worksheet, { range: headerIdx, defval: '' })

    if (rows.length === 0) {
      unlinkSync(storedFilePath)
      return { success: false, message: 'The uploaded file is empty' }
    }

    // Extract column headers (keys from first row)
    const columns = Object.keys(rows[0])

    // Insert dataset metadata into MySQL database
    const [datasetResult] = await db.execute(
      `
      INSERT INTO imported_datasets (file_name, original_file_path, description, columns_json, row_count)
      VALUES (?, ?, ?, ?, ?)
    `,
      [fileName, storedFilePath, description || '', JSON.stringify(columns), rows.length]
    )

    const datasetId = datasetResult.insertId

    await logAudit('DATASET_IMPORTED', 'imported_datasets', datasetId, {
      fileName,
      rowCount: rows.length
    })

    return { success: true, id: datasetId, fileName, rowCount: rows.length }
  } catch (error) {
    console.error('Import dataset error:', error)
    // Clean up stored file on failure
    if (existsSync(storedFilePath)) {
      try {
        unlinkSync(storedFilePath)
      } catch (e) {}
    }
    return { success: false, message: `Failed to parse file: ${error.message}` }
  }
}

// CHANGED: getDatasets is asynchronous and fetches metadata from MySQL
export async function getDatasets() {
  try {
    const db = getDbConnection()
    const [rows] = await db.execute('SELECT * FROM imported_datasets ORDER BY imported_at DESC')
    return rows
  } catch (error) {
    console.error('Get datasets error:', error)
    return []
  }
}

// CHANGED: deleteDataset is asynchronous and deletes database metadata and disk files
export async function deleteDataset(id) {
  try {
    const db = getDbConnection()
    const [datasetRows] = await db.execute('SELECT * FROM imported_datasets WHERE id = ?', [id])
    const dataset = datasetRows[0]
    if (!dataset) return { success: false, message: 'Dataset not found' }

    // Delete local file
    if (dataset.original_file_path && existsSync(dataset.original_file_path)) {
      try {
        unlinkSync(dataset.original_file_path)
      } catch (e) {
        console.error(e)
      }
    }

    await db.execute('DELETE FROM imported_datasets WHERE id = ?', [id])

    await logAudit('DATASET_DELETED', 'imported_datasets', id, { fileName: dataset.file_name })
    return { success: true }
  } catch (error) {
    console.error('Delete dataset error:', error)
    return { success: false, message: error.message }
  }
}

// Helper to dynamically scan for the first row containing target header keywords in spreadsheet files
function findHeaderRowIndex(worksheet) {
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
  const targetHeaders = ['tracking number', 'parcel status', 'delivery date', 'final operation person', 'actual weight']
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (Array.isArray(row)) {
      const hasHeader = row.some(cell => {
        const cellStr = String(cell || '').trim().toLowerCase()
        return targetHeaders.includes(cellStr)
      })
      if (hasHeader) {
        return i
      }
    }
  }
  return 0
}

// Helper to parse dates robustly (handles strings and Excel serial date numbers)
function parseDateStr(str) {
  if (str === undefined || str === null || str === '') return null
  const s = String(str).trim()
  if (!s) return null

  // Check if it's an Excel date serial number
  const num = Number(s)
  if (!isNaN(num) && num > 30000 && num < 70000) {
    const excelEpoch = new Date(1899, 11, 30)
    const msPerDay = 24 * 60 * 60 * 1000
    return new Date(excelEpoch.getTime() + num * msPerDay)
  }

  // Try YYYY-MM-DD
  const ymdMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (ymdMatch) {
    return new Date(parseInt(ymdMatch[1]), parseInt(ymdMatch[2]) - 1, parseInt(ymdMatch[3]))
  }

  // Try M/D/YYYY
  const mdyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
  if (mdyMatch) {
    return new Date(parseInt(mdyMatch[3]), parseInt(mdyMatch[1]) - 1, parseInt(mdyMatch[2]))
  }

  const parsed = new Date(s)
  return isNaN(parsed.getTime()) ? null : parsed
}

function formatDateToYMD(date) {
  if (!date) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getRowDateYMD(row) {
  const status = String(row['Parcel Status'] || '').trim().toLowerCase()
  if (status === 'delivered') {
    const delDate = String(row['Delivery Date'] || '').trim()
    if (delDate) {
      const d = parseDateStr(delDate)
      if (d) return formatDateToYMD(d)
    }
  }
  const finalOpTime = String(row['Final Operation Time'] || '').trim()
  if (finalOpTime) {
    const d = parseDateStr(finalOpTime)
    if (d) return formatDateToYMD(d)
  }
  return ''
}

function parseWeight(weightVal) {
  if (weightVal === undefined || weightVal === null || weightVal === '') return 0
  const clean = String(weightVal).replace(/[^0-9.]/g, '')
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

// CHANGED: added helper to filter Excel rows dynamically in JavaScript memory
function filterRowsInMemory(rows, activeFilters) {
  if (!activeFilters || activeFilters.length === 0) return rows

  return rows.filter((row) => {
    for (const f of activeFilters) {
      if (f.filter_type === 'global_search') {
        const query = String(f.val1 || '').trim().toLowerCase()
        if (query) {
          const rowText = Object.values(row)
            .map(val => String(val || '').trim().toLowerCase())
            .join(' ')
          if (!rowText.includes(query)) return false
        }
        continue
      }

      const value = row[f.column_key]
      const strVal = value !== undefined && value !== null ? String(value).trim() : ''

      if (f.filter_type === 'date_range') {
        const rowDate = getRowDateYMD(row)
        if (!rowDate) return false
        if (f.val1 && f.val2) {
          if (rowDate < f.val1 || rowDate > f.val2) return false
        } else if (f.val1) {
          if (rowDate < f.val1) return false
        } else if (f.val2) {
          if (rowDate > f.val2) return false
        }
      } else if (f.column_key === 'Actual weight' && f.filter_type === 'dropdown') {
        if (f.val1 !== undefined && f.val1 !== null && f.val1 !== '') {
          const weight = parseWeight(strVal)
          const range = String(f.val1).trim()
          if (range === '0-9 kgs') {
            if (weight < 0 || weight > 9) return false
          } else if (range === '10-19 kgs') {
            if (weight < 10 || weight > 19) return false
          } else if (range === '20+ kgs') {
            if (weight < 20) return false
          }
        }
      } else if (f.filter_type === 'number_range') {
        const numVal = parseFloat(strVal)
        const minVal = parseFloat(f.val1)
        const maxVal = parseFloat(f.val2)

        if (!isNaN(numVal)) {
          if (!isNaN(minVal) && !isNaN(maxVal)) {
            if (numVal < minVal || numVal > maxVal) return false
          } else if (!isNaN(minVal)) {
            if (numVal < minVal) return false
          } else if (!isNaN(maxVal)) {
            if (numVal > maxVal) return false
          }
        } else {
          return false
        }
      } else if (f.filter_type === 'exact_match' || f.filter_type === 'dropdown') {
        if (f.val1 !== undefined && f.val1 !== null && f.val1 !== '') {
          if (strVal.toLowerCase() !== String(f.val1).toLowerCase().trim()) return false
        }
      } else if (f.filter_type === 'contains') {
        if (f.val1 !== undefined && f.val1 !== null && f.val1 !== '') {
          if (!strVal.toLowerCase().includes(String(f.val1).toLowerCase().trim())) return false
        }
      }
    }
    return true
  })
}

// CHANGED: queryDatasetRows reads rows directly from Excel file on disk and filters in memory
export async function queryDatasetRows(datasetId, activeFilters, limit = 50, offset = 0) {
  try {
    const db = getDbConnection()
    const [datasetRows] = await db.execute('SELECT * FROM imported_datasets WHERE id = ?', [
      datasetId
    ])
    const dataset = datasetRows[0]
    if (!dataset) return { success: false, message: 'Dataset not found' }

    if (!existsSync(dataset.original_file_path)) {
      return { success: false, message: 'Source file not found on disk' }
    }

    // Read from Excel file directly
    const workbook = XLSX.readFile(dataset.original_file_path)
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    // Parse as JSON rows with header row detection
    const headerIdx = findHeaderRowIndex(worksheet)
    const rows = XLSX.utils.sheet_to_json(worksheet, { range: headerIdx, defval: '' })

    // Filter rows in memory
    const filteredRows = filterRowsInMemory(rows, activeFilters)

    // Paginate in memory
    const paginated = filteredRows.slice(offset, offset + limit)

    const parsedRows = paginated.map((r, idx) => ({
      id: offset + idx + 1,
      row_index: offset + idx,
      data: r
    }))

    return {
      success: true,
      total: filteredRows.length,
      rows: parsedRows
    }
  } catch (error) {
    console.error('Query dataset rows error:', error)
    return { success: false, message: error.message }
  }
}

// NEW: getDatasetMetadata returns unique final operation persons and the date range
export async function getDatasetMetadata(datasetId) {
  try {
    const db = getDbConnection()
    const [datasetRows] = await db.execute('SELECT * FROM imported_datasets WHERE id = ?', [
      datasetId
    ])
    const dataset = datasetRows[0]
    if (!dataset) return { success: false, message: 'Dataset not found' }

    if (!existsSync(dataset.original_file_path)) {
      return { success: false, message: 'Source file not found on disk' }
    }

    const workbook = XLSX.readFile(dataset.original_file_path)
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    const headerIdx = findHeaderRowIndex(worksheet)
    const rows = XLSX.utils.sheet_to_json(worksheet, { range: headerIdx, defval: '' })

    const ridersSet = new Set()
    let minDate = ''
    let maxDate = ''

    rows.forEach((row) => {
      const rider = String(row['Final Operation Person'] || '').trim()
      if (rider) ridersSet.add(rider)

      const date = getRowDateYMD(row)
      if (date) {
        if (!minDate || date < minDate) minDate = date
        if (!maxDate || date > maxDate) maxDate = date
      }
    })

    return {
      success: true,
      riders: Array.from(ridersSet).sort(),
      minDate,
      maxDate
    }
  } catch (error) {
    console.error('Get dataset metadata error:', error)
    return { success: false, message: error.message }
  }
}

// CHANGED: aggregateDataset reads rows directly from Excel file on disk and computes stats in memory
export async function aggregateDataset(datasetId, activeFilters, aggregateConfig) {
  try {
    const db = getDbConnection()
    const [datasetRows] = await db.execute('SELECT * FROM imported_datasets WHERE id = ?', [
      datasetId
    ])
    const dataset = datasetRows[0]
    if (!dataset) return { success: false, message: 'Dataset not found' }

    if (!existsSync(dataset.original_file_path)) {
      return { success: false, message: 'Source file not found on disk' }
    }

    // Read Excel file directly
    const workbook = XLSX.readFile(dataset.original_file_path)
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    const headerIdx = findHeaderRowIndex(worksheet)
    const rows = XLSX.utils.sheet_to_json(worksheet, { range: headerIdx, defval: '' })

    // Filter rows in memory
    const filteredRows = filterRowsInMemory(rows, activeFilters)

    let sum_val = null
    let avg_val = null
    let min_val = null
    let max_val = null
    let parcel_range_count = null

    if (aggregateConfig) {
      if (aggregateConfig.sum_column) {
        let sum = 0
        filteredRows.forEach((r) => {
          sum += parseFloat(r[aggregateConfig.sum_column]) || 0
        })
        sum_val = sum
      }
      if (aggregateConfig.avg_column) {
        let sum = 0
        let count = 0
        filteredRows.forEach((r) => {
          const val = parseFloat(r[aggregateConfig.avg_column])
          if (!isNaN(val)) {
            sum += val
            count++
          }
        })
        avg_val = count > 0 ? sum / count : 0
      }
      if (aggregateConfig.min_column) {
        let min = Infinity
        filteredRows.forEach((r) => {
          const val = parseFloat(r[aggregateConfig.min_column])
          if (!isNaN(val) && val < min) min = val
        })
        min_val = min === Infinity ? 0 : min
      }
      if (aggregateConfig.max_column) {
        let max = -Infinity
        filteredRows.forEach((r) => {
          const val = parseFloat(r[aggregateConfig.max_column])
          if (!isNaN(val) && val > max) max = val
        })
        max_val = max === -Infinity ? 0 : max
      }
      if (
        aggregateConfig.weight_column &&
        aggregateConfig.weight_min !== undefined &&
        aggregateConfig.weight_max !== undefined
      ) {
        const minW = parseFloat(aggregateConfig.weight_min)
        const maxW = parseFloat(aggregateConfig.weight_max)
        if (!isNaN(minW) && !isNaN(maxW)) {
          let count = 0
          filteredRows.forEach((r) => {
            const val = parseFloat(r[aggregateConfig.weight_column])
            if (!isNaN(val) && val >= minW && val <= maxW) {
              count++
            }
          })
          parcel_range_count = count
        }
      }
    }

    // Compute detailed stats for summary cards
    let delivered_count = 0
    let detained_count = 0
    let total_remittance = 0

    filteredRows.forEach((r) => {
      const status = String(r['Parcel Status'] || '').trim().toLowerCase()
      const cod = parseFloat(r['COD Amount']) || 0

      if (status === 'delivered') {
        delivered_count++
        total_remittance += cod
      } else if (status === 'detained') {
        detained_count++
      }
    })

    // Calculate new parcels arrived today across all datasets regardless of active filter using unique Tracking Numbers
    let unique_today_parcels = new Set()
    const todayYMD = formatDateToYMD(new Date())
    try {
      const [allDatasets] = await db.execute('SELECT * FROM imported_datasets')
      for (const d of allDatasets) {
        if (existsSync(d.original_file_path)) {
          const wb = XLSX.readFile(d.original_file_path)
          const sheetName = wb.SheetNames[0]
          const ws = wb.Sheets[sheetName]
          const hIdx = findHeaderRowIndex(ws)
          const dRows = XLSX.utils.sheet_to_json(ws, { range: hIdx, defval: '' })
          
          dRows.forEach((r) => {
            const inboundStr = String(r['Inbound Time'] || '').trim()
            const trackingNum = String(r['Tracking Number'] || '').trim()
            if (inboundStr && trackingNum) {
              const parsedInbound = parseDateStr(inboundStr)
              if (parsedInbound) {
                const inboundYMD = formatDateToYMD(parsedInbound)
                if (inboundYMD === todayYMD) {
                  unique_today_parcels.add(trackingNum)
                }
              }
            }
          })
        }
      }
    } catch (err) {
      console.error("Error calculating today's new parcels count:", err)
    }

    const new_parcels_arrived = unique_today_parcels.size

    console.log(`[aggregateDataset] Today is ${todayYMD}, calculated unique new_parcels_arrived: ${new_parcels_arrived}`)

    // Calculate counts per weight category under active date range / other filters
    let weight_0_9 = 0
    // Keep it compatible if it's 10-19 or others
    let weight_10_19 = 0
    let weight_20_plus = 0
    try {
      const filtersExceptWeight = activeFilters ? activeFilters.filter(f => f.column_key !== 'Actual weight') : []
      const baseRowsForWeight = filterRowsInMemory(rows, filtersExceptWeight)
      baseRowsForWeight.forEach((r) => {
        const weight = parseWeight(r['Actual weight'])
        if (weight >= 0 && weight <= 9) {
          weight_0_9++
        } else if (weight >= 10 && weight <= 19) {
          weight_10_19++
        } else if (weight >= 20) {
          weight_20_plus++
        }
      })
    } catch (err) {
      console.error("Error calculating weight range breakdown:", err)
    }

    return {
      success: true,
      summary: {
        total_count: filteredRows.length,
        sum_val,
        avg_val,
        min_val,
        max_val,
        parcel_range_count,
        delivered_count,
        detained_count,
        total_remittance,
        new_parcels_arrived,
        weight_0_9,
        weight_10_19,
        weight_20_plus
      }
    }
  } catch (error) {
    console.error('Aggregate dataset error:', error)
    return { success: false, message: error.message }
  }
}


// CHANGED: made getFilterDefinitions asynchronous and updated SQLite calls to mysql2
export async function getFilterDefinitions() {
  try {
    const db = getDbConnection()
    const [rows] = await db.execute('SELECT * FROM filter_definitions ORDER BY display_order ASC')
    return rows
  } catch (error) {
    console.error('Get filter definitions error:', error)
    return []
  }
}

// CHANGED: made getActiveFilterDefinitions asynchronous and updated SQLite calls to mysql2
export async function getActiveFilterDefinitions() {
  try {
    const db = getDbConnection()
    const [rows] = await db.execute(
      "SELECT * FROM filter_definitions WHERE status = 'Active' ORDER BY display_order ASC"
    )
    return rows
  } catch (error) {
    console.error('Get active filters error:', error)
    return []
  }
}

// CHANGED: made addFilterDefinition asynchronous and updated SQLite calls to mysql2
export async function addFilterDefinition(filter) {
  try {
    const db = getDbConnection()
    const [result] = await db.execute(
      `
      INSERT INTO filter_definitions (filter_name, column_key, filter_type, options_json, display_order, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [
        filter.filter_name,
        filter.column_key,
        filter.filter_type,
        filter.options_json || '[]',
        filter.display_order || 0,
        filter.status || 'Active'
      ]
    )

    const newId = result.insertId
    await logAudit('FILTER_ADDED', 'filter_definitions', newId, filter)
    return { success: true, id: newId }
  } catch (error) {
    console.error('Add filter definition error:', error)
    return { success: false, message: error.message }
  }
}

// CHANGED: made updateFilterDefinition asynchronous and updated SQLite calls to mysql2
export async function updateFilterDefinition(id, filter) {
  try {
    const db = getDbConnection()
    await db.execute(
      `
      UPDATE filter_definitions
      SET filter_name = ?, column_key = ?, filter_type = ?, 
          options_json = ?, display_order = ?, status = ?
      WHERE id = ?
    `,
      [
        filter.filter_name,
        filter.column_key,
        filter.filter_type,
        filter.options_json || '[]',
        filter.display_order || 0,
        filter.status || 'Active',
        id
      ]
    )

    await logAudit('FILTER_EDITED', 'filter_definitions', id, filter)
    return { success: true }
  } catch (error) {
    console.error('Update filter definition error:', error)
    return { success: false, message: error.message }
  }
}

// CHANGED: made deleteFilterDefinition asynchronous and updated SQLite calls to mysql2
export async function deleteFilterDefinition(id) {
  try {
    const db = getDbConnection()
    const [rows] = await db.execute('SELECT * FROM filter_definitions WHERE id = ?', [id])
    const filter = rows[0]
    if (!filter) return { success: false, message: 'Filter not found' }

    await db.execute('DELETE FROM filter_definitions WHERE id = ?', [id])
    await logAudit('FILTER_DELETED', 'filter_definitions', id, filter)
    return { success: true }
  } catch (error) {
    console.error('Delete filter definition error:', error)
    return { success: false, message: error.message }
  }
}
