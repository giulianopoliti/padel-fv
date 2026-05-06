import { Badge } from "@/components/ui/badge"

interface WeeklyPointsBadgeProps {
  points: number
  className?: string
}

const WeeklyPointsBadge = ({ points, className = "" }: WeeklyPointsBadgeProps) => {
  const isPositive = points > 0
  const isNegative = points < 0
  
  // No mostrar nada si es 0
  if (points === 0) return null
  
  return (
    <Badge 
      className={`text-xs ${
        isPositive 
          ? 'bg-green-100 text-green-700 border-green-200' 
          : 'bg-red-100 text-red-700 border-red-200'
      } ${className}`}
    >
      {points > 0 ? '+' : ''}{points}
    </Badge>
  )
}

export default WeeklyPointsBadge 