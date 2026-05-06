# 🏆 Bracket Visualization V2

Sistema moderno de visualización de brackets para torneos de pádel con arquitectura extensible.

## 📋 Estado Actual: FASE 1 COMPLETADA

### ✅ Implementado en Fase 1

- **Estructura de carpetas** modular y escalable
- **Tipos TypeScript** completos y documentados
- **Configuraciones** base para diferentes algoritmos
- **Componente principal** con arquitectura preparada
- **Sistema de placeholders** dinámicos
- **Drag & Drop** types preparados

### 🎯 Características Principales

#### 🔧 Arquitectura Modular
```
bracket-v2/
├── types/           # Tipos TypeScript estrictos
├── constants/       # Configuraciones predefinidas  
├── hooks/           # Hooks especializados (Fase 2)
├── components/      # Componentes reutilizables (Fase 2)
├── engines/         # Motores de lógica (Fase 2-4)
└── utils/           # Utilidades helper (Fase 2)
```

#### 🎮 Funcionalidades Planificadas

1. **Sistema de Placeholders Dinámicos**
   - Muestra brackets antes de que terminen las zonas
   - Usa `zone_positions.is_definitive` de la BD
   - Resolución automática cuando se definen posiciones

2. **Drag & Drop de Posiciones**
   - Intercambio de parejas dentro de la misma ronda
   - Validación en tiempo real
   - Solo para usuarios propietarios

3. **Procesamiento Automático de BYEs**
   - Avance automático cuando hay BYE
   - Actualización de bracket tree
   - Notificaciones al usuario

4. **Soporte Multi-Algoritmo**
   - Algoritmo tradicional
   - Algoritmo serpenteo (1A vs 1B solo en final)
   - Extensible para futuros algoritmos

## 🔧 Tipos Principales Implementados

### BracketMatchV2
```typescript
interface BracketMatchV2 {
  id: string
  round: Round
  order_in_round: number
  status: MatchStatus
  participants: {
    slot1: ParticipantSlot
    slot2: ParticipantSlot
  }
  result?: MatchResultV2
  // ... más campos
}
```

### ParticipantSlot
```typescript
interface ParticipantSlot {
  type: 'couple' | 'placeholder' | 'bye'
  couple?: CoupleData
  placeholder?: PlaceholderData
  seed?: SeedInfo
}
```

### DragDropOperation
```typescript
interface DragDropOperation {
  operationId: string
  sourceMatchId: string
  targetMatchId: string
  sourceSlot: SlotPosition
  targetSlot: SlotPosition
  validation: DragDropValidation
}
```

## ⚙️ Configuraciones Disponibles

### Por Algoritmo
- `TRADITIONAL_CONFIG`: Seeding estándar
- `SERPENTINE_CONFIG`: Con garantía 1A vs 1B en final
- `BEST_OF_3_CONFIG`: Para formatos futuros

### Por Dispositivo
- `mobile`: 280px de ancho
- `tablet`: 320px de ancho  
- `desktop`: 340px de ancho
- `compact`: Para muchos matches
- `expanded`: Máximo detalle

### Por Rol de Usuario
- `owner`: Todas las funcionalidades
- `public`: Solo lectura
- `coach`: Lectura + estadísticas
- `minimal`: Performance optimizada

## 🚀 Uso del Componente

```tsx
import { BracketVisualizationV2 } from './bracket-v2/BracketVisualizationV2'

<BracketVisualizationV2
  tournamentId="uuid-del-torneo"
  algorithm="serpentine"
  isOwner={true}
  onDataRefresh={() => refetch()}
  onMatchUpdate={(matchId, result) => console.log('Match updated')}
/>
```

## 🔄 Próximas Fases

### Fase 2: Layout Engine (2-3 días)
- [ ] Implementar `useBracketData` hook
- [ ] Migrar lógica de posicionamiento del legacy
- [ ] Crear componente `ConnectorLines` con SVG
- [ ] Implementar `MatchCard` reutilizable

