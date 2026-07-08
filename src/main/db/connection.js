import mysql from 'mysql2/promise'
import config from './config.json'

let poolInstance = null

// Initialize database: creates the database if it doesn't exist and opens a connection pool
export async function initDbConnection() {
  if (poolInstance) return poolInstance

  // Connect to MySQL without specifying a database to run database auto-creation
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password
  })

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  )
  await connection.end()

  // Create pool instance
  poolInstance = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  })

  return poolInstance
}

export function getDbConnection() {
  if (!poolInstance) {
    throw new Error(
      'Database connection pool has not been initialized. Call initDbConnection() first.'
    )
  }
  return poolInstance
}

export async function closeDbConnection() {
  if (poolInstance) {
    await poolInstance.end()
    poolInstance = null
    console.log('Database connection pool closed')
  }
}
