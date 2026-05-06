"use client"

import { type FormEvent, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { getPresetOptionsByType } from '@/config/tournament-format-presets'
import { buildTournamentFormatConfig } from '@/lib/services/tournament-format-config-builder'
import { TournamentFormatResolver } from '@/lib/services/tournament-format-resolver'
import { updateTournamentFormatConfig } from '../actions'
import type { TournamentFormatPresetId } from '@/types/tournament-format-v2'

interface TournamentFormatConfigFormProps {
  tournamentId: string
  tournamentType: 'AMERICAN' | 'LONG'
  tournamentStatus?: string | null
  formatConfig: unknown
  registeredCouplesCount: number
}

export default function TournamentFormatConfigForm({
  tournamentId,
  tournamentType,
  tournamentStatus,
  formatConfig,
  registeredCouplesCount,
}: TournamentFormatConfigFormProps) {
  const getDefaultSingleAdvanceCount = (fallback: number) => {
    if (registeredCouplesCount > 0) {
      return registeredCouplesCount
    }
    return fallback
  }

  const resolvedFormat = useMemo(
    () => TournamentFormatResolver.getResolvedFormat({ type: tournamentType, format_config: formatConfig }),
    [tournamentType, formatConfig]
  )

  const presetOptions = useMemo(() => {
    const allOptions = getPresetOptionsByType(tournamentType)
    const isStartedAmericanTournament =
      tournamentType === 'AMERICAN' && tournamentStatus && tournamentStatus !== 'NOT_STARTED'

    if (!isStartedAmericanTournament) {
      return allOptions
    }

    const runtimeOptions = allOptions.filter((preset) =>
      preset.presetId === 'AMERICAN_MULTI_ZONE_2' || preset.presetId === 'AMERICAN_MULTI_ZONE_3'
    )
    const currentPreset = allOptions.find((preset) => preset.presetId === resolvedFormat.presetId)

    if (
      currentPreset &&
      !runtimeOptions.some((preset) => preset.presetId === currentPreset.presetId)
    ) {
      return [currentPreset, ...runtimeOptions]
    }

    return runtimeOptions
  }, [tournamentType, tournamentStatus, resolvedFormat.presetId])

  const [presetId, setPresetId] = useState<TournamentFormatPresetId>(resolvedFormat.presetId)
  const [singleAdvanceCount, setSingleAdvanceCount] = useState(
    resolvedFormat.advancementConfig.kind === 'SINGLE'
      ? getDefaultSingleAdvanceCount(resolvedFormat.advancementConfig.advanceCount)
      : getDefaultSingleAdvanceCount(8)
  )
  const [goldCount, setGoldCount] = useState(
    resolvedFormat.advancementConfig.kind === 'GOLD_SILVER' ? resolvedFormat.advancementConfig.goldCount : 4
  )
  const [silverCount, setSilverCount] = useState(
    resolvedFormat.advancementConfig.kind === 'GOLD_SILVER' ? resolvedFormat.advancementConfig.silverCount : 4
  )
  const [eliminatedCount, setEliminatedCount] = useState(
    resolvedFormat.advancementConfig.kind === 'GOLD_SILVER' ? resolvedFormat.advancementConfig.eliminatedCount : 0
  )
  const [isLoading, setIsLoading] = useState(false)
  const [businessError, setBusinessError] = useState<string | null>(null)

  const selectedPreset = presetOptions.find((preset) => preset.presetId === presetId)

  const getFriendlyFormatError = (code?: string, fallback?: string) => {
    switch (code) {
      case 'INVALID_TOURNAMENT_STATUS':
        return 'El formato solo se puede cambiar cuando el torneo está en NOT_STARTED o ZONE_PHASE.'
      case 'BRACKET_ALREADY_EXISTS':
      case 'BRACKET_ARTIFACTS_EXIST':
        return 'No se puede cambiar el formato porque la llave ya fue generada o hay artefactos de llave persistidos.'
      case 'UNSUPPORTED_RUNTIME_PRESET_TRANSITION':
        return 'Con el torneo en curso, solo se permite cambiar entre MZ2 y MZ3.'
      case 'ZONE_CAPACITY_EXCEEDED_FOR_MZ3':
      case 'MZ3_TO_MZ2_OVER_LIMIT':
        return fallback || 'Las zonas actuales no son compatibles con el formato seleccionado.'
      case 'ZONE_ROUNDS_SYNC_FAILED':
        return 'No se pudo sincronizar la configuración de partidos por zona. Intentá nuevamente.'
      default:
        return fallback || 'No se pudo guardar el formato.'
    }
  }

  const handlePresetChange = (nextPresetId: string) => {
    const nextPreset = presetOptions.find((preset) => preset.presetId === nextPresetId)
    if (!nextPreset) return

    setBusinessError(null)
    setPresetId(nextPreset.presetId)
    if (nextPreset.advancementConfig.kind === 'SINGLE') {
      setSingleAdvanceCount(getDefaultSingleAdvanceCount(nextPreset.advancementConfig.advanceCount))
    }
    if (nextPreset.advancementConfig.kind === 'GOLD_SILVER') {
      setGoldCount(nextPreset.advancementConfig.goldCount)
      setSilverCount(nextPreset.advancementConfig.silverCount)
      setEliminatedCount(nextPreset.advancementConfig.eliminatedCount)
    }
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    setBusinessError(null)

    try {
      const nextConfig = buildTournamentFormatConfig({
        presetId,
        singleAdvanceCount,
        goldCount,
        silverCount,
        eliminatedCount,
      })

      const result = await updateTournamentFormatConfig(tournamentId, nextConfig)
      if (!result.success) {
        const message = getFriendlyFormatError(result.code, result.error)
        setBusinessError(message)
        toast.error(message)
        return
      }

      toast.success('Formato guardado correctamente')
    } catch (error) {
      const message = 'Ocurrió un error inesperado al guardar el formato.'
      console.error('Unexpected error saving format config:', error)
      setBusinessError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="space-y-2">
        <Label>Preset</Label>
        <Select value={presetId} onValueChange={handlePresetChange}>
          <SelectTrigger className="bg-white">
            <SelectValue placeholder="Selecciona un formato" />
          </SelectTrigger>
          <SelectContent>
            {presetOptions.map((preset) => (
              <SelectItem key={preset.presetId} value={preset.presetId}>
                {preset.display.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedPreset && (
          <p className="text-sm text-slate-600">{selectedPreset.display.description}</p>
        )}
        {tournamentType === 'AMERICAN' && tournamentStatus && tournamentStatus !== 'NOT_STARTED' && (
          <p className="text-xs text-slate-500">
            En torneo iniciado solo se permite cambio runtime entre MZ2 y MZ3.
          </p>
        )}
      </div>

      {businessError && (
        <Alert variant="destructive">
          <AlertDescription>{businessError}</AlertDescription>
        </Alert>
      )}

      {selectedPreset?.advancementConfig.kind === 'SINGLE' && (
        <div className="space-y-2">
          <Label htmlFor="single-advance-count">Parejas que avanzan a la llave</Label>
          <Input
            id="single-advance-count"
            type="number"
            min="2"
            max={registeredCouplesCount > 0 ? registeredCouplesCount : undefined}
            value={singleAdvanceCount}
            onChange={(event) => {
              const raw = Number(event.target.value || 0)
              if (registeredCouplesCount > 0) {
                setSingleAdvanceCount(Math.min(raw, registeredCouplesCount))
                return
              }
              setSingleAdvanceCount(raw)
            }}
            className="bg-white"
          />
          {registeredCouplesCount > 0 && (
            <p className="text-xs text-slate-500">
              Máximo permitido: {registeredCouplesCount} (parejas inscriptas).
            </p>
          )}
        </div>
      )}

      {selectedPreset?.advancementConfig.kind === 'GOLD_SILVER' && (
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="gold-count">Oro</Label>
            <Input
              id="gold-count"
              type="number"
              min="0"
              value={goldCount}
              onChange={(event) => setGoldCount(Number(event.target.value || 0))}
              className="bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="silver-count">Plata</Label>
            <Input
              id="silver-count"
              type="number"
              min="0"
              value={silverCount}
              onChange={(event) => setSilverCount(Number(event.target.value || 0))}
              className="bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eliminated-count">Afuera</Label>
            <Input
              id="eliminated-count"
              type="number"
              min="0"
              value={eliminatedCount}
              onChange={(event) => setEliminatedCount(Number(event.target.value || 0))}
              className="bg-white"
            />
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4 border-t">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando...' : 'Guardar Formato'}
        </Button>
      </div>
    </form>
  )
}
