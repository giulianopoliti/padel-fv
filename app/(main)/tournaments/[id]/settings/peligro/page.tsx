import { redirect } from 'next/navigation'

interface SettingsPeligroPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function SettingsPeligroPage({
  params,
}: SettingsPeligroPageProps) {
  const resolvedParams = await params
  redirect(`/tournaments/${resolvedParams.id}/settings/operacion`)
}
