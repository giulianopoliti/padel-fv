# 🏆 PLAN DE IMPLEMENTACIÓN - BRACKET TORNEO LARGO

## 📋 RESUMEN EJECUTIVO

Este documento detalla la implementación de un componente completamente nuevo para la gestión de brackets en torneos largos, combinando lo mejor de:
- **ImprovedBracketRenderer** (drag & drop + lógica de avance)
- **MatchSchedulingContainer** (disponibilidad + gestión de horarios)
- **LoadMatchResultDialog** (carga de resultados con sets)

## 🎯 CONCEPTO VISUAL FINAL

### VISTA BRACKET (Por defecto)
```
┌─────────────────────────────────────────────────────────────────┐
│ [🎾 Bracket View] [📅 Schedule View]                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 8VOS DE FINAL         4TOS DE FINAL        SEMIFINAL    FINAL  │
│ ┌─────────────┐       ┌─────────────┐      ┌───────┐   ┌─────┐ │
│ │Pedro Pablo  │───────│   Ganador   │──────│Ganador│───│ 🏆  │ │
│ │vs Giulian   │       │   Match 1   │      │ Semi 1│   │     │ │
│ │[Load Result]│       │[Load Result]│      │[Load] │   │     │ │
│ └─────────────┘       └─────────────┘      └───────┘   └─────┘ │
│ ┌─────────────┐       ┌─────────────┐      ┌───────┐           │
│ │Ana López    │───────│   Ganador   │──────│Ganador│           │
│ │vs María     │       │   Match 2   │      │ Semi 2│           │
│ │[Load Result]│       │[Load Result]│      │[Load] │           │
│ └─────────────┘       └─────────────┘      └───────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### VISTA SCHEDULE (MATRIZ COMPACTA) - LA CLAVE
```
┌─────────────────────────────────────────────────────────────────┐
│ [Bracket View] [🔥 Schedule View] [Round: 8VOS ▼]               │
├─────────────────────────────────────────────────────────────────┤
│              │ Sáb 9-11 │ Sáb 14-16│ Dom 10-12│ Dom 16-18│     │
├──────────────┼──────────┼──────────┼──────────┼──────────┤     │
│ MATCH 1      │          │          │          │          │     │
│ Pedro Pablo  │    ✅    │    ❌    │    ✅    │    ✅    │ [⚙️] │
│ Giulian M.   │    ✅    │    ✅    │    ❌    │    ✅    │ [📊]│
├──────────────┼──────────┼──────────┼──────────┼──────────┤     │
│ MATCH 2      │          │          │          │          │     │
│ Ana López    │    ✅    │    ✅    │    ❌    │    ✅    │ [⚙️] │
│ María García │    ❌    │    ✅    │    ✅    │    ✅    │ [📊]│
├──────────────┼──────────┼──────────┼──────────┼──────────┤     │
│ MATCH 3      │          │          │          │          │     │
│ Carlos Díaz  │    ✅    │    ❌    │    ✅    │    ❌    │ [⚙️] │
│ Luis Moreno  │    ✅    │    ✅    │    ✅    │    ✅    │ [📊]│
└──────────────┴──────────┴──────────┴──────────┴──────────┘     │
│ [⚙️] = Asignar Horario  [📊] = Load Result                     │
└─────────────────────────────────────────────────────────────────┘
```

**CARACTERÍSTICAS CLAVE DE LA MATRIZ:**
- **Cada match = 2 filas** (pareja 1 + pareja 2)
- **Time slots horizontales** en el header
- **Ticks de disponibilidad** para cada pareja por slot
- **Cards de matches muy compactas** y pegadas
- **Botones de acción** al final de cada match
- **Round selector** para filtrar por fase

## 🔄 REUTILIZACIÓN MÁXIMA DE CÓDIGO EXISTENTE

### ✅ COMPONENTES UI (100% reutilizados)
```typescript
// 1. LoadMatchResultDialog - EXACTO como está
import LoadMatchResultDialog from '@/app/(main)/tournaments/[id]/match-scheduling/components/LoadMatchResultDialog'

// 2. useBracketData - Hook completo de datos
import { useBracketData } from '@/components/tournament/bracket-v2/hooks/useBracketData'

// 3. useBracketDragDrop - Lógica drag & drop
import { useBracketDragDrop } from '@/components/tournament/bracket-v2/context/bracket-drag-context'

// 4. SchedulingMatrixV0 - Lógica de disponibilidad
import SchedulingMatrixV0 from '@/app/(main)/tournaments/[id]/match-scheduling/components/SchedulingMatrixV0'

