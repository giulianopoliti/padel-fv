/**
 * Utilidades para validar y testear el estado correcto de los matches
 */

import { MATCH_STATUS, type MatchStatus } from "@/types/match-status";

export interface MatchValidationInfo {
  id: string;
  couple1_id: string | null;
  couple2_id: string | null;
  status: MatchStatus;
  winner_id: string | null;
  round: string;
  order: number;
  is_from_initial_generation?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  expectedStatus: MatchStatus;
  issues: string[];
  recommendations: string[];
}

/**
 * Valida si un match tiene el estado correcto según su configuración
 */
export function validateMatchStatus(match: MatchValidationInfo): ValidationResult {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  const { couple1_id, couple2_id, status, winner_id, is_from_initial_generation } = match;
  const hasOneCouple = (couple1_id && !couple2_id) || (!couple1_id && couple2_id);
  const hasBothCouples = couple1_id && couple2_id;
  const hasNoCouples = !couple1_id && !couple2_id;

  let expectedStatus: MatchStatus;

  // Determinar el estado esperado
  if (hasNoCouples) {
    expectedStatus = MATCH_STATUS.WAITING_OPONENT;
  } else if (hasOneCouple) {
    if (is_from_initial_generation) {
      expectedStatus = MATCH_STATUS.BYE;
      if (status === MATCH_STATUS.BYE && !winner_id) {
        issues.push("Match BYE debe tener un winner_id definido");
        recommendations.push("Asignar el winner_id a la pareja presente");
      }
    } else {
      expectedStatus = MATCH_STATUS.WAITING_OPONENT;
      if (winner_id) {
        issues.push("Match WAITING_OPONENT no debe tener winner_id");
        recommendations.push("Remover winner_id hasta que ambas parejas estén definidas");
      }
    }
  } else if (hasBothCouples) {
    expectedStatus = MATCH_STATUS.PENDING;
    if (status === MATCH_STATUS.WAITING_OPONENT) {
      issues.push("Match con ambas parejas no puede estar WAITING_OPONENT");
      recommendations.push("Cambiar estado a PENDING");
    }
  } else {
    expectedStatus = MATCH_STATUS.WAITING_OPONENT;
  }

  // Validar estado actual vs esperado
  if (status !== expectedStatus) {
    issues.push(`Estado actual '${status}' no coincide con esperado '${expectedStatus}'`);
  }

  // Validaciones adicionales específicas por estado
  switch (status) {
    case MATCH_STATUS.BYE:
      if (!is_from_initial_generation) {
        issues.push("Estado BYE solo es válido para matches de generación inicial");
        recommendations.push("Cambiar a WAITING_OPONENT o marcar como generación inicial");
      }
      if (!winner_id) {
        issues.push("Match BYE debe tener winner_id definido");
      }
      break;
      
    case MATCH_STATUS.WAITING_OPONENT:
      if (winner_id) {
        issues.push("Match WAITING_OPONENT no debe tener winner_id");
        recommendations.push("Remover winner_id o cambiar estado");
      }
      break;
      
    case MATCH_STATUS.PENDING:
      if (!hasBothCouples) {
        issues.push("Match PENDING debe tener ambas parejas definidas");
        recommendations.push("Completar parejas o cambiar estado");
      }
      break;
      
    case MATCH_STATUS.FINISHED:
      if (!winner_id) {
        issues.push("Match FINISHED debe tener winner_id definido");
      }
      if (!hasBothCouples && !is_from_initial_generation) {
        issues.push("Match FINISHED sin ambas parejas solo es válido para BYE inicial");
      }
      break;
  }

  return {
    isValid: issues.length === 0,
    expectedStatus,
    issues,
    recommendations
  };
}

/**
 * Valida todo un bracket de matches
 */
