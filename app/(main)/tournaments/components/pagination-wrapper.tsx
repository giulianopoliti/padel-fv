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
      />
      <p className="text-sm text-gray-500">
        Mostrando {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, total)} de {total} torneos
      </p>
    </div>
  )
}
