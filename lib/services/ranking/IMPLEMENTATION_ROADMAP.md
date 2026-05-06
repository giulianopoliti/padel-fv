# 🎯 SISTEMA CONFIGURABLE DE RANKING - PLAN DE IMPLEMENTACIÓN COMPLETO

## 📋 **RESUMEN EJECUTIVO**

Este documento describe la implementación completa de un sistema configurable de ranking para torneos de padel, manteniendo **100% backward compatibility** con el sistema American existente.

### **🎪 Estado Actual (Completado)**
- ✅ **FASE 1**: Estructura de Base de Datos
- ✅ **FASE 2**: Data Providers

### **🚀 Próximos Pasos**
- 🔄 **FASE 3**: Configurable Ranking Engine
- 🔄 **FASE 4**: Integration & Server Actions  
- 🔄 **FASE 5**: UI & Configuration Dashboard

---

## 🏗️ **ARQUITECTURA GENERAL**

```
                    ┌─────────────────────────────────────┐
                    │        TOURNAMENT.TYPE              │
                    │     (Database Decision Field)       │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────┴───────────────────┐
                    │                                     │
         ┌──────────▼──────────┐              ┌──────────▼──────────┐
         │   LEGACY SYSTEM     │              │ CONFIGURABLE SYSTEM │
         │                     │              │                     │
         │  • AMERICAN         │              │  • LONG             │
         │  • ZoneRankingEngine│              │  • AMERICAN_OTP     │
         │  • Hardcoded criteria│              │  • Database config  │
         │  • Optimal performance│              │  • Flexible criteria│
         └─────────────────────┘              └─────────────────────┘
```

---

## 📊 **MAPEO DE TIPOS DE TORNEO**

| Tournament Type | Sistema | Data Source | Result Fields | Sets/Match | Configurable |
|----------------|---------|-------------|---------------|------------|--------------|
| **AMERICAN** | Legacy | ZoneStatsCalculator | games_won | 1 | ❌ No |
| **LONG** | Configurable | set_matches table | sets_won | 2-3 | ✅ Sí |
| **AMERICAN_OTP** | Configurable | result_couple1/2 | games_won | 1 | ✅ Sí |

---

## ✅ **FASE 1 COMPLETADA: BASE DE DATOS**

### **Migraciones Aplicadas**
- `20250909080000_create_tournament_ranking_config.sql` - Tabla de configuración
- `20250909080001_add_american_otp_tournament_type.sql` - Nuevo enum value

### **Estructura de Configuración**
```json
{
  "tournament_id": "uuid",
  "criteria": [
    {"order": 1, "criterion": "wins", "enabled": true, "weight": 1},
    {"order": 2, "criterion": "sets_difference", "enabled": true, "weight": 1},
    {"order": 3, "criterion": "games_difference", "enabled": true, "weight": 1},
    {"order": 4, "criterion": "head_to_head", "enabled": true, "weight": 1},
    {"order": 5, "criterion": "sets_for", "enabled": true, "weight": 1},
    {"order": 6, "criterion": "games_for", "enabled": true, "weight": 1},
    {"order": 7, "criterion": "random", "enabled": true, "weight": 1}
  ],
  "is_active": true
}
```

---

## ✅ **FASE 2 COMPLETADA: DATA PROVIDERS**

### **Archivos Implementados**
```
lib/services/ranking/providers/
├── base-stats-data-provider.ts          # Clase base con lógica común
├── american-tournament-stats.provider.ts # Wrapper del sistema existente  
├── long-tournament-stats.provider.ts     # Nuevo: 3 sets desde set_matches
├── american-otp-stats.provider.ts        # Nuevo: zona única configurable
├── stats-data-provider-factory.ts        # Factory pattern
└── index.ts                              # Exports centralizados
```

