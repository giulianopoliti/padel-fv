"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Archive, Calendar, Plus, Search, Settings, Trophy } from "lucide-react"
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

  const buildStatusHref = (statusPath: "upcoming" | "in-progress" | "past") => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("page")
    const queryString = params.toString()
    return `/tournaments/${statusPath}${queryString ? `?${queryString}` : ""}`
  }

  const isActiveStatus = (statusPath: "upcoming" | "in-progress" | "past") => {
    return pathname.includes(`/tournaments/${statusPath}`)
  }

  const statusTabs = [
    {
      href: buildStatusHref("upcoming"),
      label: "Proximos",
      icon: Calendar,
      active: isActiveStatus("upcoming"),
    },
    {
      href: buildStatusHref("in-progress"),
      label: "Activos",
      icon: Trophy,
      active: isActiveStatus("in-progress"),
    },
    {
      href: buildStatusHref("past"),
      label: "Pasados",
      icon: Archive,
      active: isActiveStatus("past"),
    },
  ]

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#223765_0%,#243b6c_45%,#1f335d_100%)] text-white">
      {(userDetails?.role === "CLUB" || userDetails?.role === "ORGANIZADOR") ? (
        <div className="border-b border-white/10 bg-[#213761]/82">
          <div className="container mx-auto px-6 py-4">
            <div className="flex justify-end">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild className="bg-court-500 text-brand-900 hover:bg-court-400">
                  <Link href="/my-tournaments">
                    <Settings className="mr-2 h-4 w-4" />
                    Gestionar Mis Torneos
                  </Link>
                </Button>
                <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
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
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-court-300">Padel FV</p>
          <h1 className="mb-4 text-4xl font-black tracking-tight text-white">{title}</h1>
          <p className="max-w-3xl text-lg text-slate-200">{description}</p>
        </div>

        <div className="mb-10 space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400" size={18} />
              <Input
                placeholder="Buscar torneos..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-slate-400 focus:border-court-500/50 focus:ring-court-500/20"
              />
            </div>

            <div className="grid w-full max-w-md grid-cols-2 rounded-2xl border border-white/10 bg-white/5 p-1">
              <Link
                href={buildTypeHref("LONG")}
                className={`rounded-xl px-4 py-3 text-center text-sm font-semibold transition-colors ${
                  currentType === "LONG" ? "bg-court-500 text-brand-900 shadow-sm" : "text-slate-300 hover:text-white"
                }`}
              >
                Ligas
              </Link>
              <Link
                href={buildTypeHref("AMERICAN")}
                className={`rounded-xl px-4 py-3 text-center text-sm font-semibold transition-colors ${
                  currentType === "AMERICAN" ? "bg-court-500 text-brand-900 shadow-sm" : "text-slate-300 hover:text-white"
                }`}
              >
                Americanos
              </Link>
            </div>
          </div>

          <TournamentFilters categories={categories} clubs={clubs} />
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#1b2d52]/76 shadow-sm backdrop-blur-sm">
          <div className="border-b border-white/10 bg-white/[0.04] p-2">
            <div className="grid grid-cols-3 gap-2">
              {statusTabs.map((tab) => {
                const Icon = tab.icon

                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-semibold transition-colors ${
                      tab.active
                        ? "bg-court-500 text-brand-900 shadow-sm"
                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  )
}
