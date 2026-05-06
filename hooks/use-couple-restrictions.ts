import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useCoupleRestrictions(tournamentId: string) {
  const { data, isLoading, error, mutate } = useSWR<{
    success: boolean
    coupleIds: string[]
    error?: string
  }>(
    tournamentId ? `/api/tournaments/${tournamentId}/couples-with-active-matches` : null, 
    fetcher
  )

  const restrictedCouples = new Set(data?.coupleIds ?? [])

  return {
    restrictedCouples,
    isLoading,
    error: error?.message || data?.error,
    refresh: mutate,
    // Helper function to check if a couple can be moved
    canMoveCouple: (coupleId: string) => !restrictedCouples.has(coupleId),
    // Helper function to get restriction reason
    getRestrictionReason: (coupleId: string) => 
      restrictedCouples.has(coupleId) 
        ? "Esta pareja tiene partidos activos y no puede ser movida"
        : null
  }
}