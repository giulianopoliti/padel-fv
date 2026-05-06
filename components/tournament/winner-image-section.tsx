"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import UploadWinnerImage from "./upload-winner-image"
import WinnerImageDisplay from "./winner-image-display"

interface WinnerImageSectionProps {
  tournament: any
  tournamentId: string
}

export default function WinnerImageSection({ tournament, tournamentId }: WinnerImageSectionProps) {
  const [winnerImageUrl, setWinnerImageUrl] = useState(tournament.winner_image_url)
  const [isEditing, setIsEditing] = useState(!tournament.winner_image_url) // Start in edit mode if no image
  const [isRefreshing, setIsRefreshing] = useState(false)
  const router = useRouter()

  // Update local state if tournament prop changes
  useEffect(() => {
    setWinnerImageUrl(tournament.winner_image_url)
  }, [tournament.winner_image_url])

  const handleImageUploaded = async (url: string) => {
    // Immediately update local state with the new URL
    setWinnerImageUrl(url)
    setIsEditing(false) // Switch to display mode after successful upload
    
    // Add a small delay and then refresh to ensure server state is updated
    setIsRefreshing(true)
    setTimeout(async () => {
      router.refresh()
      setIsRefreshing(false)
    }, 1000)
  }

  const handleEditClick = () => {
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
  }

  if (isEditing || !winnerImageUrl) {
    return (
      <UploadWinnerImage
        tournamentId={tournamentId}
        tournamentName={tournament.name}
        existingImageUrl={winnerImageUrl}
        onImageUploaded={handleImageUploaded}
        showCancelButton={!!winnerImageUrl}
        onCancel={handleCancelEdit}
      />
    )
  }

  return (
    <WinnerImageDisplay
      tournamentName={tournament.name}
      winnerImageUrl={winnerImageUrl}
      showEditOption={true}
      onEditClick={handleEditClick}
      isRefreshing={isRefreshing}
    />
  )
} 