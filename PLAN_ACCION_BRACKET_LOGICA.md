# 🎯 PLAN DE ACCIÓN: UNIFICACIÓN DE LÓGICA DE BRACKETS

## 📊 **OBJETIVO**
Reutilizar la lógica del `ImprovedBracketRenderer` (torneo americano) para torneos largos, manteniendo el componente `LoadMatchResultDialog` pero unificando toda la gestión de matches.

---

## 🗄️ **ESTRUCTURA DE BASE DE DATOS**

### **Tabla `matches` - Campos Principales:**
```sql
CREATE TABLE matches (
  id UUID,
  status match_status,
  couple1_id UUID,
  couple2_id UUID,
  winner_id UUID,
  result_couple1 TEXT,  -- "6" (games) o "2" (sets ganados)
  result_couple2 TEXT,  -- "4" (games) o "1" (sets ganados)
  tournament_id UUID,
  round ROUND,
  zone_id UUID
)
```

### **Tabla `set_matches` - Para Detalles de Sets:**
```sql
CREATE TABLE set_matches (
  match_id UUID,
  set_number SMALLINT (1-5),
  couple1_games SMALLINT,  -- Games específicos: 6, 4, 7
  couple2_games SMALLINT,  -- Games específicos: 4, 6, 5
  winner_couple_id UUID    -- Ganador del set individual
)
```

---

## 🎯 **FLUJOS ACTUALES**

### **🇺🇸 Torneo Americano (ImprovedBracketRenderer):**
```
1. Input: "6-4" (games en 1 set)
2. Storage: matches.result_couple1 = "6", result_couple2 = "4"
3. Logic: couple1_games > couple2_games → winner_id = couple1_id
4. Display: "6-4"
5. Advancement: winner_id → next match via advanceWinnerUsingHierarchy()
```

### **🌊 Torneo Largo (LoadMatchResultDialog):**
```
1. Input: "6-4, 4-6, 7-5" (3 sets)
2. Storage:
   - matches.result_couple1 = "2", result_couple2 = "1" (sets ganados)
   - set_matches: 3 registros con games por set
3. Logic: Sets ganados → 2-1 → winner_id = couple1_id
4. Display: "6-4, 4-6, 7-5" + "Sets: 2-1"
5. Advancement: winner_id → next match via advanceWinnerUsingHierarchy()
```

---

## 📋 **PLAN DE IMPLEMENTACIÓN**

### **FASE 1: EXTENDER useMatchManagement** ⏱️ *2 horas*

#### **1.1 Agregar Soporte Best of 3**
```typescript
// 📁 components/tournament/bracket-v2/hooks/useMatchManagement.ts

// NUEVO helper para crear resultado de 3 sets
const createBestOf3Result = useCallback((
  sets: MatchSet[],
  winnerId: string,
  duration?: number
): MatchResult => {
  const finalScore = sets.map(set => `${set.couple1_games}-${set.couple2_games}`).join(', ')

  // ✅ CALCULAR SETS GANADOS (para result_couple1/result_couple2)
  const [couple1Sets, couple2Sets] = sets.reduce(
    (acc, set) => {
      if (set.couple1_games > set.couple2_games) acc[0]++
      else acc[1]++
      return acc
    },
    [0, 0]
  )

  return {
    format: 'best_of_3',
    sets,
    winner_id: winnerId,
    match_duration_minutes: duration,
    final_score: finalScore,
    // ✅ NUEVOS CAMPOS para compatibilidad
    sets_won_couple1: couple1Sets.toString(),  // "2"
    sets_won_couple2: couple2Sets.toString()   // "1"
  }
}, [])

// AGREGAR a las actions:
const actions: MatchManagementActions = {
  // ... existentes ...
  createBestOf3Result,  // ✅ NUEVA
}
```

#### **1.2 Modificar updateResult para Manejar Ambos Formatos**
```typescript
// 📁 components/tournament/bracket-v2/hooks/useMatchManagement.ts

const updateResult = useCallback(async (
  matchId: string,
  result: MatchResult,
  finishMatch = true
): Promise<boolean> => {
  updateState({ updatingResult: true, error: undefined })

  try {
    // ✅ DETECTAR ENDPOINT SEGÚN FORMATO
    const endpoint = result.format === 'best_of_3'
      ? `/api/tournaments/${tournamentId}/matches/${matchId}/universal-result`
      : `/api/tournaments/${tournamentId}/matches/${matchId}/update-result`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result, finishMatch })
    })

    // ... resto igual
  } catch (error) {
    // ... error handling
  }
}, [tournamentId, handleError, updateState, onMatchUpdate])
```

### **FASE 2: CREAR ENDPOINT UNIFICADO** ⏱️ *2 horas*

