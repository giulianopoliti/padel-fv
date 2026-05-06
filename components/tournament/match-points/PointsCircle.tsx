"use client"

interface PointsCircleProps {
  points: number
  isWinner: boolean
  size?: "sm" | "md" | "lg"
}

const PointsCircle = ({ points, isWinner, size = "md" }: PointsCircleProps) => {
  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-7 h-7 text-sm",
    lg: "w-9 h-9 text-base"
  }

  const bgColor = isWinner ? "bg-green-50" : "bg-red-50"
  const textColor = isWinner ? "text-green-600" : "text-red-600"

  return (
    <div
      className={`
        ${sizeClasses[size]}
        ${bgColor}
        ${textColor}
        rounded-full
        flex items-center justify-center
        font-normal
        shadow
        transition-all
      `}
      style={{ minWidth: '1.5em' }}
    >
      {points > 0 ? `+${points}` : points}
    </div>
  )
}

export default PointsCircle 