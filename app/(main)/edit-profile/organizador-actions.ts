'use server'

import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';

const organizadorProfileSchema = z.object({
  name: z.string().min(1, "El nombre de la organización es requerido."),
  description: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  responsible_first_name: z.string().min(1, "El nombre del responsable es requerido."),
  responsible_last_name: z.string().min(1, "El apellido del responsable es requerido."),
  responsible_dni: z.string().min(1, "El DNI del responsable es requerido."),
  responsible_position: z.string().min(1, "El cargo del responsable es requerido."),
});

const clubCreationSchema = z.object({
  name: z.string().min(1, "El nombre del club es requerido."),
  address: z.string().min(1, "La dirección del club es requerida."),
  phone: z.string().nullable().optional(),
  email: z.string().email("Email inválido").nullable().optional(),
  instagram: z.string().nullable().optional(),
  courts: z.number().int().min(1, "Debe tener al menos 1 cancha").nullable().optional(),
  opens_at: z.string().nullable().optional(),
  closes_at: z.string().nullable().optional(),
});

export type OrganizadorFormState = {
  message: string;
  errors?: {
    name?: string[];
    description?: string[];
    phone?: string[];
    responsible_first_name?: string[];
    responsible_last_name?: string[];
    responsible_dni?: string[];
    responsible_position?: string[];
    general?: string[];
  } | null;
  success: boolean;
  organizadorProfile?: any;
  organizationClubs?: any[];
  allClubs?: any[];
};

export async function getOrganizadorProfile(): Promise<OrganizadorFormState> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, message: "Usuario no autenticado.", errors: null };
  }

  try {
    // 1. Get basic user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, role, avatar_url')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.error("GetOrganizadorProfile: Error fetching user data", userError);
      return { success: false, message: userError?.message || "No se encontraron datos de usuario.", errors: null };
    }

    if (userData.role !== 'ORGANIZADOR') {
      return { success: false, message: "El usuario no tiene el rol de ORGANIZADOR.", errors: null };
    }

    // 2. Get organization from organization_members where user is owner
    let organizacionId = null;
    let organizacionData = null;

    const { data: memberData, error: memberError } = await supabase
      .from('organization_members')
      .select('organizacion_id, member_role, is_active')
      .eq('user_id', user.id)
      .in('member_role', ['owner', 'admin'])
      .maybeSingle();

    if (memberData) {
      organizacionId = memberData.organizacion_id;

      // Get the organization data including gallery fields and featured_club_id
      const { data: orgData, error: orgError } = await supabase
        .from('organizaciones')
        .select('*, cover_image_url, gallery_images, featured_club_id')
        .eq('id', organizacionId)
        .single();

      if (!orgError && orgData) {
        organizacionData = orgData;
      }
    }

    // 3. Get organization clubs if we have an organization ID
    let organizationClubs: any[] = [];
    if (organizacionId) {
      const { data: clubsData, error: clubsError } = await supabase
        .from('organization_clubs')
        .select(`
          id,
          clubes (
            id,
            name,
            address,
            phone,
            email,
            instagram,
            courts,
            opens_at,
            closes_at,
            cover_image_url,
            gallery_images
          )
        `)
        .eq('organizacion_id', organizacionId);

      if (!clubsError && clubsData) {
        organizationClubs = clubsData.map(item => ({
          id: item.id,
          ...item.clubes
        }));
      }
    }

    // 4. Get all available clubs for association
    const { data: allClubs, error: allClubsError } = await supabase
      .from('clubes')
      .select('id, name, address, phone, email')
      .order('name');

    if (allClubsError) {
      console.error("Error fetching all clubs:", allClubsError);
    }

    // Combine user and organization data
    const combinedProfile = {
      ...userData,
      ...(organizacionData || {}),
    };

    return {
      success: true,
      message: !organizacionData ? 
        "Complete el perfil de su organización para comenzar." : 
        "Datos de la organización obtenidos con éxito.",
      organizadorProfile: combinedProfile,
      organizationClubs: organizationClubs || [],
      allClubs: allClubs || [],
      errors: null,
    };

  } catch (error: any) {
    console.error("GetOrganizadorProfile: Unexpected error", error);
    return { success: false, message: `Error inesperado: ${error.message}`, errors: null };
  }
}

