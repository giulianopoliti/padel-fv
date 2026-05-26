import {
  applyOrganizerMatchesFilters,
  buildOrganizerMatchesCsv,
  type OrganizerMatchRow,
} from "@/lib/organizer-matches-shared"

const baseMatch = (overrides: Partial<OrganizerMatchRow>): OrganizerMatchRow => ({
  matchId: "match-1",
  tournamentId: "tournament-1",
  tournamentName: "Torneo Apertura",
  scheduledDate: "2026-05-26",
  scheduledStartTime: "10:00:00",
  scheduledEndTime: "11:00:00",
  courtAssignment: "1",
  round: "ZONE",
  status: "PENDING",
  matchClubId: null,
  tournamentClubId: "club-tournament",
  effectiveClubId: "club-tournament",
  effectiveClubName: "Club del Torneo",
  couple1Display: "Jugador A / Jugador B",
  couple2Display: "Jugador C / Jugador D",
  ...overrides,
})

describe("organizer matches helpers", () => {
  it("filters by effective club id instead of only match club id", () => {
    const inheritedClubMatch = baseMatch({
      matchId: "match-inherited",
      matchClubId: null,
      tournamentClubId: "club-root",
      effectiveClubId: "club-root",
      effectiveClubName: "Club raíz",
    })

    const explicitClubMatch = baseMatch({
      matchId: "match-explicit",
      matchClubId: "club-secondary",
      tournamentClubId: "club-root",
      effectiveClubId: "club-secondary",
      effectiveClubName: "Club secundario",
    })

    const result = applyOrganizerMatchesFilters(
      [inheritedClubMatch, explicitClubMatch],
      { clubId: "club-root" },
    )

    expect(result).toHaveLength(1)
    expect(result[0].matchId).toBe("match-inherited")
  })

  it("builds csv content with BOM and effective club name", () => {
    const csv = buildOrganizerMatchesCsv([
      baseMatch({
        effectiveClubName: "Club Central",
      }),
    ])

    expect(csv.startsWith("\uFEFF")).toBe(true)
    expect(csv).toContain("Club Central")
    expect(csv).toContain("Torneo Apertura")
  })

  it("hides past matches by default and allows them when includePast is true", () => {
    const today = new Date().toLocaleDateString("en-CA")
    const pastMatch = baseMatch({
      matchId: "past-match",
      scheduledDate: "2025-10-12",
    })
    const upcomingMatch = baseMatch({
      matchId: "today-or-future",
      scheduledDate: today,
    })

    const defaultResult = applyOrganizerMatchesFilters([pastMatch, upcomingMatch], {})
    expect(defaultResult.map((match) => match.matchId)).toEqual(["today-or-future"])

    const includePastResult = applyOrganizerMatchesFilters([pastMatch, upcomingMatch], {
      includePast: true,
    })
    expect(includePastResult).toHaveLength(2)
  })

  it("filters correctly by explicit past date when includePast is enabled", () => {
    const result = applyOrganizerMatchesFilters(
      [
        baseMatch({ matchId: "old", scheduledDate: "2025-10-12" }),
        baseMatch({ matchId: "new", scheduledDate: "2026-10-12" }),
      ],
      {
        includePast: true,
        date: "2025-10-12",
      },
    )

    expect(result).toHaveLength(1)
    expect(result[0].matchId).toBe("old")
  })
})
