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
    
    // Parse as JSON array of objects
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
    
    if (rows.length === 0) {
      unlinkSync(storedFilePath)
      return { success: false, message: 'The uploaded file is empty' }
    }
    
    // Extract column headers (keys from first row)
    const columns = Object.keys(rows[0])
    
    // Insert dataset metadata into MySQL database
    const [datasetResult] = await db.execute(`
      INSERT INTO imported_datasets (file_name, original_file_path, description, columns_json, row_count)
      VALUES (?, ?, ?, ?, ?)
    `, [fileName, storedFilePath, description || '', JSON.stringify(columns), rows.length])
    
    const datasetId = datasetResult.insertId
    
    await logAudit('DATASET_IMPORTED', 'imported_datasets', datasetId, { fileName, rowCount: rows.length })
    
    return { success: true, id: datasetId, fileName, rowCount: rows.length }
  } catch (error) {
    console.error('Import dataset error:', error)
    // Clean up stored file on failure
    if (existsSync(storedFilePath)) {
      try { unlinkSync(storedFilePath) } catch (e) {}
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
      try { unlinkSync(dataset.original_file_path) } catch (e) { console.error(e) }
    }
    
    await db.execute('DELETE FROM imported_datasets WHERE id = ?', [id])
    
    await logAudit('DATASET_DELETED', 'imported_datasets', id, { fileName: dataset.file_name })
    return { success: true }
  } catch (error) {
    console.error('Delete dataset error:', error)
    return { success: false, message: error.message }
  }
}

// CHANGED: added helper to filter Excel rows dynamically in JavaScript memory
function filterRowsInMemory(rows, activeFilters) {
  if (!activeFilters || activeFilters.length === 0) return rows
  
  return rows.filter(row => {
    for (const f of activeFilters) {
      const value = row[f.column_key]
      const strVal = value !== undefined && value !== null ? String(value).trim() : ''
      
      if (f.filter_type === 'date_range') {
        if (f.val1 && f.val2) {
          if (strVal < f.val1 || strVal > f.val2) return false
        } else if (f.val1) {
          if (strVal < f.val1) return false
        } else if (f.val2) {
          if (strVal > f.val2) return false
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
    const [datasetRows] = await db.execute('SELECT * FROM imported_datasets WHERE id = ?', [datasetId])
    const dataset = datasetRows[0]
    if (!dataset) return { success: false, message: 'Dataset not found' }
    
    if (!existsSync(dataset.original_file_path)) {
      return { success: false, message: 'Source file not found on disk' }
    }
    
    // Read from Excel file directly
    const workbook = XLSX.readFile(dataset.original_file_path)
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    
    // Parse as JSON rows
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
    
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

// CHANGED: aggregateDataset reads rows directly from Excel file on disk and computes stats in memory
export async function aggregateDataset(datasetId, activeFilters, aggregateConfig) {
  try {
    const db = getDbConnection()
    const [datasetRows] = await db.execute('SELECT * FROM imported_datasets WHERE id = ?', [datasetId])
    const dataset = datasetRows[0]
    if (!dataset) return { success: false, message: 'Dataset not found' }
    
    if (!existsSync(dataset.original_file_path)) {
      return { success: false, message: 'Source file not found on disk' }
    }
    
    // Read Excel file directly
    const workbook = XLSX.readFile(dataset.original_file_path)
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
    
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
        filteredRows.forEach(r => {
          sum += parseFloat(r[aggregateConfig.sum_column]) || 0
        })
        sum_val = sum
      }
      if (aggregateConfig.avg_column) {
        let sum = 0
        let count = 0
        filteredRows.forEach(r => {
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
        filteredRows.forEach(r => {
          const val = parseFloat(r[aggregateConfig.min_column])
          if (!isNaN(val) && val < min) min = val
        })
        min_val = min === Infinity ? 0 : min
      }
      if (aggregateConfig.max_column) {
        let max = -Infinity
        filteredRows.forEach(r => {
          const val = parseFloat(r[aggregateConfig.max_column])
          if (!isNaN(val) && val > max) max = val
        })
        max_val = max === -Infinity ? 0 : max
      }
      if (aggregateConfig.weight_column && aggregateConfig.weight_min !== undefined && aggregateConfig.weight_max !== undefined) {
        const minW = parseFloat(aggregateConfig.weight_min)
        const maxW = parseFloat(aggregateConfig.weight_max)
        if (!isNaN(minW) && !isNaN(maxW)) {
          let count = 0
          filteredRows.forEach(r => {
            const val = parseFloat(r[aggregateConfig.weight_column])
            if (!isNaN(val) && val >= minW && val <= maxW) {
              count++
            }
          })
          parcel_range_count = count
        }
      }
    }
    
    return {
      success: true,
      summary: {
        total_count: filteredRows.length,
        sum_val,
        avg_val,
        min_val,
        max_val,
        parcel_range_count
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
    const [rows] = await db.execute("SELECT * FROM filter_definitions WHERE status = 'Active' ORDER BY display_order ASC")
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
    const [result] = await db.execute(`
      INSERT INTO filter_definitions (filter_name, column_key, filter_type, options_json, display_order, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      filter.filter_name,
      filter.column_key,
      filter.filter_type,
      filter.options_json || '[]',
      filter.display_order || 0,
      filter.status || 'Active'
    ])
    
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
    await db.execute(`
      UPDATE filter_definitions
      SET filter_name = ?, column_key = ?, filter_type = ?, 
          options_json = ?, display_order = ?, status = ?
      WHERE id = ?
    `, [
      filter.filter_name,
      filter.column_key,
      filter.filter_type,
      filter.options_json || '[]',
      filter.display_order || 0,
      filter.status || 'Active',
      id
    ])
    
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
