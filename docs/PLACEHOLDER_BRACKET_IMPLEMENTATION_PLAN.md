# PLAN DE IMPLEMENTACIÓN - BRACKETS CON PLACEHOLDERS

## 📋 RESUMEN EJECUTIVO

Este documento detalla el plan completo para implementar brackets con placeholders en el frontend, manteniendo la funcionalidad de drag & drop existente y el algoritmo hybrid-serpentino.

### 🎯 OBJETIVO
Permitir que el usuario genere brackets antes de que terminen todas las zonas, usando placeholders para posiciones no definitivas y parejas reales para posiciones definitivas.

### ✅ REQUERIMIENTOS CONFIRMADOS
1. **Condición previa**: Todos los partidos de zona CREADOS (no necesariamente jugados)
   - Zona 4 parejas: 4 partidos total (2 por pareja)
   - Zona 3 parejas: 3 partidos total (2 por pareja)

2. **Algoritmo**: Mantener hybrid-serpentino exacto (1A vs 1B solo en final)

3. **BYEs**: Seguir funcionando automáticamente como siempre

4. **Drag & Drop**: Mantener funcionalidad existente + extensión para placeholders

5. **Resolución automática**: Triggers cuando posiciones se vuelven definitivas

---

## 🏗️ ARQUITECTURA ACTUAL ANALIZADA

### ✅ SISTEMA BRACKET V2 EXISTENTE
- **Componente principal**: `BracketVisualizationV2.tsx`
- **Drag & Drop completo**: `BracketDragDropProvider` + contexto
- **Tipos robustos**: `bracket-types.ts` + `placeholder-types.ts` (YA EXISTEN)
- **Múltiples renderers**: Modular y extensible

### ✅ BACKEND YA IMPLEMENTADO
- **`PlaceholderBracketGenerator`**: Clase completa en `lib/services/bracket-generator-v2.ts`
- **Base de datos**: Tablas `tournament_couple_seeds`, `placeholder_resolutions`, `matches` con campos placeholder
- **Algoritmo definitivo**: `CorrectedDefinitiveAnalyzer` funcional

### 🔧 COMPONENTE DE GENERACIÓN ACTUAL
- **Ubicación**: `components/tournament/bracket-generation-section.tsx`
- **Integración**: En `TournamentZonesTab` → sección "Llaves"
- **Estado actual**: Solo genera brackets tradicionales
- **Acción actual**: `generateZoneAwareBracketAction(tournamentId)`

---

## 📝 FASES DE IMPLEMENTACIÓN

### 🔥 FASE 1: ENDPOINT DE GENERACIÓN CON PLACEHOLDERS
**PRIORIDAD: CRÍTICA** - Base de todo el sistema

#### 1.1 Crear Nuevo Action
**Archivo**: `app/api/tournaments/[id]/actions.ts`

```typescript
/**
 * Genera bracket con placeholders usando PlaceholderBracketGenerator
 */
export async function generatePlaceholderBracketAction(tournamentId: string) {
  try {
    // 1. Validar condición previa: todos los partidos creados
    await validateAllZoneMatchesCreated(tournamentId)
    
    // 2. Ejecutar algoritmo de posiciones definitivas
    const definitiveResult = await updateDefinitivePositions(tournamentId)
    
    // 3. Usar PlaceholderBracketGenerator (YA EXISTE)
    const generator = new PlaceholderBracketGenerator()
    
    // 4. Generar seeding híbrido
    const seeds = await generator.generatePlaceholderSeeding(tournamentId)
    
    // 5. Generar matches con placeholders
    const matches = await generator.generateBracketMatches(seeds, tournamentId)
    
    // 6. Crear jerarquía de matches
    const hierarchy = await generator.createMatchHierarchy(matches, tournamentId)
    
    // 7. Guardar en base de datos
    await savePlaceholderBracketToDatabase(tournamentId, seeds, matches, hierarchy)
    
    // 8. Transicionar torneo a BRACKET_PHASE
    await updateTournamentPhase(tournamentId, 'BRACKET_PHASE')
    
    return {
      success: true,
      message: 'Bracket con placeholders generado exitosamente',
      data: {
        totalSeeds: seeds.length,
        definitiveSeeds: seeds.filter(s => !s.is_placeholder).length,
        placeholderSeeds: seeds.filter(s => s.is_placeholder).length,
        totalMatches: matches.length,
        byeMatches: matches.filter(m => m.status === 'BYE').length,
        definitiveAnalysis: definitiveResult
      }
    }
  } catch (error) {
    return {
      success: false,
      message: error.message,
      error: error
    }
  }
}

/**
 * Valida que todos los partidos de zona estén creados
 */
async function validateAllZoneMatchesCreated(tournamentId: string) {
  const zones = await supabase
    .from('zones')
    .select('id, name')
    .eq('tournament_id', tournamentId)
  
  for (const zone of zones.data || []) {
    // Contar parejas en la zona
    const { count: coupleCount } = await supabase
      .from('zone_positions')
      .select('*', { count: 'exact' })
      .eq('zone_id', zone.id)
    
    // Contar partidos creados
    const { count: matchCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact' })
      .eq('zone_id', zone.id)
    
    // Validar según lógica de American 2
    const expectedMatches = coupleCount === 4 ? 4 : 3 // 2 partidos por pareja
    
    if (matchCount < expectedMatches) {
      throw new Error(
        `Zona ${zone.name}: faltan ${expectedMatches - matchCount} partidos por crear. ` +
        `Creados: ${matchCount}, Esperados: ${expectedMatches}`
      )
    }
  }
}
```

