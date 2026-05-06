import { Badge } from "@/components/ui/badge"
import { formatPlayerDni, hasRealDni } from "@/lib/utils/player-dni"

interface PlayerDniDisplayProps {
  dni?: string | null
  dniIsTemporary?: boolean | null
  emptyLabel?: string
  className?: string
}

export default function PlayerDniDisplay({
  dni,
  dniIsTemporary,
  emptyLabel = "DNI pendiente",
  className = "",
}: PlayerDniDisplayProps) {
  const shouldShowTemporary = dniIsTemporary ?? !hasRealDni(dni)

  if (shouldShowTemporary) {
    return (
      <Badge variant="secondary" className={className}>
        {emptyLabel}
      </Badge>
    )
  }

  return <span className={className}>{formatPlayerDni(dni)}</span>
}
