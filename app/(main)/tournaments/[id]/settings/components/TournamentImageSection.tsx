"use client"

import React from 'react'
import PreTournamentImageSection from '@/components/tournament/pre-tournament-image-section'
import { getStorageUrl } from '@/utils/storage-url'

interface TournamentImageSectionProps {
  tournament: {
    id: string
    name: string
    pre_tournament_image_url?: string | null
    clubes?: {
      cover_image_url?: string | null
    } | null
  }
}

export default function TournamentImageSection({ tournament }: TournamentImageSectionProps) {
  // Extract club cover image URL and apply storage proxy for local development
  const clubCoverImageUrl = tournament.clubes?.cover_image_url
    ? getStorageUrl(tournament.clubes.cover_image_url)
    : null

  return (
    <PreTournamentImageSection
      tournament={tournament}
      tournamentId={tournament.id}
      clubCoverImageUrl={clubCoverImageUrl}
    />
  )
}
