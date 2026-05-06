"use client"

import { MatchPointsCouple } from "@/types"
import PointsCircle from "./PointsCircle"
import BatacazoBadge from "./BatacazoBadge"

interface MatchPointsDisplayProps {
  matchPoints?: Record<string, MatchPointsCouple>
  matchId: string
  isFinished: boolean
  winnerCoupleId?: string
  couple1Id?: string
  couple2Id?: string
}

const MatchPointsDisplay = ({ 
  matchPoints, 
  matchId, 
  isFinished,
  winnerCoupleId,
  couple1Id,
  couple2Id
}: MatchPointsDisplayProps) => {
  const points = matchPoints?.[matchId]
  
  if (!points || !isFinished) {
    return null
  }

  const couple1IsWinner = winnerCoupleId === couple1Id
  const couple2IsWinner = winnerCoupleId === couple2Id

  const couple1Points = couple1IsWinner ? points.points_winner : points.points_loser
  const couple2Points = couple2IsWinner ? points.points_winner : points.points_loser

  return (
    <div className="flex items-center gap-2">
      {/* Puntos Pareja 1 */}
      <div className="flex items-center gap-1">
        <PointsCircle 
          points={couple1Points} 
          isWinner={couple1IsWinner}
          size="sm"
        />
        {couple1IsWinner && (
          <BatacazoBadge points={couple1Points} size="sm" />
        )}
      </div>

      {/* Separador */}
      <span className="text-slate-400 text-xs">vs</span>

      {/* Puntos Pareja 2 */}
      <div className="flex items-center gap-1">
        <PointsCircle 
          points={couple2Points} 
          isWinner={couple2IsWinner}
          size="sm"
        />
        {couple2IsWinner && (
          <BatacazoBadge points={couple2Points} size="sm" />
        )}
      </div>
    </div>
  )
}

export default MatchPointsDisplay 