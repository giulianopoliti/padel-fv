import { OrganizationsClient } from "./organizations-client"
import { supabaseAdmin } from "@/lib/supabase-admin"

async function getOrganizationsWithMembers() {
  const { data: organizations, error } = await supabaseAdmin
    .from("organizaciones")
    .select(`
      id,
      name,
      email,
      phone,
      is_active,
      created_at,
      responsible_first_name,
      responsible_last_name,
      responsible_dni,
      description
    `)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching organizations:", error)
    return []
  }

  return organizations || []
}

export default async function AdminOrganizationsPage() {
  const organizations = await getOrganizationsWithMembers()

  return <OrganizationsClient organizations={organizations} />
}