#### 1.2 Funciones de Soporte
```typescript
/**
 * Guarda bracket con placeholders en base de datos
 */
async function savePlaceholderBracketToDatabase(
  tournamentId: string,
  seeds: PlaceholderSeed[],
  matches: BracketMatch[],
  hierarchy: MatchHierarchy[]
) {
  // 1. Limpiar datos existentes si los hay
  await supabase.from('tournament_couple_seeds').delete().eq('tournament_id', tournamentId)
  await supabase.from('matches').delete().eq('tournament_id', tournamentId).eq('phase', 'BRACKET_PHASE')
  await supabase.from('match_hierarchy').delete().eq('tournament_id', tournamentId)
  
  // 2. Insertar seeds con placeholders
  const seedsData = seeds.map(seed => ({
    tournament_id: tournamentId,
    seed: seed.seed,
    bracket_position: seed.bracket_position,
    couple_id: seed.couple_id,
    zone_id: seed.zone_id,
    is_placeholder: seed.is_placeholder,
    placeholder_zone_id: seed.placeholder_zone_id,
    placeholder_position: seed.placeholder_position,
    placeholder_label: seed.placeholder_label,
    created_as_placeholder: seed.created_as_placeholder
  }))
  
  await supabase.from('tournament_couple_seeds').insert(seedsData)
  
  // 3. Insertar matches con placeholders
  const matchesData = matches.map(match => ({
    id: match.id,
    tournament_id: tournamentId,
    couple1_id: match.couple1_id,
    couple2_id: match.couple2_id,
    placeholder_couple1_label: match.placeholder_couple1_label,
    placeholder_couple2_label: match.placeholder_couple2_label,
    round: match.round,
    order_in_round: match.order_in_round,
    status: match.status,
    type: match.type,
    phase: 'BRACKET_PHASE'
  }))
  
  await supabase.from('matches').insert(matchesData)
  
  // 4. Insertar jerarquía
  await supabase.from('match_hierarchy').insert(hierarchy)
}
```

### 🔧 FASE 2: MODIFICAR COMPONENTE DE GENERACIÓN
**PRIORIDAD: ALTA** - Interfaz de usuario

#### 2.1 Extender BracketGenerationSection
**Archivo**: `components/tournament/bracket-generation-section.tsx`

