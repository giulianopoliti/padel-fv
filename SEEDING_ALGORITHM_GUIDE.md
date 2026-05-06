# 🎾 Algoritmo de Seeding para Torneos de Pádel

## 📋 Resumen

Este documento explica el algoritmo implementado para generar brackets eliminatorios con seeding correcto en torneos de pádel, donde TODOS los participantes avanzan al bracket eliminatorio.

## ✨ Características Principales

### ✅ Algoritmo Implementado
- **Seeding por orden de creación de zonas**: El ganador de la primera zona creada obtiene seed 1, el de la segunda zona seed 2, etc.
- **Agrupación por posición**: Primero todos los ganadores de zona, luego todos los segundos, terceros, etc.
- **TODOS avanzan**: Todas las parejas de las zonas participan en el bracket eliminatorio
- **Seeding tradicional**: 1 vs N, 2 vs (N-1), 3 vs (N-2), etc.
- **Manejo de BYEs**: Automático para números no potencia de 2
- **Escalabilidad**: Funciona desde 2 hasta 64+ parejas

### 🎯 Reglas de Seeding

1. **Ganadores de zona (1° lugar)**:
   - Zona A (1ra creada) → Seed 1
   - Zona B (2da creada) → Seed 2
   - Zona C (3ra creada) → Seed 3
   - Y así sucesivamente...

2. **Segundos lugares**:
   - 2° de Zona A → Seed 7 (si hay 6 zonas)
   - 2° de Zona B → Seed 8
   - 2° de Zona C → Seed 9
   - Y así sucesivamente...

3. **Demás posiciones**: Siguen el mismo patrón, manteniendo el orden de creación de las zonas

### 🛠️ Funciones Principales

#### 1. `generateEliminationBracketAction(tournamentId: string)`
**Función principal que genera todo el bracket eliminatorio**

```typescript
const result = await generateEliminationBracketAction(tournamentId);
if (result.success) {
  console.log(result.message);
  console.log(`Seeds: ${result.seededCouples.length}`);
  console.log(`Matches: ${result.matches.length}`);
}
```

#### 2. `checkZonesReadyForElimination(tournamentId: string)`
**Verifica que todas las zonas estén completas antes de generar brackets**

```typescript
const status = await checkZonesReadyForElimination(tournamentId);
if (status.ready) {
  // Proceder con la generación de brackets
  await generateEliminationBracketAction(tournamentId);
} else {
  console.log(status.message); // Mostrar qué falta
}
```

## 🎯 Ejemplo de Funcionamiento

### Entrada: 21 parejas en 6 zonas

```
Zone A (1ra zona): P1(9pts), P2(7pts), P3(4pts), P4(3pts)
Zone B (2da zona): P5(9pts), P6(6pts), P7(5pts), P8(1pts)
Zone C (3ra zona): P9(8pts), P10(7pts), P11(4pts), P12(3pts)
Zone D (4ta zona): P13(9pts), P14(6pts), P15(3pts)
Zone E (5ta zona): P16(8pts), P17(5pts), P18(4pts)
Zone F (6ta zona): P19(7pts), P20(6pts), P21(2pts)
```

### Seeding Asignado

```
PRIMEROS LUGARES (Seeds 1-6):
Seed 1: P1 (1° Zone A) - 9 pts
Seed 2: P5 (1° Zone B) - 9 pts
Seed 3: P9 (1° Zone C) - 8 pts
Seed 4: P13 (1° Zone D) - 9 pts
Seed 5: P16 (1° Zone E) - 8 pts
Seed 6: P19 (1° Zone F) - 7 pts

SEGUNDOS LUGARES (Seeds 7-12):
Seed 7: P2 (2° Zone A) - 7 pts
Seed 8: P6 (2° Zone B) - 6 pts
Seed 9: P10 (2° Zone C) - 7 pts
Seed 10: P14 (2° Zone D) - 6 pts
Seed 11: P17 (2° Zone E) - 5 pts
Seed 12: P20 (2° Zone F) - 6 pts

TERCEROS LUGARES (Seeds 13-18):
Seed 13: P3 (3° Zone A) - 4 pts
Seed 14: P7 (3° Zone B) - 5 pts
Seed 15: P11 (3° Zone C) - 4 pts
Seed 16: P15 (3° Zone D) - 3 pts
Seed 17: P18 (3° Zone E) - 4 pts
Seed 18: P21 (3° Zone F) - 2 pts

CUARTOS LUGARES (Seeds 19-21):
Seed 19: P4 (4° Zone A) - 3 pts
Seed 20: P8 (4° Zone B) - 1 pts
Seed 21: P12 (4° Zone C) - 3 pts
```

### Bracket Resultante (32 posiciones, 11 BYEs)

