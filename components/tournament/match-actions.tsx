'use client';

import type { BaseMatch } from '@/types';
import MatchStatusBadge from './match-status-badge';
import MatchActionsMenu from './match-actions-menu';

type MatchStatus = BaseMatch['status'];

interface MatchActionsProps {
  match: {
    id: string;
    status: MatchStatus;
    court?: string;
  };
  tournamentId: string;
  isOwner: boolean;
  onUpdateMatch: (matchId: string, data: { status?: MatchStatus; court?: string }) => Promise<void>;
  onOpenResultDialog: () => void;
  onMatchDeleted?: () => void;
  matchInfo?: {
    couple1?: string;
    couple2?: string;
    hasRealCouple1?: boolean;
    hasRealCouple2?: boolean;
    isPlaceholder1?: boolean;
    isPlaceholder2?: boolean;
  };
}

export default function MatchActions({ match, tournamentId, isOwner, onUpdateMatch, onOpenResultDialog, onMatchDeleted, matchInfo }: MatchActionsProps) {
  // Para espectadores, solo mostrar el estado
  if (!isOwner) {
    return (
      <MatchStatusBadge 
        status={match.status} 
        court={match.court}
      />
    );
  }

  // Para el club propietario, mostrar solo el menú de acciones (sin duplicar el estado)
  return (
    <MatchActionsMenu
      matchId={match.id}
      tournamentId={tournamentId}
      status={match.status}
      court={match.court}
      matchInfo={matchInfo}
      onUpdateMatch={onUpdateMatch}
      onMatchDeleted={onMatchDeleted}
      isOwner={isOwner}
      onOpenResultDialog={onOpenResultDialog}
    />
  );
} 