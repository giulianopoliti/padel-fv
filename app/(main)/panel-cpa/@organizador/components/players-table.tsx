"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Phone, Hash, Trophy } from "lucide-react"
import { getCategoryColor } from "@/lib/utils/category-colors"

interface PlayerData {
  id: string
  first_name: string
  last_name: string
  dni: string | null
  phone: string | null
  score: number | null
  profile_image_url: string | null
  category_name: string | null
  email?: string | null
  users?: { email: string | null }
}

interface PlayersTableProps {
  players: PlayerData[]
}

const getInitials = (firstName: string, lastName: string) => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

const formatDNI = (dni: string | null) => {
  if (!dni) return "-"
  // Formato: 12.345.678
  return dni.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

const formatPhone = (phone: string | null) => {
  if (!phone) return "-"
  // Si el teléfono es muy largo, truncarlo
  if (phone.length > 15) {
    return phone.substring(0, 15) + "..."
  }
  return phone
}

const getEmail = (player: PlayerData) => {
  return player.users?.email || player.email || "-"
}

export default function PlayersTable({ players }: PlayersTableProps) {
  if (players.length === 0) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mb-4">
              <Trophy className="h-8 w-8 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              No hay jugadores registrados
            </h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Aún no tienes jugadores asociados a tu organización.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead className="min-w-[200px]">Jugador</TableHead>
                <TableHead className="min-w-[120px]">DNI</TableHead>
                <TableHead className="min-w-[200px]">Email</TableHead>
                <TableHead className="min-w-[140px]">Teléfono</TableHead>
                <TableHead className="text-right min-w-[100px]">Puntos</TableHead>
                <TableHead className="min-w-[100px]">Categoría</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player, index) => (
                <TableRow
                  key={player.id}
                  className="hover:bg-muted/50 transition-colors"
                >
                  {/* Posición */}
                  <TableCell className="font-medium text-muted-foreground">
                    {index + 1}
                  </TableCell>

                  {/* Jugador con Avatar */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border-2 border-border">
                        <AvatarImage
                          src={player.profile_image_url || undefined}
                          alt={`${player.first_name} ${player.last_name}`}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold">
                          {getInitials(player.first_name, player.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-semibold">
                          {player.first_name} {player.last_name}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  {/* DNI */}
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Hash className="h-4 w-4" aria-hidden="true" />
                      <span className="font-mono text-sm">
                        {formatDNI(player.dni)}
                      </span>
                    </div>
                  </TableCell>

                  {/* Email */}
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {getEmail(player)}
                    </span>
                  </TableCell>

                  {/* Teléfono */}
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" aria-hidden="true" />
                      <span className="text-sm">
                        {formatPhone(player.phone)}
                      </span>
                    </div>
                  </TableCell>

                  {/* Puntos */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Trophy className="h-4 w-4 text-amber-500" aria-hidden="true" />
                      <span className="font-bold text-lg">
                        {player.score || 0}
                      </span>
                    </div>
                  </TableCell>

                  {/* Categoría */}
                  <TableCell>
                    {player.category_name ? (
                      <Badge variant="outline" className={getCategoryColor(player.category_name)}>
                        {player.category_name}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        Sin categoría
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
