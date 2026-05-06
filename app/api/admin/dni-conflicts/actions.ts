'use server';

import { createClient } from '@/utils/supabase/server';

/**
 * Get all pending DNI conflicts for admin review
 */
export async function getDNIConflicts() {
  const supabase = await createClient();
  
  try {
    const { data: conflicts, error } = await supabase
      .from('dni_conflicts')
      .select(`
        *,
        existing_player:existing_player_id (
          id,
          first_name,
          last_name,
          dni,
          score,
          category_name,
          created_at
        ),
        new_player:new_player_id (
          id,
          first_name,
          last_name,
          dni,
          score,
          category_name,
          created_at
        ),
        new_user:new_user_id (
          id,
          email,
          role
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('[getDNIConflicts] Error fetching conflicts:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, conflicts: conflicts || [] };
    
  } catch (error: any) {
    console.error('[getDNIConflicts] Unexpected error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Resolve a DNI conflict
 */
export async function resolveDNIConflict(
  conflictId: string, 
  resolution: 'merge_players' | 'keep_separate' | 'delete_duplicate',
  adminNotes?: string
) {
  const supabase = await createClient();
  
  try {
    // Get current user (admin)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' };
    }
    
    // Update conflict status
    const { error: updateError } = await supabase
      .from('dni_conflicts')
      .update({
        status: 'resolved',
        admin_notes: adminNotes,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id
      })
      .eq('id', conflictId);
      
    if (updateError) {
      console.error('[resolveDNIConflict] Error updating conflict:', updateError);
      return { success: false, error: updateError.message };
    }
    
    return { success: true, message: 'Conflicto resuelto exitosamente' };
    
  } catch (error: any) {
    console.error('[resolveDNIConflict] Unexpected error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get conflict statistics
 */
export async function getDNIConflictStats() {
  const supabase = await createClient();
  
  try {
    const { data: stats, error } = await supabase
      .from('dni_conflicts')
      .select('status')
      .then(result => {
        if (result.error) return result;
        
        const conflicts = result.data || [];
        const pending = conflicts.filter(c => c.status === 'pending').length;
        const resolved = conflicts.filter(c => c.status === 'resolved').length;
        const total = conflicts.length;
        
        return {
          data: { pending, resolved, total },
          error: null
        };
      });
      
    if (error) {
      console.error('[getDNIConflictStats] Error fetching stats:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, stats };
    
  } catch (error: any) {
    console.error('[getDNIConflictStats] Unexpected error:', error);
    return { success: false, error: error.message };
  }
} 