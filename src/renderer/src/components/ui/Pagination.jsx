import React from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

export default function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onChangePage,
  onChangeItemsPerPage,
  itemsPerPageOptions = [10, 25, 50, 100]
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1

  // Handle boundary controls
  const handleFirstPage = () => onChangePage(1)
  const handlePrevPage = () => onChangePage(Math.max(1, currentPage - 1))
  const handleNextPage = () => onChangePage(Math.min(totalPages, currentPage + 1))
  const handleLastPage = () => onChangePage(totalPages)

  // Compute pagination range/window with ellipses
  const getPageNumbers = () => {
    const pages = []
    const range = 2 // number of page buttons to show on either side of currentPage

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - range && i <= currentPage + range)) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...')
      }
    }
    return pages
  }

  const pageNumbers = getPageNumbers()

  // Slicing math details
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  return (
    <div className="shrink-0 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 dark:border-slate-800/80 pt-4 text-[10px] text-slate-500 dark:text-slate-400 font-semibold bg-white dark:bg-[#111827] px-4 py-2 transition-colors duration-150">
      {/* Records Count Text */}
      <div className="flex items-center gap-2">
        <span>
          Showing <span className="font-bold text-slate-700 dark:text-slate-300">{startItem}</span>{' '}
          to <span className="font-bold text-slate-700 dark:text-slate-300">{endItem}</span> of{' '}
          <span className="font-bold text-slate-700 dark:text-slate-300">{totalItems}</span> records
        </span>
      </div>

      {/* Pagination Actions Controls */}
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        {/* Rows per Page Select */}
        <div className="flex items-center gap-2 select-none">
          <span>Rows per page:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              onChangeItemsPerPage(Number(e.target.value))
              onChangePage(1) // Reset to page 1 on resize
            }}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1 outline-none transition focus:border-sky-500 text-[10px] font-bold text-slate-700 dark:text-slate-350 cursor-pointer"
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            {itemsPerPageOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' }}>
          {/* Jump to Very First Page */}
          <button
            disabled={currentPage === 1}
            onClick={handleFirstPage}
            className="flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
            title="First Page"
          >
            <ChevronsLeft size={12} />
          </button>

          {/* Jump to Previous Page */}
          <button
            disabled={currentPage === 1}
            onClick={handlePrevPage}
            className="flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
            title="Previous Page"
          >
            <ChevronLeft size={12} />
          </button>

          {/* Dynamic Windowed Page Numbers */}
          <div className="flex items-center gap-1">
            {pageNumbers.map((num, idx) => {
              if (num === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 py-1 text-slate-350 select-none font-medium"
                  >
                    ...
                  </span>
                )
              }
              const isCurrent = num === currentPage
              return (
                <button
                  key={`page-${num}`}
                  onClick={() => onChangePage(num)}
                  className={`
                    px-2.5 py-1 rounded-lg border text-[10px] font-bold transition
                    ${
                      isCurrent
                        ? 'border-sky-500 bg-sky-500 text-black shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350'
                    }
                  `}
                >
                  {num}
                </button>
              )
            })}
          </div>

          {/* Jump to Next Page */}
          <button
            disabled={currentPage === totalPages}
            onClick={handleNextPage}
            className="flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
            title="Next Page"
          >
            <ChevronRight size={12} />
          </button>

          {/* Jump to Very Last Page */}
          <button
            disabled={currentPage === totalPages}
            onClick={handleLastPage}
            className="flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
            title="Last Page"
          >
            <ChevronsRight size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}