### **Características de los Providers**
- **AmericanTournamentStatsProvider**: Delega a `ZoneStatsCalculator` existente
- **LongTournamentStatsProvider**: Calcula desde `set_matches` table
- **AmericanOTPStatsProvider**: Similar a American pero configurable
- **Factory**: Crea providers automáticamente según `tournament.type`

---

## 🔄 **FASE 3: CONFIGURABLE RANKING ENGINE (PRÓXIMO)**

### **3.1 Implementar ConfigurableRankingEngine**

```typescript
// lib/services/ranking/engines/configurable-ranking-engine.ts
export class ConfigurableRankingEngine {
  constructor(private configuration: RankingConfiguration) {}
  
  rankCouplesByConfiguration(
    coupleStats: ExtendedCoupleStats[]
  ): ExtendedCoupleStats[]
  
  applyCriterion(
    couples: ExtendedCoupleStats[], 
    criterion: RankingCriterion
  ): ExtendedCoupleStats[]
  
  resolveHeadToHeadTies(
    tiedCouples: ExtendedCoupleStats[],
    headToHeadMatrix: HeadToHeadResult[]
  ): ExtendedCoupleStats[]
}
```

**Lógica de Ranking Configurable:**
1. **Agrupar** parejas por criterio principal (ej: wins)
2. **Aplicar criterios** secundarios en orden configurado
3. **Resolver empates** con head-to-head cuando aplicable
4. **Tiebreaker final** aleatorio si persiste empate
5. **Asignar posiciones** finales y generar explicaciones

### **3.2 Implementar ConfigurableRankingService**

```typescript
// lib/services/ranking/services/configurable-ranking.service.ts
export class ConfigurableRankingService implements ConfigurableRankingService {
  async calculateZonePositions(
    context: ZoneRankingContext
  ): Promise<ConfigurableRankingResult>
  
  async updateZonePositionsInDatabase(
    context: ZoneRankingContext
  ): Promise<UpdateResult>
  
  previewRanking(
    context: ZoneRankingContext
  ): Promise<ConfigurableRankingResult>
}
```

**Flujo del Service:**
1. **Obtener datos** usando el DataProvider apropiado
2. **Aplicar configuración** usando ConfigurableRankingEngine
3. **Generar resultado** con métricas y explicaciones
4. **Fallback automático** a sistema legacy si hay error

### **3.3 Sistema de Fallback Robusto**

```typescript
try {
  // Intentar sistema configurable
  return await configurableRankingService.calculate(context)
} catch (error) {
  console.warn('Configurable system failed, using legacy fallback:', error)
  
  // Fallback automático
  const legacyService = new ZonePositionService()
  return await legacyService.calculateZonePositions(zoneId)
}
```

---

## 🔄 **FASE 4: INTEGRATION & SERVER ACTIONS**

### **4.1 Tournament Strategy Integration**

```typescript
// lib/domain/strategies/long-tournament.strategy.ts
export class LongTournamentStrategy extends TournamentStrategy {
  async calculateZonePositions(zoneId: string, tournamentId: string) {
    // Determinar sistema basado en tournament.type
    const systemType = getRankingSystemType('LONG')
    
    if (systemType === 'CONFIGURABLE') {
      // Usar nuevo sistema
      const service = new ConfigurableRankingService()
      const provider = new LongTournamentStatsProvider()
      const config = await getRankingConfig(tournamentId)
      
      return service.calculateZonePositions({
        tournamentId, zoneId, tournamentType: 'LONG',
        rankingConfiguration: config, dataProvider: provider
      })
    }
  }
}
```

### **4.2 Server Actions Híbridas**

