"use server"

import { createClient } from "@/utils/supabase/server";
import type { DetailedUserDetails } from "@/types";

export async function getUserDetails(): Promise<DetailedUserDetails | null> {
  try {
    const supabase = await createClient();
    
    // Obtener el usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('[getUserDetails] Auth error:', authError);
      return null;
    }
    
    if (!user) {
      console.log('[getUserDetails] No authenticated user');
      return null;
    }

    console.log('[getUserDetails] Fetching user details for:', user.id.substring(0, 8));

    // Obtener los detalles del usuario desde la view optimizada
    const { data, error } = await supabase
      .from("user_details_v")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error('[getUserDetails] Database error:', error);
      throw error;
    }

    if (!data) {
      console.warn('[getUserDetails] User not found in database:', user.id);
      return null;
    }

    console.log('[getUserDetails] Successfully fetched user details:', {
      userId: user.id.substring(0, 8),
      role: data.role,
      hasRoleId: !!(data.player_id || data.club_id || data.coach_id || data.organizador_id),
      organizador_id: data.organizador_id,
      logo_url: data.logo_url,
      name: data.name
    });

    console.log('[getUserDetails] Full data object:', JSON.stringify(data, null, 2));

    return data as DetailedUserDetails;
  } catch (error) {
    console.error('[getUserDetails] Unexpected error:', error);
    return null;
  }
} 