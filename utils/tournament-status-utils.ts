/**
 * Utilidades para manejar los estados de torneos
 * Centralizamos las traducciones de estados para evitar duplicación
 */

export function getTournamentStatusText(status: string | null): string {
  switch (status) {
    case "NOT_STARTED":
      return "Próximamente";
    case "ZONE_PHASE":
      return "Fase de Zonas";
    case "BRACKET_PHASE":
      return "Fase Eliminatoria";
    case "PAIRING":
      return "Emparejamiento";
    case "ZONE_REGISTRATION":
      return "Inscripción de Zonas";
    case "IN_PROGRESS":
      return "En curso";
    case "FINISHED":
      return "Finalizado";
    case "FINISHED_POINTS_PENDING":
      return "Puntos Pendientes";
    case "FINISHED_POINTS_CALCULATED":
      return "Puntos Aplicados";
    case "CANCELED":
      return "Cancelado";
    default:
      return status || "Desconocido";
  }
}

export function getMatchStatusText(status: string | null): string {
  switch (status) {
    case 'FINISHED':
      return 'Finalizado';
    case 'COMPLETED':
      return 'Completado';
    case 'IN_PROGRESS':
      return 'En Juego';
    case 'NOT_STARTED':
      return 'Programado';
    case 'PENDING':
      return 'Pendiente';
    case 'SCHEDULED':
      return 'Programado';
    case 'CANCELED':
      return 'Cancelado';
    default:
      return status || 'Desconocido';
  }
}

export function getFechaStatusText(status: string | null): string {
  switch (status) {
    case 'NOT_STARTED':
      return 'No Iniciada';
    case 'SCHEDULING':
      return 'Programando';
    case 'IN_PROGRESS':
      return 'En Progreso';
    case 'COMPLETED':
      return 'Completada';
    case 'CANCELED':
      return 'Cancelada';
    default:
      return status || 'Desconocido';
  }
}