export async function completeOrganizadorProfile(prevState: OrganizadorFormState, formData: FormData): Promise<OrganizadorFormState> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, message: "Error de autenticación. Intenta iniciar sesión de nuevo.", errors: null };
  }

  // Ensure user is an ORGANIZADOR
  const { data: userRoleData, error: roleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (roleError || !userRoleData || userRoleData.role !== 'ORGANIZADOR') {
    return { success: false, message: "Acción no permitida. Rol de usuario incorrecto.", errors: null };
  }

  const rawFormEntries = Object.fromEntries(formData.entries());
  
  const dataToValidate = {
    name: rawFormEntries.name as string,
    description: rawFormEntries.description === '' ? null : rawFormEntries.description as string,
    phone: rawFormEntries.phone === '' ? null : rawFormEntries.phone as string,
    responsible_first_name: rawFormEntries.responsible_first_name as string,
    responsible_last_name: rawFormEntries.responsible_last_name as string,
    responsible_dni: rawFormEntries.responsible_dni as string,
    responsible_position: rawFormEntries.responsible_position as string,
  };

  const validation = organizadorProfileSchema.safeParse(dataToValidate);

  if (!validation.success) {
    console.error("Organizador Validation Errors:", validation.error.flatten().fieldErrors);
    return {
      success: false,
      message: "Error de validación. Revisa los campos de la organización.",
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const validatedData = validation.data;

  try {
    // First, check if user already has an organization via organization_members
    const { data: existingMember, error: memberCheckError } = await supabase
      .from('organization_members')
      .select('organizacion_id')
      .eq('user_id', user.id)
      .in('member_role', ['owner', 'admin'])
      .maybeSingle();

    let organizacionId: string;

    if (existingMember?.organizacion_id) {
      // Update existing organization
      organizacionId = existingMember.organizacion_id;
      
      const { error: updateError } = await supabase
        .from('organizaciones')
        .update({
          name: validatedData.name,
          description: validatedData.description,
          phone: validatedData.phone,
          responsible_first_name: validatedData.responsible_first_name,
          responsible_last_name: validatedData.responsible_last_name,
          responsible_dni: validatedData.responsible_dni,
          responsible_position: validatedData.responsible_position,
        })
        .eq('id', organizacionId);

      if (updateError) {
        console.error("Error updating organization:", updateError);
        return { success: false, message: `Error al actualizar la organización: ${updateError.message}`, errors: null };
      }
    } else {
      // Create new organization
      const { data: newOrganization, error: insertOrganizacionError } = await supabase
        .from('organizaciones')
        .insert({
          name: validatedData.name,
          description: validatedData.description,
          phone: validatedData.phone,
          responsible_first_name: validatedData.responsible_first_name,
          responsible_last_name: validatedData.responsible_last_name,
          responsible_dni: validatedData.responsible_dni,
          responsible_position: validatedData.responsible_position,
        })
        .select('id')
        .single();

      if (insertOrganizacionError || !newOrganization) {
        console.error("Error creating organization:", insertOrganizacionError);
        return { success: false, message: `Error al crear la organización: ${insertOrganizacionError?.message}`, errors: null };
      }

      organizacionId = newOrganization.id;

      // Create organization_members record for the user as admin
      const { error: memberInsertError } = await supabase
        .from('organization_members')
        .insert({
          organizacion_id: organizacionId,
          user_id: user.id,
          member_role: 'admin',
          is_active: true,
        });

      if (memberInsertError) {
        console.error("Error creating organization member:", memberInsertError);
        return { success: false, message: `Error al crear la membresía de la organización: ${memberInsertError.message}`, errors: null };
      }
    }

    return { success: true, message: "Perfil de la organización actualizado con éxito.", errors: null };

  } catch (error: any) {
    console.error("Unexpected error updating organizador profile:", error);
    return { success: false, message: `Error inesperado: ${error.message || 'Ocurrió un problema'}`, errors: null };
  }
}

export async function createClubForOrganization(formData: FormData): Promise<{ success: boolean; message: string; errors?: any }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, message: "Error de autenticación. Intenta iniciar sesión de nuevo." };
  }

  // Verify user is an ORGANIZADOR
  const { data: userRoleData, error: roleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (roleError || !userRoleData || userRoleData.role !== 'ORGANIZADOR') {
    return { success: false, message: "Acción no permitida. Solo los organizadores pueden crear clubes." };
  }

  // Get user's organization
  const { data: memberData, error: memberError } = await supabase
    .from('organization_members')
    .select('organizacion_id, member_role')
    .eq('user_id', user.id)
    .in('member_role', ['owner', 'admin'])
    .eq('is_active', true)
    .maybeSingle();

  if (memberError || !memberData) {
    return { success: false, message: "No se pudo encontrar tu organización. Completa tu perfil primero." };
  }

  const organizacionId = memberData.organizacion_id;

  // Extract and validate form data
  const rawFormData = {
    name: formData.get("name") as string,
    address: formData.get("address") as string,
    phone: formData.get("phone") as string || null,
    email: formData.get("email") as string || null,
    instagram: formData.get("instagram") as string || null,
    courts: formData.get("courts") && formData.get("courts") !== "" ? parseInt(formData.get("courts") as string) : null,
    opens_at: formData.get("opens_at") as string || null,
    closes_at: formData.get("closes_at") as string || null,
  };

  // Clean up empty strings to null
  const cleanedData = {
    ...rawFormData,
    phone: rawFormData.phone === "" ? null : rawFormData.phone,
    email: rawFormData.email === "" ? null : rawFormData.email,
    instagram: rawFormData.instagram === "" ? null : rawFormData.instagram,
    opens_at: rawFormData.opens_at === "" ? null : rawFormData.opens_at,
    closes_at: rawFormData.closes_at === "" ? null : rawFormData.closes_at,
  };

  const validation = clubCreationSchema.safeParse(cleanedData);

  if (!validation.success) {
    console.error("Club creation validation errors:", validation.error.flatten().fieldErrors);
    return {
      success: false,
      message: "Error de validación. Revisa los campos del club.",
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const validatedData = validation.data;

  try {
    // Create the club
    const { data: newClub, error: clubError } = await supabase
      .from('clubes')
      .insert({
        name: validatedData.name,
        address: validatedData.address,
        phone: validatedData.phone,
        email: validatedData.email,
        instagram: validatedData.instagram,
        courts: validatedData.courts,
        opens_at: validatedData.opens_at,
        closes_at: validatedData.closes_at,
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select('id, name')
      .single();

    if (clubError || !newClub) {
      console.error("Error creating club:", clubError);
      return { success: false, message: `Error al crear el club: ${clubError?.message}` };
    }

    // Associate the club with the organization
    const { error: associationError } = await supabase
      .from('organization_clubs')
      .insert({
        organizacion_id: organizacionId,
        club_id: newClub.id,
        created_at: new Date().toISOString(),
      });

    if (associationError) {
      console.error("Error associating club with organization:", associationError);
      // Try to rollback the club creation if association fails
      await supabase
        .from('clubes')
        .delete()
        .eq('id', newClub.id);
        
      return { success: false, message: `Error al asociar el club con la organización: ${associationError.message}` };
    }

    return { 
      success: true, 
      message: `Club "${newClub.name}" creado y asociado exitosamente a tu organización.` 
    };

  } catch (error: any) {
    console.error("Unexpected error creating club:", error);
    return { success: false, message: `Error inesperado: ${error.message || 'Ocurrió un problema'}` };
  }
}

export async function associateExistingClub(clubId: string): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, message: "Error de autenticación. Intenta iniciar sesión de nuevo." };
  }

  // Verify user is an ORGANIZADOR
  const { data: userRoleData, error: roleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (roleError || !userRoleData || userRoleData.role !== 'ORGANIZADOR') {
    return { success: false, message: "Acción no permitida. Solo los organizadores pueden asociar clubes." };
  }

  // Get user's organization
  const { data: memberData, error: memberError } = await supabase
    .from('organization_members')
    .select('organizacion_id, member_role')
    .eq('user_id', user.id)
    .in('member_role', ['owner', 'admin'])
    .eq('is_active', true)
    .maybeSingle();

  if (memberError || !memberData) {
    return { success: false, message: "No se pudo encontrar tu organización. Completa tu perfil primero." };
  }

  const organizacionId = memberData.organizacion_id;

  if (!clubId) {
    return { success: false, message: "ID del club requerido." };
  }

  try {
    // Verify the club exists
    const { data: clubData, error: clubError } = await supabase
      .from('clubes')
      .select('id, name, is_active')
      .eq('id', clubId)
      .eq('is_active', true)
      .single();

    if (clubError || !clubData) {
      return { success: false, message: "Club no encontrado o no activo." };
    }

    // Check if the association already exists
    const { data: existingAssociation, error: checkError } = await supabase
      .from('organization_clubs')
      .select('id')
      .eq('organizacion_id', organizacionId)
      .eq('club_id', clubId)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking existing association:", checkError);
      return { success: false, message: "Error al verificar asociación existente." };
    }

    if (existingAssociation) {
      return { success: false, message: "Este club ya está asociado a tu organización." };
    }

    // Create the association
    const { error: associationError } = await supabase
      .from('organization_clubs')
      .insert({
        organizacion_id: organizacionId,
        club_id: clubId,
        created_at: new Date().toISOString(),
      });

    if (associationError) {
      console.error("Error associating club with organization:", associationError);
      return { success: false, message: `Error al asociar el club: ${associationError.message}` };
    }

    return {
      success: true,
      message: `Club "${clubData.name}" asociado exitosamente a tu organización.`
    };

  } catch (error: any) {
    console.error("Unexpected error associating club:", error);
    return { success: false, message: `Error inesperado: ${error.message || 'Ocurrió un problema'}` };
  }
}

/**
 * Upload logo for an organization
 */
export async function uploadOrganizationLogoAction(formData: FormData): Promise<{ success: boolean; message: string; url?: string }> {
  const supabase = await createClient();

  try {
    console.log('[uploadOrganizationLogoAction] Starting logo upload...');

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[uploadOrganizationLogoAction] Auth error:', authError);
      return { success: false, message: "Usuario no autenticado." };
    }
    console.log('[uploadOrganizationLogoAction] User authenticated:', user.id);

    // Verify user is an ORGANIZADOR
    const { data: userRoleData, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError || !userRoleData || userRoleData.role !== 'ORGANIZADOR') {
      console.error('[uploadOrganizationLogoAction] Role error:', roleError, 'Role:', userRoleData?.role);
      return { success: false, message: "Acción no permitida. Solo los organizadores pueden subir imágenes." };
    }
    console.log('[uploadOrganizationLogoAction] User role verified: ORGANIZADOR');

    // Get user's organization
    const { data: memberData, error: memberError } = await supabase
      .from('organization_members')
      .select('organizacion_id')
      .eq('user_id', user.id)
      .in('member_role', ['owner', 'admin'])
      .eq('is_active', true)
      .maybeSingle();

    if (memberError || !memberData) {
      console.error('[uploadOrganizationLogoAction] Member error:', memberError);
      return { success: false, message: "No se pudo encontrar tu organización." };
    }

    const organizacionId = memberData.organizacion_id;
    console.log('[uploadOrganizationLogoAction] Organization ID:', organizacionId);

    // Get file from form data
    const file = formData.get('file') as File;
    if (!file || file.size === 0) {
      console.error('[uploadOrganizationLogoAction] No file provided');
      return { success: false, message: "No se seleccionó ningún archivo." };
    }
    console.log('[uploadOrganizationLogoAction] File received:', file.name, 'Size:', file.size, 'Type:', file.type);
    console.log('[uploadOrganizationLogoAction] File size:', (file.size / (1024 * 1024)).toFixed(2), 'MB');

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      console.error('[uploadOrganizationLogoAction] Invalid file type:', file.type);
      return { success: false, message: "Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG, WEBP)." };
    }

    // ✅ PASO 1: Buscar y eliminar logos existentes
    console.log('[uploadOrganizationLogoAction] Searching for existing logos...');
    const { data: existingLogos, error: listError } = await supabase.storage
      .from('organizaciones')
      .list(organizacionId, {
        search: 'logo-'
      });

    if (listError) {
      console.error('[uploadOrganizationLogoAction] Error listing files:', listError);
    }

    if (existingLogos && existingLogos.length > 0) {
      console.log('[uploadOrganizationLogoAction] Deleting', existingLogos.length, 'old logo(s)...');
      const filesToDelete = existingLogos.map(f => `${organizacionId}/${f.name}`);

      const { error: deleteError } = await supabase.storage
        .from('organizaciones')
        .remove(filesToDelete);

      if (deleteError) {
        console.error('[uploadOrganizationLogoAction] Error deleting old logos:', deleteError);
      } else {
        console.log('[uploadOrganizationLogoAction] Successfully deleted old logos');
      }
    } else {
      console.log('[uploadOrganizationLogoAction] No existing logos found');
    }

    // ✅ PASO 2: Upload to Supabase Storage
    const fileExtension = file.name.split('.').pop();
    const fileName = `${organizacionId}/logo-${Date.now()}.${fileExtension}`;
    console.log('[uploadOrganizationLogoAction] Uploading to path:', fileName);

    const { error: uploadError } = await supabase.storage
      .from('organizaciones')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('[uploadOrganizationLogoAction] Upload error:', uploadError);
      return { success: false, message: `Error al subir el logo: ${uploadError.message}` };
    }
    console.log('[uploadOrganizationLogoAction] File uploaded successfully');

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('organizaciones')
      .getPublicUrl(fileName);
    console.log('[uploadOrganizationLogoAction] Public URL:', publicUrl);

    // Update organization logo_url in database
    const { error: updateError } = await supabase
      .from('organizaciones')
      .update({ logo_url: publicUrl })
      .eq('id', organizacionId);

    if (updateError) {
      console.error('[uploadOrganizationLogoAction] Database update error:', updateError);
      return { success: false, message: `Error al actualizar el logo: ${updateError.message}` };
    }
    console.log('[uploadOrganizationLogoAction] Database updated successfully');

    // Invalidate cache
    const { revalidatePath } = await import("next/cache");
    revalidatePath('/edit-profile');

    console.log('[uploadOrganizationLogoAction] Logo upload completed successfully');
    return {
      success: true,
      message: "Logo actualizado exitosamente.",
      url: publicUrl,
    };
  } catch (error: any) {
    console.error('[uploadOrganizationLogoAction] Unexpected error:', error);
    return { success: false, message: "Error inesperado al subir el logo." };
  }
}