```typescript
interface BracketGenerationSectionProps {
  tournamentId: string
  tournamentStatus: string
  bracketStatus?: string
  canGenerateBracket?: boolean
  totalCouples: number
  totalZones: number
  onBracketGenerated?: () => void
  // NUEVO
  enablePlaceholders?: boolean
  allZoneMatchesCreated?: boolean
}

export default function BracketGenerationSection({
  // ... props existentes
  enablePlaceholders = true, // DEFAULT: habilitar placeholders
  allZoneMatchesCreated = false
}: BracketGenerationSectionProps) {
  // NUEVO: Estado para tipo de bracket
  const [bracketType, setBracketType] = useState<'placeholder' | 'traditional'>('placeholder')
  const [placeholderInfo, setPlaceholderInfo] = useState<any>(null)
  
  // NUEVO: Validación específica para placeholders
  const canGeneratePlaceholderBracket = () => {
    return (
      tournamentStatus === 'ZONE_PHASE' &&
      bracketStatus !== 'BRACKET_GENERATED' &&
      totalCouples >= 4 &&
      allZoneMatchesCreated // NUEVA CONDICIÓN
    )
  }
  
  // MODIFICAR: Handler de generación
  const handleGenerateBracket = async () => {
    if (isGenerating) return
    setIsGenerating(true)
    
    try {
      let result
      
      if (bracketType === 'placeholder') {
        // NUEVO: Usar action de placeholders
        result = await generatePlaceholderBracketAction(tournamentId)
        
        if (result.success) {
          setPlaceholderInfo(result.data)
          toast({
            title: "¡Bracket con placeholders generado!",
            description: `${result.data.definitiveSeeds} posiciones definitivas, ${result.data.placeholderSeeds} placeholders`,
            duration: 5000,
          })
        }
      } else {
        // EXISTENTE: Usar action tradicional
        result = await generateZoneAwareBracketAction(tournamentId)
        
        if (result.success) {
          setBracketResult(result)
          toast({
            title: "¡Bracket tradicional generado!",
            description: `${result.totalMatches} matches creados`,
            duration: 5000,
          })
        }
      }
      
      if (!result.success) {
        toast({
          title: "Error al generar bracket",
          description: result.message,
          variant: "destructive",
        })
      } else {
        onBracketGenerated?.()
      }
    } catch (error) {
      toast({
        title: "Error inesperado",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }
  
  return (
    <Card className={/* ... estilos existentes */}>
      <CardHeader>
        {/* ... header existente */}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ... información existente */}
        
        {/* NUEVO: Selector de tipo de bracket */}
        {shouldShowGenerateButton() && enablePlaceholders && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-slate-700">Tipo de Bracket:</div>
            <div className="flex gap-2">
              <Button 
                variant={bracketType === 'placeholder' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setBracketType('placeholder')}
                className="flex-1"
              >
                🔄 Con Placeholders
              </Button>
              <Button 
                variant={bracketType === 'traditional' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setBracketType('traditional')}
                className="flex-1"
              >
                ⏳ Tradicional
              </Button>
            </div>
            
            {/* Descripción del tipo seleccionado */}
            <div className="text-xs text-slate-600 p-2 bg-slate-50 rounded">
              {bracketType === 'placeholder' ? (
                <div>
                  <strong>Con Placeholders:</strong> Genera el bracket inmediatamente usando 
                  posiciones definitivas conocidas y placeholders ("1A", "2B") para posiciones 
                  que aún pueden cambiar. Se actualizará automáticamente.
                </div>
              ) : (
                <div>
                  <strong>Tradicional:</strong> Espera a que terminen todas las zonas antes 
                  de generar el bracket con todas las posiciones finales conocidas.
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODIFICAR: Botón de generar */}
        {shouldShowGenerateButton() && (
          <Button
            onClick={handleGenerateBracket}
            disabled={isGenerating || (bracketType === 'placeholder' && !allZoneMatchesCreated)}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {bracketType === 'placeholder' 
                  ? 'Generando Bracket con Placeholders...' 
                  : 'Generando Bracket Tradicional...'
                }
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                {bracketType === 'placeholder' 
                  ? 'Generar Bracket con Placeholders' 
                  : 'Generar Bracket Tradicional'
                }
                <ArrowRight className="h-4 w-4" />
              </div>
            )}
          </Button>
        )}
        
        {/* NUEVO: Información sobre placeholders generados */}
        {placeholderInfo && (
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
              🔄 Bracket con Placeholders Generado
            </h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-lg font-bold text-blue-700">{placeholderInfo.definitiveSeeds}</div>
                <div className="text-slate-600">Definitivas</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-700">{placeholderInfo.placeholderSeeds}</div>
                <div className="text-slate-600">Placeholders</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-700">{placeholderInfo.totalMatches}</div>
                <div className="text-slate-600">Matches</div>
              </div>
            </div>
          </div>
        )}

        {/* ... resto del componente existente */}
      </CardContent>
    </Card>
  )
}
```

#### 2.2 Hook para Validación de Partidos
**Archivo**: `hooks/use-zone-matches-validation.ts`

