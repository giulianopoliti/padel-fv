'use client'

import React from 'react'
import { Building2, Navigation } from 'lucide-react'
import { ExistingMatch } from '../../actions'
import { buildGoogleMapsSearchUrl } from '@/lib/maps/google-maps'

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

  const mapsUrl = match.club.maps_url || buildGoogleMapsSearchUrl({
    name: match.club.name,
    address: match.club.address,
    formattedAddress: match.club.formatted_address,
    googlePlaceId: match.club.google_place_id,
    latitude: match.club.latitude,
    longitude: match.club.longitude,
  })

  return (
    <div className="flex items-center gap-2">
      <div className="rounded bg-purple-100 p-1.5">
        <Building2 className="h-3 w-3 text-purple-600" />
      </div>
      <div className="min-w-0">
        <span className="block truncate text-sm font-medium text-gray-700">{match.club.name}</span>
        {mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-purple-700 underline-offset-4 hover:underline"
          >
            <Navigation className="h-3 w-3" />
            Como llegar
          </a>
        ) : null}
      </div>
    </div>
  )
}

export default ClubDisplay