/**
 * Upload cover image for an organization
 */
export async function uploadOrganizationCoverAction(formData: FormData): Promise<{ success: boolean; message: string; url?: string }> {
  const supabase = await createClient();

  try {
    console.log('[uploadOrganizationCoverAction] Starting cover image upload...');

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[uploadOrganizationCoverAction] Auth error:', authError);
      return { success: false, message: "Usuario no autenticado." };
    }
    console.log('[uploadOrganizationCoverAction] User authenticated:', user.id);

    // Verify user is an ORGANIZADOR
    const { data: userRoleData, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError || !userRoleData || userRoleData.role !== 'ORGANIZADOR') {
      console.error('[uploadOrganizationCoverAction] Role error:', roleError, 'Role:', userRoleData?.role);
      return { success: false, message: "Acción no permitida. Solo los organizadores pueden subir imágenes." };
    }
    console.log('[uploadOrganizationCoverAction] User role verified: ORGANIZADOR');

    // Get user's organization
    const { data: memberData, error: memberError } = await supabase
      .from('organization_members')
      .select('organizacion_id')
      .eq('user_id', user.id)
      .in('member_role', ['owner', 'admin'])
      .eq('is_active', true)
      .maybeSingle();

    if (memberError || !memberData) {
      console.error('[uploadOrganizationCoverAction] Member error:', memberError);
      return { success: false, message: "No se pudo encontrar tu organización." };
    }

    const organizacionId = memberData.organizacion_id;
    console.log('[uploadOrganizationCoverAction] Organization ID:', organizacionId);

    // Get file from form data
    const file = formData.get('file') as File;
    if (!file || file.size === 0) {
      console.error('[uploadOrganizationCoverAction] No file provided');
      return { success: false, message: "No se seleccionó ningún archivo." };
    }
    console.log('[uploadOrganizationCoverAction] File received:', file.name, 'Size:', file.size, 'Type:', file.type);
    console.log('[uploadOrganizationCoverAction] File size:', (file.size / (1024 * 1024)).toFixed(2), 'MB');

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      console.error('[uploadOrganizationCoverAction] Invalid file type:', file.type);
      return { success: false, message: "Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG, WEBP)." };
    }

    // ✅ PASO 1: Buscar y eliminar covers existentes
    console.log('[uploadOrganizationCoverAction] Searching for existing covers...');
    const { data: existingCovers, error: listError } = await supabase.storage
      .from('organizaciones')
      .list(organizacionId, {
        search: 'cover-'
      });

    if (listError) {
      console.error('[uploadOrganizationCoverAction] Error listing files:', listError);
    }

    if (existingCovers && existingCovers.length > 0) {
      console.log('[uploadOrganizationCoverAction] Deleting', existingCovers.length, 'old cover(s)...');
      const filesToDelete = existingCovers.map(f => `${organizacionId}/${f.name}`);

      const { error: deleteError } = await supabase.storage
        .from('organizaciones')
        .remove(filesToDelete);

      if (deleteError) {
        console.error('[uploadOrganizationCoverAction] Error deleting old covers:', deleteError);
      } else {
        console.log('[uploadOrganizationCoverAction] Successfully deleted old covers');
      }
    } else {
      console.log('[uploadOrganizationCoverAction] No existing covers found');
    }

    // ✅ PASO 2: Upload to Supabase Storage
    const fileExtension = file.name.split('.').pop();
    const fileName = `${organizacionId}/cover-${Date.now()}.${fileExtension}`;
    console.log('[uploadOrganizationCoverAction] Uploading to path:', fileName);

    const { error: uploadError } = await supabase.storage
      .from('organizaciones')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('[uploadOrganizationCoverAction] Upload error:', uploadError);
      return { success: false, message: `Error al subir la imagen: ${uploadError.message}` };
    }
    console.log('[uploadOrganizationCoverAction] File uploaded successfully');

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('organizaciones')
      .getPublicUrl(fileName);
    console.log('[uploadOrganizationCoverAction] Public URL:', publicUrl);

    // Update organization cover_image_url in database
    const { error: updateError } = await supabase
      .from('organizaciones')
      .update({ cover_image_url: publicUrl })
      .eq('id', organizacionId);

    if (updateError) {
      console.error('[uploadOrganizationCoverAction] Database update error:', updateError);
      return { success: false, message: `Error al actualizar la imagen: ${updateError.message}` };
    }
    console.log('[uploadOrganizationCoverAction] Database updated successfully');

    // Invalidate cache
    const { revalidatePath } = await import("next/cache");
    revalidatePath('/edit-profile');

    console.log('[uploadOrganizationCoverAction] Cover image upload completed successfully');
    return {
      success: true,
      message: "Imagen de portada actualizada exitosamente.",
      url: publicUrl,
    };
  } catch (error: any) {
    console.error('[uploadOrganizationCoverAction] Unexpected error:', error);
    return { success: false, message: "Error inesperado al subir la imagen." };
  }
}

