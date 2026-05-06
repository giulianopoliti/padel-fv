'use client'

import React from 'react'
import { Building2 } from 'lucide-react'
import { ExistingMatch } from '../../actions'

interface ClubDisplayProps {
  match: ExistingMatch
}

const ClubDisplay: React.FC<ClubDisplayProps> = ({ match }) => {
  if (!match.club?.name) {
    return (
      <div className="text-gray-400 text-sm flex items-center gap-1">
        <Building2 className="w-3 h-3" />
        <span>Sin club</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="bg-purple-100 p-1.5 rounded">
        <Building2 className="w-3 h-3 text-purple-600" />
      </div>
      <span className="text-sm font-medium text-gray-700">{match.club.name}</span>
    </div>
  )
}

export default ClubDisplay
