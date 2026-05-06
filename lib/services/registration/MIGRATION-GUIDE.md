# 📚 Guía de Migración - Sistema de Inscripciones Strategy Pattern

## 🔄 Cambios en las Funciones API

### Funciones Refactorizadas (100% Backward Compatible)

Todas estas funciones mantienen **exactamente la misma signatura** y comportamiento externo, pero internamente usan el Strategy Pattern:

#### 1. `registerCoupleForTournament()`
```typescript
// ✅ ANTES y DESPUÉS - Misma signatura
export async function registerCoupleForTournament(
  tournamentId: string, 
  player1Id: string, 
  player2Id: string
): Promise<{ success: boolean; error?: string; inscription?: any }>

// 🔄 CAMBIO INTERNO
// Antes: 260+ líneas de lógica con if statements
// Después: Delega a registerCoupleForTournamentV2() que usa Strategy Pattern
```

#### 2. `registerNewPlayerForTournament()`
```typescript
// ✅ ANTES y DESPUÉS - Misma signatura
export async function registerNewPlayerForTournament(
  tournamentId: string,
  firstName: string,
  lastName: string,
  phone: string,
  dni: string,
  playerGender: Gender
): Promise<{ success: boolean; message?: string; playerId?: string; inscription?: any }>

// 🔄 CAMBIO INTERNO
// Antes: Creación manual + lógica duplicada
// Después: Delega a registerNewPlayerForTournamentV2() que usa Strategy Pattern
```

#### 3. `registerAuthenticatedPlayerForTournament()`
```typescript
// ✅ ANTES y DESPUÉS - Misma signatura
export async function registerAuthenticatedPlayerForTournament(
  tournamentId: string, 
  phone?: string
): Promise<{ success: boolean; message: string; inscriptionId?: string }>

// 🔄 CAMBIO INTERNO
// Antes: Lógica manual para jugadores logueados
// Después: Delega a registerAuthenticatedPlayerForTournamentV2() con Strategy Pattern
```

#### 4. `removeCoupleFromTournament()`
```typescript
// ✅ ANTES y DESPUÉS - Misma signatura
export async function removeCoupleFromTournament(
  tournamentId: string, 
  coupleId: string
): Promise<{ success: boolean; message: string }>

// 🔄 CAMBIO INTERNO
// Antes: Eliminación manual con if statements para zone_couples
// Después: Delega a removeCoupleFromTournamentV2() con Strategy Pattern
```

#### 5. `registerCoupleForTournamentAndRemoveIndividual()`
```typescript
// ✅ ANTES y DESPUÉS - Misma signatura
export async function registerCoupleForTournamentAndRemoveIndividual(
  tournamentId: string, 
  player1Id: string, 
  player2Id: string
): Promise<{ 
  success: boolean; 
  error?: string; 
  inscription?: any; 
  convertedFrom?: 'player1' | 'player2' | null;
  message?: string;
}>

// 🔄 CAMBIO INTERNO
// Antes: Conversión compleja manual
// Después: Delega a registerCoupleForTournamentAndRemoveIndividualV2() con Strategy Pattern
```

## 🆕 Nuevas APIs Disponibles

### API Strategy Pattern Directa (Recomendada para Nuevo Código)

```typescript
import { 
  registerCouple,
  registerNewPlayersAsCouple,
  registerIndividualPlayer,
  registerAuthenticatedPlayer,
  convertIndividualToCouple,
  removeCouple 
} from '@/lib/services/registration'

// Registro de pareja existente
const result = await registerCouple({
  tournamentId: 'abc123',
  player1Id: 'player1',
  player2Id: 'player2'
})

// Crear jugadores nuevos como pareja
const result = await registerNewPlayersAsCouple({
  tournamentId: 'abc123',
  player1: { firstName: 'Juan', lastName: 'Pérez', phone: '+541123456789', dni: '12345678', gender: 'MALE' },
  player2: { firstName: 'Carlos', lastName: 'López', phone: '+541123456790', dni: '87654321', gender: 'MALE' }
})

// Registro individual
const result = await registerIndividualPlayer({
  tournamentId: 'abc123',
  playerId: 'player1'
})

// Auto-registro de jugador logueado
const result = await registerAuthenticatedPlayer({
  tournamentId: 'abc123',
  phone: '+541123456789'
})

// Conversión individual → pareja
const result = await convertIndividualToCouple({
  tournamentId: 'abc123',
  player1Id: 'player1',
  player2Id: 'player2'
})

// Eliminar pareja
const result = await removeCouple({
  tournamentId: 'abc123',
  coupleId: 'couple1'
})
```

### Ventajas de la API Directa

```typescript
// ✅ Response más detallado
interface CoupleRegistrationResult {
  success: boolean
  error?: string
  inscriptionId?: string
  coupleId?: string
  zoneAssigned?: boolean  // true para LONG, false para AMERICAN
  zoneId?: string         // Solo para LONG
}

// ✅ Información específica del tipo de torneo
if (result.zoneAssigned) {
  console.log(`Pareja asignada a zona: ${result.zoneId}`)
} else {
  console.log('Pareja registrada, zona se asignará manualmente')
}
```

