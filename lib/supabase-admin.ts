import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/database.types'

/**
 * Supabase Admin Client
 *
 * Este cliente usa service_role_key para bypass completo de RLS policies.
 * IMPORTANTE: Solo usar en server actions, NUNCA en código del cliente.
 *
 * Uso:
 * ```typescript
 * import { supabaseAdmin } from '@/lib/supabase-admin'
 *
 * const { data } = await supabaseAdmin
 *   .from('table')
 *   .select('*')
 * ```
 */
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

/**
 * Verifica que el usuario actual tenga rol ADMIN
 *
 * @throws Error si no está autenticado o no es ADMIN
 * @returns ID del usuario admin
 */
export async function verifyAdmin(): Promise<string> {
  // Importar createClient normal para auth
  const { createClient: createNormalClient } = await import('@/utils/supabase/server')
  const supabase = await createNormalClient()

  // Verificar autenticación
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('No autenticado')
  }

  // Verificar rol ADMIN usando supabaseAdmin
  const { data: userData, error: roleError } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (roleError) {
    throw new Error('Error al verificar permisos')
  }

  if (userData.role !== 'ADMIN') {
    throw new Error('No autorizado - Se requiere rol ADMIN')
  }

  return user.id
}
