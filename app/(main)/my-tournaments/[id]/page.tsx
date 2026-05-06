import { redirect } from 'next/navigation';

interface MyTournamentRedirectPageProps {
  params: { id: string };
}

// Esta página ahora solo sirve como un punto de acceso rápido que redirige
// a la vista unificada del torneo.
export default function MyTournamentRedirectPage({ params }: MyTournamentRedirectPageProps) {
  redirect(`/tournaments/${params.id}`);
}
