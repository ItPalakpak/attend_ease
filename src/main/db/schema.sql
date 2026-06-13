CREATE DATABASE IF NOT EXISTS `staff_attendance` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `staff_attendance`;

-- 1. admin table
CREATE TABLE IF NOT EXISTS `admin` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) UNIQUE NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. roles table
CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `role_name` VARCHAR(100) UNIQUE NOT NULL,
  `description` TEXT,
  `status` VARCHAR(20) DEFAULT 'Active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. departments table
CREATE TABLE IF NOT EXISTS `departments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `department_name` VARCHAR(100) UNIQUE NOT NULL,
  `description` TEXT,
  `status` VARCHAR(20) DEFAULT 'Active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 4. staff table
CREATE TABLE IF NOT EXISTS `staff` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `staff_id` VARCHAR(100) UNIQUE NOT NULL,
  `employee_number` VARCHAR(100) UNIQUE,
  `first_name` VARCHAR(100) NOT NULL,
  `middle_name` VARCHAR(100),
  `last_name` VARCHAR(100) NOT NULL,
  `gender` VARCHAR(20),
  `birth_date` VARCHAR(20),
  `role_id` INT,
  `department_id` INT,
  `contact_number` VARCHAR(50),
  `email` VARCHAR(100),
  `address` TEXT,
  `date_hired` VARCHAR(20),
  `employment_status` VARCHAR(20) DEFAULT 'Active',
  `photo_path` VARCHAR(255),
  `qr_code_path` VARCHAR(255),
  `emergency_contact_name` VARCHAR(100),
  `emergency_contact_number` VARCHAR(50),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 5. role_history table
CREATE TABLE IF NOT EXISTS `role_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `staff_id` INT NOT NULL,
  `old_role_id` INT,
  `new_role_id` INT,
  `changed_by` VARCHAR(100) DEFAULT 'Admin',
  `changed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`old_role_id`) REFERENCES `roles`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`new_role_id`) REFERENCES `roles`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 6. attendance table
CREATE TABLE IF NOT EXISTS `attendance` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `staff_id` INT NOT NULL,
  `date` VARCHAR(20) NOT NULL,
  `time_in` VARCHAR(20),
  `time_out` VARCHAR(20),
  `status` VARCHAR(20),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(`staff_id`, `date`),
  FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. settings table
CREATE TABLE IF NOT EXISTS `settings` (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` TEXT NOT NULL
) ENGINE=InnoDB;

-- 8. audit_logs table
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(100),
  `entity_id` INT,
  `details` TEXT,
  `performed_by` VARCHAR(100) DEFAULT 'Admin',
  `performed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 9. imported_datasets table
CREATE TABLE IF NOT EXISTS `imported_datasets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `file_name` VARCHAR(255) NOT NULL,
  `original_file_path` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `columns_json` TEXT NOT NULL,
  `row_count` INT DEFAULT 0,
  `imported_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 10. imported_rows table
CREATE TABLE IF NOT EXISTS `imported_rows` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `dataset_id` INT NOT NULL,
  `row_index` INT NOT NULL,
  `data_json` TEXT NOT NULL,
  FOREIGN KEY (`dataset_id`) REFERENCES `imported_datasets`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 11. filter_definitions table
CREATE TABLE IF NOT EXISTS `filter_definitions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `filter_name` VARCHAR(100) NOT NULL,
  `column_key` VARCHAR(100) NOT NULL,
  `filter_type` VARCHAR(50) NOT NULL,
  `options_json` TEXT,
  `display_order` INT DEFAULT 0,
  `status` VARCHAR(20) DEFAULT 'Active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 12. delivery_imports table
CREATE TABLE IF NOT EXISTS `delivery_imports` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `file_name` VARCHAR(255) NOT NULL,
  `description` VARCHAR(255),
  `imported_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `row_count` INT DEFAULT 0
) ENGINE=InnoDB;

-- 13. franchisee_delivery_details table
CREATE TABLE IF NOT EXISTS `franchisee_delivery_details` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `import_id` INT NOT NULL,
  `tracking_number` VARCHAR(100),
  `parcel_status` VARCHAR(50),
  `inbound_time` VARCHAR(100),
  `first_to_deliver_category` VARCHAR(50),
  `client_category` VARCHAR(50),
  `chargeable_weight` DECIMAL(10,2),
  `parcel_weight_range` VARCHAR(50),
  `actual_weight` VARCHAR(50),
  `actual_length` VARCHAR(50),
  `actual_width` VARCHAR(50),
  `actual_high` VARCHAR(50),
  `consignee_address` TEXT,
  `cod_amount` DECIMAL(10,2),
  `payment_method` VARCHAR(50),
  `problematic_mark` VARCHAR(50),
  `need_to_return` VARCHAR(50),
  `suspected_lost` VARCHAR(50),
  `final_operation_time` VARCHAR(100),
  `final_operation_person` VARCHAR(100),
  `delivery_date` VARCHAR(100),
  FOREIGN KEY (`import_id`) REFERENCES `delivery_imports`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;
