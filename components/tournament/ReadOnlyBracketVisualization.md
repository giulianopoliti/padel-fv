# ReadOnlyBracketVisualization Component

## Overview

**ReadOnlyBracketVisualization** es un componente de visualización de brackets para torneos que combina la UX/UI del sistema de clubs con la funcionalidad de puntos de la vista pública. Diseñado para ser usado en vistas públicas y estados finalizados de torneos.

## Features

### ✅ **Layout Horizontal Tradicional**
- Cards organizadas de **izquierda → derecha** por rondas eliminatorias
- **Responsive**: Mobile (scroll horizontal) → Desktop (vista completa)
- **Detección dinámica**: Funciona para torneos que empiecen en cualquier ronda (4TOS, 8VOS, etc.)

### ✅ **Manejo de BYEs**
- **Detección automática**: `couple1_id` o `couple2_id` = `null`
- **Display apropiado**: "BYE vs [Pareja]" o "[Pareja] vs BYE"
- **Badge**: "Pase Directo" para partidos BYE

### ✅ **Sistema de Puntos Integrado**
- **PointsCircle**: Muestra puntos ganados/perdidos (+16, -8)
- **BatacazoBadge**: Badge especial cuando ganador > 18 puntos
- **Manejo gracioso**: No falla en torneos legacy sin datos de puntos

### ✅ **Jerarquía de Brackets**
- **match_hierarchy**: Posicionamiento basado en relaciones padre-hijo
- **Centrado automático**: Partidos padre centrados respecto a hijos
- **Fallback**: Orden por ID si no hay jerarquía disponible

### ✅ **Estados Especiales**
- **FINISHED_POINTS_CALCULATED**: Header explicativo con ejemplo de BATACAZO
- **Sin brackets**: Mensaje informativo apropiado
- **Errores**: Manejo gracioso con alerts informativos

## Usage

```typescript
import ReadOnlyBracketVisualization from './bracket-v2/components/ReadOnlyBracketVisualization'

// Uso básico
<ReadOnlyBracketVisualization 
  tournamentId="uuid-tournament-id" 
/>

// Con estado de torneo
<ReadOnlyBracketVisualization 
  tournamentId="uuid-tournament-id"
  tournamentStatus="FINISHED_POINTS_CALCULATED" 
/>
```

## Integration Chain

### Public View Flow
```
TournamentPageLayout → LegacyBracketHandler → ReadOnlyBracketTab → ReadOnlyBracketVisualization
```

### FINISHED_POINTS_CALCULATED Flow  
```
BracketVisualizationV2 → ReadOnlyBracketTab → ReadOnlyBracketVisualization
```

## Data Flow

### API Endpoints Used
1. **`/api/tournaments/[id]/matches`** - Obtiene partidos eliminatorios
2. **`/api/tournaments/[id]/match-hierarchy`** - Jerarquía padre-hijo (opcional)
3. **`/api/tournaments/[id]/match-points`** - Puntos por partido (opcional)

### Data Processing
1. **Filtrado**: Solo partidos eliminatorios (excluye ZONE)
2. **Detección de rondas**: Dinámicamente según partidos existentes
3. **Jerarquía**: Aplicación de posicionamiento si existe
4. **Puntos**: Carga opcional sin bloquear rendering

## Responsive Design

### Desktop (≥1024px)
- **4 columnas**: Todas las rondas visibles
- **Cards centradas**: Posicionamiento jerárquico completo
- **Gap amplio**: Separación clara entre rondas

### Tablet (768px-1023px)
- **2-3 columnas**: Scroll horizontal suave
- **Touch friendly**: Navegación táctil optimizada

### Mobile (<768px)
- **1 columna**: Vista compacta con scroll
- **Cards apiladas**: Orden cronológico de rondas
- **Indicadores**: Headers claros de cada ronda

## Error Handling

### Graceful Degradation
- **Sin puntos**: Muestra brackets sin círculos de puntos
- **Sin jerarquía**: Orden por ID de partido
- **Sin partidos**: Mensaje informativo apropiado
- **API errors**: Alerts explicativos sin romper UI

### Legacy Tournament Support
- **Automático**: Detecta ausencia de `match_points_couples`
- **Sin errores**: Continúa funcionando normalmente
- **Feedback**: Indicador en footer de tipo de bracket

## Performance

### Optimizations
- **useMemo**: Cálculo de layout solo cuando cambian datos
- **Parallel loading**: APIs en paralelo para mejor UX
- **Conditional rendering**: Solo renderiza datos disponibles

### Bundle Size
- **Componentes reutilizados**: PointsCircle, BatacazoBadge existentes
- **Tree shaking**: Imports específicos de lucide-react
- **CSS**: Solo Tailwind classes (sin CSS custom)

## Examples

### Tournament Starting at Quarters
```
4TOS          SEMIFINAL     FINAL
[Match 1]     [Semi 1]      [Final]
[Match 2]     [Semi 2]      
[Match 3]     
[Match 4]     
```

### Tournament with BYEs
```
4TOS              SEMIFINAL         FINAL
[Team A vs BYE]   [Team A vs B]     [Winner]
[Team B vs C]     [Team D vs E]     
[Team D vs E]     
[BYE vs Team F]   
```

### With Points (FINISHED_POINTS_CALCULATED)
```
Header: "Los círculos muestran puntos ganados (+16) y BATACAZO 🎯 para >18 puntos"

4TOS                    SEMIFINAL              FINAL
[Team A vs BYE]         [Team A (+12) vs       [Team A (+8) vs
[Team B (+16) vs           Team B (+14)] 🎯      Team D (+22)] 🎯
   Team C (-16)]        [Team D (+10) vs
[Team D (+18)] 🎯         Team F (+8)]
   vs [Team E (-18)]
```

## Testing

### Test Cases
- ✅ Torneos legacy sin puntos
- ✅ Torneos V2 con puntos completos
- ✅ Torneos con BYEs en diferentes posiciones
- ✅ Diferentes puntos de inicio (8VOS, 4TOS, etc.)
- ✅ Estados FINISHED_POINTS_CALCULATED
- ✅ Responsive en diferentes devices
- ✅ Errores de API y fallbacks

### Browser Support
- ✅ Chrome, Firefox, Safari (últimas 2 versiones)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- ✅ Touch interactions optimizadas