export function validateBracket(matches: MatchValidationInfo[]): {
  isValid: boolean;
  totalIssues: number;
  matchResults: Map<string, ValidationResult>;
  summary: {
    byeCount: number;
    waitingCount: number;
    pendingCount: number;
    finishedCount: number;
    invalidCount: number;
  };
} {
  const matchResults = new Map<string, ValidationResult>();
  let totalIssues = 0;
  
  const summary = {
    byeCount: 0,
    waitingCount: 0,
    pendingCount: 0,
    finishedCount: 0,
    invalidCount: 0
  };

  matches.forEach(match => {
    const result = validateMatchStatus(match);
    matchResults.set(match.id, result);
    
    if (!result.isValid) {
      totalIssues += result.issues.length;
      summary.invalidCount++;
    }
    
    // Contar por estado actual
    switch (match.status) {
      case MATCH_STATUS.BYE:
        summary.byeCount++;
        break;
      case MATCH_STATUS.WAITING_OPONENT:
        summary.waitingCount++;
        break;
      case MATCH_STATUS.PENDING:
        summary.pendingCount++;
        break;
      case MATCH_STATUS.FINISHED:
        summary.finishedCount++;
        break;
    }
  });

  return {
    isValid: totalIssues === 0,
    totalIssues,
    matchResults,
    summary
  };
}

/**
 * Genera un reporte detallado de validación
 */
export function generateValidationReport(
  matches: MatchValidationInfo[]
): string {
  const bracketValidation = validateBracket(matches);
  const { summary, matchResults, totalIssues } = bracketValidation;
  
  let report = `🔍 REPORTE DE VALIDACIÓN DE BRACKET\n`;
  report += `=======================================\n\n`;
  
  report += `📊 RESUMEN:\n`;
  report += `- Total de matches: ${matches.length}\n`;
  report += `- BYE: ${summary.byeCount}\n`;
  report += `- Esperando oponente: ${summary.waitingCount}\n`;
  report += `- Pendientes: ${summary.pendingCount}\n`;
  report += `- Finalizados: ${summary.finishedCount}\n`;
  report += `- Con errores: ${summary.invalidCount}\n`;
  report += `- Total de problemas: ${totalIssues}\n\n`;
  
  if (totalIssues > 0) {
    report += `⚠️ PROBLEMAS ENCONTRADOS:\n`;
    report += `==========================\n`;
    
    matchResults.forEach((result, matchId) => {
      if (!result.isValid) {
        const match = matches.find(m => m.id === matchId);
        report += `\n🔸 Match ${matchId} (${match?.round} - ${match?.order}):\n`;
        report += `   Estado actual: ${match?.status}\n`;
        report += `   Estado esperado: ${result.expectedStatus}\n`;
        report += `   Problemas:\n`;
        result.issues.forEach(issue => {
          report += `     - ${issue}\n`;
        });
        report += `   Recomendaciones:\n`;
        result.recommendations.forEach(rec => {
          report += `     - ${rec}\n`;
        });
      }
    });
  } else {
    report += `✅ BRACKET VÁLIDO: No se encontraron problemas\n`;
  }
  
  return report;
}

/**
 * Función para testing rápido
 */
export function testMatchScenarios(): void {
  console.log("🧪 Testing match validation scenarios...");
  
  // Caso 1: BYE válido
  const byeMatch: MatchValidationInfo = {
    id: "test-bye",
    couple1_id: "couple1",
    couple2_id: null,
    status: MATCH_STATUS.BYE,
    winner_id: "couple1",
    round: "16VOS",
    order: 1,
    is_from_initial_generation: true
  };
  
  // Caso 2: Esperando oponente válido
  const waitingMatch: MatchValidationInfo = {
    id: "test-waiting",
    couple1_id: "couple1",
    couple2_id: null,
    status: MATCH_STATUS.WAITING_OPONENT,
    winner_id: null,
    round: "8VOS",
    order: 1,
    is_from_initial_generation: false
  };
  
  // Caso 3: Pendiente válido
  const pendingMatch: MatchValidationInfo = {
    id: "test-pending",
    couple1_id: "couple1",
    couple2_id: "couple2",
    status: MATCH_STATUS.PENDING,
    winner_id: null,
    round: "4TOS",
    order: 1,
    is_from_initial_generation: false
  };
  
  // Caso 4: Error - BYE sin generación inicial
  const invalidByeMatch: MatchValidationInfo = {
    id: "test-invalid-bye",
    couple1_id: "couple1",
    couple2_id: null,
    status: MATCH_STATUS.BYE,
    winner_id: "couple1",
    round: "8VOS",
    order: 1,
    is_from_initial_generation: false
  };
  
  const testMatches = [byeMatch, waitingMatch, pendingMatch, invalidByeMatch];
  
  console.log(generateValidationReport(testMatches));
} 