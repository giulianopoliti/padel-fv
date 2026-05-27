import { redirect } from 'next/navigation'

interface SettingsPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const resolvedParams = await params
  redirect(`/tournaments/${resolvedParams.id}/settings/datos`)
}