/**
 * Upload gallery image for an organization
 */
export async function uploadOrganizationGalleryAction(formData: FormData): Promise<{ success: boolean; message: string; url?: string; galleryImages?: string[] }> {
  const supabase = await createClient();

  try {
    console.log('[uploadOrganizationGalleryAction] Starting gallery image upload...');

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[uploadOrganizationGalleryAction] Auth error:', authError);
      return { success: false, message: "Usuario no autenticado." };
    }
    console.log('[uploadOrganizationGalleryAction] User authenticated:', user.id);

    // Verify user is an ORGANIZADOR
    const { data: userRoleData, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError || !userRoleData || userRoleData.role !== 'ORGANIZADOR') {
      console.error('[uploadOrganizationGalleryAction] Role error:', roleError, 'Role:', userRoleData?.role);
      return { success: false, message: "Acción no permitida. Solo los organizadores pueden subir imágenes." };
    }
    console.log('[uploadOrganizationGalleryAction] User role verified: ORGANIZADOR');

    // Get user's organization
    const { data: memberData, error: memberError } = await supabase
      .from('organization_members')
      .select('organizacion_id')
      .eq('user_id', user.id)
      .in('member_role', ['owner', 'admin'])
      .eq('is_active', true)
      .maybeSingle();

    if (memberError || !memberData) {
      console.error('[uploadOrganizationGalleryAction] Member error:', memberError);
      return { success: false, message: "No se pudo encontrar tu organización." };
    }

    const organizacionId = memberData.organizacion_id;
    console.log('[uploadOrganizationGalleryAction] Organization ID:', organizacionId);

    // Get file from form data
    const file = formData.get('file') as File;
    if (!file || file.size === 0) {
      console.error('[uploadOrganizationGalleryAction] No file provided');
      return { success: false, message: "No se seleccionó ningún archivo." };
    }
    console.log('[uploadOrganizationGalleryAction] File received:', file.name, 'Size:', file.size, 'Type:', file.type);
    console.log('[uploadOrganizationGalleryAction] File size:', (file.size / (1024 * 1024)).toFixed(2), 'MB');

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      console.error('[uploadOrganizationGalleryAction] Invalid file type:', file.type);
      return { success: false, message: "Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG, WEBP)." };
    }

    // Get current gallery images
    const { data: orgData, error: orgError } = await supabase
      .from('organizaciones')
      .select('gallery_images')
      .eq('id', organizacionId)
      .single();

    if (orgError) {
      console.error('[uploadOrganizationGalleryAction] Error fetching organization:', orgError);
      return { success: false, message: "Error al obtener datos de la organización." };
    }

    const currentGallery = (orgData.gallery_images as string[]) || [];
    console.log('[uploadOrganizationGalleryAction] Current gallery size:', currentGallery.length);

    // Upload to Supabase Storage
    const fileExtension = file.name.split('.').pop();
    const fileName = `${organizacionId}/gallery-${Date.now()}.${fileExtension}`;
    console.log('[uploadOrganizationGalleryAction] Uploading to path:', fileName);

    const { error: uploadError } = await supabase.storage
      .from('organizaciones')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('[uploadOrganizationGalleryAction] Upload error:', uploadError);
      return { success: false, message: `Error al subir la imagen: ${uploadError.message}` };
    }
    console.log('[uploadOrganizationGalleryAction] File uploaded successfully');

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('organizaciones')
      .getPublicUrl(fileName);
    console.log('[uploadOrganizationGalleryAction] Public URL:', publicUrl);

    // Add new image to gallery array
    const updatedGallery = [...currentGallery, publicUrl];
    console.log('[uploadOrganizationGalleryAction] Updated gallery size:', updatedGallery.length);

    // Update organization gallery_images in database
    const { error: updateError } = await supabase
      .from('organizaciones')
      .update({ gallery_images: updatedGallery })
      .eq('id', organizacionId);

    if (updateError) {
      console.error('[uploadOrganizationGalleryAction] Database update error:', updateError);
      return { success: false, message: `Error al actualizar la galería: ${updateError.message}` };
    }
    console.log('[uploadOrganizationGalleryAction] Database updated successfully');

    // Invalidate cache
    const { revalidatePath } = await import("next/cache");
    revalidatePath('/edit-profile');

    console.log('[uploadOrganizationGalleryAction] Gallery image upload completed successfully');
    return {
      success: true,
      message: "Imagen agregada a la galería exitosamente.",
      url: publicUrl,
      galleryImages: updatedGallery,
    };
  } catch (error: any) {
    console.error('[uploadOrganizationGalleryAction] Unexpected error:', error);
    return { success: false, message: "Error inesperado al subir la imagen." };
  }
}