#### **2.1 Endpoint para Torneo Largo**
```typescript
// 📁 app/api/tournaments/[id]/matches/[matchId]/universal-result/route.ts

export async function POST(request: NextRequest, { params }: any) {
  const { result, finishMatch = true } = await request.json()

  // ✅ VALIDAR FORMATO
  if (result.format !== 'best_of_3') {
    return NextResponse.json({
      success: false,
      error: 'Este endpoint es solo para best_of_3'
    }, { status: 400 })
  }

  const supabase = await createClient()
  const matchId = params.matchId
  const tournamentId = params.id

  try {
    // ✅ ACTUALIZAR matches CON SETS GANADOS
    const { error: updateMatchError } = await supabase
      .from('matches')
      .update({
        winner_id: result.winner_id,
        status: finishMatch ? 'FINISHED' : 'IN_PROGRESS',
        result_couple1: result.sets_won_couple1,  // "2"
        result_couple2: result.sets_won_couple2   // "1"
      })
      .eq('id', matchId)

    if (updateMatchError) throw updateMatchError

    // ✅ INSERTAR set_matches CON DETALLES
    const setsToInsert = result.sets.map((set, index) => {
      const setWinnerId = set.couple1_games > set.couple2_games
        ? /* couple1_id */
        : /* couple2_id */

      return {
        match_id: matchId,
        set_number: index + 1,
        couple1_games: set.couple1_games,
        couple2_games: set.couple2_games,
        winner_couple_id: setWinnerId,
        status: 'COMPLETED'
      }
    })

    const { error: setsError } = await supabase
      .from('set_matches')
      .insert(setsToInsert)

    if (setsError) throw setsError

    // ✅ USAR LÓGICA EXISTENTE DE AVANCE
    if (finishMatch) {
      const { advanceWinnerUsingHierarchy } = await import('@/app/api/tournaments/actions')
      await advanceWinnerUsingHierarchy(supabase, tournamentId, matchId, result.winner_id, 'normal_win')
    }

    return NextResponse.json({
      success: true,
      matchId,
      result,
      status: finishMatch ? 'FINISHED' : 'IN_PROGRESS'
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
```

### **FASE 3: ADAPTAR UI PARA MOSTRAR SETS** ⏱️ *3 horas*

#### **3.1 Detectar Tipo de Torneo en GranularMatchCard**
```typescript
// 📁 components/tournament/bracket-v2/components/GranularMatchCard.tsx

export interface GranularMatchCardProps {
  match: BracketMatchV2
  tournamentId: string
  tournamentType?: 'AMERICAN' | 'LONG'  // ✅ NUEVO
  // ... resto
}

export function GranularMatchCard({
  match,
  tournamentType = 'AMERICAN',  // ✅ DEFAULT AMERICAN
  // ... resto
}: GranularMatchCardProps) {

  // ✅ DETERMINAR FORMATO DE RESULTADO
  const isLongTournament = tournamentType === 'LONG'

  // ✅ BOTÓN CONDICIONAL
  const handleResultButtonClick = () => {
    if (isLongTournament) {
      setShowLoadMatchDialog(true)  // LoadMatchResultDialog
    } else {
      setShowInlineResult(true)     // InlineResultForm existente
    }
  }

  // ✅ RESULTADO CONDICIONAL
  const renderMatchResult = () => {
    if (match.status !== 'FINISHED') return null

    if (isLongTournament) {
      return <ThreeSetResultDisplay matchId={match.id} />
    } else {
      return (
        <div className="text-sm">
          Resultado: {match.result_couple1}-{match.result_couple2}
        </div>
      )
    }
  }

  return (
    <Card>
      {/* ... resto del card ... */}

      {/* ✅ RESULTADO ADAPTABLE */}
      {renderMatchResult()}

      {/* ✅ BOTÓN ADAPTABLE */}
      {statusInfo.canAddResult && (
        <Button onClick={handleResultButtonClick}>
          {isLongTournament ? 'Cargar Resultado (3 sets)' : 'Cargar Resultado'}
        </Button>
      )}

      {/* ✅ FORMULARIOS CONDICIONALES */}
      {showInlineResult && !isLongTournament && (
        <InlineResultForm {...props} />
      )}

      {showLoadMatchDialog && isLongTournament && (
        <LoadMatchResultDialog
          match={adaptMatchForDialog(match)}
          tournament={{ type: 'LONG' }}
          open={showLoadMatchDialog}
          onOpenChange={(open) => !open && setShowLoadMatchDialog(false)}
          onResultSaved={handleResultSaved}
          onUpdateMatchResult={createBridgeFunction()}
        />
      )}
    </Card>
  )
}
```

