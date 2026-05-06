# 🔌 Integración del Sistema Bracket V2

Guía para integrar el nuevo sistema BracketVisualizationV2 en la aplicación existente.

## ✅ Estado Actual: FASE 1 COMPLETADA

### ✅ Lo que YA está funcionando:

1. **Sistema de tipos completo** (485+ líneas)
2. **Hook useBracketData** - Obtiene datos reales de APIs
3. **Adaptadores de formato** - Convierte legacy → BracketMatchV2
4. **Configuraciones** base para diferentes algoritmos
5. **Componente principal** con placeholders funcionales
6. **Conexión con APIs existentes**:
   - `/api/tournaments/[id]/matches`
   - `/api/tournaments/[id]/seeds`
   - `/api/tournaments/[id]/zones-ready`

## 🚀 Cómo usar el nuevo sistema

### Opción 1: Reemplazo directo (Recomendado para testing)

```tsx
// En cualquier componente de torneo
import { BracketV2Test } from '@/components/tournament/bracket-v2/test/BracketV2Test'

// Reemplazar el componente existente
<BracketV2Test 
  tournamentId={tournamentId}
  isOwner={isOwner}
  showDebug={true}
/>
```

### Opción 2: Integración en TournamentBracketWrapper

```tsx
// En tournament-bracket-wrapper.tsx
import { BracketVisualizationV2 } from '@/components/tournament/bracket-v2/BracketVisualizationV2'

// Agregar caso para serpentine
case 'serpentine':
  return (
    <BracketVisualizationV2
      tournamentId={tournamentId}
      algorithm="serpentine"
      isOwner={isOwner}
      onDataRefresh={onDataRefresh}
    />
  )
```

### Opción 3: Hook directo

```tsx
// En cualquier componente
import { useBracketData } from '@/components/tournament/bracket-v2/hooks/useBracketData'

const { data, loading, error, refetch } = useBracketData(tournamentId, {
  algorithm: 'serpentine',
  enableRealtime: true
})
```

## 📊 Datos que obtiene automáticamente

✅ **Matches**: Transformados al formato BracketMatchV2
✅ **Seeds**: Con información de zona y posición
✅ **Estado**: Detecta placeholders vs matches reales  
✅ **Configuración**: Según algoritmo y rol de usuario
✅ **Tiempo real**: Suscripciones automáticas a cambios

## 🧪 Testing recomendado

### 1. Probar con torneo existente

```bash
# Usar cualquier torneo que tenga matches
# El sistema debería mostrar:
# - Número de matches encontrados
# - Estado del bracket
# - Debug info en desarrollo
```

### 2. Verificar datos en consola

```javascript
// El hook logea automáticamente:
// [useBracketData] Processed X valid matches for tournament...
// [useBracketData] Transformation debug: {...}
```

### 3. Testear refetch

```javascript
// Los botones deberían:
// - Actualizar datos al hacer click
// - Mostrar estado "Actualizando..." 
// - Refrescar automáticamente cada cambio en BD
```

## 🔧 Configuración avanzada

### Algoritmos disponibles

```tsx
algorithm="traditional"  // Seeding estándar
algorithm="serpentine"   // 1A vs 1B solo en final  
algorithm="custom"       // Para futuras extensiones
```

### Features por rol

```tsx
isOwner={true}   // Drag & drop, BYE processing, etc
isOwner={false}  // Solo lectura, estadísticas básicas
```

### Tiempo real

```tsx
enableRealtime={true}   // Suscripciones automáticas
refetchInterval={5000}  // Polling cada 5 segundos
```

## 🐛 Debug y troubleshooting

### Console logs importantes

```
✅ [useBracketData] Processed X valid matches
✅ [useBracketData] Transformation debug: {...}
⚠️  [useBracketData] X matches with validation errors
❌ Error fetching bracket data: {...}
```

### Estados esperados

```
NOT_GENERATED              → No hay matches
GENERATED_WITH_PLACEHOLDERS → Hay matches con placeholders
FULLY_RESOLVED             → Todos los matches tienen parejas
PARTIALLY_RESOLVED         → Algunos matches terminados
COMPLETED                  → Torneo finalizado
```

### Validaciones automáticas

- Matches deben tener ID válido
- Participants deben tener slot1 y slot2
- Round debe ser válido
- Order_in_round debe ser > 0

## 🛠 Personalización

### Layout responsive

```tsx
config={{
  layout: {
    columnWidth: 340,    // Ancho columnas
    matchHeight: 135,    // Alto de cada match
    spacing: 20,         // Espaciado
    responsive: true     // Adaptable
  }
}}
```

### Features específicas

```tsx
config={{
  features: {
    showSeeds: true,           // Mostrar seeds
    showZoneInfo: true,        // Info de zonas
    enableDragDrop: isOwner,   // Drag & drop
    enableLiveScoring: false,  // Scoring en vivo
    showStatistics: true,      // Estadísticas
    autoProcessBYEs: isOwner   // Procesamiento automático
  }
}}
```

## 🔄 Migración del sistema legacy

### Paso 1: Testing paralelo
- Mantener sistema existente
- Agregar BracketV2Test en modo debug
- Comparar resultados

### Paso 2: Reemplazo gradual
- Torneos nuevos → Usar V2
- Torneos existentes → Mantener legacy
- Feature flag para controlarlo

### Paso 3: Migración completa
- Reemplazar en TournamentBracketWrapper
- Remover sistema legacy
- Optimizar performance

## 📋 Próximas fases

### FASE 2: Layout Engine (2-3 días)
- [ ] Componente MatchCard reutilizable
- [ ] Sistema de líneas conectoras SVG  
- [ ] Posicionamiento responsive
- [ ] Migración de lógica legacy

### FASE 3: Drag & Drop (3 días)
- [ ] Hook useBracketDragDrop
- [ ] Componentes drag & drop
- [ ] Endpoints backend para intercambios
- [ ] Validación en tiempo real

### FASE 4: Sistema BYE (2 días)
- [ ] Procesamiento automático de BYEs
- [ ] Avance automático de ganadores
- [ ] Notificaciones al usuario

### FASE 5: Integración (2 días)
- [ ] Testing completo
- [ ] Optimizaciones de performance
- [ ] Documentación final
- [ ] Capacitación del equipo

## 💡 Tips para desarrolladores

1. **Debug mode**: Siempre activar en desarrollo
2. **Console logs**: Revisar transformación de datos
3. **Network tab**: Verificar llamadas a APIs
4. **Component tree**: Usar React DevTools
5. **TypeScript**: El sistema es type-safe, usar IntelliSense

## 🆘 Soporte

Si encuentras problemas:

1. **Verificar console** para errores de transformación
2. **Revisar Network** para errores de API
3. **Testear refetch** manual con botones
4. **Comparar** con sistema legacy
5. **Reportar** con datos específicos del torneo