# Resolución de Placeholders con Foreign Keys

## 📖 Resumen

Este documento explica la nueva implementación de resolución de placeholders que utiliza **Foreign Keys** y maneja automáticamente los **matches BYE**. La nueva arquitectura reemplaza el sistema anterior basado en `placeholder_label` por uno más robusto basado en `zone_id + position`.

## 🎯 Problema Resuelto

### **Problema Anterior**:
- ❌ RPC `resolve_placeholders_atomic` usaba string matching con `placeholder_label`
- ❌ No actualizaba matches directamente
- ❌ Matches BYE quedaban sin `winner_id` 
- ❌ Dependía de propagación manual externa
- ❌ Arquitectura obsoleta vs FKs modernas

### **Solución Nueva**:
- ✅ RPC `resolve_placeholders_with_fks` usa `zone_id + position` (más robusto)
- ✅ Actualiza seeds Y matches en una sola transacción atómica
- ✅ Maneja BYEs automáticamente con `winner_id` correcto
- ✅ Usa Foreign Keys `tournament_couple_seed1_id` y `tournament_couple_seed2_id`
- ✅ Arquitectura moderna alineada con tu sistema actual

## 🏗️ Arquitectura

### **Flujo de Datos**:

```
Posición Definitiva → RPC resolve_placeholders_with_fks → 
├─ 1. Buscar seeds por zone_id + position
├─ 2. Actualizar tournament_couple_seeds.couple_id  
├─ 3. Propagar a matches via FKs
└─ 4. Resolver BYEs automáticamente
```

### **Tablas Involucradas**:

1. **`tournament_couple_seeds`** - Seeds del torneo (resuelve placeholders)
2. **`matches`** - Partidos del bracket (recibe propagación via FKs)
3. **`placeholder_resolutions`** - Auditoría de resoluciones

## 🔧 Componentes

### 1. **RPC: `resolve_placeholders_with_fks`**

**Ubicación**: Base de datos (migration: `create_resolve_placeholders_with_fks`)

**Parámetros**:
```sql
p_tournament_id UUID              -- ID del torneo
p_zone_resolutions JSONB          -- Array de resoluciones: [{zone_id, position, couple_id}]
```

**Funcionalidades**:
- ✅ **Transaccional**: Todo o nada, rollback automático en errores
- ✅ **Busca por FK**: `zone_id + position` en lugar de strings
- ✅ **Propaga a matches**: Usa `tournament_couple_seed1_id/seed2_id`
- ✅ **Maneja BYEs**: Actualiza `status='BYE'` y `winner_id` automáticamente
- ✅ **Auditoría**: Registra en `placeholder_resolutions`
- ✅ **Logging**: NOTICE para debugging

### 2. **Servicio TypeScript: `PlaceholderResolutionService`**

**Ubicación**: `lib/services/placeholder-resolution-service.ts`

**Cambios Realizados**:
- ✅ Nueva interface `ZoneResolution`
- ✅ Método `applyResolutions()` actualizado para usar nuevo RPC
- ✅ Conversión automática de `PlaceholderResolution[]` a `ZoneResolution[]`
- ✅ Mantiene compatibilidad con algoritmos existentes (Fast Path, etc.)

## 📝 Uso

### **Llamada desde código**:

```typescript
import { getPlaceholderResolver } from '@/lib/services/placeholder-resolution-service'

// Uso normal - no cambia nada en tu código existente
const resolver = getPlaceholderResolver()
const result = await resolver.resolvePlaceholders(tournamentId)

// El servicio internamente usa el nuevo RPC automáticamente
```

### **Flujo interno** (automático):

1. **Obtiene placeholders** no resueltos por `tournament_id`
2. **Encuentra posiciones definitivas** en `zone_positions`  
3. **Convierte a ZoneResolution[]**: `{zoneId, position, coupleId}`
4. **Llama RPC modernizado**: `resolve_placeholders_with_fks`
5. **RPC hace todo atómicamente**:
   - Resuelve seeds
   - Propaga a matches
   - Maneja BYEs con winner_id

## 🔄 Migración

### **Cambios Realizados Automáticamente**:

1. ✅ **Nuevo RPC creado** en base de datos
2. ✅ **Servicio TypeScript actualizado** para usar nuevo RPC
3. ✅ **Compatibilidad mantenida** - tu código existente sigue funcionando
4. ✅ **Sin breaking changes** - mismo comportamiento externo

### **RPC Anterior**:
- `resolve_placeholders_atomic` - **AÚN DISPONIBLE** por compatibilidad
- Pero ya no se usa en el código nuevo

## 🧪 Testing

### **Casos de Prueba Cubiertos**:

1. **✅ Resolución Normal**: Placeholder → Pareja real
2. **✅ Match BYE**: Placeholder resuelto donde oponente es `null` 
3. **✅ Multiple Seeds**: Varios placeholders de la misma zona/posición
4. **✅ Transaccionalidad**: Rollback si algo falla
5. **✅ Performance**: Operación atómica única

### **Para probar manualmente**:

```sql
-- Ver placeholders pendientes
SELECT * FROM tournament_couple_seeds 
WHERE tournament_id = 'tu-tournament-id' 
AND is_placeholder = true;

-- Probar resolución
SELECT resolve_placeholders_with_fks(
  'tu-tournament-id',
  '[{"zone_id": "zone-uuid", "position": 1, "couple_id": "couple-uuid"}]'::jsonb
);

-- Verificar resultado
SELECT * FROM matches 
WHERE tournament_id = 'tu-tournament-id' 
AND status = 'BYE';
```

## 📊 Logs y Debugging

### **Logs del RPC** (en Supabase logs):
```
NOTICE: Starting placeholder resolution for tournament: xxx
NOTICE: Processing resolution: zone_id=xxx, position=1, couple_id=xxx  
NOTICE: Found 2 placeholder seeds to resolve
NOTICE: Resolution completed: 2 seeds resolved, 4 matches affected, 1 BYE matches created
```

### **Logs del Servicio TypeScript**:
```
✅ [PLACEHOLDER-RESOLVER] Applied 2 resolutions using FK-based RPC: {
  "success": true,
  "resolved_count": 2,
  "affected_matches": 4,
  "bye_matches_created": 1
}
```

## ⚠️ Consideraciones

### **Importante**:
- ✅ **Completamente transaccional** - no hay estados inconsistentes
- ✅ **Backward compatible** - código existente funciona igual
- ✅ **Mejor performance** - una sola operación atómica
- ✅ **Manejo automático de BYEs** - problema principal resuelto

### **Limitaciones**:
- ⚠️ Requiere que `zone_positions.is_definitive = true` esté bien calculado
- ⚠️ Depende de FKs `tournament_couple_seed1_id/seed2_id` en matches

## 📈 Beneficios

1. **🚀 Performance**: 1 operación vs múltiples queries
2. **🔒 Confiabilidad**: Transaccional, no hay estados parciales  
3. **🎯 Precisión**: FK-based vs string matching
4. **🤖 Automático**: BYEs resueltos sin intervención manual
5. **🧹 Simplicidad**: Una sola fuente de verdad
6. **📝 Auditoría**: Todas las resoluciones quedan registradas

---

## 📞 Soporte

Si hay problemas con la resolución de placeholders:

1. **Revisar logs de Supabase** para mensajes NOTICE del RPC
2. **Verificar `zone_positions.is_definitive`** esté correctamente calculado  
3. **Confirmar FKs** `tournament_couple_seed1_id/seed2_id` en matches
4. **Verificar datos** en `placeholder_resolutions` para auditoría

La nueva implementación es **más robusta y automática** que la anterior.