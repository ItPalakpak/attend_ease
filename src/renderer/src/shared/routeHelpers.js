export const routeTitles = {
  '/dashboard': 'Dashboard Overview',
  '/staff': 'Staff Management',
  '/staff/new': 'Add New Staff',
  '/staff/edit': 'Edit Staff',
  '/scan': 'Scan Attendance',
  '/attendance': 'Attendance History',
  '/reports': 'Reports',
  '/gasoline': 'Gasoline Subsidy Logs',
  '/roles': 'Role Management',
  '/departments': 'Department Management',
  '/id-cards': 'ID Cards',
  '/data-import': 'Data Import',
  '/analytics': 'Data Analytics',
  '/filter-config': 'Filter Configuration',
  '/settings': 'Settings',
  '/backup': 'Backup & Restore',
  '/audit-logs': 'Audit Logs'
}

export const routeDescriptions = {
  '/dashboard': 'Real-time attendance tracking and organization summary',
  '/staff': 'View and manage staff records, designations, and security credentials',
  '/staff/new': 'Create a new staff profile in the database',
  '/staff/edit': 'Modify employee information and status',
  '/scan': 'Scan staff QR ID code to log Clock-In or Clock-Out',
  '/attendance': 'Query, filter, and track historical attendance logs',
  '/reports': 'Generate, view, and export organization attendance metrics',
  '/gasoline': 'Manage delivery rider discounts, copay status, and monthly employer payout sheets',
  '/roles': 'Manage user roles and designations within the organization',
  '/departments': 'Manage organizational divisions and departments',
  '/id-cards': 'Design and download official Flash Express employee IDs',
  '/data-import':
    'Import CSV or Excel sheets for advanced filtering and calculations (parcels weight counting)',
  '/analytics': 'Query datasets, compute stats, and run cargo/parcel weight filter calculations',
  '/filter-config':
    'Configure which spreadsheet columns are filterable in the Data Analytics dashboard',
  '/settings':
    'Configure attendance rules, admin profile, and custom dynamic filters for imported spreadsheets',
  '/backup': 'Back up your local database and staff photos or restore from a previous archive',
  '/audit-logs': 'Track all administrative operations and database updates'
}

export function getPageTitle(pathname) {
  if (routeTitles[pathname]) return routeTitles[pathname]
  if (pathname.startsWith('/staff/edit/')) return 'Edit Staff'
  if (pathname.match(/^\/staff\/[^/]+$/)) return 'Staff Profile'
  if (pathname.startsWith('/id-cards/')) return 'ID Card Preview'
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length > 0) {
    return segments[segments.length - 1]
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }
  return 'Dashboard'
}

export function getPageDescription(pathname) {
  if (routeDescriptions[pathname]) return routeDescriptions[pathname]
  if (pathname.startsWith('/staff/edit/')) return routeDescriptions['/staff/edit']
  if (pathname.match(/^\/staff\/[^/]+$/))
    return 'Employee details, role history, and security QR code'
  if (pathname.startsWith('/id-cards/')) return routeDescriptions['/id-cards']
  return null
}

export function getBreadcrumbs(pathname) {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs = [{ label: 'Home', path: '/dashboard' }]
  let currentPath = ''
  for (const segment of segments) {
    currentPath += `/${segment}`
    const label =
      routeTitles[currentPath] ||
      segment
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    crumbs.push({ label, path: currentPath })
  }
  return crumbs
}