```typescript
/**
 * Hook para validar que todos los partidos de zona estén creados
 */
export function useZoneMatchesValidation(tournamentId: string) {
  const [validation, setValidation] = useState<{
    allCreated: boolean
    zones: Array<{
      id: string
      name: string
      couplesCount: number
      matchesCreated: number
      matchesExpected: number
      isComplete: boolean
    }>
    loading: boolean
  }>({
    allCreated: false,
    zones: [],
    loading: true
  })

  const validateMatches = useCallback(async () => {
    setValidation(prev => ({ ...prev, loading: true }))
    
    try {
      // Obtener zonas
      const { data: zones } = await supabase
        .from('zones')
        .select('id, name')
        .eq('tournament_id', tournamentId)

      const zoneValidations = []
      let allComplete = true

      for (const zone of zones || []) {
        // Contar parejas
        const { count: couplesCount } = await supabase
          .from('zone_positions')
          .select('*', { count: 'exact' })
          .eq('zone_id', zone.id)

        // Contar partidos
        const { count: matchesCreated } = await supabase
          .from('matches')
          .select('*', { count: 'exact' })
          .eq('zone_id', zone.id)

        // Calcular esperados (American 2: 2 partidos por pareja)
        const matchesExpected = couplesCount === 4 ? 4 : 3
        const isComplete = matchesCreated >= matchesExpected

        if (!isComplete) allComplete = false

        zoneValidations.push({
          id: zone.id,
          name: zone.name,
          couplesCount,
          matchesCreated,
          matchesExpected,
          isComplete
        })
      }

      setValidation({
        allCreated: allComplete,
        zones: zoneValidations,
        loading: false
      })
    } catch (error) {
      console.error('Error validating zone matches:', error)
      setValidation(prev => ({ ...prev, loading: false }))
    }
  }, [tournamentId])

  useEffect(() => {
    if (tournamentId) {
      validateMatches()
    }
  }, [tournamentId, validateMatches])

  return {
    ...validation,
    refetch: validateMatches
  }
}
```

### 📊 FASE 3: ADAPTAR TIPOS DE DATOS
**PRIORIDAD: MEDIA** - Extensión de tipos existentes

#### 3.1 Extender BracketMatchV2
**Archivo**: `components/tournament/bracket-v2/types/bracket-types.ts`

```typescript
export interface BracketMatchV2 {
  // ... campos existentes ...
  
  // CAMPOS DE PLACEHOLDER
  placeholder_couple1_label?: string | null
  placeholder_couple2_label?: string | null
  is_placeholder_match?: boolean
  
  // METADATOS DE RESOLUCIÓN
  placeholder_resolution?: {
    can_be_resolved: boolean
    resolution_confidence: number
    expected_resolution_time?: string
    auto_resolve_enabled: boolean
  }
  
  // INFORMACIÓN DE ESTADO PLACEHOLDER
  placeholder_status?: {
    total_placeholders: number
    resolved_placeholders: number
    definitive_placeholders: number
    pending_placeholders: number
  }
}

export interface CoupleData {
  // ... campos existentes ...
  
  // PLACEHOLDER INFO
  is_placeholder?: boolean
  placeholder_info?: PlaceholderInfo
  
  // METADATOS DE RESOLUCIÓN
  resolution_data?: {
    resolved_from_placeholder?: string
    resolved_at?: string
    resolution_method?: 'automatic' | 'manual' | 'trigger'
  }
}

// NUEVO: Estado específico para matches con placeholders
export type PlaceholderMatchStatus = 
  | 'WAITING_OPPONENT'      // Match con al menos un placeholder
  | 'PARTIALLY_RESOLVED'    // Match con un placeholder resuelto
  | 'FULLY_RESOLVED'        // Match sin placeholders (se convierte en PENDING)
  | 'PLACEHOLDER_ERROR'     // Error en resolución de placeholder
```

### 🖱️ FASE 4: EXTENDER DRAG & DROP PARA PLACEHOLDERS
**PRIORIDAD: ALTA** - Funcionalidad crítica

#### 4.1 Modificar Lógica de Drag & Drop
**Archivo**: `hooks/useBracketDragOperations.ts`

