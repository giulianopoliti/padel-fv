import { createClient } from "@/utils/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { checkTournamentPermissions } from "@/utils/tournament-permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const url = new URL(request.url)
  const fechaId = url.searchParams.get('fecha_id')

  if (!fechaId) {
    return NextResponse.json({ error: 'fecha_id is required' }, { status: 400 })
  }

  try {
    // Get time slots for the fecha
    const { data: timeSlots, error: timeSlotsError } = await supabase
      .from('tournament_time_slots')
      .select(`
        *,
        couple_time_availability (
          couple_id,
          is_available,
          couples (
            id,
            player1:players!couples_player1_id_fkey (first_name, last_name),
            player2:players!couples_player2_id_fkey (first_name, last_name)
          )
        )
      `)
      .eq('fecha_id', fechaId)
      .eq('is_available', true)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    if (timeSlotsError) {
      throw timeSlotsError
    }

    // Get fecha info
    const { data: fecha, error: fechaError } = await supabase
      .from('tournament_fechas')
      .select('*')
      .eq('id', fechaId)
      .single()

    if (fechaError) {
      throw fechaError
    }

    // Transform data for frontend
    const formattedTimeSlots = timeSlots?.map(slot => ({
      ...slot,
      availableCouples: slot.couple_time_availability
        ?.filter(cta => cta.is_available)
        .map(cta => ({
          couple_id: cta.couple_id,
          player1_name: `${cta.couples?.player1?.first_name} ${cta.couples?.player1?.last_name}`,
          player2_name: `${cta.couples?.player2?.first_name} ${cta.couples?.player2?.last_name}`,
          is_available: cta.is_available
        })) || []
    })) || []

    return NextResponse.json({
      fecha,
      timeSlots: formattedTimeSlots
    })

  } catch (error) {
    console.error('Error fetching schedules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schedules' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const tournamentId = params.id
  
  try {
    // Verify user authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      )
    }

    // Verify user has permissions to create time slots
    const permissionResult = await checkTournamentPermissions(user.id, tournamentId, supabase)
    if (!permissionResult.hasPermission) {
      return NextResponse.json(
        { error: permissionResult.reason || 'No tienes permisos para crear horarios en este torneo' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { fecha_id, date, start_time, end_time, court_name, max_matches } = body

    const { data, error } = await supabase
      .from('tournament_time_slots')
      .insert({
        fecha_id,
        date,
        start_time,
        end_time,
        court_name,
        max_matches: max_matches || 1,
        is_available: true
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Error creating time slot:', error)
    return NextResponse.json(
      { error: 'Failed to create time slot' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  
  try {
    const body = await request.json()
    const { couple_id, time_slot_id, is_available } = body

    // Upsert couple availability
    const { data, error } = await supabase
      .from('couple_time_availability')
      .upsert({
        couple_id,
        time_slot_id,
        is_available
      }, {
        onConflict: 'couple_id,time_slot_id'
      })
      .select()

    if (error) {
      throw error
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Error updating availability:', error)
    return NextResponse.json(
      { error: 'Failed to update availability' },
      { status: 500 }
    )
  }
}