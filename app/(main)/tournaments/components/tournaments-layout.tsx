"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Search, Settings, Plus } from "lucide-react"
import { useUser } from "@/contexts/user-context"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import TournamentFilters from "./tournament-filters"

interface TournamentsLayoutProps {
  children: React.ReactNode
  title: string
  description: string
  currentType: "LONG" | "AMERICAN"
  categories: Array<{ name: string }>
  clubs: Array<{ id: string; name: string }>
}

export default function TournamentsLayout({
  children,
  title,
  description,
  currentType,
  categories,
  clubs,
}: TournamentsLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { userDetails } = useUser()
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "")

  useEffect(() => {
    setSearchTerm(searchParams.get("search") || "")
  }, [searchParams])

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    const params = new URLSearchParams(searchParams.toString())

    if (value) {
      params.set("search", value)
    } else {
      params.delete("search")
    }

    params.delete("page")
    router.push(`${pathname}?${params.toString()}`)
  }

  const buildTypeHref = (type: "LONG" | "AMERICAN") => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("type", type)
    params.delete("page")
    return `${pathname}?${params.toString()}`
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f7f7_0%,#ffffff_40%,#f4f7fb_100%)]">
      {(userDetails?.role === "CLUB" || userDetails?.role === "ORGANIZADOR") ? (
        <div className="border-b border-brand-100 bg-white">
          <div className="container mx-auto px-6 py-4">
            <div className="flex justify-end">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild className="bg-brand-600 text-white hover:bg-brand-700">
                  <Link href="/my-tournaments">
                    <Settings className="mr-2 h-4 w-4" />
                    Gestionar Mis Torneos
                  </Link>
                </Button>
                <Button asChild variant="outline" className="border-brand-200 text-brand-700 hover:bg-brand-50">
                  <Link href="/tournaments/create">
                    <Plus className="mr-2 h-4 w-4" />
                    Crear Nuevo Torneo
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="container mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">Padel FV</p>
          <h1 className="mb-4 text-4xl font-black tracking-tight text-brand-900">{title}</h1>
          <p className="max-w-3xl text-lg text-slate-600">{description}</p>
        </div>

        <div className="mb-10 space-y-6 rounded-3xl border border-brand-100 bg-white p-6 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400" size={18} />
              <Input
                placeholder="Buscar torneos..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 text-gray-600 placeholder:text-gray-400 focus:border-brand-300 focus:ring-brand-200"
              />
            </div>

            <div className="grid w-full max-w-md grid-cols-2 rounded-2xl bg-brand-100/70 p-1">
              <Link
                href={buildTypeHref("LONG")}
                className={`rounded-xl px-4 py-3 text-center text-sm font-semibold transition-colors ${
                  currentType === "LONG" ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-brand-900"
                }`}
              >
                Ligas
              </Link>
              <Link
                href={buildTypeHref("AMERICAN")}
                className={`rounded-xl px-4 py-3 text-center text-sm font-semibold transition-colors ${
                  currentType === "AMERICAN" ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-brand-900"
                }`}
              >
                Americanos
              </Link>
            </div>
          </div>

          <TournamentFilters categories={categories} clubs={clubs} />
        </div>

        <div className="rounded-3xl border border-brand-100 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  )
}
