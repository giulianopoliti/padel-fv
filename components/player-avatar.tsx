"use client"

import { useState } from "react"

interface PlayerAvatarProps {
  src: string | undefined
  alt: string
  className?: string
  size?: number
}

export default function PlayerAvatar({ 
  src, 
  alt, 
  className = "w-10 h-10", 
  size = 40 
}: PlayerAvatarProps) {
  const [imageError, setImageError] = useState(false)

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  if (!src || imageError) {
    // Fallback to initials avatar
    return (
      <div className={`${className} rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm`}>
        {getInitials(alt)}
      </div>
    )
  }

  return (
    <div className={`${className} rounded-full overflow-hidden shadow-sm`}>
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        onError={() => setImageError(true)}
      />
    </div>
  )
} 