/**
 * Remove gallery image from an organization
 */
export async function removeOrganizationGalleryAction(formData: FormData): Promise<{ success: boolean; message: string; galleryImages?: string[] }> {
  const supabase = await createClient();

  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, message: "Usuario no autenticado." };
    }

    // Verify user is an ORGANIZADOR
    const { data: userRoleData, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError || !userRoleData || userRoleData.role !== 'ORGANIZADOR') {
      return { success: false, message: "Acción no permitida. Solo los organizadores pueden eliminar imágenes." };
    }

    // Get user's organization
    const { data: memberData, error: memberError } = await supabase
      .from('organization_members')
      .select('organizacion_id')
      .eq('user_id', user.id)
      .in('member_role', ['owner', 'admin'])
      .eq('is_active', true)
      .maybeSingle();

    if (memberError || !memberData) {
      return { success: false, message: "No se pudo encontrar tu organización." };
    }

    const organizacionId = memberData.organizacion_id;

    // Get image URL from form data
    const imageUrl = formData.get('imageUrl') as string;
    if (!imageUrl) {
      return { success: false, message: "URL de imagen no válida." };
    }

    // Get current gallery images
    const { data: orgData, error: orgError } = await supabase
      .from('organizaciones')
      .select('gallery_images')
      .eq('id', organizacionId)
      .single();

    if (orgError) {
      console.error("Error fetching organization:", orgError);
      return { success: false, message: "Error al obtener datos de la organización." };
    }

    const currentGallery = (orgData.gallery_images as string[]) || [];

    // Remove image from array
    const updatedGallery = currentGallery.filter(url => url !== imageUrl);

    // Extract file path from URL to delete from storage
    const urlParts = imageUrl.split('/');
    const bucketIndex = urlParts.findIndex(part => part === 'organizaciones');
    if (bucketIndex !== -1 && bucketIndex < urlParts.length - 1) {
      const filePath = urlParts.slice(bucketIndex + 1).join('/');

      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from('organizaciones')
        .remove([filePath]);

      if (deleteError) {
        console.error("Error deleting image from storage:", deleteError);
        // Continue anyway to update the database
      }
    }

    // Update organization gallery_images in database
    const { error: updateError } = await supabase
      .from('organizaciones')
      .update({ gallery_images: updatedGallery })
      .eq('id', organizacionId);

    if (updateError) {
      console.error("Error updating organization gallery:", updateError);
      return { success: false, message: `Error al actualizar la galería: ${updateError.message}` };
    }

    // Invalidate cache
    const { revalidatePath } = await import("next/cache");
    revalidatePath('/edit-profile');

    return {
      success: true,
      message: "Imagen eliminada de la galería exitosamente.",
      galleryImages: updatedGallery,
    };
  } catch (error: any) {
    console.error("Error in removeOrganizationGalleryAction:", error);
    return { success: false, message: "Error inesperado al eliminar la imagen." };
  }
}

