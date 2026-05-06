'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Trophy, Calculator, Users } from 'lucide-react'
import { PointsReviewDialog } from '@/components/tournament/points-review-dialog'
import { useRouter } from 'next/navigation'

interface PointsCalculationBannerProps {
  tournamentId: string
  winnerId: string | null
  onPointsCalculated: () => void
}

export function PointsCalculationBanner({
  tournamentId,
  onPointsCalculated
}: PointsCalculationBannerProps) {
  const [showDialog, setShowDialog] = useState(false)
  const router = useRouter()

  const handleConfirmPoints = async () => {
    const response = await fetch(`/api/tournaments/${tournamentId}/points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!response.ok) {
      throw new Error('Error applying points')
    }

    onPointsCalculated()
    setShowDialog(false)
  }

  return (
    <>
      <Card className="border mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-sm font-medium">Torneo finalizado</p>
                <p className="text-xs text-muted-foreground">
                  La final terminó. Ya podés aplicar los puntos del torneo.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => router.push(`/tournaments/${tournamentId}/recategorize-players`)}
                size="sm"
                variant="outline"
              >
                <Users className="h-4 w-4 mr-2" />
                Recategorizar Jugadores
              </Button>
              <Button
                onClick={() => setShowDialog(true)}
                size="sm"
                variant="outline"
              >
                <Calculator className="h-4 w-4 mr-2" />
                Calcular Puntos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PointsReviewDialog
        tournamentId={tournamentId}
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        onConfirm={handleConfirmPoints}
      />
    </>
  )
}
