# Mobile Bottom Sheet - Documentación

## 📱 Resumen

Sistema de movimiento de parejas en mobile usando Bottom Sheet nativo, reemplazando el drag & drop que no funciona en dispositivos móviles.

---

## 🎯 Problema Original

**Drag & Drop HTML5 no funciona en mobile:**
- No se puede arrastrar
- Solo selecciona texto
- Experiencia frustrante para usuarios móviles

---

## ✅ Solución Implementada

**Bottom Sheet con tap-to-move:**
1. Usuario toca pareja → Abre Bottom Sheet
2. Sheet muestra lista de zonas disponibles
3. Usuario toca zona → Pareja se mueve
4. O toca "Pool" → Pareja vuelve al pool
5. O cierra sheet → Cancela

---

## 📂 Archivos Principales

### 1. **MoveCoupleMobileSheet.tsx** (Nuevo)
**Ubicación:** `components/tournament/zones/components/MoveCoupleMobileSheet.tsx`

**Propósito:** Componente Bottom Sheet para mobile

**Props:**
```typescript
interface MoveCoupleMobileSheetProps {
  open: boolean                    // Controla visibilidad
  onOpenChange: (open: boolean)    // Callback para cerrar
  selectedCouple: {
    id: string
    name: string
    sourceZoneId: string | null    // null = viene del pool
  }
  zones: ZoneOption[]              // Lista de zonas disponibles
  onMoveToZone: (zoneId: string)   // Handler para mover a zona
  onMoveToPool: ()                 // Handler para devolver al pool
  showPoolOption: boolean          // Mostrar opción de pool
}
```

**UI:**
- Lista scrolleable de zonas
- Indicador verde/gris según disponibilidad
- Badge "Llena" si zona está al máximo
- Separador visual antes de opción "Pool"
- Botón cancelar en footer

---

### 2. **use-drag-drop.ts** (Modificado)
**Ubicación:** `components/tournament/zones/hooks/use-drag-drop.ts`

**Cambios:**
```typescript
// Agregado al return (línea 333-335):
createOperation,              // Crear operación sin drag state
addPendingOperation,         // Agregar operación directamente
```

**Por qué:** Permite crear operaciones manualmente sin simular drag & drop.

---

### 3. **TournamentZonesMatrix.tsx** (Modificado)
**Ubicación:** `components/tournament/zones/TournamentZonesMatrix.tsx`

**Cambios:**

#### A. Importar Bottom Sheet (línea 40)
```typescript
import { MoveCoupleMobileSheet } from './components/MoveCoupleMobileSheet'
```

#### B. Desestructurar helpers (línea 133-135)
```typescript
validateDrop,           // Validar operación
createOperation,        // Crear operación
addPendingOperation    // Agregar a pending
```

#### C. Handler: Mover a Zona (línea 389-439)
```typescript
const handleMoveToZoneFromSheet = useCallback((targetZoneId: string) => {
  // 1. Crear drag item
  const dragItem = selectedCoupleForMove.sourceZoneId
    ? { type: 'zone-couple', ... }
    : { type: 'available-couple', ... }

  // 2. Crear drop target
  const dropTarget = createDropTarget('zone', targetZoneId, ...)

  // 3. Validar (síncrono)
  const validation = validateDrop(dragItem, dropTarget, zoneCounts)
  if (!validation.valid) {
    toast.error(validation.reason)
    return  // Early return
  }

  // 4. Crear operación
  const operation = createOperation(dragItem, dropTarget)

  // 5. Optimistic update
  optimisticUpdate(...)

  // 6. Agregar a pending
  addPendingOperation(operation)

  // 7. Feedback
  toast.success('Pareja movida')
}, [...])
```

#### D. Handler: Mover a Pool (línea 441-484)
```typescript
const handleMoveToPoolFromSheet = useCallback(() => {
  // Mismo patrón que handleMoveToZoneFromSheet
  // pero con dropTarget = 'available-pool'
}, [...])
```

#### E. Renderizar Sheet (línea 626-648)
```typescript
{isMobile && selectedCoupleForMove && (
  <MoveCoupleMobileSheet
    open={!!selectedCoupleForMove}
    onOpenChange={(open) => {
      if (!open) setSelectedCoupleForMove(null)
    }}
    selectedCouple={{...}}
    zones={enhancedZones.map(zone => ({
      id: zone.id,
      name: zone.name,
      currentSize: zone.couples.length,
      capacity: zone.capacity,
      canReceive: zone.couples.length < zone.capacity
    }))}
    onMoveToZone={handleMoveToZoneFromSheet}
    onMoveToPool={handleMoveToPoolFromSheet}
    showPoolOption={!!selectedCoupleForMove.sourceZoneId}
  />
)}
```

---

### 4. **CoupleRow.tsx** (Modificado)
**Ubicación:** `components/tournament/zones/components/CoupleRow.tsx`

**Cambios (línea 151-162):**
```typescript
const handleCoupleTap = () => {
  if (!isMobile || !isEditMode || !canDrag || !onCoupleSelect) return

  // Abrir bottom sheet con datos de pareja
  onCoupleSelect({
    coupleId: couple.id,
    coupleName: `${couple.player1Name} / ${couple.player2Name}`,
    sourceZoneId: isInZone && zoneId ? zoneId : null
  })
}
```