/**
 * Upload cover image for a club (by organizer)
 */
export async function uploadClubCoverActionForOrganizer(clubId: string, formData: FormData): Promise<{ success: boolean; message: string; url?: string }> {
  const supabase = await createClient();

  try {
    console.log('[uploadClubCoverActionForOrganizer] Starting upload for club:', clubId);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[uploadClubCoverActionForOrganizer] Auth error:', authError);
      return { success: false, message: "Usuario no autenticado." };
    }

    // Verify user is an ORGANIZADOR and has access to this club
    const { data: userRoleData, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError || !userRoleData || userRoleData.role !== 'ORGANIZADOR') {
      console.error('[uploadClubCoverActionForOrganizer] Role error:', roleError);
      return { success: false, message: "Acción no permitida." };
    }

    // Get user's organization and verify club association
    const { data: memberData, error: memberError } = await supabase
      .from('organization_members')
      .select('organizacion_id')
      .eq('user_id', user.id)
      .in('member_role', ['owner', 'admin'])
      .eq('is_active', true)
      .maybeSingle();

    if (memberError || !memberData) {
      console.error('[uploadClubCoverActionForOrganizer] Member error:', memberError);
      return { success: false, message: "No se pudo encontrar tu organización." };
    }

    // Verify club is associated with organization
    const { data: clubAssoc, error: clubAssocError } = await supabase
      .from('organization_clubs')
      .select('id')
      .eq('organizacion_id', memberData.organizacion_id)
      .eq('club_id', clubId)
      .maybeSingle();

    if (clubAssocError || !clubAssoc) {
      console.error('[uploadClubCoverActionForOrganizer] Club not associated:', clubAssocError);
      return { success: false, message: "Este club no está asociado a tu organización." };
    }

    const file = formData.get('file') as File;
    if (!file || file.size === 0) {
      console.error('[uploadClubCoverActionForOrganizer] No file provided');
      return { success: false, message: "No se seleccionó ningún archivo." };
    }

    console.log('[uploadClubCoverActionForOrganizer] File received:', file.name, 'Size:', file.size, 'Type:', file.type);

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      console.error('[uploadClubCoverActionForOrganizer] Invalid file type:', file.type);
      return { success: false, message: "Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG, WEBP)." };
    }

    // Use the same helper function that CLUB role uses
    console.log('[uploadClubCoverActionForOrganizer] Calling uploadClubCoverImage helper...');
    const { uploadClubCoverImage } = await import("@/app/api/users");
    const result = await uploadClubCoverImage(clubId, file);
    console.log('[uploadClubCoverActionForOrganizer] Upload result:', result);

    if (result.success) {
      // Invalidate cache
      const { revalidatePath } = await import("next/cache");
      revalidatePath('/edit-profile');

      console.log('[uploadClubCoverActionForOrganizer] Cover image uploaded successfully');
      return { success: true, message: "Imagen de portada actualizada exitosamente.", url: result.url };
    } else {
      console.error('[uploadClubCoverActionForOrganizer] Upload failed:', result.error);
      return { success: false, message: result.error || "Error al subir la imagen." };
    }
  } catch (error: any) {
    console.error('[uploadClubCoverActionForOrganizer] Unexpected error:', error);
    return { success: false, message: "Error inesperado al subir la imagen." };
  }
}

