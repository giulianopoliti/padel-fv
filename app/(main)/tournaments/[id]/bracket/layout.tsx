import React from 'react'
import { createClient } from '@/utils/supabase/server'
import { getUserDetails } from '@/utils/db/getUserDetails'

interface BracketLayoutProps {
  children: React.ReactNode
  organizer: React.ReactNode
  player: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function BracketLayout({
  children,
  organizer,
  player,
  params
}: BracketLayoutProps) {
  const resolvedParams = await params
  const supabase = await createClient()

  try {
    // Obtener información del usuario
    const userDetails = await getUserDetails()
    const userRole = userDetails?.role

    console.log('[BracketLayout] User role:', userRole)
    console.log('[BracketLayout] User details:', userDetails)

    // Para torneos LONG, usar parallel routes basadas en rol
    const { data: tournament, error } = await supabase
      .from('tournaments')
      .select('type')
      .eq('id', resolvedParams.id)
      .single()

    console.log('[BracketLayout] Tournament:', tournament)
    console.log('[BracketLayout] Error:', error)

    // LONG: separar organizadores de jugadores/público via parallel routes
    if (tournament?.type === 'LONG') {
      if (userRole === 'CLUB' || userRole === 'ORGANIZADOR' || userRole === 'COACH') {
        console.log('[BracketLayout] LONG organizer → @organizer slot')
        return (
          <div className="bracket-layout-container">
            {organizer}
          </div>
        )
      }
      // PLAYER, sin login, cualquier otro rol → vista read-only de LONG
      console.log('[BracketLayout] LONG player/public → @player slot')
      return (
        <div className="bracket-layout-container">
          {player}
        </div>
      )
    }

    // AMERICAN (cualquier rol) → children maneja owner/público internamente
    console.log('[BracketLayout] AMERICAN → children slot')
    return (
      <div className="bracket-layout-container">
        {children}
      </div>
    )
  } catch (error) {
    console.error('[BracketLayout] Error:', error)
    // Fallback a la página normal en caso de error
    return (
      <div className="bracket-layout-container">
        {children}
      </div>
    )
  }
}