### Fase 3: Drag & Drop (3 días)
- [ ] Implementar `useBracketDragDrop` hook
- [ ] Crear componentes drag & drop
- [ ] Crear endpoint backend para intercambios
- [ ] Sistema de validación en tiempo real

### Fase 4: Sistema BYE (2 días)
- [ ] Implementar `BYEProcessor` engine
- [ ] Procesamiento automático
- [ ] Endpoint para avance por BYE
- [ ] Controles de usuario

### Fase 5: Integración (2 días)
- [ ] Conectar con `TournamentBracketWrapper`
- [ ] Testing completo con datos reales
- [ ] Optimizaciones de performance
- [ ] Polish UI/UX

## 🧪 Testing

### Verificar Tipos
```bash
# Verificar que no hay errores de TypeScript
npx tsc --noEmit
```

### Testing Visual
```tsx
// Importar el componente en cualquier página
import { BracketVisualizationV2 } from '@/components/tournament/bracket-v2/BracketVisualizationV2'

// Usar con datos de prueba
<BracketVisualizationV2 
  tournamentId="test-tournament"
  algorithm="serpentine"
  isOwner={true}
/>
```

## 📚 Documentación de Tipos

### Estados del Bracket
- `NOT_GENERATED`: Sin bracket
- `GENERATED_WITH_PLACEHOLDERS`: Con placeholders
- `PARTIALLY_RESOLVED`: Algunos placeholders resueltos
- `FULLY_RESOLVED`: Todos resueltos
- `COMPLETED`: Bracket finalizado

### Algoritmos Soportados
- `traditional`: Seeding estándar
- `serpentine`: Garantía 1A vs 1B solo en final
- `custom`: Para extensiones futuras

### Formatos de Match
- `best-of-1`: Un solo set (actual)
- `best-of-3`: Mejor de 3 sets (futuro)
- `best-of-5`: Mejor de 5 sets (futuro)

## 🔗 Integración con Sistema Existente

### Conexión con Legacy
El nuevo sistema está diseñado para integrarse sin romper el existente:

```tsx
// En tournament-bracket-wrapper.tsx
case 'serpentine':
  return <BracketVisualizationV2 
    tournamentId={tournamentId}
    algorithm="serpentine"
    isOwner={isOwner}
    onDataRefresh={onDataRefresh}
  />
```

### APIs Utilizadas
- `/api/tournaments/[id]/matches` - Matches existentes
- `/api/tournaments/[id]/seeds` - Información de seeding
- `/api/tournaments/[id]/zones-ready` - Estado de zonas
- `/api/tournaments/[id]/swap-bracket-positions` - Drag & drop (Fase 3)

## 🎨 Ventajas sobre el Legacy

### Mantenibilidad
- **1 responsabilidad por archivo** vs 1600 líneas monolíticas
- **Tipos estrictos** previenen errores en runtime
- **Testing granular** de cada componente
- **Debug más fácil** con componentes pequeños

### Extensibilidad  
- **Configuración declarativa** para nuevos formatos
- **Sistema de plugins** para funcionalidades
- **Hooks reutilizables** para otros componentes
- **Arquitectura preparada** para cambios futuros

### Performance
- **Memoización granular** por componente
- **Re-renders mínimos** con estados aislados
- **Lazy loading** de funcionalidades pesadas
- **Bundle splitting** automático

## 🚨 Notas Importantes

### Compatibilidad
- ✅ Compatible con algoritmo serpenteo existente
- ✅ Usa las mismas APIs del backend actual
- ✅ Migración gradual sin breaking changes
- ✅ Fallback al sistema legacy si hay errores

### Desarrollo Incremental
- Cada fase es independiente y funcional
- Se puede deployar parcialmente
- Testing continuo con datos reales
- Rollback fácil si hay problemas

### TypeScript Estricto
- No se permite `any` types
- Validación en build time
- IntelliSense completo en IDE
- Documentación auto-generada