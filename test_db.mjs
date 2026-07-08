import fs from 'fs'
import mysql from 'mysql2/promise'

async function test() {
  try {
    const config = JSON.parse(fs.readFileSync('./src/main/db/config.json', 'utf8'))
    console.log('Connecting to database with config:', {
      host: config.host,
      port: config.port,
      user: config.user,
      database: config.database
    })

    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database
    })

    console.log('Connected.')

    const [settingsRows] = await connection.execute('SELECT * FROM settings')
    console.log('Settings Rows in DB:', settingsRows)

    const [filterRows] = await connection.execute('SELECT * FROM filter_definitions')
    console.log('Filter Definitions in DB:', filterRows)

    await connection.end()
    process.exit(0)
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  }
}

test()
