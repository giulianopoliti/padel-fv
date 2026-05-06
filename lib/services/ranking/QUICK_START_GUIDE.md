# 🚀 GUÍA DE INICIO RÁPIDO - Sistema Configurable de Ranking

## 📋 **¿Qué es este sistema?**

Un sistema de ranking **configurable** para torneos de padel que permite personalizar los criterios de ordenamiento **sin afectar** los torneos American existentes.

### **🎯 Funciona así:**
- **Torneos AMERICAN**: Siguen funcionando **idéntico** (sistema legacy optimizado)
- **Torneos LONG**: Nuevo sistema configurable con ranking desde base de datos
- **Torneos AMERICAN_OTP**: Zona única con criterios configurables

---

## ⚡ **SETUP RÁPIDO**

### **1. Aplicar Migraciones**
```bash
# Agregar AMERICAN_OTP al enum y crear tabla de configuración
npx supabase migration up
```

### **2. Usar en tu código**
```typescript
import { getRankingSystemType, createStatsDataProvider } from '@/lib/services/ranking/utils'

// Determinar sistema automáticamente
const systemType = getRankingSystemType(tournament.type)

if (systemType === 'LEGACY') {
  // ✅ AMERICAN: Sistema existente (sin cambios)
  const legacyService = new ZonePositionService()
  const result = await legacyService.calculateZonePositions(zoneId)
  
} else {
  // 🆕 LONG/AMERICAN_OTP: Sistema configurable
  const provider = createStatsDataProvider(tournament.type)
  const stats = await provider.calculateCoupleStats(couple, matches)
}
```

---

## 🎯 **CASOS DE USO COMUNES**

### **Caso 1: Torneo American (No cambios)**
```typescript
// Esto sigue funcionando EXACTAMENTE igual
const zonePositionService = new ZonePositionService()
const result = await zonePositionService.calculateZonePositions(zoneId)
// ✅ Zero cambios, performance idéntico
```

### **Caso 2: Torneo Largo (Nuevo)**
```typescript
// Torneo de 3 sets con criterios configurables
const provider = new LongTournamentStatsProvider()
const couples = await provider.calculateAllCoupleStats(couples, matches)

// Data interpretation automática:
// - result_couple1/2 = sets ganados (ej: "2", "1") 
// - Games vienen de set_matches table
// - Ranking configurable desde DB
```

### **Caso 3: American OTP - Zona Única (Nuevo)**
```typescript
// American de zona única con criterios personalizables
const provider = new AmericanOTPStatsProvider()
const stats = await provider.calculateCoupleStats(couple, matches)

// Data interpretation:
// - result_couple1/2 = games ganados (igual que American)
// - 1 set por match
// - Ranking configurable desde DB
```

---

## 🔧 **CONFIGURACIÓN DE RANKING**

### **Criterios Disponibles**
```typescript
const availableCriteria = [
  'wins',              // Partidos ganados  
  'sets_difference',   // Diferencia de sets (Long tournaments)
  'games_difference',  // Diferencia de games
  'head_to_head',      // Enfrentamiento directo
  'sets_for',          // Sets ganados
  'games_for',         // Games ganados  
  'player_scores',     // Puntaje individual jugadores
  'random'             // Desempate aleatorio
]
```

### **Configuración por Defecto - LONG**
```json
{
  "criteria": [
    {"order": 1, "criterion": "wins", "enabled": true},
    {"order": 2, "criterion": "sets_difference", "enabled": true},
    {"order": 3, "criterion": "games_difference", "enabled": true}, 
    {"order": 4, "criterion": "head_to_head", "enabled": true},
    {"order": 5, "criterion": "sets_for", "enabled": true},
    {"order": 6, "criterion": "games_for", "enabled": true},
    {"order": 7, "criterion": "random", "enabled": true}
  ]
}
```

### **Configuración por Defecto - AMERICAN_OTP**
```json
{
  "criteria": [
    {"order": 1, "criterion": "wins", "enabled": true},
    {"order": 2, "criterion": "head_to_head", "enabled": true},
    {"order": 3, "criterion": "games_difference", "enabled": true},
    {"order": 4, "criterion": "games_for", "enabled": true}, 
    {"order": 5, "criterion": "player_scores", "enabled": true},
    {"order": 6, "criterion": "random", "enabled": true}
  ]
}
```

---

## 🛠️ **FACTORY PATTERN**

