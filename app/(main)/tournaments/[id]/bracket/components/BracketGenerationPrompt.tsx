'use client'

import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Trophy, AlertTriangle, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface BracketGenerationPromptProps {
  tournamentId: string
  onGenerationComplete?: () => void
}

/**
 * BracketGenerationPrompt - Empty State con botón para generar bracket
 *
 * Se muestra cuando:
 * - El torneo está en ZONE_PHASE
 * - El usuario tiene FULL_MANAGEMENT
 * - No hay bracket generado todavía
 *
 * @see LongBracketWrapper.tsx - Componente padre que controla cuándo mostrar esto
 */
export default function BracketGenerationPrompt({
  tournamentId,
  onGenerationComplete
}: BracketGenerationPromptProps) {
  const router = useRouter()
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requiredMatchesPerCoupleValues, setRequiredMatchesPerCoupleValues] = useState<number[]>([])
  const [longBracketMatchRequirementEnabled, setLongBracketMatchRequirementEnabled] = useState(true)

  React.useEffect(() => {
    let cancelled = false

    const fetchBracketRequirements = async () => {
      try {
        const response = await fetch(`/api/tournaments/${tournamentId}/generate-placeholder-bracket`)
        if (!response.ok) return

        const validation = await response.json()
        const values = Array.isArray(validation.requiredMatchesPerCoupleValues)
          ? validation.requiredMatchesPerCoupleValues.filter((value: unknown): value is number => (
            typeof value === 'number' && Number.isFinite(value) && value > 0
          ))
          : []

        if (!cancelled) {
          setRequiredMatchesPerCoupleValues(values)
          setLongBracketMatchRequirementEnabled(validation.longBracketMatchRequirementEnabled !== false)
        }
      } catch (requirementError) {
        console.warn('[BracketGenerationPrompt] Could not load bracket requirements:', requirementError)
      }
    }

    fetchBracketRequirements()

    return () => {
      cancelled = true
    }
  }, [tournamentId])

  const requirementText = React.useMemo(() => {
    if (!longBracketMatchRequirementEnabled) {
      return 'La llave se generara con la tabla de posiciones actual, aunque no todas las parejas tengan los partidos completos.'
    }

    if (requiredMatchesPerCoupleValues.length === 1) {
      const matches = requiredMatchesPerCoupleValues[0]
      const noun = matches === 1 ? 'partido creado' : 'partidos creados'
      return `Podés iniciar la llave únicamente si cada pareja tiene ${matches} ${noun}.`
    }

    if (requiredMatchesPerCoupleValues.length > 1) {
      const formattedValues = requiredMatchesPerCoupleValues.join(' o ')
      return `Podés iniciar la llave únicamente si cada pareja tiene los partidos creados que exige su zona (${formattedValues}).`
    }

    return 'Podés iniciar la llave únicamente si cada pareja tiene los partidos creados que exige el formato.'
  }, [longBracketMatchRequirementEnabled, requiredMatchesPerCoupleValues])

  const handleGenerate = async () => {
    if (isGenerating) return

    setIsGenerating(true)
    setError(null)

    try {
      // Llamar al endpoint de generación de bracket
      const response = await fetch(`/api/tournaments/${tournamentId}/generate-bracket-from-seeding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al generar el bracket')
      }

      // Éxito - refrescar la página o notificar al padre
      if (onGenerationComplete) {
        onGenerationComplete()
      } else {
        router.refresh()
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error inesperado al generar bracket'
      setError(errorMessage)
      console.error('Error generating bracket:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12 px-4">
      <Card className="max-w-2xl w-full">
        <CardContent className="pt-8 pb-8">
          {/* Icono principal */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              <Trophy className="w-10 h-10 text-blue-600" />
            </div>
          </div>

          {/* Mensaje principal */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              No hay llave generada aún
            </h2>
            <p className="text-muted-foreground">
              El bracket de eliminación directa está listo para ser generado
            </p>
          </div>

          {/* Alerta de advertencia */}
          <Alert className="mb-6 border-amber-400 bg-amber-50">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <span className="font-semibold">¡Importante!</span> Podés generarla sin haber terminado las zonas, pero una vez que la generes, no vas a poder agregar más parejas.
            </AlertDescription>
          </Alert>

          {/* Nota informativa */}
          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground">
              {requirementText}
            </p>
          </div>

          {/* Error message si existe */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>
                <strong>Error:</strong> {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Botón de generación */}
          <div className="flex justify-center">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              size="lg"
              className="min-w-[200px]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generando llave...
                </>
              ) : (
                <>
                  <Trophy className="mr-2 h-5 w-5" />
                  Generar llave
                </>
              )}
            </Button>
          </div>

          {/* Disclaimer adicional */}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Las validaciones del backend verificarán que todo esté correcto antes de generar el bracket.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
