import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function MainLayout() {
  return (
    <div className="flex flex-1 h-full w-full overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <Header />

        {/* Page content */}
        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="flex-1 flex flex-col min-h-0 p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
