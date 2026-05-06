📋 Documentación del Sistema de Inscripciones

  🏗️ Arquitectura General

  CLIENT COMPONENTS → API ROUTES → STRATEGY PATTERN → DATABASE

  Componentes Principales:

  - Frontend: CoupleRegistrationAdvanced, RegisterPlayerForm,
  TournamentPlayersTab
  - API Routes: /register-new-couple, /register-individual
  - Strategy Pattern: LongTournamentStrategy, AmericanTournamentStrategy
  - Categorización: utils/player-categorization.ts

  ---
  🎾 Tipos de Inscripción

  1. Parejas Nuevas (Ambos jugadores nuevos)

  POST /api/tournaments/[id]/register-new-couple
  Body: { player1: {...}, player2: {...} }
  - ✅ Crea ambos jugadores con categorización automática
  - ✅ Forma pareja e inscribe en torneo
  - ✅ Asigna a zona (según tipo de torneo)

  2. Jugador Individual Nuevo

  POST /api/tournaments/[id]/register-individual
  Body: { firstName, lastName, dni, gender, phone? }
  - ✅ Crea jugador con categorización automática
  - ✅ Inscribe como individual (sin pareja aún)

  3. Jugador Individual Existente

  POST /api/tournaments/[id]/register-individual
  Body: { playerId: "uuid" }
  - ✅ Categoriza jugador si no está categorizado
  - ✅ Inscribe como individual

  ---
  🔧 Strategy Pattern

  Flujo Unificado:

  1. API Route → Valida request y contexto
  2. Registration Service → Selecciona strategy según tipo torneo
  3. Strategy específica → Ejecuta lógica de negocio
  4. Categorización → checkAndCategorizePlayer() para todos los casos
  5. Response → JSON serializado al cliente

  Strategies Implementadas:

  - LongTournamentStrategy → Torneos largos (zonas + brackets)
  - AmericanTournamentStrategy → Torneos americanos (round-robin)

  ---
  🎯 Categorización Automática

  Lógica Unificada:

  // utils/player-categorization.ts
  export async function checkAndCategorizePlayer(playerId, categoryName,
  supabase)

  Proceso:

  1. Verifica si jugador ya está categorizado
  2. Consulta tabla categories para obtener lower_range
  3. Actualiza jugador: score, category_name, is_categorized: true
  4. Fallback a score 1000 si categoría no existe

  Cobertura:

  - ✅ Parejas nuevas (ambos jugadores)
  - ✅ Jugadores individuales nuevos
  - ✅ Jugadores individuales existentes (si no categorizados)

  ---
  📡 API Routes

  Ventajas del Patrón API Route:

  - ✅ Serialización completa Server/Client
  - ✅ Error handling centralizado con HTTP status codes
  - ✅ Logging estructurado para monitoring
  - ✅ Preparado para migración a Python backend

  Respuesta Estándar:

  {
    success: boolean,
    message?: string,
    error?: string,
    data?: { playerId, inscriptionId, wasCategorized, ... },
    meta: { timestamp, strategy, tournamentType }
  }

  ---
  🚨 Problemas Resueltos

  1. Serialización Server/Client

  - Problema: Strategy Pattern no se podía llamar directamente desde Client        
  Components
  - Solución: API Routes como capa intermedia

  2. Campo Phone Opcional

  - Problema: Validaciones inconsistentes requerían phone
  - Solución: Removido de validaciones, opcional en toda la cadena

  3. Categorización Individual

  - Problema: Jugadores individuales no se categorizaban
  - Solución: Agregado categorizePlayers() en registerIndividualPlayer()

  ---
  🔄 Flujos de Inscripción

  Pareja Nueva:

  Frontend → /register-new-couple → Strategy.registerNewPlayersAsCouple() →        
  categorización → inscripción

  Individual Nuevo:

  Frontend → /register-individual → V2.registerNewPlayer() →
  Strategy.registerIndividualPlayer() → categorización

  Individual Existente:

  Frontend → /register-individual → Strategy.registerIndividualPlayer() →
  categorización → inscripción

  ---
  📊 Estado Final

  - ✅ Categorización unificada en todos los flujos
  - ✅ Strategy Pattern funcionando via API routes
  - ✅ Serialización Server/Client resuelta
  - ✅ Consistencia entre torneos Long y American
  - ✅ Preparado para migración a backend Python