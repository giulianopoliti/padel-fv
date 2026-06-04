import {
  applyOrganizerMatchesFilters,
  buildOrganizerMatchesCsv,
  getDefaultOrganizerMatchesFilters,
  parseOrganizerMatchesFilters,
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
  it("uses the current day full range by default when parsing filters", () => {
    const today = new Date().toLocaleDateString("en-CA")

    expect(parseOrganizerMatchesFilters({})).toEqual({
      fromDate: today,
      fromTime: "00:00",
      toDate: today,
      toTime: "23:59",
      includePast: false,
    })
  })

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
      {
        clubId: "club-root",
        includePast: true,
        fromDate: "2026-05-26",
        fromTime: "00:00",
        toDate: "2026-05-26",
        toTime: "23:59",
      },
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
    const defaults = getDefaultOrganizerMatchesFilters()
    const pastMatch = baseMatch({
      matchId: "past-match",
      scheduledDate: "2025-10-12",
    })
    const upcomingMatch = baseMatch({
      matchId: "today-or-future",
      scheduledDate: today,
    })

    const defaultResult = applyOrganizerMatchesFilters([pastMatch, upcomingMatch], {
      ...defaults,
      fromDate: today,
      toDate: today,
    })
    expect(defaultResult.map((match) => match.matchId)).toEqual(["today-or-future"])

    const includePastResult = applyOrganizerMatchesFilters([pastMatch, upcomingMatch], {
      ...defaults,
      fromDate: "2025-10-12",
      toDate: today,
      includePast: true,
    })
    expect(includePastResult).toHaveLength(2)
  })

  it("filters correctly by a date-time range", () => {
    const result = applyOrganizerMatchesFilters(
      [
        baseMatch({ matchId: "before", scheduledDate: "2026-10-12", scheduledStartTime: "08:30:00" }),
        baseMatch({ matchId: "inside", scheduledDate: "2026-10-12", scheduledStartTime: "10:00:00" }),
        baseMatch({ matchId: "after", scheduledDate: "2026-10-13", scheduledStartTime: "14:30:00" }),
      ],
      {
        fromDate: "2026-10-12",
        fromTime: "09:00",
        toDate: "2026-10-13",
        toTime: "13:00",
        includePast: true,
      },
    )

    expect(result).toHaveLength(1)
    expect(result[0].matchId).toBe("inside")
  })

  it("returns no matches for an invalid range", () => {
    const result = applyOrganizerMatchesFilters(
      [baseMatch({ matchId: "inside", scheduledDate: "2026-10-12", scheduledStartTime: "10:00:00" })],
      {
        fromDate: "2026-10-13",
        fromTime: "13:00",
        toDate: "2026-10-12",
        toTime: "09:00",
        includePast: true,
      },
    )

    expect(result).toEqual([])
  })
})
