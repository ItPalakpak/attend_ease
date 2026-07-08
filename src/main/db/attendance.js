import { getDbConnection } from './connection.js'
import { getSettings } from './settings.js'
import { logAudit } from './audit.js'

// CHANGED: made calculateStatus asynchronous to await settings from database
async function calculateStatus(timeStr) {
  const settings = await getSettings()
  const presentCutoff = settings.present_cutoff || '08:00'

  const scanTime = timeStr.substring(0, 5) // Extract HH:MM
  if (scanTime <= presentCutoff) {
    return 'Present'
  } else {
    return 'Late'
  }
}

// CHANGED: made recordClockIn asynchronous and implemented MySQL transaction handling
export async function recordClockIn(staffFormattedId, dateStr, timeStr) {
  const db = getDbConnection()
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    // Find staff by formatted staff_id (e.g. "EMP0001")
    const [staffRows] = await connection.execute('SELECT * FROM staff WHERE staff_id = ?', [
      staffFormattedId
    ])
    const staff = staffRows[0]
    if (!staff) {
      connection.release()
      return { success: false, message: 'Invalid QR Code: Staff not found' }
    }

    if (staff.employment_status !== 'Active') {
      connection.release()
      return { success: false, message: `Staff is inactive (${staff.employment_status})` }
    }

    // Check if already clocked in today
    const [existingRows] = await connection.execute(
      'SELECT * FROM attendance WHERE staff_id = ? AND date = ?',
      [staff.id, dateStr]
    )
    const existing = existingRows[0]
    if (existing) {
      connection.release()
      return {
        success: false,
        message: 'Already clocked in today',
        alreadyRecorded: true,
        attendance: {
          name: `${staff.first_name} ${staff.last_name}`,
          time_in: existing.time_in,
          time_out: existing.time_out,
          status: existing.status
        }
      }
    }

    // Calculate status (Present or Late)
    const status = await calculateStatus(timeStr)

    await connection.execute(
      `
      INSERT INTO attendance (staff_id, date, time_in, status)
      VALUES (?, ?, ?, ?)
    `,
      [staff.id, dateStr, timeStr, status]
    )

    await logAudit('ATTENDANCE_IN', 'attendance', staff.id, {
      date: dateStr,
      time: timeStr,
      status
    })

    await connection.commit()

    return {
      success: true,
      message: 'Attendance recorded successfully',
      staff: {
        id: staff.id,
        staff_id: staff.staff_id,
        name: `${staff.first_name} ${staff.last_name}`,
        photo_path: staff.photo_path,
        position: staff.role_id
      },
      attendance: {
        time_in: timeStr,
        status: status
      }
    }
  } catch (error) {
    await connection.rollback()
    console.error('Clock-in error:', error)
    return { success: false, message: 'An error occurred while clocking in' }
  } finally {
    connection.release()
  }
}

// CHANGED: made recordClockOut asynchronous and implemented MySQL transaction handling
export async function recordClockOut(staffFormattedId, dateStr, timeStr) {
  const db = getDbConnection()
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()

    // Find staff by formatted staff_id
    const [staffRows] = await connection.execute('SELECT * FROM staff WHERE staff_id = ?', [
      staffFormattedId
    ])
    const staff = staffRows[0]
    if (!staff) {
      connection.release()
      return { success: false, message: 'Invalid QR Code: Staff not found' }
    }

    // Check if they clocked in today
    const [existingRows] = await connection.execute(
      'SELECT * FROM attendance WHERE staff_id = ? AND date = ?',
      [staff.id, dateStr]
    )
    const existing = existingRows[0]
    if (!existing) {
      connection.release()
      return { success: false, message: 'Cannot clock out: No clock-in record found for today' }
    }

    if (existing.time_out) {
      connection.release()
      return {
        success: false,
        message: 'Already clocked out today',
        alreadyRecorded: true,
        attendance: {
          name: `${staff.first_name} ${staff.last_name}`,
          time_in: existing.time_in,
          time_out: existing.time_out,
          status: existing.status
        }
      }
    }

    await connection.execute(
      `
      UPDATE attendance
      SET time_out = ?
      WHERE id = ?
    `,
      [timeStr, existing.id]
    )

    await logAudit('ATTENDANCE_OUT', 'attendance', staff.id, { date: dateStr, time: timeStr })

    await connection.commit()

    return {
      success: true,
      message: 'Clock-out recorded successfully',
      staff: {
        id: staff.id,
        staff_id: staff.staff_id,
        name: `${staff.first_name} ${staff.last_name}`,
        photo_path: staff.photo_path
      },
      attendance: {
        time_in: existing.time_in,
        time_out: timeStr,
        status: existing.status
      }
    }
  } catch (error) {
    await connection.rollback()
    console.error('Clock-out error:', error)
    return { success: false, message: 'An error occurred while clocking out' }
  } finally {
    connection.release()
  }
}

