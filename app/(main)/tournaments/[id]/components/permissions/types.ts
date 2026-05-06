// Types para el sistema de permisos y vistas
export type UserRole = 'GUEST' | 'PLAYER' | 'CLUB' | 'COACH' | 'ORGANIZADOR' | 'ADMIN';

export type TournamentPermission = 
  | 'view_public'           // Ver información pública
  | 'register_individual'   // Registrarse individualmente
  | 'register_couple'       // Registrarse en pareja
  | 'manage_tournament'     // Gestionar torneo completo
  | 'update_results'        // Actualizar resultados
  | 'manage_inscriptions'   // Gestionar inscripciones
  | 'upload_images'         // Subir imágenes
  | 'start_tournament'      // Iniciar torneo
  | 'cancel_tournament';    // Cancelar torneo

export interface TournamentAccess {
  role: UserRole;
  isOwner: boolean;
  isParticipant: boolean;
  permissions: TournamentPermission[];
}

export interface ViewStrategy {
  canAccess: (access: TournamentAccess) => boolean;
  getViewConfig: (access: TournamentAccess) => ViewConfig;
}

export interface ViewConfig {
  showHeader: boolean;
  showActionButtons: boolean;
  allowRegistration: boolean;
  allowEditing: boolean;
  showPrivateInfo: boolean;
  backUrl: string;
  backLabel: string;
}

export interface TournamentViewProps {
  tournamentId: string;
  access: TournamentAccess;
} 