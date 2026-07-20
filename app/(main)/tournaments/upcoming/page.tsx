import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{
    page?: string
    category?: string
    club?: string
    gender?: string
    search?: string
    type?: string
  }>
}

export default async function UpcomingTournamentsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const queryString = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]))
  ).toString()
  redirect(`/tournaments${queryString ? `?${queryString}` : ""}`)
}
