# 🎾 Sistema Configurable de Ranking para Torneos de Padel

## ⚠️ COMPATIBILIDAD CRÍTICA

**Este sistema de ranking es 100% ADITIVO y NO afecta la funcionalidad existente de torneos American.**

- ✅ **Torneos American continúan usando `ZonePositionService` y `ZoneRankingEngine` existentes**
- ✅ **Zero breaking changes al código existente**
- ✅ **Los tests existentes continúan pasando**
- ✅ **Performance de torneos American no se ve afectado**

## 📋 Resumen del Sistema

Este módulo proporciona un sistema de ranking configurable para nuevos formatos de torneo, manteniendo la implementación existente de torneos American intacta.

### 🎯 **Estado Actual**
- ✅ **COMPLETADO**: Estructura de Base de Datos 
- ✅ **COMPLETADO**: Data Providers (AmericanTournamentStatsProvider, LongTournamentStatsProvider, AmericanOTPStatsProvider)
- ✅ **COMPLETADO**: Configurable Ranking Engine
- ✅ **COMPLETADO**: Integration & Server Actions
- 🔄 **PRÓXIMO**: Testing & Validation
- 🔄 **PENDIENTE**: UI Dashboard

### 📚 **Documentación Completa**
- 📖 **[IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)** - Plan de implementación completo con cronograma
- 🏗️ **[ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)** - Documentación técnica de arquitectura
- 📋 **[README.md](./README.md)** - Este archivo (overview general)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                Tournament Format Decision               │
├─────────────────────────────────────────────────────────┤
│  Is format "AMERICAN" | "AMERICAN_2" | "AMERICAN_3"?   │
│                                                         │
│  YES ──────────► Use existing ZonePositionService      │
│                  (Hardcoded, optimized, battle-tested) │
│                                                         │
│  NO ───────────► Use ConfigurableRankingService        │
│                  (Flexible, database-driven config)    │
└─────────────────────────────────────────────────────────┘
```

## Format Support

### Legacy Formats (Existing System)
- ✅ `AMERICAN` - Uses hardcoded `ZoneRankingEngine`
- ✅ `AMERICAN_2` - Uses hardcoded `ZoneRankingEngine` 
- ✅ `AMERICAN_3` - Uses hardcoded `ZoneRankingEngine`

### Configurable Formats (New System)
- 🆕 `LONG` - Configurable ranking with set_matches support
- 🚀 `PRO` - Future professional format
- 🛠️ `CUSTOM` - Fully customizable formats

## Key Interfaces

### StatsDataProvider
Pluggable data providers for different tournament structures:
- **American Provider**: Uses `result_couple1/2` from matches (existing logic)
- **Long Provider**: Uses `set_matches` table for detailed tracking
- **Future Providers**: Can support any data structure

### ConfigurableRankingService  
Main service for tournaments that support configurable ranking criteria:
- Database-driven ranking configuration
- Runtime criteria modification
- Preview capabilities
- Fallback to legacy system on errors

### RankingConfiguration
Defines how tournaments should be ranked:
- Ordered criteria (wins, sets_difference, games_difference, etc.)
- Enable/disable criteria
- Sort directions
- Custom comparators

## Usage Examples

### For American Tournaments (No Changes)
```typescript
// This continues to work exactly as before
const zonePositionService = new ZonePositionService()
const result = await zonePositionService.calculateZonePositions(zoneId)
```

### For Long Tournaments (New)
```typescript
// This is new functionality - based on tournament.type field
import { getRankingSystemType } from '@/lib/services/ranking/utils'

const tournamentType = tournament.type // From database field
const systemType = getRankingSystemType(tournamentType)

if (systemType === 'CONFIGURABLE') {
  const factory = new ConfigurableRankingServiceFactory()
  const service = factory.createService(tournamentType)

  if (service) {
    const context: ZoneRankingContext = {
      tournamentId: tournament.id,
      zoneId: 'zone-id', 
      tournamentType: tournamentType, // 'LONG', 'PRO', etc.
      rankingConfiguration: await getRankingConfig(tournament.id),
      dataProvider: new LongTournamentStatsProvider()
    }
    
    const result = await service.calculateZonePositions(context)
  }
} else {
  // Falls back to existing system automatically
  const legacyService = new ZonePositionService()
  const result = await legacyService.calculateZonePositions(zoneId)
}
```

### System Decision Logic
```typescript
import { getRankingSystemType, shouldUseLegacySystem } from '@/lib/services/ranking/utils'

// Based on tournament.type from database
const tournamentType = tournament.type

// Decision logic
if (shouldUseLegacySystem(tournamentType)) {
  // Use existing ZonePositionService (American tournaments)
  console.log('Using legacy hardcoded system')
} else {
  // Use new ConfigurableRankingService (Long, Pro, etc.)
  console.log('Using configurable system')
}
```

### Fallback Safety
```typescript
// If configurable system fails, automatically falls back to legacy
try {
  const result = await configurableService.calculateZonePositions(context)
} catch (error) {
  console.warn('Configurable ranking failed, falling back to legacy system')
  const legacyService = new ZonePositionService()
  const result = await legacyService.calculateZonePositions(zoneId)
}
```

## File Structure

```
lib/services/ranking/
├── interfaces/
│   ├── stats-data-provider.interface.ts     # Data provider contracts
│   ├── configurable-ranking.interface.ts    # Ranking service contracts
│   └── index.ts                            # Re-exports
├── types/
│   └── ranking-configuration.types.ts      # Configuration types
├── providers/                              # Data providers (Step 2)
│   ├── american-stats.provider.ts          # (Future)
│   ├── long-stats.provider.ts              # (Future)
│   └── index.ts                            # (Future)
├── services/                               # Service implementations (Step 3)
│   ├── configurable-ranking.service.ts     # (Future)
│   └── index.ts                            # (Future)
└── README.md                               # This file
```

## Migration Strategy

### Phase 1: Interfaces (CURRENT)
- ✅ Define contracts for configurable ranking
- ✅ Zero impact on existing system
- ✅ Foundation for future implementations

### Phase 2: Providers (NEXT)
- 🔄 Implement `LongTournamentStatsProvider`
- 🔄 Create provider factory
- ✅ American tournaments still use existing system

### Phase 3: Service Implementation
- 🔄 Implement `ConfigurableRankingService`
- 🔄 Add fallback mechanisms
- ✅ American tournaments still unaffected

### Phase 4: Integration
- 🔄 Update tournament strategies to choose ranking system
- 🔄 Add UI for ranking configuration
- ✅ American tournaments remain on legacy system by default

## Testing Strategy

1. **Legacy System Protection**: All existing tests continue to pass
2. **New System Testing**: Separate test suites for configurable ranking
3. **Integration Testing**: Verify format-based system selection
4. **Fallback Testing**: Ensure graceful degradation

## Performance Considerations

- **American tournaments**: Zero performance impact (same code path)
- **Configurable tournaments**: Slight overhead for flexibility
- **Caching**: Database ranking configurations cached in memory
- **Lazy loading**: Providers loaded only when needed

## Next Steps

1. ✅ **Step 1 Complete**: Interfaces defined
2. 🔄 **Step 2**: Implement `LongTournamentStatsProvider`
3. 🔄 **Step 3**: Implement `ConfigurableRankingService`
4. 🔄 **Step 4**: Integrate with tournament strategies