/**
 * Upload gallery image for a club (by organizer)
 */
export async function uploadClubGalleryActionForOrganizer(clubId: string, formData: FormData): Promise<{ success: boolean; message: string; url?: string; galleryImages?: string[] }> {
  const supabase = await createClient();

  try {
    console.log('[uploadClubGalleryActionForOrganizer] Starting upload for club:', clubId);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[uploadClubGalleryActionForOrganizer] Auth error:', authError);
      return { success: false, message: "Usuario no autenticado." };
    }

    // Verify user is an ORGANIZADOR and has access to this club
    const { data: userRoleData, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError || !userRoleData || userRoleData.role !== 'ORGANIZADOR') {
      console.error('[uploadClubGalleryActionForOrganizer] Role error:', roleError);
      return { success: false, message: "Acción no permitida." };
    }

    // Get user's organization and verify club association
    const { data: memberData, error: memberError } = await supabase
      .from('organization_members')
      .select('organizacion_id')
      .eq('user_id', user.id)
      .in('member_role', ['owner', 'admin'])
      .eq('is_active', true)
      .maybeSingle();

    if (memberError || !memberData) {
      console.error('[uploadClubGalleryActionForOrganizer] Member error:', memberError);
      return { success: false, message: "No se pudo encontrar tu organización." };
    }

    // Verify club is associated with organization
    const { data: clubAssoc, error: clubAssocError } = await supabase
      .from('organization_clubs')
      .select('id')
      .eq('organizacion_id', memberData.organizacion_id)
      .eq('club_id', clubId)
      .maybeSingle();

    if (clubAssocError || !clubAssoc) {
      console.error('[uploadClubGalleryActionForOrganizer] Club not associated:', clubAssocError);
      return { success: false, message: "Este club no está asociado a tu organización." };
    }

    const file = formData.get('file') as File;
    if (!file || file.size === 0) {
      console.error('[uploadClubGalleryActionForOrganizer] No file provided');
      return { success: false, message: "No se seleccionó ningún archivo." };
    }

    console.log('[uploadClubGalleryActionForOrganizer] File received:', file.name, 'Size:', file.size, 'Type:', file.type);

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      console.error('[uploadClubGalleryActionForOrganizer] Invalid file type:', file.type);
      return { success: false, message: "Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG, WEBP)." };
    }

    // Use the same helper function that CLUB role uses
    console.log('[uploadClubGalleryActionForOrganizer] Calling uploadClubGalleryImage helper...');
    const { uploadClubGalleryImage } = await import("@/app/api/users");
    const result = await uploadClubGalleryImage(clubId, file);
    console.log('[uploadClubGalleryActionForOrganizer] Upload result:', result);

    if (result.success) {
      // Invalidate cache
      const { revalidatePath } = await import("next/cache");
      revalidatePath('/edit-profile');

      console.log('[uploadClubGalleryActionForOrganizer] Gallery image uploaded successfully');
      return {
        success: true,
        message: "Imagen agregada a la galería exitosamente.",
        url: result.url,
        galleryImages: result.galleryImages,
      };
    } else {
      console.error('[uploadClubGalleryActionForOrganizer] Upload failed:', result.error);
      return { success: false, message: result.error || "Error al subir la imagen." };
    }
  } catch (error: any) {
    console.error('[uploadClubGalleryActionForOrganizer] Unexpected error:', error);
    return { success: false, message: "Error inesperado al subir la imagen." };
  }
}

/**
 * Remove gallery image from a club (by organizer)
 */
export async function removeClubGalleryActionForOrganizer(clubId: string, imageUrl: string): Promise<{ success: boolean; message: string; galleryImages?: string[] }> {
  const supabase = await createClient();

  try {
    console.log('[removeClubGalleryActionForOrganizer] Starting removal for club:', clubId, 'Image:', imageUrl);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[removeClubGalleryActionForOrganizer] Auth error:', authError);
      return { success: false, message: "Usuario no autenticado." };
    }

    // Verify user is an ORGANIZADOR and has access to this club
    const { data: userRoleData, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError || !userRoleData || userRoleData.role !== 'ORGANIZADOR') {
      console.error('[removeClubGalleryActionForOrganizer] Role error:', roleError);
      return { success: false, message: "Acción no permitida." };
    }

    // Get user's organization and verify club association
    const { data: memberData, error: memberError } = await supabase
      .from('organization_members')
      .select('organizacion_id')
      .eq('user_id', user.id)
      .in('member_role', ['owner', 'admin'])
      .eq('is_active', true)
      .maybeSingle();

    if (memberError || !memberData) {
      console.error('[removeClubGalleryActionForOrganizer] Member error:', memberError);
      return { success: false, message: "No se pudo encontrar tu organización." };
    }

    // Verify club is associated with organization
    const { data: clubAssoc, error: clubAssocError } = await supabase
      .from('organization_clubs')
      .select('id')
      .eq('organizacion_id', memberData.organizacion_id)
      .eq('club_id', clubId)
      .maybeSingle();

    if (clubAssocError || !clubAssoc) {
      console.error('[removeClubGalleryActionForOrganizer] Club not associated:', clubAssocError);
      return { success: false, message: "Este club no está asociado a tu organización." };
    }

    // Use the same helper function that CLUB role uses
    console.log('[removeClubGalleryActionForOrganizer] Calling removeClubGalleryImage helper...');
    const { removeClubGalleryImage } = await import("@/app/api/users");
    const result = await removeClubGalleryImage(clubId, imageUrl);
    console.log('[removeClubGalleryActionForOrganizer] Remove result:', result);

    if (result.success) {
      // Invalidate cache
      const { revalidatePath } = await import("next/cache");
      revalidatePath('/edit-profile');

      console.log('[removeClubGalleryActionForOrganizer] Gallery image removed successfully');
      return {
        success: true,
        message: "Imagen eliminada de la galería exitosamente.",
        galleryImages: result.galleryImages,
      };
    } else {
      console.error('[removeClubGalleryActionForOrganizer] Remove failed:', result.error);
      return { success: false, message: result.error || "Error al eliminar la imagen." };
    }
  } catch (error: any) {
    console.error('[removeClubGalleryActionForOrganizer] Unexpected error:', error);
    return { success: false, message: "Error inesperado al eliminar la imagen." };
  }
}

