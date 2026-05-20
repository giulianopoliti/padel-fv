import { Gender } from "@/types"
import {
  filterTournamentsByGender,
  getTournamentGenderPriority,
  isTournamentGenderFilter,
  prioritizeTournamentsByGender,
} from "@/lib/tournaments/gender-filtering"

describe("gender tournament filtering", () => {
  const tournaments = [
    { id: "1", gender: Gender.FEMALE, label: "female-1" },
    { id: "2", gender: Gender.MIXED, label: "mixed-1" },
    { id: "3", gender: Gender.MALE, label: "male-1" },
    { id: "4", gender: Gender.FEMALE, label: "female-2" },
    { id: "5", gender: Gender.MALE, label: "male-2" },
  ]

  it("validates explicit gender filters", () => {
    expect(isTournamentGenderFilter("MALE")).toBe(true)
    expect(isTournamentGenderFilter("FEMALE")).toBe(true)
    expect(isTournamentGenderFilter("MIXED")).toBe(true)
    expect(isTournamentGenderFilter("all")).toBe(false)
    expect(isTournamentGenderFilter(null)).toBe(false)
  })

  it("returns the expected priority order for male and female players", () => {
    expect(getTournamentGenderPriority(Gender.MALE)).toEqual([
      Gender.MALE,
      Gender.MIXED,
      Gender.FEMALE,
    ])
    expect(getTournamentGenderPriority(Gender.FEMALE)).toEqual([
      Gender.FEMALE,
      Gender.MIXED,
      Gender.MALE,
    ])
    expect(getTournamentGenderPriority(Gender.MIXED)).toBeNull()
    expect(getTournamentGenderPriority(null)).toBeNull()
  })

  it("prioritizes male tournaments first for male players while preserving bucket order", () => {
    expect(prioritizeTournamentsByGender(tournaments, Gender.MALE).map(({ label }) => label)).toEqual([
      "male-1",
      "male-2",
      "mixed-1",
      "female-1",
      "female-2",
    ])
  })

  it("prioritizes female tournaments first for female players while preserving bucket order", () => {
    expect(prioritizeTournamentsByGender(tournaments, Gender.FEMALE).map(({ label }) => label)).toEqual([
      "female-1",
      "female-2",
      "mixed-1",
      "male-1",
      "male-2",
    ])
  })

  it("filters strictly when the user selects a gender manually", () => {
    expect(filterTournamentsByGender(tournaments, Gender.MIXED).map(({ label }) => label)).toEqual([
      "mixed-1",
    ])
    expect(filterTournamentsByGender(tournaments, "all").map(({ label }) => label)).toEqual(
      tournaments.map(({ label }) => label),
    )
  })
})