### **Crear Provider Automáticamente**
```typescript
import { statsDataProviderFactory } from '@/lib/services/ranking/providers'

// Factory crea el provider correcto automáticamente
const provider = statsDataProviderFactory.createProvider(tournament.type)

if (provider) {
  const stats = await provider.calculateAllCoupleStats(couples, matches)
  console.log(`Using ${provider.getTournamentType()} provider`)
}
```

### **Información del Provider**
```typescript
// Obtener info detallada sobre el provider
const info = statsDataProviderFactory.getProviderInfo('LONG')
console.log(info)

// Output:
// {
//   supported: true,
//   usesConfigurableRanking: true,
//   providerClass: 'LongTournamentStatsProvider',
//   dataInterpretation: {
//     resultRepresents: 'sets_won',
//     setsPerMatch: 'variable', 
//     gamesSource: 'set_matches_table'
//   }
// }
```

---

## 🔍 **DEBUGGING Y VALIDACIÓN**

### **Validar Stats Calculadas**
```typescript
const stats = await provider.calculateCoupleStats(couple, matches)

// Las validaciones se ejecutan automáticamente
if (stats.customStats?.validationErrors?.length > 0) {
  console.warn('Validation errors found:', stats.customStats.validationErrors)
}
```

### **Comparar Sistemas**
```typescript
// Para testing: comparar American con AmericanOTP
const americanProvider = new AmericanTournamentStatsProvider()  // Wrapper legacy
const americanOTPProvider = new AmericanOTPStatsProvider()     // Nuevo configurable

const legacyStats = await americanProvider.calculateCoupleStats(couple, matches)
const configurableStats = await americanOTPProvider.calculateCoupleStats(couple, matches)

// Los resultados básicos deben ser idénticos
assert.equal(legacyStats.matchesWon, configurableStats.matchesWon)
assert.equal(legacyStats.gamesWon, configurableStats.gamesWon)
```

---

## 🚨 **TROUBLESHOOTING COMÚN**

### **Error: "No provider found for tournament type"**
```typescript
// Verificar que el tipo está soportado
const isSupported = statsDataProviderFactory.isSupported('LONG')
if (!isSupported) {
  console.error('Tournament type LONG not supported')
}

// Ver tipos soportados
const supportedTypes = statsDataProviderFactory.getSupportedTypes()
console.log('Supported types:', supportedTypes) // ['AMERICAN', 'LONG', 'AMERICAN_OTP']
```

### **Error: "set_matches data not found"**  
```typescript
// Para torneos LONG, verificar que existen set_matches
const setMatches = await getSetMatches(matchId)
if (setMatches.length === 0) {
  console.warn(`No set_matches found for match ${matchId}`)
  // El provider manejará esto gracefully
}
```

### **Performance Issues**
```typescript
// Usar batch calculation en lugar de individual
const allStats = await provider.calculateAllCoupleStats(couples, matches) // ✅ Optimizado
// En lugar de:
// const stats = await Promise.all(couples.map(c => provider.calculateCoupleStats(c, matches))) // ❌ Lento
```

---

## 📊 **MONITORING Y MÉTRICAS**

### **Performance Tracking**
```typescript
const startTime = Date.now()
const stats = await provider.calculateCoupleStats(couple, matches)
const duration = Date.now() - startTime

console.log(`Calculation took ${duration}ms for ${matches.length} matches`)

// American tournaments should maintain baseline performance
if (tournament.type === 'AMERICAN' && duration > BASELINE_PERFORMANCE) {
  console.warn('Performance degradation detected in American tournament')
}
```

### **Data Quality Metrics**
```typescript
// Verificar consistency de datos
const totalMatches = stats.matchesWon + stats.matchesLost
const totalSets = stats.setsWon + stats.setsLost

if (tournament.type === 'AMERICAN') {
  // En American: sets = matches (1 set por match)
  assert.equal(totalSets, totalMatches)
}

if (tournament.type === 'LONG') {
  // En Long: sets puede ser > matches (múltiples sets por match)
  assert.isTrue(totalSets >= totalMatches)
}
```

---

## 🎯 **PRÓXIMOS PASOS**

1. **Aplicar migraciones** de base de datos
2. **Testing** con datos de tu torneo
3. **Implementar ConfigurableRankingEngine** (próximo en roadmap)
4. **Dashboard UI** para configurar criterios
5. **Production deployment**

### **¿Necesitas ayuda?**
- 📖 Ver **[IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)** para plan completo
- 🏗️ Ver **[ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)** para detalles técnicos
- 🔧 Revisar código en `lib/services/ranking/providers/` para ejemplos