```typescript
// app/api/tournaments/[id]/zone-positions/update/route.ts
export async function updateZonePositions(tournamentId: string, zoneId: string) {
  const tournament = await getTournament(tournamentId)
  const systemType = getRankingSystemType(tournament.type)
  
  if (systemType === 'LEGACY') {
    // ✅ AMERICAN: Sistema existente
    const legacyService = new ZonePositionService()
    return legacyService.updateZonePositionsInDatabase(tournamentId, zoneId)
    
  } else {
    // 🆕 LONG/AMERICAN_OTP: Sistema configurable
    const factory = new DefaultStatsDataProviderFactory()
    const provider = factory.createProvider(tournament.type)
    const config = await getRankingConfig(tournamentId)
    
    const service = new ConfigurableRankingService()
    return service.updateZonePositionsInDatabase({
      tournamentId, zoneId, tournamentType: tournament.type,
      rankingConfiguration: config, dataProvider: provider
    })
  }
}
```

### **4.3 Triggers Automáticos**

```typescript
// Cuando se actualiza un resultado de match
export async function onMatchResultUpdate(matchId: string, result: MatchResult) {
  const match = await getMatch(matchId)
  const tournament = await getTournament(match.tournament_id)
  
  // Actualizar matches table según tipo de torneo
  if (tournament.type === 'LONG') {
    // result_couple1/2 = sets ganados
    await updateMatch(matchId, {
      result_couple1: result.totalSets.couple1,
      result_couple2: result.totalSets.couple2
    })
    
    // Actualizar set_matches con games detallados
    for (const set of result.sets) {
      await updateSetMatch(matchId, set.setNumber, {
        couple1_games: set.couple1Score,
        couple2_games: set.couple2Score
      })
    }
  } else {
    // AMERICAN/AMERICAN_OTP: result_couple1/2 = games
    await updateMatch(matchId, {
      result_couple1: result.totalGames.couple1,
      result_couple2: result.totalGames.couple2
    })
  }
  
  // Recalcular posiciones automáticamente
  await updateZonePositions(match.tournament_id, match.zone_id)
}
```

---

## 🔄 **FASE 5: UI & CONFIGURATION DASHBOARD**

### **5.1 Página de Configuración del Torneo**

```
app/(main)/tournaments/[id]/settings/
├── page.tsx                        # Dashboard principal
├── components/
│   ├── RankingCriteriaEditor.tsx   # Drag & drop de criterios
│   ├── RankingPreview.tsx          # Preview en tiempo real
│   ├── SystemSelector.tsx          # Selector legacy vs configurable
│   └── ConfigurationHistory.tsx    # Historial de cambios
```

**Características del Dashboard:**
- **Drag & Drop** para reordenar criterios
- **Toggle switches** para enable/disable criterios
- **Weight sliders** para ponderaciones futuras
- **Preview en tiempo real** de cómo afectaría las posiciones actuales
- **Backup automático** antes de aplicar cambios
- **Rollback** a configuraciones anteriores

### **5.2 Enhanced Tournament Views**

**Long Tournament View Extensions:**
```typescript
// app/(main)/tournaments/[id]/components/LongTournamentView.tsx
// Agregar nueva card:
{
  title: "Configuración de Ranking",
  description: "Personalizar criterios de ordenamiento",
  href: `/tournaments/${tournamentId}/settings`,
  icon: Settings,
  available: true
}
```

**Zone Positions Enhancement:**
```typescript
// Mostrar criterios aplicados en tabla de posiciones
<PositionsTable 
  couples={rankedCouples}
  appliedCriteria={rankingResult.appliedConfiguration.criteria}
  tiebreakExplanations={rankingResult.tiebreakResults}
/>
```

### **5.3 Real-time Position Updates**

```typescript
// Actualización en tiempo real cuando cambian configuraciones
const useRankingPreview = (tournamentId: string, newConfig: RankingConfiguration) => {
  return useSWR(
    ['ranking-preview', tournamentId, newConfig],
    () => previewRankingChanges(tournamentId, newConfig),
    { revalidateOnFocus: false }
  )
}
```

---

## 📋 **CRONOGRAMA DETALLADO**

