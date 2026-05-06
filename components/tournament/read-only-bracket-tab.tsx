"use client"

import ReadOnlyBracketVisualization from "./bracket-v2/components/ReadOnlyBracketVisualization"

interface ReadOnlyBracketTabProps {
  tournamentId: string
  tournamentStatus?: string
}

export default function ReadOnlyBracketTab({ tournamentId, tournamentStatus }: ReadOnlyBracketTabProps) {
  return (
    <div className="h-full flex flex-col">
      <ReadOnlyBracketVisualization 
        tournamentId={tournamentId} 
        tournamentStatus={tournamentStatus}
      />
    </div>
  )
} 