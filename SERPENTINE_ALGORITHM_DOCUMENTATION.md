# Algoritmo de Seeding Serpentino para Torneos de Padel

## Resumen del Proyecto

Este documento describe la implementación del algoritmo de seeding serpentino (snake seeding) para torneos de padel multi-zona, desarrollado para asegurar que los mejores equipos de diferentes zonas solo se encuentren en la final.

## Arquitectura del Sistema

### 1. Separación de Responsabilidades

El sistema está diseñado con una arquitectura modular que separa completamente:

- **Algoritmo de Serpenteo**: Función pura que calcula posiciones de bracket independiente del ordenamiento
- **Estrategias de Ordenamiento**: Funciones intercambiables que determinan el orden de los seeds
- **Persistencia**: Actualización de base de datos separada de la lógica de negocio

### 2. Componentes Principales

#### Archivo: `utils/bracket-seeding-algorithm.ts`

**Interfaces:**
```typescript
export interface CoupleRanking {
  couple_id: string;
  tournament_id: string;
  zone_id: string;
  position: number;
  wins: number;
  losses: number;
  games_for: number;
  games_against: number;
  games_difference: number;
  points: number;
  tie_info?: string;
  zones?: { name: string };
}

export interface BracketSeeding {
  P: number; // bracket size (potencia de 2)
  order: (number | 'BYE')[]; // posición -> seed (o BYE)
  position_by_seed: number[]; // seed -> posición
  first_round_pairs: [number, number][];
}
```

## Estrategias de Ordenamiento

### Estrategia 1: Round-Robin por Zonas (Recomendada)
`getCouplesRankedByZones()`

**Patrón de ordenamiento:**
- Seed 1 = Posición 1 de Zona A
- Seed 2 = Posición 1 de Zona B  
- Seed 3 = Posición 1 de Zona C
- Seed 4 = Posición 2 de Zona A
- Seed 5 = Posición 2 de Zona B
- Seed 6 = Posición 2 de Zona C
- Y así sucesivamente...

**Ventajas:**
- Balanceo perfecto entre zonas
- Los #1 de cada zona solo se encuentran en semifinales/final
- Fácil de entender y validar

### Estrategia 2: Por Performance General
`getCouplesRankedByPerformance()`

**Criterios de ordenamiento:**
1. Posición en zona (menor es mejor)
2. Victorias (más victorias mejor)
3. Diferencia de games (mayor mejor)
4. Games a favor (más mejor)

**Uso:** Ideal para zona única o cuando se quiere ranking absoluto

### Estrategia 3: Legacy
`getCouplesRankedByZoneResults()`

**Propósito:** Mantener compatibilidad con implementación anterior

## Algoritmo de Serpenteo

### Función Principal: `buildBracketSeeding(N: number)`

**Algoritmo Serpentino:**
```
Para N = 4 parejas:
- Orden inicial: [1, 2]
- Duplicación: [1, 4, 3, 2]
- Resultado: Seed 1 vs Seed 4, Seed 2 vs Seed 3

Para N = 8 parejas:
- Orden: [1, 8, 5, 4, 3, 6, 7, 2]
- Primera ronda: (1 vs 8), (2 vs 7), (3 vs 6), (4 vs 5)
```

**Propiedades del algoritmo:**
- Los seeds 1 y 2 están en mitades opuestas del bracket
- Solo pueden encontrarse en la final
- Distribución balanceada de fuerza en cada mitad

### Manejo de BYEs

El algoritmo calcula automáticamente:
- `P = siguiente potencia de 2 ≥ N`
- Posiciones con BYE cuando `N < P`
- Advancement automático para equipos con BYE

## API Endpoints

### POST `/api/tournaments/[id]/generate-seeding`
Genera seeds usando la estrategia configurada (por defecto: by-zones)

**Response:**
```json
{
  "success": true,
  "strategy": "by-zones",
  "totalCouples": 10,
  "bracketSize": 16,
  "byes": 6,
  "couplesRanked": [...]
}
```

### POST `/api/tournaments/[id]/generate-bracket-from-seeding`
Genera matches de eliminación basados en seeds existentes

**Proceso:**
1. Lee `tournament_couple_seeds`
2. Calcula rounds necesarios según bracket size
3. Genera matches de primera ronda con BYEs
4. Crea placeholder matches para rounds posteriores

### GET `/api/tournaments/[id]/seeds`
Retorna seeds con información completa de parejas

## Tablas de Base de Datos

### `tournament_couple_seeds`
```sql
- tournament_id (UUID)
- couple_id (UUID)
- seed (INTEGER) -- 1 = mejor, incrementa
- bracket_position (INTEGER) -- posición en bracket (1 a P)
- zone_id (UUID)
```

### `zone_positions`
```sql
- couple_id (UUID)
- tournament_id (UUID)  
- zone_id (UUID)
- position (INTEGER) -- posición final en zona
- wins, losses, games_for, games_against, etc.
- is_definitive (BOOLEAN) -- solo procesar finales
```

## Flujo de Generación Completo

1. **Preparación:**
   - Verificar que `zone_positions.is_definitive = true`
   - Limpiar seeds y matches existentes

2. **Generación de Seeds:**
   ```typescript
   const result = await generateTournamentSeeding(tournamentId, supabase, 'by-zones')
   ```

3. **Generación de Bracket:**
   ```typescript
   // Automático después del seeding
   await generateBracketFromSeeding(tournamentId, supabase)
   ```

4. **Resultado:**
   - Seeds ordenados según estrategia
   - Matches de eliminación generados
   - BYEs manejados automáticamente

## Debug Interface

### Componente: `tournament-bracket-debug.tsx`

**Funcionalidades:**
- Visualización del patrón round-robin esperado
- Seeds con nombres de zona y jugadores
- Matches generados con información completa
- Logs detallados en consola

**Verificación Visual:**
- Seed 1 debe ser Zona A, Posición 1
- Bracket positions siguen patrón serpentino
- Matches muestran seeds correctos

## Configuración en Producción

### Variables de Estrategia
Por defecto usa `'by-zones'`, pero se puede cambiar:
```typescript
generateTournamentSeeding(tournamentId, supabase, 'by-performance')
```

### Logs de Monitoreo
El sistema genera logs detallados:
- `[generateTournamentSeeding] Strategy by-zones produced ranking`
- `[POST /generate-seeding] ✅ Success`
- `[generate-bracket-from-seeding] Creating bracket`

## Ventajas del Diseño

1. **Modularidad:** Algoritmo serpentino independiente del ordenamiento
2. **Flexibilidad:** Múltiples estrategias intercambiables  
3. **Escalabilidad:** Funciona para cualquier número de parejas/zonas
4. **Testabilidad:** Cada componente se puede probar independientemente
5. **Futuro:** Listo para zona única sin cambios en serpenteo

## Consideraciones Técnicas

- **Performance:** O(n log n) para ordenamiento, O(n) para serpenteo
- **Memory:** Estructuras de datos eficientes con Maps
- **Error Handling:** Validaciones en cada paso del proceso
- **Type Safety:** TypeScript completo con interfaces definidas

---

**Desarrollado por:** Giuliano + Claude Code  
**Fecha:** Agosto 2024  
**Versión:** 1.0 - Implementación Round-Robin por Zonas