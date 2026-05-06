/**
 * Tournament Format Configurations
 * 
 * Centralized configuration for different tournament formats.
 * Each format defines specific rules for zone capacity and advancement.
 */

import type { 
  TournamentRules, 
  TournamentFormatConfig 
} from '@/types/tournament-rules.types';

// =============================================================================
// AMERICAN TOURNAMENT FORMAT
// =============================================================================

export const AMERICAN_2_TOURNAMENT_RULES: TournamentRules = {
  formatId: 'AMERICAN_2',
  formatName: 'Americano 2',
  
  zoneCapacity: {
    default: 4,
    max: 4,
    allowOverflow: true,
    overflowMessage: 'Zona especial con eliminación'
  },
  
  advancement: {
    3: {
      qualified: 3,
      eliminated: 0,
      strategy: 'ALL_ADVANCE',
      message: 'Todas las parejas clasifican al bracket'
    },
    4: {
      qualified: 4,
      eliminated: 0,
      strategy: 'ALL_ADVANCE',
      message: 'Todas las parejas clasifican al bracket'
    },
    5: {
      qualified: 4,
      eliminated: 1,
      strategy: 'TOP_N',
      message: 'Las 4 mejores parejas clasifican, 1 queda eliminada'
    }
  },
  
  warnings: {
    enableOverflowWarnings: true,
    showEliminationPreview: true,
    showMatchCountChanges: true
  }
};

export const AMERICAN_3_TOURNAMENT_RULES: TournamentRules = {
  formatId: 'AMERICAN_3',
  formatName: 'Americano 3',
  
  zoneCapacity: {
    default: 4,
    max: 4,
    allowOverflow: true,
    overflowMessage: 'Zona especial con eliminación'
  },
  
  advancement: {
    3: {
      qualified: 3,
      eliminated: 0,
      strategy: 'ALL_ADVANCE',
      message: 'Todas las parejas clasifican al bracket'
    },
    4: {
      qualified: 4,
      eliminated: 0,
      strategy: 'ALL_ADVANCE', 
      message: 'Todas las parejas clasifican al bracket'
    },
    5: {
      qualified: 4,
      eliminated: 1,
      strategy: 'TOP_N',
      message: 'Las 4 mejores parejas clasifican, 1 queda eliminada'
    }
  },
  
  warnings: {
    enableOverflowWarnings: true,
    showEliminationPreview: true,
    showMatchCountChanges: true
  }
};

export const LONG_TOURNAMENT_RULES: TournamentRules = {
  formatId: 'LONG',
  formatName: 'Largo',
  
  zoneCapacity: {
    default: 6,
    max: 8,
    allowOverflow: true,
    overflowMessage: 'Zona extendida'
  },
  
  advancement: {
    4: { qualified: 2, eliminated: 2, strategy: 'TOP_N' },
    5: { qualified: 2, eliminated: 3, strategy: 'TOP_N' },
    6: { qualified: 3, eliminated: 3, strategy: 'TOP_N' },
    7: { qualified: 3, eliminated: 4, strategy: 'TOP_N' },
    8: { qualified: 4, eliminated: 4, strategy: 'TOP_N' }
  },
  
  warnings: {
    enableOverflowWarnings: true,
    showEliminationPreview: true,
    showMatchCountChanges: false
  }
};

// =============================================================================
// COMPLETE FORMAT CONFIGURATIONS
// =============================================================================

export const AMERICAN_2_CONFIG: TournamentFormatConfig = {
  rules: AMERICAN_2_TOURNAMENT_RULES,
  
  matches: {
    matchesPerCouple: {
      3: 2,  // 3 parejas = 2 partidos cada una
      4: 2,  // 4 parejas = 2 partidos cada una  
      5: 3   // 5 parejas = 3 partidos cada una (caso especial)
    }
  },
  
  display: {
    colors: {
      normal: 'bg-green-50 border-green-200 text-green-800',
      overflow: 'bg-yellow-50 border-yellow-300 text-yellow-800',
      full: 'bg-red-50 border-red-300 text-red-800'
    },
    icons: {
      normal: 'CheckCircle',
      warning: 'AlertTriangle', 
      elimination: 'XCircle'
    }
  }
};

export const AMERICAN_3_CONFIG: TournamentFormatConfig = {
  rules: AMERICAN_3_TOURNAMENT_RULES,
  
  matches: {
    matchesPerCouple: {
      3: 3,  // 3 parejas = 3 partidos cada una
      4: 3,  // 4 parejas = 3 partidos cada una
      5: 4   // 5 parejas = 4 partidos cada una
    }
  },
  
  display: {
    colors: {
      normal: 'bg-blue-50 border-blue-200 text-blue-800',
      overflow: 'bg-purple-50 border-purple-300 text-purple-800', 
      full: 'bg-red-50 border-red-300 text-red-800'
    },
    icons: {
      normal: 'CheckCircle',
      warning: 'AlertTriangle',
      elimination: 'XCircle'
    }
  }
};

export const LONG_CONFIG: TournamentFormatConfig = {
  rules: LONG_TOURNAMENT_RULES,
  
  matches: {
    matchesPerCouple: {
      4: 3,  // Round robin: n-1 matches
      5: 4,
      6: 5,
      7: 6,
      8: 7
    }
  },
  
  display: {
    colors: {
      normal: 'bg-indigo-50 border-indigo-200 text-indigo-800',
      overflow: 'bg-orange-50 border-orange-300 text-orange-800',
      full: 'bg-red-50 border-red-300 text-red-800'
    },
    icons: {
      normal: 'Target',
      warning: 'AlertCircle',
      elimination: 'Slash'
    }
  }
};

// =============================================================================
// FORMAT REGISTRY
// =============================================================================

export const TOURNAMENT_FORMATS: Record<string, TournamentFormatConfig> = {
  'AMERICAN_2': AMERICAN_2_CONFIG,
  'AMERICAN_3': AMERICAN_3_CONFIG, 
  'LONG': LONG_CONFIG
};

/**
 * Default fallback configuration for unknown formats
 */
export const DEFAULT_TOURNAMENT_CONFIG: TournamentFormatConfig = AMERICAN_2_CONFIG;

// =============================================================================
// HELPER FUNCTIONS  
// =============================================================================

/**
 * Get tournament format configuration by ID
 */
export function getTournamentFormatConfig(formatId: string): TournamentFormatConfig {
  return TOURNAMENT_FORMATS[formatId] || DEFAULT_TOURNAMENT_CONFIG;
}

/**
 * Get available tournament formats
 */
export function getAvailableTournamentFormats(): Array<{ id: string; name: string; rules: TournamentRules }> {
  return Object.entries(TOURNAMENT_FORMATS).map(([id, config]) => ({
    id,
    name: config.rules.formatName,
    rules: config.rules
  }));
}

/**
 * Check if a format supports zone overflow
 */
export function formatSupportsOverflow(formatId: string): boolean {
  const config = getTournamentFormatConfig(formatId);
  return config.rules.zoneCapacity.allowOverflow;
}

/**
 * Get matches per couple for a zone size in a format
 */
export function getMatchesPerCouple(formatId: string, zoneSize: number): number {
  const config = getTournamentFormatConfig(formatId);
  return config.matches.matchesPerCouple[zoneSize] || 2; // default fallback
}