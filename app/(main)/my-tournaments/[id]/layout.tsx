import type React from "react"
import { Suspense } from "react"
import { Loader2 } from "lucide-react"

export default function TournamentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-screen">
          <Loader2 className="h-8 w-8 text-violet-600 animate-spin" />
          <span className="ml-2 text-slate-600">Cargando...</span>
        </div>
      }
    >
      {children}
    </Suspense>
  )
}