## 🔧 Comportamiento por Tipo de Torneo

### AMERICAN Tournament
```typescript
// Comportamiento automático para torneos AMERICAN:
await registerCouple({ tournamentId, player1Id, player2Id })
// ➡️ Solo inserta en tabla 'inscriptions'
// ➡️ zoneAssigned: false
// ➡️ Organizador asigna zonas manualmente después

await removeCouple({ tournamentId, coupleId })
// ➡️ Solo elimina de tabla 'inscriptions'
// ➡️ removedFromZones: false
```

### LONG Tournament
```typescript
// Comportamiento automático para torneos LONG:
await registerCouple({ tournamentId, player1Id, player2Id })
// ➡️ Inserta en 'inscriptions' + 'zone_couples' (zona general)
// ➡️ zoneAssigned: true
// ➡️ zoneId: ID de la zona general

await removeCouple({ tournamentId, coupleId })
// ➡️ Elimina de 'inscriptions' + 'zone_couples'
// ➡️ removedFromZones: true
// ➡️ zonesCount: número de zonas de las que se eliminó
```

## 🧪 Testing y Validación

### Verificar Backward Compatibility

```typescript
// ✅ Estos tests deben seguir pasando sin cambios
describe('Backward Compatibility', () => {
  test('registerCoupleForTournament maintains same behavior', async () => {
    const result = await registerCoupleForTournament(tournamentId, player1Id, player2Id)
    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('inscription')
  })

  test('AMERICAN tournament only uses inscriptions', async () => {
    // Verificar que solo se cree registro en inscriptions
    // Verificar que NO se cree registro en zone_couples
  })

  test('LONG tournament uses inscriptions + zone_couples', async () => {
    // Verificar que se cree registro en inscriptions
    // Verificar que se cree registro en zone_couples
  })
})
```

### Probar Nueva API

```typescript
describe('Strategy Pattern API', () => {
  test('provides detailed tournament-specific information', async () => {
    const result = await registerCouple({ tournamentId, player1Id, player2Id })
    
    if (tournamentType === 'AMERICAN') {
      expect(result.zoneAssigned).toBe(false)
      expect(result.zoneId).toBeUndefined()
    } else if (tournamentType === 'LONG') {
      expect(result.zoneAssigned).toBe(true)
      expect(result.zoneId).toBeDefined()
    }
  })
})
```

## ⚠️ Consideraciones Importantes

### 1. Logs Actualizados
```typescript
// ✅ ANTES
console.log('[registerCoupleForTournament] Iniciando registro...')

// ✅ DESPUÉS  
console.log('[registerCoupleForTournament] 🔄 Refactorizado con Strategy Pattern...')
console.log('[registerCoupleForTournamentV2] 🎾 Usando Strategy Pattern...')
```

### 2. Error Handling Mejorado
```typescript
// ✅ Errores más específicos por tipo de torneo
// ✅ Fallback automático en caso de error del Strategy Pattern
// ✅ Logging estructurado para debugging
```

### 3. Performance
```typescript
// ✅ Cache de estrategias para evitar múltiples instancias
// ✅ Lazy loading del Strategy Pattern solo cuando se necesita
// ✅ Validaciones optimizadas por tipo
```

## 📋 Checklist de Migración

### Para Desarrolladores Existentes
- [ ] ✅ **No requiere cambios** - funciones existentes siguen funcionando
- [ ] 🧪 **Ejecutar tests** para verificar que todo funciona
- [ ] 📊 **Monitorear logs** para detectar cualquier anomalía
- [ ] 📚 **Leer documentación** del nuevo sistema Strategy Pattern

### Para Nuevos Desarrollos
- [ ] 🆕 **Usar API directa** del Strategy Pattern cuando sea posible
- [ ] 🎯 **Aprovechar información detallada** de `zoneAssigned`, `zoneId`, etc.
- [ ] 📝 **Implementar error handling** específico por tipo de torneo
- [ ] 🧪 **Escribir tests** que aprovechan las nuevas capacidades

## 🚀 Beneficios Inmediatos

### ✅ Sin Trabajo Adicional
- Todas las funcionalidades existentes siguen funcionando
- No hay breaking changes
- Comportamiento automático por tipo de torneo

### ✅ Con Trabajo Mínimo
- Acceso a información más detallada usando nueva API
- Error handling más específico
- Logs más informativos para debugging

### ✅ Con Refactoring Gradual
- Migración componente por componente a la nueva API
- Mejor testing con mocking de estrategias específicas
- Código más limpio y mantenible

---

## 💡 Recomendaciones

1. **Continúa usando las funciones existentes** - no hay prisa para cambiar
2. **Prueba la nueva API** en desarrollos nuevos para familiarizarte
3. **Aprovecha la información adicional** (`zoneAssigned`, `zoneId`) cuando sea útil
4. **Reporta cualquier problema** - el sistema tiene fallbacks para garantizar estabilidad

¡El sistema está diseñado para una **transición suave** y **sin fricción**! 🎉