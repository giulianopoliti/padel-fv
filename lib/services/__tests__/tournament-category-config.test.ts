import {
  areCategoriesConsecutive,
  categorizePlayerForTournament,
  resolveInitialPlayerProfile,
  resolvePersistedTournamentCategoryName,
  resolveInitialScoreFromCategories,
  validateMixedPairGender,
  type CategoryRange,
} from "@/lib/services/tournament-category-config"

const categories: CategoryRange[] = [
  { name: "9na", lower_range: 0, upper_range: 299 },
  { name: "8va", lower_range: 300, upper_range: 599 },
  { name: "7ma", lower_range: 600, upper_range: 899 },
  { name: "6ta", lower_range: 900, upper_range: 1199 },
  { name: "5ta", lower_range: 1200, upper_range: 1499 },
  { name: "4ta", lower_range: 1500, upper_range: 1799 },
]

const createMockSupabase = (playerOverrides?: Partial<any>) => {
  const state = {
    players: {
      "player-1": {
        id: "player-1",
        first_name: "Juan",
        last_name: "Perez",
        score: null,
        is_categorized: false,
        category_name: null,
        ...playerOverrides,
      },
    } as Record<string, any>,
    lastUpdate: null as null | { id: string; payload: Record<string, unknown> },
  }

  const buildPlayersQuery = () => ({
    select() {
      return {
        eq(column: string, value: string) {
          return {
            async single() {
              if (column !== "id") {
                return { data: null, error: { message: "Unsupported players lookup" } }
              }

              return { data: state.players[value] ?? null, error: null }
            },
          }
        },
      }
    },
    update(payload: Record<string, unknown>) {
      return {
        async eq(column: string, value: string) {
          if (column !== "id" || !state.players[value]) {
            return { error: { message: "Player not found" } }
          }

          state.players[value] = {
            ...state.players[value],
            ...payload,
          }
          state.lastUpdate = { id: value, payload }
          return { error: null }
        },
      }
    },
  })

  const buildCategoriesQuery = () => ({
    select() {
      return {
        order() {
          return Promise.resolve({ data: categories, error: null })
        },
      }
    },
  })

  return {
    state,
    client: {
      from(table: string) {
        if (table === "players") {
          return buildPlayersQuery()
        }

        if (table === "categories") {
          return buildCategoriesQuery()
        }

        throw new Error(`Unsupported table in mock: ${table}`)
      },
    },
  }
}

describe("tournament-category-config", () => {
  test("resuelve puntaje inicial SINGLE desde categories", () => {
    const score = resolveInitialScoreFromCategories(
      {
        mode: "SINGLE",
        category: "6ta",
      },
      categories,
    )

    expect(score).toBe(900)
  })

  test("resuelve puntaje inicial RANGE como promedio entre lower_range", () => {
    const score = resolveInitialScoreFromCategories(
      {
        mode: "RANGE",
        categoryA: "6ta",
        categoryB: "7ma",
      },
      categories,
    )

    expect(score).toBe(750)
  })

  test("solo considera válidas categorías consecutivas para RANGE", () => {
    expect(areCategoriesConsecutive(categories, "6ta", "7ma")).toBe(true)
    expect(areCategoriesConsecutive(categories, "6ta", "8va")).toBe(false)
  })

  test("resuelve puntaje inicial MIXED_SUM desde combinaciones válidas de DB", () => {
    const score = resolveInitialScoreFromCategories(
      {
        mode: "MIXED_SUM",
        targetSum: 11,
        mixedPairRequired: true,
      },
      categories,
    )

    expect(score).toBe(1050)
  })

  test("falla cuando falta una categoría requerida", () => {
    expect(() =>
      resolveInitialScoreFromCategories(
        {
          mode: "RANGE",
          categoryA: "6ta",
          categoryB: "1ra",
        },
        categories,
      ),
    ).toThrow("No se pudo resolver una de las categorías combinadas")
  })

  test("resuelve perfil inicial legacy usando category_name simple", async () => {
    const mock = createMockSupabase()

    const result = await resolveInitialPlayerProfile({
      supabase: mock.client,
      tournament: {
        category_name: "7ma",
      },
    })

    expect(result.score).toBe(600)
    expect(result.categoryName).toBe("7ma")
  })

  test("resuelve la categoría persistida real para torneos combinados", () => {
    const persistedCategoryName = resolvePersistedTournamentCategoryName(
      {
        mode: "RANGE",
        categoryA: "6ta",
        categoryB: "7ma",
      },
      categories,
    )

    expect(persistedCategoryName).toBe("7ma")
  })

  test("categoriza un jugador sin score usando la configuración del torneo", async () => {
    const mock = createMockSupabase()

    const result = await categorizePlayerForTournament({
      playerId: "player-1",
      supabase: mock.client,
      tournament: {
        category_name: "6ta-7ma",
        category_config: {
          mode: "RANGE",
          categoryA: "6ta",
          categoryB: "7ma",
          validationEnabled: false,
        },
      },
    })

    expect(result.success).toBe(true)
    expect(result.wasCategorized).toBe(true)
    expect(result.newScore).toBe(750)
    expect(result.categoryName).toBe("7ma")
    expect(mock.state.lastUpdate?.payload).toMatchObject({
      score: 750,
      category_name: "7ma",
      is_categorized: true,
    })
  })

  test("no modifica jugadores ya categorizados", async () => {
    const mock = createMockSupabase({
      score: 1234,
      is_categorized: true,
      category_name: "5ta",
    })

    const result = await categorizePlayerForTournament({
      playerId: "player-1",
      supabase: mock.client,
      tournament: {
        category_name: "6ta",
      },
    })

    expect(result.success).toBe(true)
    expect(result.alreadyCategorized).toBe(true)
    expect(mock.state.lastUpdate).toBeNull()
  })

  test("valida parejas mixtas en modo estricto", () => {
    expect(validateMixedPairGender("MIXED", "MALE", "FEMALE")).toEqual({ success: true })
    expect(validateMixedPairGender("MIXED", "MALE", "MALE")).toEqual({
      success: false,
      error: "Es un torneo mixto, la pareja debe ser 1 hombre y 1 mujer.",
    })
  })
})