// 5. shadcn components para fechas
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
```

### ✅ FUNCIONES BACKEND (100% reutilizadas)
```typescript
// 1. Data loading
import { getMatchSchedulingData } from '@/app/(main)/tournaments/[id]/match-scheduling/actions'

// 2. Match creation
import { createMatch } from '@/app/(main)/tournaments/[id]/match-scheduling/actions'

// 3. Result updates
import { updateMatchResult } from '@/app/(main)/tournaments/[id]/match-scheduling/actions'

// 4. Drag & drop operations
import { swapBracketPositions } from '@/app/api/tournaments/[id]/actions'
```

### ✅ TIPOS Y INTERFACES (100% reutilizados)
```typescript
import type { ExistingMatch, SchedulingData } from '@/app/(main)/tournaments/[id]/match-scheduling/actions'
import type { BracketMatchV2 } from '@/components/tournament/bracket-v2/types/bracket-types'
import type { SetResult } from '@/app/(main)/tournaments/[id]/match-scheduling/actions'
```

## 🏗️ ARQUITECTURA DE IMPLEMENTACIÓN

### ESTRUCTURA DE ARCHIVOS (Solo componentes nuevos)
```
app/(main)/tournaments/[id]/bracket/
├── page.tsx                          // Página principal con toggle
├── components/
│   ├── LongBracketView.tsx           // Vista bracket horizontal
│   ├── LongScheduleView.tsx          // Vista matriz schedule
│   ├── ScheduleMatrix.tsx            // Matriz compacta de matches
│   ├── MatchMatrixRow.tsx            // Fila de match (2 parejas)
│   ├── ScheduleMatchModal.tsx        // Modal asignar horario
│   └── RoundSelector.tsx             // Selector de round
└── hooks/
    ├── useLongBracketData.ts         // Extend useBracketData
    └── useScheduleMatrix.ts          // Lógica matriz schedule
```

### COMPONENTE PRINCIPAL
```typescript
// app/(main)/tournaments/[id]/long-bracket/page.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import LongBracketView from './components/LongBracketView'
import LongScheduleView from './components/LongScheduleView'

type ViewMode = 'bracket' | 'schedule'

export default function LongBracketPage({ params }: { params: { id: string } }) {
  const [viewMode, setViewMode] = useState<ViewMode>('bracket')

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header con toggle */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant={viewMode === 'bracket' ? 'default' : 'outline'}
            onClick={() => setViewMode('bracket')}
            className="flex items-center gap-2"
          >
            🎾 Bracket View
          </Button>
          <Button
            variant={viewMode === 'schedule' ? 'default' : 'outline'}
            onClick={() => setViewMode('schedule')}
            className="flex items-center gap-2"
          >
            📅 Schedule View
          </Button>
        </div>
      </div>

      {/* Content conditional */}
      <div className="p-6">
        {viewMode === 'bracket' ? (
          <LongBracketView tournamentId={params.id} />
        ) : (
          <LongScheduleView tournamentId={params.id} />
        )}
      </div>
    </div>
  )
}
```

## 🎨 VISTA SCHEDULE - COMPONENTE MATRIZ

### CONCEPTO DETALLADO
```typescript
// components/LongScheduleView.tsx
'use client'

import { useState } from 'react'
import { useBracketData } from '@/components/tournament/bracket-v2/hooks/useBracketData'
import { getMatchSchedulingData } from '@/app/(main)/tournaments/[id]/match-scheduling/actions'
import RoundSelector from './RoundSelector'
import ScheduleMatrix from './ScheduleMatrix'

export default function LongScheduleView({ tournamentId }: { tournamentId: string }) {
  const [selectedRound, setSelectedRound] = useState<Round>('8VOS')

  // Reutilizar hook existente
  const { data: bracketData } = useBracketData(tournamentId)

  // Reutilizar función existente
  const [schedulingData, setSchedulingData] = useState(null)

  // Filtrar matches por round seleccionado
  const roundMatches = bracketData?.matches.filter(m => m.round === selectedRound) || []

  return (
    <div className="space-y-6">
      {/* Round selector */}
      <RoundSelector
        selectedRound={selectedRound}
        onRoundChange={setSelectedRound}
        availableRounds={['8VOS', '4TOS', 'SEMIFINAL', 'FINAL']}
      />

      {/* Matriz schedule */}
      <ScheduleMatrix
        matches={roundMatches}
        timeSlots={schedulingData?.timeSlots || []}
        availability={schedulingData?.availability || []}
        onScheduleMatch={handleScheduleMatch}
        onLoadResult={handleLoadResult}
      />
    </div>
  )
}
```

### MATRIZ SCHEDULE (El componente clave)
```typescript
// components/ScheduleMatrix.tsx
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import MatchMatrixRow from './MatchMatrixRow'