#### **3.2 Componente para Mostrar 3 Sets**
```typescript
// 📁 components/tournament/universal/ThreeSetResultDisplay.tsx

export function ThreeSetResultDisplay({ matchId }: { matchId: string }) {
  const [sets, setSets] = useState<any[]>([])
  const [match, setMatch] = useState<any>(null)

  useEffect(() => {
    fetchMatchData()
  }, [matchId])

  const fetchMatchData = async () => {
    try {
      // ✅ OBTENER DATOS DE matches Y set_matches
      const [matchResponse, setsResponse] = await Promise.all([
        fetch(`/api/matches/${matchId}/summary`),
        fetch(`/api/matches/${matchId}/sets`)
      ])

      const matchData = await matchResponse.json()
      const setsData = await setsResponse.json()

      setMatch(matchData.match)
      setSets(setsData.sets || [])
    } catch (error) {
      console.error('Error fetching match data:', error)
    }
  }

  if (!match) return <div>Cargando...</div>

  return (
    <div className="space-y-2">
      {/* ✅ RESUMEN DE SETS GANADOS */}
      <div className="flex items-center gap-2 text-sm">
        <Trophy className="h-4 w-4 text-yellow-500" />
        <span className="font-medium">
          Sets: {match.result_couple1}-{match.result_couple2}
        </span>
      </div>

      {/* ✅ DETALLES DE CADA SET */}
      <div className="flex gap-2 text-xs">
        {sets.map((set) => (
          <div
            key={set.id}
            className="bg-gray-100 px-2 py-1 rounded text-center"
          >
            <div className="font-medium">S{set.set_number}</div>
            <div>{set.couple1_games}-{set.couple2_games}</div>
          </div>
        ))}
      </div>

      {/* ✅ SCORE FINAL FORMATEADO */}
      <div className="text-xs text-gray-600">
        {sets.map(set => `${set.couple1_games}-${set.couple2_games}`).join(', ')}
      </div>
    </div>
  )
}
```

#### **3.3 APIs para Obtener Datos**
```typescript
// 📁 app/api/matches/[matchId]/summary/route.ts
export async function GET(request: Request, { params }: any) {
  const supabase = await createClient()

  const { data: match, error } = await supabase
    .from('matches')
    .select('id, status, result_couple1, result_couple2, winner_id')
    .eq('id', params.matchId)
    .single()

  return Response.json({ success: true, match })
}

// 📁 app/api/matches/[matchId]/sets/route.ts
export async function GET(request: Request, { params }: any) {
  const supabase = await createClient()

  const { data: sets, error } = await supabase
    .from('set_matches')
    .select('*')
    .eq('match_id', params.matchId)
    .order('set_number', { ascending: true })

  return Response.json({ success: true, sets })
}
```

### **FASE 4: CONECTAR CON BRIDGE** ⏱️ *1 hora*

#### **4.1 Bridge Function para LoadMatchResultDialog**
```typescript
// 📁 components/tournament/bracket-v2/components/GranularMatchCard.tsx

const createBridgeFunction = () => {
  return async (
    matchId: string,
    sets: SetResult[],
    winnerId: string,
    resultCouple1: string,
    resultCouple2: string
  ): Promise<{success: boolean, error?: string}> => {

    // ✅ CONVERTIR SetResult[] → MatchResult unified
    const matchSets = sets.map(set => ({
      couple1_games: set.couple1_games,
      couple2_games: set.couple2_games
    }))

    // ✅ USAR HOOK UNIFICADO
    const result = matchActions.createBestOf3Result(matchSets, winnerId)
    const success = await matchActions.updateResult(matchId, result, true)

    return { success, error: success ? undefined : matchState.error }
  }
}
```

#### **4.2 Pasar tournamentType desde LongBracketView**
```typescript
// 📁 app/(main)/tournaments/[id]/bracket/components/LongBracketView.tsx

<ImprovedBracketRenderer
  bracketData={bracketData}
  tournamentId={tournamentId}
  tournamentType="LONG"  // ✅ NUEVO - indica que es torneo largo
  isOwner={hasManagementPermissions}
  enableDragDrop={hasManagementPermissions}
  onDataRefresh={handleDataRefresh}
/>
```

#### **4.3 Modificar ImprovedBracketRenderer**
```typescript
// 📁 components/tournament/bracket-v2/components/ImprovedBracketRenderer.tsx

export interface ImprovedBracketRendererProps {
  bracketData: BracketData
  tournamentId: string
  tournamentType?: 'AMERICAN' | 'LONG'  // ✅ NUEVO
  isOwner?: boolean
  enableDragDrop?: boolean
  // ... resto igual
}

export function ImprovedBracketRenderer({
  bracketData,
  tournamentId,
  tournamentType = 'AMERICAN',  // ✅ DEFAULT AMERICAN
  // ... resto
}: ImprovedBracketRendererProps) {

  // ✅ PASAR A GranularMatchCard
  const renderMatch = (match: BracketMatchV2, index: number) => {
    return (
      <GranularMatchCard
        match={match}
        tournamentId={tournamentId}
        tournamentType={tournamentType}  // ✅ NUEVO
        isOwner={isOwner}
        isEditMode={isEditMode}
        onMatchUpdate={onMatchUpdate}
        onResultClick={handleResultClick}
      />
    )
  }
}
```