```typescript
/**
 * Extiende la lógica de drag & drop para soportar placeholders
 */
interface PlaceholderDragConfig extends DragDropConfig {
  // NUEVO: Configuración específica para placeholders
  allowPlaceholderDrop: boolean
  allowPartialResolution: boolean
  autoResolveOnDrop: boolean
}

export function useBracketDragOperations({
  tournamentId,
  isOwner,
  config
}: {
  tournamentId: string
  isOwner: boolean
  config: PlaceholderDragConfig
}) {
  // ... lógica existente ...

  // NUEVO: Validación extendida para placeholders
  const canDragFromMatch = useCallback((match: BracketMatchV2, coupleId: string): boolean => {
    // Lógica existente para matches normales
    if (match.status === 'PENDING') return true
    
    // NUEVA LÓGICA PARA PLACEHOLDERS
    if (match.is_placeholder_match && match.status === 'WAITING_OPPONENT') {
      // Permitir drag de parejas reales desde matches con placeholders
      const isDraggingRealCouple = (
        (match.couple1_id === coupleId && !match.placeholder_couple1_label) ||
        (match.couple2_id === coupleId && !match.placeholder_couple2_label)
      )
      
      return isDraggingRealCouple && config.allowPlaceholderDrop
    }
    
    return false
  }, [config.allowPlaceholderDrop])

  // NUEVO: Validación de drop en placeholders
  const canDropOnMatch = useCallback((
    targetMatch: BracketMatchV2, 
    draggedCoupleId: string,
    targetSlot?: 1 | 2
  ): boolean => {
    // Lógica existente para matches normales
    if (targetMatch.status === 'PENDING') return true
    
    // NUEVA LÓGICA PARA PLACEHOLDERS
    if (targetMatch.is_placeholder_match && targetMatch.status === 'WAITING_OPPONENT') {
      // Verificar si hay slots con placeholders disponibles
      const slot1IsPlaceholder = !targetMatch.couple1_id && targetMatch.placeholder_couple1_label
      const slot2IsPlaceholder = !targetMatch.couple2_id && targetMatch.placeholder_couple2_label
      
      if (targetSlot) {
        // Drop en slot específico
        return targetSlot === 1 ? slot1IsPlaceholder : slot2IsPlaceholder
      } else {
        // Drop general - al menos un slot debe ser placeholder
        return slot1IsPlaceholder || slot2IsPlaceholder
      }
    }
    
    return false
  }, [])

  // NUEVO: Handler específico para drop en placeholders
  const handlePlaceholderDrop = useCallback(async (
    targetMatch: BracketMatchV2,
    draggedCoupleId: string,
    sourceMatch: BracketMatchV2,
    targetSlot: 1 | 2
  ) => {
    try {
      // 1. Preparar datos de actualización
      const updateData: Partial<BracketMatchV2> = {}
      
      // 2. Reemplazar placeholder con pareja real
      if (targetSlot === 1) {
        updateData.couple1_id = draggedCoupleId
        updateData.placeholder_couple1_label = null
      } else {
        updateData.couple2_id = draggedCoupleId
        updateData.placeholder_couple2_label = null
      }
      
      // 3. Verificar si match se vuelve completamente resuelto
      const otherSlotHasCouple = targetSlot === 1 
        ? targetMatch.couple2_id 
        : targetMatch.couple1_id
        
      const otherSlotIsPlaceholder = targetSlot === 1
        ? targetMatch.placeholder_couple2_label
        : targetMatch.placeholder_couple1_label
      
      if (otherSlotHasCouple && !otherSlotIsPlaceholder) {
        // Match completamente resuelto
        updateData.status = 'PENDING'
        updateData.is_placeholder_match = false
        updateData.placeholder_status = {
          total_placeholders: 0,
          resolved_placeholders: 2,
          definitive_placeholders: 0,
          pending_placeholders: 0
        }
      } else {
        // Match parcialmente resuelto
        updateData.status = 'PARTIALLY_RESOLVED'
        updateData.placeholder_status = {
          total_placeholders: 2,
          resolved_placeholders: 1,
          definitive_placeholders: 0,
          pending_placeholders: 1
        }
      }
      
      // 4. Actualizar source match (liberar slot)
      const sourceUpdateData: Partial<BracketMatchV2> = {}
      if (sourceMatch.couple1_id === draggedCoupleId) {
        sourceUpdateData.couple1_id = null
        sourceUpdateData.placeholder_couple1_label = generatePlaceholderLabel(sourceMatch, 1)
      } else {
        sourceUpdateData.couple2_id = null
        sourceUpdateData.placeholder_couple2_label = generatePlaceholderLabel(sourceMatch, 2)
      }
      
      // 5. Ejecutar actualizaciones en paralelo
      await Promise.all([
        updateMatchInDatabase(targetMatch.id, updateData),
        updateMatchInDatabase(sourceMatch.id, sourceUpdateData)
      ])
      
      // 6. Trigger resolución automática si está habilitada
      if (config.autoResolveOnDrop) {
        await triggerPlaceholderResolution(tournamentId)
      }
      
      // 7. Notificar éxito
      return {
        success: true,
        message: 'Pareja movida a placeholder exitosamente',
        targetMatchUpdated: updateData,
        sourceMatchUpdated: sourceUpdateData
      }
      
    } catch (error) {
      console.error('Error in placeholder drop:', error)
      return {
        success: false,
        message: error.message,
        error
      }
    }
  }, [config.autoResolveOnDrop, tournamentId])

  // MODIFICAR: Handler principal de drop
  const handleDrop = useCallback(async (dropData: any) => {
    const { targetMatch, draggedCoupleId, sourceMatch, targetSlot } = dropData
    
    // Detectar tipo de drop
    if (targetMatch.is_placeholder_match) {
      // Drop en match con placeholders
      return await handlePlaceholderDrop(targetMatch, draggedCoupleId, sourceMatch, targetSlot)
    } else {
      // Drop normal (lógica existente)
      return await handleNormalDrop(dropData)
    }
  }, [handlePlaceholderDrop])

  return {
    // ... métodos existentes ...
    
    // NUEVOS métodos para placeholders
    canDragFromMatch,
    canDropOnMatch,
    handlePlaceholderDrop,
    handleDrop // MODIFICADO
  }
}

// NUEVA: Función auxiliar para generar labels de placeholder
function generatePlaceholderLabel(match: BracketMatchV2, slot: 1 | 2): string {
  // Lógica para generar label basado en jerarquía del match
  // Por ejemplo: "Ganador Match 1", "Perdedor Semifinal A", etc.
  const round = match.round
  const orderInRound = match.order_in_round
  
  return `${round === 'FINAL' ? 'Finalista' : 'Ganador'} ${round} ${orderInRound}`
}
```