interface ScheduleMatrixProps {
  matches: BracketMatchV2[]
  timeSlots: TimeSlot[]
  availability: AvailabilityItem[]
  onScheduleMatch: (matchId: string) => void
  onLoadResult: (matchId: string) => void
}

export default function ScheduleMatrix({
  matches, timeSlots, availability, onScheduleMatch, onLoadResult
}: ScheduleMatrixProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-48">Match</TableHead>
            {timeSlots.map(slot => (
              <TableHead key={slot.id} className="text-center min-w-24">
                <div className="text-xs">
                  {formatDay(slot.date)}
                </div>
                <div className="text-xs font-mono">
                  {slot.start_time}-{slot.end_time}
                </div>
              </TableHead>
            ))}
            <TableHead className="w-32">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matches.map(match => (
            <MatchMatrixRow
              key={match.id}
              match={match}
              timeSlots={timeSlots}
              availability={availability}
              onScheduleMatch={onScheduleMatch}
              onLoadResult={onLoadResult}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

### FILA DE MATCH (2 parejas + disponibilidad)
```typescript
// components/MatchMatrixRow.tsx
import { TableRow, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

interface MatchMatrixRowProps {
  match: BracketMatchV2
  timeSlots: TimeSlot[]
  availability: AvailabilityItem[]
  onScheduleMatch: (matchId: string) => void
  onLoadResult: (matchId: string) => void
}

export default function MatchMatrixRow({
  match, timeSlots, availability, onScheduleMatch, onLoadResult
}: MatchMatrixRowProps) {

  // Helper para obtener disponibilidad de una pareja en un slot
  const getCoupleAvailability = (coupleId: string, slotId: string) => {
    return availability.find(a =>
      a.couple_id === coupleId && a.time_slot_id === slotId
    )?.is_available || false
  }

  return (
    <>
      {/* Fila de pareja 1 */}
      <TableRow className="border-b-0">
        <TableCell className="border-r bg-slate-50">
          <div className="text-sm font-medium">MATCH {match.position}</div>
          <div className="text-sm">{match.couple1?.name || 'TBD'}</div>
        </TableCell>
        {timeSlots.map(slot => (
          <TableCell key={`${match.couple1?.id}-${slot.id}`} className="text-center border-r">
            <Checkbox
              checked={getCoupleAvailability(match.couple1?.id, slot.id)}
              disabled
              className="mx-auto"
            />
          </TableCell>
        ))}
        <TableCell rowSpan={2} className="text-center">
          <div className="space-y-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onScheduleMatch(match.id)}
              disabled={match.status !== 'PENDING'}
            >
              ⚙️
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => onLoadResult(match.id)}
              disabled={match.status !== 'NOT_STARTED'}
            >
              📊
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {/* Fila de pareja 2 */}
      <TableRow className="border-b-2">
        <TableCell className="border-r bg-slate-50">
          <div className="text-sm">{match.couple2?.name || 'TBD'}</div>
        </TableCell>
        {timeSlots.map(slot => (
          <TableCell key={`${match.couple2?.id}-${slot.id}`} className="text-center border-r">
            <Checkbox
              checked={getCoupleAvailability(match.couple2?.id, slot.id)}
              disabled
              className="mx-auto"
            />
          </TableCell>
        ))}
      </TableRow>
    </>
  )
}
```

## 🎯 MODALES Y ACCIONES

### MODAL ASIGNAR HORARIO (Nuevo)
```typescript
// components/ScheduleMatchModal.tsx
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createMatch } from '@/app/(main)/tournaments/[id]/match-scheduling/actions'

interface ScheduleMatchModalProps {
  match: BracketMatchV2
  open: boolean
  onOpenChange: (open: boolean) => void
  onScheduled: () => void
}

export default function ScheduleMatchModal({
  match, open, onOpenChange, onScheduled
}: ScheduleMatchModalProps) {
  const [date, setDate] = useState<Date>()
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [court, setCourt] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSchedule = async () => {
    if (!date || !startTime || !endTime) return

    setLoading(true)
    try {
      // Reutilizar función existente de match-scheduling
      await createMatch({
        couple1Id: match.couple1.id,
        couple2Id: match.couple2.id,
        date: date.toISOString().split('T')[0],
        startTime,
        endTime,
        court: court || null
      })

      onScheduled()
      onOpenChange(false)
    } catch (error) {
      console.error('Error scheduling match:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar Horario al Partido</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Match</label>
            <p className="text-sm text-slate-600">
              {match.couple1?.name} vs {match.couple2?.name}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Fecha</label>
            <DatePicker value={date} onChange={setDate} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Hora Inicio</label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Hora Fin</label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Cancha (Opcional)</label>
            <Input
              value={court}
              onChange={(e) => setCourt(e.target.value)}
              placeholder="Ej: Cancha 1"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={!date || !startTime || !endTime || loading}
          >
            {loading ? 'Asignando...' : 'Asignar Horario'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### LOAD RESULT - REUTILIZACIÓN EXACTA
```typescript
// En LongScheduleView.tsx
import LoadMatchResultDialog from '@/app/(main)/tournaments/[id]/match-scheduling/components/LoadMatchResultDialog'

const [resultMatch, setResultMatch] = useState<BracketMatchV2 | null>(null)

const handleLoadResult = (matchId: string) => {
  const match = matches.find(m => m.id === matchId)
  setResultMatch(match)
}

// En el JSX
<LoadMatchResultDialog
  match={resultMatch}
  open={!!resultMatch}
  onOpenChange={() => setResultMatch(null)}
  onResultSaved={() => {
    // Auto-advance ganador + marcar perdedor eliminado
    // Reutilizar lógica de ImprovedBracketRenderer
    setResultMatch(null)
    refetchData()
  }}
/>
```

## 📱 RESPONSIVE DESIGN

### Desktop (1024px+)
- Matriz completa visible
- Scroll horizontal si muchos time slots
- Headers sticky

### Tablet (768px-1024px)
- Matriz con scroll horizontal optimizado
- Botones de acción más grandes
- Headers sticky

### Mobile (320px-768px)
- Cambiar a cards apiladas
- Un match por "card"
- Disponibilidad en modal
- Botones prominentes

## ⚡ PERFORMANCE & OPTIMIZACIÓN

### Lazy Loading
```typescript
// Solo cargar data cuando se necesita
const { data: schedulingData } = useScheduleMatrix(tournamentId, selectedRound)
```

### Virtual Scrolling
```typescript
// Para torneos con muchos matches (64 parejas)
import { VirtualizedList } from '@tanstack/react-virtual'
```

### Batch Operations
```typescript
// Actualizar múltiples matches de una vez
const handleBatchUpdateAvailability = async (updates: AvailabilityUpdate[]) => {
  await Promise.all(updates.map(update => updateAvailability(update)))
}
```

## 🚀 PLAN DE IMPLEMENTACIÓN

### FASE 1: Setup Base (2-3 días)
- ✅ Migraciones aplicadas
- 📁 Estructura de archivos
- 🔄 Página principal con toggle

### FASE 2: Vista Bracket (2-3 días)
- 🎾 LongBracketView horizontal
- 🖱️ Drag & drop integration
- 📊 LoadMatchResultDialog integration

### FASE 3: Vista Schedule - Matriz (3-4 días)
- 📅 ScheduleMatrix component
- 📋 MatchMatrixRow component
- ⚙️ ScheduleMatchModal

### FASE 4: Integración de Datos (2-3 días)
- 🔄 useLongBracketData hook
- 📊 useScheduleMatrix hook
- 🔗 API integrations

### FASE 5: Optimización & Testing (2-3 días)
- 📱 Responsive design
- ⚡ Performance optimizations
- 🧪 Testing & bug fixes

### FASE 6: Polish & Documentation (1-2 días)
- 🎨 UI/UX refinements
- 📚 Documentation updates
- 🚀 Deployment

**TOTAL ESTIMADO: 12-18 días**

---

## 🎯 RESULTADO FINAL

Una interfaz dual que combina:
- ✅ **Bracket View**: Layout horizontal tradicional con drag & drop
- ✅ **Schedule View**: Matriz compacta con disponibilidad inline
- ✅ **Reutilización máxima**: 90%+ código existente
- ✅ **LoadMatchResultDialog**: Exactamente como está
- ✅ **shadcn components**: Para fecha/hora
- ✅ **Performance optimizada**: Para 32-64 parejas
- ✅ **Responsive design**: Mobile, tablet, desktop
- ✅ **Auto-eliminación**: Marca perdedores automáticamente

**La matriz de schedule será la innovación clave que diferencia esta implementación de las existentes.**