/**
 * Update club information (by organizer)
 */
export async function updateClubForOrganizer(formData: FormData): Promise<{ success: boolean; message: string; errors?: any }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, message: "Error de autenticación. Intenta iniciar sesión de nuevo." };
  }

  // Verify user is an ORGANIZADOR
  const { data: userRoleData, error: roleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (roleError || !userRoleData || userRoleData.role !== 'ORGANIZADOR') {
    return { success: false, message: "Acción no permitida. Solo los organizadores pueden actualizar clubes." };
  }

  // Get user's organization
  const { data: memberData, error: memberError } = await supabase
    .from('organization_members')
    .select('organizacion_id, member_role')
    .eq('user_id', user.id)
    .in('member_role', ['owner', 'admin'])
    .eq('is_active', true)
    .maybeSingle();

  if (memberError || !memberData) {
    return { success: false, message: "No se pudo encontrar tu organización. Completa tu perfil primero." };
  }

  const organizacionId = memberData.organizacion_id;
  const clubId = formData.get("clubId") as string;

  if (!clubId) {
    return { success: false, message: "ID del club requerido." };
  }

  // Verify club is associated with this organization
  const { data: clubAssoc, error: clubAssocError } = await supabase
    .from('organization_clubs')
    .select('id')
    .eq('organizacion_id', organizacionId)
    .eq('club_id', clubId)
    .maybeSingle();

  if (clubAssocError || !clubAssoc) {
    return { success: false, message: "Este club no está asociado a tu organización." };
  }

  // Extract and validate form data
  const rawFormData = {
    name: formData.get("name") as string,
    address: formData.get("address") as string,
    phone: formData.get("phone") as string || null,
    email: formData.get("email") as string || null,
    instagram: formData.get("instagram") as string || null,
    courts: formData.get("courts") && formData.get("courts") !== "" ? parseInt(formData.get("courts") as string) : null,
    opens_at: formData.get("opens_at") as string || null,
    closes_at: formData.get("closes_at") as string || null,
  };

  // Clean up empty strings to null
  const cleanedData = {
    ...rawFormData,
    phone: rawFormData.phone === "" ? null : rawFormData.phone,
    email: rawFormData.email === "" ? null : rawFormData.email,
    instagram: rawFormData.instagram === "" ? null : rawFormData.instagram,
    opens_at: rawFormData.opens_at === "" ? null : rawFormData.opens_at,
    closes_at: rawFormData.closes_at === "" ? null : rawFormData.closes_at,
  };

  const validation = clubCreationSchema.safeParse(cleanedData);

  if (!validation.success) {
    console.error("Club update validation errors:", validation.error.flatten().fieldErrors);
    return {
      success: false,
      message: "Error de validación. Revisa los campos del club.",
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const validatedData = validation.data;

  try {
    // Update the club
    const { error: updateError } = await supabase
      .from('clubes')
      .update({
        name: validatedData.name,
        address: validatedData.address,
        phone: validatedData.phone,
        email: validatedData.email,
        instagram: validatedData.instagram,
        courts: validatedData.courts,
        opens_at: validatedData.opens_at,
        closes_at: validatedData.closes_at,
      })
      .eq('id', clubId);

    if (updateError) {
      console.error("Error updating club:", updateError);
      return { success: false, message: `Error al actualizar el club: ${updateError.message}` };
    }

    // Invalidate cache
    const { revalidatePath } = await import("next/cache");
    revalidatePath('/edit-profile');

    return {
      success: true,
      message: "Club actualizado exitosamente."
    };

  } catch (error: any) {
    console.error("Unexpected error updating club:", error);
    return { success: false, message: `Error inesperado: ${error.message || 'Ocurrió un problema'}` };
  }
}

/**
 * Set or unset featured club for an organization
 */
export async function setFeaturedClub(clubId: string | null): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, message: "Usuario no autenticado." };
    }

    // Get the organization for this user via organization_members
    const { data: memberData, error: memberError } = await supabase
      .from('organization_members')
      .select('organizacion_id')
      .eq('user_id', user.id)
      .in('member_role', ['owner', 'admin'])
      .maybeSingle();

    if (memberError || !memberData?.organizacion_id) {
      return { success: false, message: "No se encontró la organización del usuario." };
    }

    const organizacionId = memberData.organizacion_id;

    // If clubId is provided, verify it belongs to this organization
    if (clubId) {
      const { data: clubAssociation, error: clubError } = await supabase
        .from('organization_clubs')
        .select('id')
        .eq('organizacion_id', organizacionId)
        .eq('club_id', clubId)
        .single();

      if (clubError || !clubAssociation) {
        return { success: false, message: "El club seleccionado no pertenece a esta organización." };
      }
    }

    // Update the featured_club_id
    const { error: updateError } = await supabase
      .from('organizaciones')
      .update({ featured_club_id: clubId })
      .eq('id', organizacionId);

    if (updateError) {
      console.error("Error updating featured club:", updateError);
      return { success: false, message: "Error al actualizar el club destacado." };
    }

    return {
      success: true,
      message: clubId ? "Club destacado actualizado exitosamente." : "Club destacado removido exitosamente."
    };
  } catch (error: any) {
    console.error("Error in setFeaturedClub:", error);
    return { success: false, message: "Error inesperado al actualizar el club destacado." };
  }
}