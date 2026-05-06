import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { HomeContent } from "@/components/home/HomeContent"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session?.user) {
    redirect("/panel")
  }

  return <HomeContent />
}
