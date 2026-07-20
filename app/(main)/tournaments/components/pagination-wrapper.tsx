"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { PaginationControl } from "@/components/ui/pagination"

interface PaginationWrapperProps {
  total: number
  pageSize: number
  currentPage: number
}

export default function PaginationWrapper({ total, pageSize, currentPage }: PaginationWrapperProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', newPage.toString())
    router.push(`${pathname}?${params.toString()}`)
  }

  const totalPages = Math.ceil(total / pageSize)

  if (totalPages <= 1) return null

  return (
    <div className="flex flex-col items-center gap-4">
      <PaginationControl
        total={total}
        pageSize={pageSize}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        classNames={{
          button: "border-white/20 bg-white/[0.08] text-white shadow-sm hover:border-white/35 hover:bg-white/[0.14] hover:text-white",
          activeButton: "border-court-500 bg-court-500 text-brand-900 hover:bg-court-400 hover:text-brand-900",
          inactiveButton: "text-white",
          disabledButton: "border-white/10 bg-white/[0.06] text-white/35 disabled:opacity-100 hover:bg-white/[0.06] hover:text-white/35",
        }}
      />
      <p className="text-sm text-slate-300">
        Mostrando {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, total)} de {total} torneos
      </p>
    </div>
  )
}
