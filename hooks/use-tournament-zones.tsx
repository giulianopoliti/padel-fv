import useSWR from "swr"
import type { AvailableCouple } from "@/app/api/tournaments/[id]/actions"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useTournamentZones(tournamentId: string) {
  const { data: zonesData, isLoading: loadingZones, error: errZones, mutate: mutateZones } =
    useSWR(tournamentId ? `/api/tournaments/${tournamentId}/zones` : null, fetcher)

  const {
    data: availData,
    isLoading: loadingAvail,
    error: errAvail,
    mutate: mutateAvail,
  } = useSWR<{
    success: boolean
    couples: AvailableCouple[]
  }>(tournamentId ? `/api/tournaments/${tournamentId}/available-couples` : null, fetcher)

  return {
    zones: zonesData?.zones ?? [],
    availableCouples: availData?.couples ?? [],
    loading: loadingZones || loadingAvail,
    error: errZones?.message || errAvail?.message,
    // TODO: add mutators after implementing server endpoints
    refresh: () => {
      mutateZones()
      mutateAvail()
    },
  }
} 