---

## 🎯 **FLUJOS RESULTANTES**

### **✅ Torneo Americano (sin cambios):**
```
Input: "6-4"
→ InlineResultForm
→ useMatchManagement.updateResult(single_set)
→ /api/tournaments/[id]/matches/[matchId]/update-result
→ matches: result_couple1="6", result_couple2="4", winner_id
→ advanceWinnerUsingHierarchy()
→ UI: "6-4"
```

### **✅ Torneo Largo (nuevo):**
```
Input: "6-4, 4-6, 7-5"
→ LoadMatchResultDialog
→ Bridge function
→ useMatchManagement.updateResult(best_of_3)
→ /api/tournaments/[id]/matches/[matchId]/universal-result
→ matches: result_couple1="2", result_couple2="1", winner_id
→ set_matches: 3 registros con games por set
→ advanceWinnerUsingHierarchy() (mismo avance)
→ UI: "6-4, 4-6, 7-5" + "Sets: 2-1"
```

---

## 🏗️ **VENTAJAS**

### **✅ Base de Datos:**
- ✅ **result_couple1/result_couple2**: Usado correctamente (games vs sets)
- ✅ **set_matches**: Solo para torneos largos (detalles)
- ✅ **winner_id**: Determinado por lógica unificada
- ✅ **Avance**: Mismo sistema `advanceWinnerUsingHierarchy()` para ambos

### **✅ Código:**
- ✅ **90% reutilización** - useMatchManagement + ImprovedBracketRenderer
- ✅ **LoadMatchResultDialog preservado** - sin cambios en UI
- ✅ **Bridge pattern** - conecta ambos mundos sin duplicación
- ✅ **Endpoints específicos** - /update-result vs /universal-result

### **✅ UX:**
- ✅ **Torneo Americano**: Exactamente igual ("6-4")
- ✅ **Torneo Largo**: UI elegante ("6-4, 4-6, 7-5" + "Sets: 2-1")
- ✅ **Consistencia**: Mismo avance automático para ambos

---

## 📋 **CHECKLIST DE IMPLEMENTACIÓN**

### **Fase 1: useMatchManagement**
- [ ] Agregar `createBestOf3Result()` function
- [ ] Modificar `updateResult()` para detectar formato
- [ ] Extender interface `MatchResult` con campos de sets
- [ ] Testing de función con datos de ejemplo

### **Fase 2: API Endpoint**
- [ ] Crear `/universal-result` route
- [ ] Implementar lógica de inserción en `set_matches`
- [ ] Integrar con `advanceWinnerUsingHierarchy()`
- [ ] Testing de endpoint con Postman/curl

### **Fase 3: UI Components**
- [ ] Modificar `GranularMatchCard` para detectar tipo
- [ ] Crear `ThreeSetResultDisplay` component
- [ ] Implementar rendering condicional de resultados
- [ ] Crear APIs `/summary` y `/sets`

### **Fase 4: Bridge Integration**
- [ ] Implementar bridge function en `GranularMatchCard`
- [ ] Conectar `LoadMatchResultDialog` con bridge
- [ ] Pasar `tournamentType` desde `LongBracketView`
- [ ] Modificar `ImprovedBracketRenderer` props

### **Fase 5: Testing Final**
- [ ] Torneo Americano funciona igual que antes
- [ ] Torneo Largo muestra LoadMatchResultDialog correctamente
- [ ] Resultados se guardan en formato correcto
- [ ] Avance automático funciona para ambos tipos
- [ ] UI muestra resultados apropiados

---

## ⚡ **ORDEN DE EJECUCIÓN**

1. **Fase 1** → **Fase 4.1** → **Testing intermedio**
2. **Fase 2** → **Fase 4.2** → **Testing de integración**
3. **Fase 3** → **Fase 4.3** → **Testing de UI**
4. **Testing completo** → **Deployment**

**Tiempo total estimado**: 8-10 horas
**Riesgo**: Muy bajo (preserva funcionalidad existente)
**Beneficio**: Máximo (unifica lógica + mejora UX)

---

## 🚀 **NEXT STEPS**

1. **Revisar y aprobar** este plan
2. **Empezar con Fase 1.1** - extender useMatchManagement
3. **Testing incremental** después de cada fase
4. **Documentar cambios** en CHANGELOG.md

---

*Generado el: `{fecha}`*
*Estado: Pendiente de implementación*
*Responsable: Claude Code Assistant*