```
Ronda 16VOS:
Match 1: Seed 1 (BYE)
Match 2: Seed 16 vs Seed 17
Match 3: Seed 8 vs Seed 25 (BYE)
Match 4: Seed 9 vs Seed 24 (BYE)
Match 5: Seed 4 vs Seed 29 (BYE)
Match 6: Seed 13 vs Seed 20
Match 7: Seed 5 vs Seed 28 (BYE)
Match 8: Seed 12 vs Seed 21
Match 9: Seed 2 vs Seed 31 (BYE)
Match 10: Seed 15 vs Seed 18
Match 11: Seed 7 vs Seed 26 (BYE)
Match 12: Seed 10 vs Seed 23 (BYE)
Match 13: Seed 3 vs Seed 30 (BYE)
Match 14: Seed 14 vs Seed 19
Match 15: Seed 6 vs Seed 27 (BYE)
Match 16: Seed 11 vs Seed 22 (BYE)
```

## 🔧 Arquitectura del Sistema

```
┌─────────────────────────┐
│  generateElimination    │
│     BracketAction       │
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│ extractCouplesSeeded    │
│   FromDatabase          │ ◄── Ordena zonas por created_at
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│   assignGlobalSeeds     │ ◄── Asigna seeds por orden de zona
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│  createBracketMatches   │ ◄── Crea emparejamientos 1vsN
└─────────────────────────┘
```

## 📝 Notas Importantes

1. **Orden de zonas**: Se respeta el orden de creación (created_at) de las zonas, NO el orden alfabético
2. **Todos participan**: A diferencia de otros sistemas, TODAS las parejas avanzan al bracket eliminatorio
3. **Seeding justo**: Los ganadores de zona siempre obtienen mejores seeds que los segundos lugares
4. **BYEs automáticos**: Se asignan a los mejores seeds cuando el número de parejas no es potencia de 2

## 🔧 Integración con el Sistema Existente

### Base de Datos

#### Tabla `tournament_couple_seeds`
```sql
tournament_id | couple_id | seed | zone_id
```
- Almacena el seed global de cada pareja
- Se actualiza automáticamente

#### Tabla `matches` (actualizada)
```sql
-- Nueva columna agregada
type: 'ZONE' | 'ELIMINATION'
```

### Frontend

Los componentes de visualización de brackets funcionan automáticamente con el nuevo algoritmo:
- `TournamentBracketVisualization`
- `ReadOnlyBracketVisualization`

## 🚀 Cómo Usar

### Paso 1: Verificar Estado de Zonas
```typescript
const status = await checkZonesReadyForElimination(tournamentId);
```

### Paso 2: Generar Bracket
```typescript
if (status.ready) {
  const result = await generateEliminationBracketAction(tournamentId);
}
```

### Paso 3: Visualizar
El frontend automáticamente mostrará el nuevo bracket generado.

## 🧪 Testing

### Función de Ejemplo
```typescript
import { exampleSeeding } from '@/utils/bracket-generator';

// Descomenta en bracket-generator.ts para probar
exampleSeeding();
```

### Test Manual
1. Crea un torneo con varias zonas
2. Completa todos los matches de zona
3. Llama a `generateEliminationBracketAction`
4. Verifica el seeding en los logs

## 🔍 Debug y Troubleshooting

### Logs Detallados
El algoritmo incluye logs extensivos:
```
[generateEliminationBracket] Iniciando generación...
[extractCouplesSeeded] Extrayendo parejas clasificadas...
✅ Bracket generado exitosamente: 21 parejas, 16 matches
```

### Validaciones
- Verifica datos de entrada
- Valida que todas las zonas estén completas
- Confirma que hay suficientes parejas

### Errores Comunes
1. **"No hay parejas clasificadas"**: Las zonas no han terminado
2. **"Datos inválidos"**: Faltan campos requeridos
3. **"Zonas no están listas"**: Matches de zona incompletos

## 🎯 Ventajas del Nuevo Algoritmo

### ✅ Algoritmo Correcto
- Implementa el seeding tradicional real
- Respeta posiciones en zona
- Ordena correctamente por zona

### ✅ Escalable y Reutilizable
- Funciona con cualquier número de parejas
- Fácil de mantener y extender
- Bien documentado y tipado

### ✅ Integrado con el Sistema
- Usa las tablas existentes
- Compatible con el frontend actual
- Mantiene la funcionalidad existente

## 📚 Estructura del Código

```
utils/bracket-generator.ts
├── Tipos principales (CoupleSeeded, BracketMatch, etc.)
├── Algoritmo de seeding (assignGlobalSeeds)
├── Generación de brackets (createBracketMatches)
├── Utilidades (validación, conversión, debug)
└── Compatibilidad con código existente

app/api/tournaments/actions.ts
├── generateEliminationBracketAction (función principal)
├── extractCouplesSeededFromDatabase (extracción de datos)
├── checkZonesReadyForElimination (verificación)
└── Integración con Supabase
```

¡El algoritmo está listo para usar! 🚀 