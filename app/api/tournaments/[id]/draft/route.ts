import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params

  if (!tournamentId) {
    return NextResponse.json({ success: false, error: 'Missing tournament id' }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const permissions = await checkTournamentPermissions(user.id, tournamentId)
    if (!permissions.hasPermission) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json()
    const { is_draft } = body

    if (typeof is_draft !== 'boolean') {
      return NextResponse.json({ success: false, error: 'is_draft must be boolean' }, { status: 400 })
    }

    const { error } = await supabase
      .from('tournaments')
      .update({ is_draft })
      .eq('id', tournamentId)

    if (error) {
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 })
    }

    revalidatePath(`/tournaments`, 'page')
    revalidatePath(`/tournaments/upcoming`, 'page')
    revalidatePath(`/tournaments/in-progress`, 'page')
    revalidatePath(`/tournaments/past`, 'page')
    revalidatePath(`/my-tournaments`, 'page')
    revalidatePath(`/`, 'page')

    return NextResponse.json({ success: true, is_draft })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: 'Unexpected error' }, { status: 500 })
  }
}