#### 4.2 Actualizar Context de Drag & Drop
**Archivo**: `components/tournament/bracket-v2/context/bracket-drag-context.tsx`

```typescript
// NUEVO: Tipos para placeholder drag operations
interface PlaceholderDragItem extends BracketDragItem {
  isFromPlaceholder?: boolean
  placeholderLabel?: string
  resolutionState?: PlaceholderResolutionState
}

interface PlaceholderDropTarget extends BracketDropTarget {
  acceptsPlaceholders?: boolean
  placeholderSlot?: 1 | 2
  currentPlaceholderLabel?: string
}

// MODIFICAR: Estado del context para incluir placeholders
interface ExtendedBracketDragState {
  // ... campos existentes ...
  
  // NUEVO: Estado específico para placeholders
  placeholderOperations: Array<{
    id: string
    type: 'resolve' | 'swap' | 'clear'
    targetMatchId: string
    targetSlot: 1 | 2
    coupleId?: string
    placeholderLabel?: string
    timestamp: string
    status: 'pending' | 'processing' | 'completed' | 'error'
  }>
  
  autoResolution: {
    enabled: boolean
    inProgress: boolean
    lastTriggered?: string
  }
}

// NUEVO: Acciones específicas para placeholders
type PlaceholderDragAction = 
  | { type: 'ADD_PLACEHOLDER_OPERATION'; payload: { operation: any } }
  | { type: 'UPDATE_PLACEHOLDER_OPERATION'; payload: { id: string; updates: any } }
  | { type: 'CLEAR_PLACEHOLDER_OPERATIONS' }
  | { type: 'SET_AUTO_RESOLUTION'; payload: { enabled: boolean } }
  | { type: 'START_AUTO_RESOLUTION' }
  | { type: 'END_AUTO_RESOLUTION' }

// MODIFICAR: Context value para incluir placeholders
interface BracketDragDropContextValue {
  state: ExtendedBracketDragState
  actions: {
    // ... acciones existentes ...
    
    // NUEVAS acciones para placeholders
    addPlaceholderOperation: (operation: any) => void
    updatePlaceholderOperation: (id: string, updates: any) => void
    clearPlaceholderOperations: () => void
    setAutoResolution: (enabled: boolean) => void
    startAutoResolution: () => void
    endAutoResolution: () => void
  }
}
```

## 🗂️ DOCUMENTACIÓN DE ARCHIVOS A CREAR/MODIFICAR