**onClick en TableRow (línea 180):**
```typescript
onClick={isMobile && isEditMode ? handleCoupleTap : undefined}
```

---

### 5. **ZoneCard.tsx** (Limpiado)
**Ubicación:** `components/tournament/zones/components/ZoneCard.tsx`

**Removido:**
- ❌ `handleZoneTap` handler
- ❌ `isSelectionMode` variable
- ❌ Clases CSS de selección móvil
- ❌ `onClick` del Card

**Por qué:** Ya no se necesita tap en zonas, se usa Bottom Sheet.

---

### 6. **UnassignedPool.tsx** (Limpiado)
**Ubicación:** `components/tournament/zones/components/UnassignedPool.tsx`

**Removido:**
- ❌ `handlePoolTap` handler
- ❌ `isSelectionMode` y `canReceive` variables
- ❌ Clases CSS de selección móvil
- ❌ `onClick` del Card

**Por qué:** Ya no se necesita tap en pool, se usa Bottom Sheet.

---

## 🔄 Flujo Completo

### Desktop (Drag & Drop)
```
1. Usuario arrastra pareja
2. Sistema valida drop target
3. Crea operación
4. Optimistic update
5. Agrega a pending operations
6. Toast de confirmación
```

### Mobile (Bottom Sheet)
```
1. Usuario toca pareja
   ↓
2. CoupleRow.handleCoupleTap() ejecuta onCoupleSelect()
   ↓
3. TournamentZonesMatrix actualiza selectedCoupleForMove
   ↓
4. MoveCoupleMobileSheet se renderiza (open=true)
   ↓
5. Usuario toca zona en sheet
   ↓
6. handleMoveToZoneFromSheet():
   - Valida operación (síncrono)
   - Crea operación manualmente
   - Optimistic update
   - Agrega a pending operations
   - Toast de confirmación
   ↓
7. Sheet se cierra (setSelectedCoupleForMove(null))
```

---

## 🐛 Bug Arreglado

### Problema
Al tocar zona en Bottom Sheet salía error: **"No hay elemento siendo arrastrado"**

### Causa
Los handlers llamaban `startDrag()` seguido de `handleDrop()`. Como React actualiza estado de forma asíncrona, `handleDrop()` se ejecutaba antes de que `draggedItem` estuviera en el estado.

### Solución
Eliminar simulación de drag & drop. Crear operaciones manualmente:
```typescript
// ❌ ANTES (con bug):
startDrag(dragItem)      // Estado asíncrono
handleDrop(...)          // Lee estado que no existe
endDrag()

// ✅ DESPUÉS (sin bug):
validateDrop(...)        // Validación síncrona
createOperation(...)     // Crear operación
addPendingOperation(...) // Agregar directamente
```

---

## ✅ Validación

**Validación síncrona en mobile:**
- Verifica capacidad de zona
- Verifica parejas con partidos activos (restricted)
- Verifica reglas del formato de torneo
- Mismo sistema que drag & drop desktop

**Feedback visual:**
- Zona disponible: Verde con indicador
- Zona llena: Gris con badge "Llena"
- Error: Toast rojo con mensaje
- Éxito: Toast verde con confirmación

---

## 📊 Testing

### Mobile
✅ Tap pareja → Sheet abre
✅ Tap zona válida → Mueve sin error
✅ Tap zona llena → Toast de error
✅ Tap pareja de zona → Tap pool → Devuelve
✅ Cerrar sheet → Cancela operación

### Desktop
✅ Drag & drop funciona normalmente
✅ Validaciones funcionan igual
✅ Optimistic updates funcionan

---

## 🎨 Componentes UI Usados

**shadcn/ui:**
- `Sheet` - Bottom sheet container
- `SheetContent` - Contenido con side="bottom"
- `SheetHeader` - Título y descripción
- `SheetTitle` - Nombre de la pareja
- `SheetDescription` - Info adicional
- `SheetFooter` - Botón cancelar
- `Button` - Botones de zona y pool
- `Badge` - Indicador "Llena"

**Iconos (lucide-react):**
- `MapPin` - Icono de zona
- `Users` - Icono de pool
- `ChevronRight` - Indicador de acción

---

## 🔧 Mantenimiento

### Agregar nueva validación:
1. Modificar `validateDrop()` en `use-drag-drop.ts`
2. Automáticamente funciona en desktop y mobile

### Cambiar UI del sheet:
1. Modificar `MoveCoupleMobileSheet.tsx`
2. No afecta lógica de negocio

### Cambiar flujo de operaciones:
1. Modificar handlers en `TournamentZonesMatrix.tsx`
2. Mantener el patrón: validate → create → update → add → toast

---

## 📝 Notas

- Bottom Sheet usa Radix UI (accesible por defecto)
- Detección mobile: `/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)`
- Sheet se renderiza condicionalmente solo en mobile
- Desktop sigue usando drag & drop nativo
- Ambos flujos comparten misma validación y lógica de negocio
