"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import UploadPreTournamentImage from "./upload-pre-tournament-image"
import PreTournamentImageDisplay from "./pre-tournament-image-display"

interface PreTournamentImageSectionProps {
  tournament: any
  tournamentId: string
  clubCoverImageUrl?: string | null
}

export default function PreTournamentImageSection({ 
  tournament, 
  tournamentId, 
  clubCoverImageUrl 
}: PreTournamentImageSectionProps) {
  const [preTournamentImageUrl, setPreTournamentImageUrl] = useState(tournament.pre_tournament_image_url)
  const [isEditing, setIsEditing] = useState(!tournament.pre_tournament_image_url) // Start in edit mode if no image
  const router = useRouter()

  const handleImageUploaded = (url: string) => {
    setPreTournamentImageUrl(url)
    setIsEditing(false) // Switch to display mode after successful upload
    // Refresh the page to show the updated data
    router.refresh()
  }

  const handleEditClick = () => {
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
  }

  if (isEditing || !preTournamentImageUrl) {
    return (
      <UploadPreTournamentImage
        tournamentId={tournamentId}
        tournamentName={tournament.name}
        existingImageUrl={preTournamentImageUrl}
        clubCoverImageUrl={clubCoverImageUrl}
        onImageUploaded={handleImageUploaded}
        showCancelButton={!!preTournamentImageUrl}
        onCancel={handleCancelEdit}
      />
    )
  }

  return (
    <PreTournamentImageDisplay
      tournamentName={tournament.name}
      preTournamentImageUrl={preTournamentImageUrl}
      showEditOption={true}
      onEditClick={handleEditClick}
    />
  )
} 