### 📁 NUEVOS ARCHIVOS
```
app/api/tournaments/[id]/actions.ts                          [MODIFICAR]
├── + generatePlaceholderBracketAction()
├── + validateAllZoneMatchesCreated()
└── + savePlaceholderBracketToDatabase()

hooks/use-zone-matches-validation.ts                         [CREAR]
└── Hook para validar partidos creados

components/tournament/bracket-v2/
├── components/PlaceholderMatchCard.tsx                       [CREAR]
├── components/PlaceholderSlotDisplay.tsx                     [CREAR]
├── hooks/usePlaceholderResolution.ts                         [CREAR]
└── utils/placeholder-helpers.ts                              [CREAR]

docs/
├── PLACEHOLDER_BRACKET_IMPLEMENTATION_PLAN.md               [ESTE ARCHIVO]
├── PLACEHOLDER_DRAG_DROP_SPECIFICATION.md                   [CREAR]
└── PLACEHOLDER_UI_COMPONENTS_GUIDE.md                       [CREAR]
```

### 📁 ARCHIVOS A MODIFICAR
```
components/tournament/bracket-generation-section.tsx         [MODIFICAR]
├── + Selector de tipo de bracket
├── + Validación de partidos creados
└── + UI para placeholders

components/tournament/bracket-v2/types/bracket-types.ts      [MODIFICAR]
├── + PlaceholderMatchStatus
├── + Campos placeholder en BracketMatchV2
└── + Campos placeholder en CoupleData

components/tournament/bracket-v2/context/bracket-drag-context.tsx [MODIFICAR]
├── + PlaceholderDragItem
├── + PlaceholderDropTarget
└── + Acciones específicas para placeholders

hooks/useBracketDragOperations.ts                            [MODIFICAR]
├── + canDragFromMatch() extendido
├── + canDropOnMatch() extendido
└── + handlePlaceholderDrop()
```

---

## 🚀 ORDEN DE IMPLEMENTACIÓN RECOMENDADO

### ✅ PRIMERA SEMANA
1. **Día 1-2**: FASE 1 - Endpoint de generación (crítico)
2. **Día 3-4**: FASE 2 - Modificar componente de generación
3. **Día 5**: Testing básico del flujo de generación

### ✅ SEGUNDA SEMANA  
4. **Día 1-2**: FASE 3 - Adaptar tipos de datos
5. **Día 3-5**: FASE 4 - Extender drag & drop básico

### ✅ TERCERA SEMANA
6. **Día 1-3**: FASE 5 - Componentes de UI específicos
7. **Día 4-5**: FASE 6 - Resolución en tiempo real

### ✅ CUARTA SEMANA
8. **Día 1-3**: FASE 7 - Visualización y UX final
9. **Día 4-5**: Testing completo y refinamiento

---

## ⚠️ CONSIDERACIONES TÉCNICAS

### 🔒 VALIDACIONES CRÍTICAS
- ✅ Verificar que algoritmo hybrid-serpentino se preserve exactamente
- ✅ Confirmar que BYEs automáticos sigan funcionando
- ✅ Validar que drag & drop no rompa jerarquía de matches
- ✅ Probar resolución automática de placeholders

### 🎯 MÉTRICAS DE ÉXITO
- ✅ Usuario puede generar bracket inmediatamente después de crear partidos
- ✅ Placeholders se resuelven automáticamente cuando posiciones se vuelven definitivas
- ✅ Drag & drop funciona igual o mejor que antes
- ✅ Sistema mantiene compatibilidad total con algoritmo existente

### 🔧 PUNTOS DE INTEGRACIÓN
- ✅ `PlaceholderBracketGenerator` (ya existe, funcional)
- ✅ `CorrectedDefinitiveAnalyzer` (ya existe, funcional)
- ✅ Sistema de tipos de `bracket-v2` (ya existe, extensible)
- ✅ Context de drag & drop (ya existe, necesita extensión)

---

## 📞 PRÓXIMOS PASOS INMEDIATOS

### 🎯 EMPEZAR POR: FASE 1 - ENDPOINT DE GENERACIÓN
**Justificación**: Es la base de todo. Sin esto, no hay nada que mostrar en el frontend.

### 📋 TAREAS ESPECÍFICAS PARA HOY:
1. Crear `generatePlaceholderBracketAction()` en actions.ts
2. Implementar `validateAllZoneMatchesCreated()`
3. Crear `savePlaceholderBracketToDatabase()`
4. Testing básico con datos reales

¿Te parece bien este enfoque? ¿Empezamos por la Fase 1?