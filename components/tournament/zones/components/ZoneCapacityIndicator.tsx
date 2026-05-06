/**
 * Zone Capacity Indicator Component
 * 
 * Shows zone capacity status with non-intrusive warnings and consequences.
 * Provides contextual information about elimination and match counts.
 */

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Info, AlertTriangle, CheckCircle, Users } from 'lucide-react'
import { useTournamentValidation } from '@/hooks/use-tournament-validation'
import type { TournamentRules } from '@/types/tournament-rules.types'

interface ZoneCapacityIndicatorProps {
  currentSize: number
  zoneId?: string
  zoneName?: string
  formatId?: string
  tournamentId?: string
  showDetails?: boolean
  showConsequences?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'compact' | 'detailed'
}

export function ZoneCapacityIndicator({
  currentSize,
  zoneId,
  zoneName,
  formatId = 'AMERICAN_2',
  tournamentId,
  showDetails = true,
  showConsequences = true,
  size = 'md',
  variant = 'default'
}: ZoneCapacityIndicatorProps) {
  
  const {
    rules,
    getZoneStatusDescription,
    calculateConsequences,
    isZoneDefault,
    isZoneOverflow,
    getMaxCapacity,
    getDefaultCapacity
  } = useTournamentValidation({ tournamentId, formatId })

  const maxCapacity = getMaxCapacity()
  const defaultCapacity = getDefaultCapacity()
  const consequences = calculateConsequences(currentSize)
  const statusDescription = getZoneStatusDescription(currentSize)

  // Determine badge variant and colors
  const getBadgeVariant = () => {
    if (currentSize === 0) return 'outline'
    if (isZoneDefault(currentSize)) return 'default'
    if (isZoneOverflow(currentSize)) return 'secondary'
    return 'destructive'
  }

  const getStatusIcon = () => {
    if (currentSize === 0) return Users
    if (isZoneDefault(currentSize)) return CheckCircle
    if (isZoneOverflow(currentSize)) return AlertTriangle
    return AlertTriangle
  }

  const getStatusColor = () => {
    if (currentSize === 0) return 'text-gray-500'
    if (isZoneDefault(currentSize)) return 'text-green-600'
    if (isZoneOverflow(currentSize)) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Size configurations
  const sizeConfig = {
    sm: { 
      badge: 'text-xs px-2 py-1', 
      icon: 'h-3 w-3',
      text: 'text-xs'
    },
    md: { 
      badge: 'text-sm px-3 py-1', 
      icon: 'h-4 w-4',
      text: 'text-sm'
    },
    lg: { 
      badge: 'text-base px-4 py-2', 
      icon: 'h-5 w-5',
      text: 'text-base'
    }
  }

  const StatusIcon = getStatusIcon()

  // Compact variant - just the badge
  if (variant === 'compact') {
    return (
      <Badge 
        variant={getBadgeVariant()} 
        className={sizeConfig[size].badge}
      >
        {currentSize}/{maxCapacity}
      </Badge>
    )
  }

  // Default and detailed variants
  const badgeContent = (
    <div className="flex items-center gap-1.5">
      <StatusIcon className={`${sizeConfig[size].icon} ${getStatusColor()}`} />
      <span>{currentSize}/{maxCapacity}</span>
      {statusDescription.title !== 'Zona Estándar' && (
        <span className={`${sizeConfig[size].text} opacity-75`}>
          • {statusDescription.title}
        </span>
      )}
    </div>
  )

  if (!showDetails && !showConsequences) {
    return (
      <Badge variant={getBadgeVariant()} className={sizeConfig[size].badge}>
        {badgeContent}
      </Badge>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Badge variant={getBadgeVariant()} className={sizeConfig[size].badge}>
              {badgeContent}
            </Badge>
            
            {showConsequences && consequences.eliminated > 0 && (
              <div className="flex items-center gap-1">
                <Info className="h-3 w-3 text-amber-500" />
              </div>
            )}
          </div>
        </TooltipTrigger>
        
        <TooltipContent 
          side="bottom" 
          align="start"
          className="max-w-sm p-3"
        >
          <div className="space-y-2">
            <div className="font-medium text-sm">
              {zoneName || `Zona de ${currentSize} parejas`}
            </div>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <div>• {statusDescription.description}</div>
              
              {showConsequences && (
                <>
                  <div>• {consequences.matchesPerCouple} partidos por pareja</div>
                  <div>• {consequences.totalMatches} partidos totales</div>
                  
                  {consequences.eliminated > 0 && (
                    <div className="text-amber-600 font-medium">
                      • {consequences.eliminated} pareja{consequences.eliminated > 1 ? 's' : ''} 
                      {consequences.eliminated > 1 ? ' quedarán eliminadas' : ' quedará eliminada'}
                    </div>
                  )}
                  
                  {consequences.strategy === 'ALL_ADVANCE' && (
                    <div className="text-green-600 font-medium">
                      • Todas las parejas clasifican al bracket
                    </div>
                  )}
                </>
              )}
            </div>

            {variant === 'detailed' && (
              <div className="border-t pt-2 mt-2 text-xs text-muted-foreground">
                <div>Formato: {rules.formatName}</div>
                <div>Capacidad estándar: {defaultCapacity} parejas</div>
                <div>Máximo permitido: {maxCapacity} parejas</div>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Quick indicator for zone headers
 */
export function ZoneCapacityBadge({
  currentSize,
  formatId = 'AMERICAN_2',
  className = ''
}: {
  currentSize: number
  formatId?: string
  className?: string
}) {
  return (
    <ZoneCapacityIndicator
      currentSize={currentSize}
      formatId={formatId}
      variant="compact"
      size="sm"
      showDetails={false}
      showConsequences={false}
    />
  )
}

/**
 * Full indicator for zone management
 */
export function ZoneCapacityDetails({
  currentSize,
  zoneId,
  zoneName,
  formatId = 'AMERICAN_2',
  tournamentId
}: {
  currentSize: number
  zoneId?: string
  zoneName?: string
  formatId?: string
  tournamentId?: string
}) {
  return (
    <ZoneCapacityIndicator
      currentSize={currentSize}
      zoneId={zoneId}
      zoneName={zoneName}
      formatId={formatId}
      tournamentId={tournamentId}
      variant="detailed"
      size="md"
      showDetails={true}
      showConsequences={true}
    />
  )
}