### **Semana Actual: FASE 3 (Ranking Engine)**
- [ ] **Día 1-2**: `ConfigurableRankingEngine` 
- [ ] **Día 3**: `ConfigurableRankingService`
- [ ] **Día 4**: Sistema de fallback robusto
- [ ] **Día 5**: Testing unitario de engines

### **Semana 2: FASE 4 (Integration)**  
- [ ] **Día 1**: Tournament Strategy updates
- [ ] **Día 2**: Server Actions híbridas
- [ ] **Día 3**: Triggers automáticos
- [ ] **Día 4**: Testing de integración
- [ ] **Día 5**: Performance testing

### **Semana 3: FASE 5 (UI Dashboard)**
- [ ] **Día 1-2**: Página de configuración base
- [ ] **Día 3**: RankingCriteriaEditor (drag & drop)
- [ ] **Día 4**: Preview en tiempo real
- [ ] **Día 5**: Polish y UX testing

### **Semana 4: POLISH & DEPLOYMENT**
- [ ] **Día 1**: Bug fixes y edge cases
- [ ] **Día 2**: Performance optimization  
- [ ] **Día 3**: Documentation final
- [ ] **Día 4**: User acceptance testing
- [ ] **Día 5**: Production deployment

---

## 🧪 **ESTRATEGIA DE TESTING**

### **Testing de Compatibilidad**
```bash
# Verificar que American tournaments siguen funcionando idéntico
npm test -- --testPathPattern=american
npm test -- --testPathPattern=zone-position
```

### **Testing de Nuevos Features**
```bash
# Testing de providers
npm test -- --testPathPattern=providers

# Testing de ranking engine
npm test -- --testPathPattern=ranking-engine

# Testing de integration
npm test -- --testPathPattern=integration
```

### **Performance Testing**
```typescript
// Benchmark: American tournament performance no debe degradarse
const benchmarkAmericanRanking = async () => {
  const startTime = performance.now()
  await calculateZonePositions('american-tournament-zone-id')
  const duration = performance.now() - startTime
  
  expect(duration).toBeLessThan(BASELINE_AMERICAN_PERFORMANCE)
}
```

---

## 🚨 **RIESGOS Y MITIGACIONES**

### **🔴 RIESGO ALTO: Breaking Changes en American**
**Mitigación**: 
- AmericanTournamentStatsProvider es wrapper completo
- Zero cambios en ZoneStatsCalculator existente
- Testing exhaustivo de regresión

### **🟡 RIESGO MEDIO: Performance Degradation**  
**Mitigación**:
- Lazy loading de providers
- Caching de configuraciones
- Fallback automático a sistema optimizado

### **🟢 RIESGO BAJO: UI/UX Complexity**
**Mitigación**:
- Implementación progresiva
- Dashboard opcional (no bloquea funcionalidad)
- Configuraciones sensatas por defecto

---

## 📈 **MÉTRICAS DE ÉXITO**

### **Compatibilidad**
- ✅ **100% tests** de American tournaments pasan
- ✅ **Zero performance degradation** en American
- ✅ **Zero user-facing changes** para torneos existentes

### **Funcionalidad Nueva**
- ✅ **LONG tournaments** calculan posiciones desde set_matches
- ✅ **AMERICAN_OTP tournaments** soportan configuración
- ✅ **Dashboard** permite modificar criterios en tiempo real

### **Usabilidad**
- ✅ **Preview inmediato** de cambios de configuración
- ✅ **Explicaciones claras** de desempates
- ✅ **Rollback fácil** a configuraciones anteriores

---

## 🎯 **PRÓXIMO PASO INMEDIATO**

**IMPLEMENTAR ConfigurableRankingEngine** (`lib/services/ranking/engines/configurable-ranking-engine.ts`):

1. **Sorting por múltiples criterios** configurables
2. **Head-to-head resolution** entre parejas empatadas  
3. **Tiebreaker explanation** generation
4. **Validation** de ranking consistency

**¿Comenzamos con la implementación del ranking engine?**