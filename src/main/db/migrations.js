import { initDbConnection, getDbConnection } from './connection.js'
import bcrypt from 'bcryptjs'

export async function runMigrations() {
  // Ensure connection pool is initialized
  const db = await initDbConnection()

  // Array of CREATE TABLE statements in MySQL dialect
  const tables = [
    // 1. admin table
    `CREATE TABLE IF NOT EXISTS admin (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;`,

    // 2. roles table
    `CREATE TABLE IF NOT EXISTS roles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      role_name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      status VARCHAR(20) DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;`,

    // 3. departments table
    `CREATE TABLE IF NOT EXISTS departments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      department_name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      status VARCHAR(20) DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;`,

    // 4. staff table
    `CREATE TABLE IF NOT EXISTS staff (
      id INT AUTO_INCREMENT PRIMARY KEY,
      staff_id VARCHAR(100) UNIQUE NOT NULL,
      employee_number VARCHAR(100) UNIQUE,
      first_name VARCHAR(100) NOT NULL,
      middle_name VARCHAR(100),
      last_name VARCHAR(100) NOT NULL,
      gender VARCHAR(20),
      birth_date VARCHAR(20),
      role_id INT,
      department_id INT,
      contact_number VARCHAR(50),
      email VARCHAR(100),
      address TEXT,
      date_hired VARCHAR(20),
      employment_status VARCHAR(20) DEFAULT 'Active',
      photo_path VARCHAR(255),
      qr_code_path VARCHAR(255),
      emergency_contact_name VARCHAR(100),
      emergency_contact_number VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    ) ENGINE=InnoDB;`,

    // 5. role_history table
    `CREATE TABLE IF NOT EXISTS role_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      staff_id INT NOT NULL,
      old_role_id INT,
      new_role_id INT,
      changed_by VARCHAR(100) DEFAULT 'Admin',
      changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
      FOREIGN KEY (old_role_id) REFERENCES roles(id) ON DELETE SET NULL,
      FOREIGN KEY (new_role_id) REFERENCES roles(id) ON DELETE SET NULL
    ) ENGINE=InnoDB;`,

    // 6. attendance table
    `CREATE TABLE IF NOT EXISTS attendance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      staff_id INT NOT NULL,
      date VARCHAR(20) NOT NULL,
      time_in VARCHAR(20),
      time_out VARCHAR(20),
      status VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_staff_date (staff_id, date),
      FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;`,

    // 7. settings table
    `CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(100) PRIMARY KEY,
      \`value\` TEXT NOT NULL
    ) ENGINE=InnoDB;`,

    // 8. audit_logs table
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(100),
      entity_id INT,
      details TEXT,
      performed_by VARCHAR(100) DEFAULT 'Admin',
      performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;`,

    // 9. imported_datasets table
    `CREATE TABLE IF NOT EXISTS imported_datasets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL,
      original_file_path VARCHAR(255) NOT NULL,
      description TEXT,
      columns_json TEXT NOT NULL,
      row_count INT DEFAULT 0,
      imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;`,
    // 11. filter_definitions table
    `CREATE TABLE IF NOT EXISTS filter_definitions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filter_name VARCHAR(100) NOT NULL,
      column_key VARCHAR(100) NOT NULL,
      filter_type VARCHAR(50) NOT NULL,
      options_json TEXT,
      display_order INT DEFAULT 0,
      status VARCHAR(20) DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;`,

    // 12. gasoline_subsidies table
    `CREATE TABLE IF NOT EXISTS gasoline_subsidies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      staff_id INT NOT NULL,
      liters DECIMAL(5,2) NOT NULL,
      date VARCHAR(20) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      subsidy DECIMAL(10,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'unpaid',
      is_promo TINYINT(1) DEFAULT 0,
      promo_value DECIMAL(10,2) DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;`
  ]

  // Create tables sequentially
  for (const sql of tables) {
    await db.query(sql)
  }

  // Seed default admin user if none exists
  const [adminRows] = await db.query('SELECT COUNT(*) as count FROM admin')
  if (adminRows[0].count === 0) {
    const defaultPassword = 'admin123'
    const salt = bcrypt.genSaltSync(10)
    const hash = bcrypt.hashSync(defaultPassword, salt)
    await db.query('INSERT INTO admin (username, password_hash) VALUES (?, ?)', ['admin', hash])
    console.log('Seeded default admin user (username: admin, password: admin123)')
  }

  // Seed default settings using INSERT IGNORE so new settings are always added safely
  const defaultSettings = [
    { key: 'present_cutoff', value: '08:00' },
    { key: 'late_cutoff', value: '08:15' },
    { key: 'work_start', value: '08:00' },
    { key: 'org_name', value: 'My Organization' },
    { key: 'org_address', value: 'Manila, Philippines' },
    { key: 'working_days', value: JSON.stringify([1, 2, 3, 4, 5]) },
    { key: 'gasoline_price', value: '80' },
    { key: 'gasoline_discount', value: '0.6' },
    { key: 'gasoline_weekly_limit', value: '3' }
  ]
  for (const setting of defaultSettings) {
    await db.query('INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES (?, ?)', [setting.key, setting.value])
  }
  console.log('Seeded default application settings')
}