// CHANGED: made getDailyAttendance asynchronous and updated SQLite calls to mysql2
export async function getDailyAttendance(dateStr) {
  try {
    const db = getDbConnection()
    const settings = await getSettings()
    const workingDays = settings.working_days || [1, 2, 3, 4, 5]

    // Parse date to check day of week
    const dateObj = new Date(dateStr)
    const dayOfWeek = dateObj.getDay() // 0 = Sunday, 1 = Monday...
    const isWorkingDay = workingDays.includes(dayOfWeek)

    // Select all active staff and join their attendance record for this day
    const [records] = await db.execute(
      `
      SELECT s.id as staff_id, 
             s.staff_id as formatted_id, 
             s.first_name, 
             s.last_name, 
             r.role_name, 
             d.department_name, 
             s.photo_path,
             a.time_in, 
             a.time_out, 
             a.status
      FROM staff s
      LEFT JOIN roles r ON s.role_id = r.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN attendance a ON s.id = a.staff_id AND a.date = ?
      WHERE s.employment_status = 'Active'
      ORDER BY s.staff_id ASC
    `,
      [dateStr]
    )

    // For each record, if there's no attendance record:
    // If it's a working day, status is 'Absent'. Otherwise, they are off-duty (null or 'Off').
    return records.map((r) => {
      if (!r.status) {
        r.status = isWorkingDay ? 'Absent' : 'Off-duty'
      }
      return r
    })
  } catch (error) {
    console.error('Get daily attendance error:', error)
    return []
  }
}

// CHANGED: made getAttendanceRange asynchronous and updated SQLite calls to mysql2
export async function getAttendanceRange(startDate, endDate) {
  try {
    const db = getDbConnection()

    const [rows] = await db.execute(
      `
      SELECT a.date, 
             s.staff_id as formatted_id, 
             s.first_name, 
             s.last_name, 
             r.role_name, 
             d.department_name, 
             a.time_in, 
             a.time_out, 
             a.status
      FROM attendance a
      JOIN staff s ON a.staff_id = s.id
      LEFT JOIN roles r ON s.role_id = r.id
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE a.date BETWEEN ? AND ?
      ORDER BY a.date DESC, a.time_in DESC
    `,
      [startDate, endDate]
    )
    return rows
  } catch (error) {
    console.error('Get attendance range error:', error)
    return []
  }
}

// CHANGED: made getDashboardStats asynchronous and updated SQLite calls to mysql2
export async function getDashboardStats(dateStr) {
  try {
    const db = getDbConnection()

    // Total staff count
    const [staffCountRows] = await db.execute(
      "SELECT COUNT(*) as count FROM staff WHERE employment_status = 'Active'"
    )
    const totalStaff = staffCountRows[0].count

    // Attendance records for today
    const [todayAttendance] = await db.execute(
      'SELECT status, COUNT(*) as count FROM attendance WHERE date = ? GROUP BY status',
      [dateStr]
    )

    let presentCount = 0
    let lateCount = 0

    for (const record of todayAttendance) {
      if (record.status === 'Present') presentCount = record.count
      if (record.status === 'Late') lateCount = record.count
    }

    // Settings to check if working day
    const settings = await getSettings()
    const workingDays = settings.working_days || [1, 2, 3, 4, 5]
    const dateObj = new Date(dateStr)
    const isWorkingDay = workingDays.includes(dateObj.getDay())

    const absentCount = isWorkingDay ? Math.max(0, totalStaff - (presentCount + lateCount)) : 0

    // Role and department counts
    const [roleCountRows] = await db.execute(
      "SELECT COUNT(*) as count FROM roles WHERE status = 'Active'"
    )
    const totalRoles = roleCountRows[0].count

    const [deptCountRows] = await db.execute(
      "SELECT COUNT(*) as count FROM departments WHERE status = 'Active'"
    )
    const totalDepts = deptCountRows[0].count

    return {
      totalStaff,
      presentToday: presentCount,
      lateToday: lateCount,
      absentToday: absentCount,
      totalRoles,
      totalDepts
    }
  } catch (error) {
    console.error('Get dashboard stats error:', error)
    return {
      totalStaff: 0,
      presentToday: 0,
      lateToday: 0,
      absentToday: 0,
      totalRoles: 0,
      totalDepts: 0
    }
  }
}
