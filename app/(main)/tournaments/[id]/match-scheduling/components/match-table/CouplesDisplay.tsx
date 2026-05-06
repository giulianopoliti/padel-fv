'use client'

import React from 'react'
import { ExistingMatch } from '../../actions'
import { useIsMobile } from '@/hooks/use-mobile'

interface CouplesDisplayProps {
  match: ExistingMatch
}

const CouplesDisplay: React.FC<CouplesDisplayProps> = ({ match }) => {
  // Get couple display names from the match data
  const getCouple1Name = () => {
    if (match.couple1?.player1 && match.couple1?.player2) {
      return `${match.couple1.player1.first_name} ${match.couple1.player1.last_name} / ${match.couple1.player2.first_name} ${match.couple1.player2.last_name}`
    }
    return 'Pareja 1'
  }

  const getCouple2Name = () => {
    if (match.couple2?.player1 && match.couple2?.player2) {
      return `${match.couple2.player1.first_name} ${match.couple2.player1.last_name} / ${match.couple2.player2.first_name} ${match.couple2.player2.last_name}`
    }
    return 'Pareja 2'
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-900">
        {getCouple1Name()}
      </div>
      <div className="flex items-center justify-center">
        <div className="border-t border-gray-300 flex-grow"></div>
        <span className="px-2 text-xs text-gray-500 font-medium">vs</span>
        <div className="border-t border-gray-300 flex-grow"></div>
      </div>
      <div className="text-sm font-medium text-gray-900">
        {getCouple2Name()}
      </div>
    </div>
  )
}

export default CouplesDisplay
