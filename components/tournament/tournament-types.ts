import type { Tournament, Category, AmericanMatch, LargeMatch, Couple, User, BaseMatch } from "@/types"

type MatchStatus = BaseMatch['status'];

// Esta interfaz ahora solo contiene datos básicos del torneo
export interface BaseTournamentProps {
  tournament: Tournament
  category: Category | null
  matches: AmericanMatch[] | LargeMatch[]
  couples: Couple[]
  user: User | null
  isRegistered: boolean
  loading: boolean
  isAuthenticated: boolean
  onRegister: () => void
  // Eliminamos: user, isRegistered, loading, isAuthenticated, router, onRegister
}

export interface MatchTableProps {
  matches: BaseMatch[];
  formatDate: (date: string | undefined) => string;
  isOwner: boolean;
  tournamentId: string;
  onUpdateMatch: (matchId: string, data: { status?: MatchStatus; court?: string }) => Promise<void>;
  onOpenResultDialog?: (match: BaseMatch) => void;
  onMatchDeleted?: () => void;
}

// Eliminamos RegistrationButtonProps por ahora, ya que no se usará
// export interface RegistrationButtonProps { ... } 