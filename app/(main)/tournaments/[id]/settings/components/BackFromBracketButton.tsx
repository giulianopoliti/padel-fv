'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, AlertTriangle, RotateCcw } from 'lucide-react'
import { getBackFromBracketPreview, backTournamentFromBracketToZones } from '../actions'

interface BackFromBracketButtonProps {
  tournamentId: string
}

interface BracketPreviewData {
  seedsCount: number
  hierarchyCount: number
  bracketMatchesCount: number
  finishedBracketMatches: number
  pendingBracketMatches: number
}

export default function BackFromBracketButton({ tournamentId }: BackFromBracketButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [previewData, setPreviewData] = useState<BracketPreviewData | null>(null)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const { toast } = useToast()

  const handleOpenDialog = async () => {
    setIsLoading(true)
    setIsConfirmed(false)
    
    try {
      const result = await getBackFromBracketPreview(tournamentId)
      
      if (!result.success) {
        toast({
          title: 'Error',
          description: result.error || 'No se pudo obtener la información del bracket',
          variant: 'destructive'
        })
        return
      }

      if (!result.data) {
        toast({
          title: 'Información',
          description: 'No hay datos de bracket para eliminar en este torneo',
          variant: 'default'
        })
        return
      }

      setPreviewData(result.data)
      setIsDialogOpen(true)
    } catch (error) {
      console.error('Error getting preview:', error)
      toast({
        title: 'Error',
        description: 'Error al obtener la información del bracket',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmReset = async () => {
    if (!isConfirmed) {
      toast({
        title: 'Confirmación requerida',
        description: 'Debes confirmar que entiendes las consecuencias de esta acción',
        variant: 'destructive'
      })
      return
    }

    setIsConfirming(true)
    
    try {
      const result = await backTournamentFromBracketToZones(tournamentId)
      
      if (result.success) {
        toast({
          title: 'Éxito',
          description: result.message || 'Torneo revertido exitosamente a fase de zonas',
          variant: 'default'
        })
        setIsDialogOpen(false)
        setIsConfirmed(false)
        setPreviewData(null)
        // Recargar la página después de un breve delay
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudo revertir el torneo',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error reverting tournament:', error)
      toast({
        title: 'Error',
        description: 'Error inesperado al revertir el torneo',
        variant: 'destructive'
      })
    } finally {
      setIsConfirming(false)
    }
  }

  const totalItems = previewData ? 
    previewData.seedsCount + previewData.hierarchyCount + previewData.bracketMatchesCount : 0

  const hasFinishedMatches = previewData && previewData.finishedBracketMatches > 0

  return (
    <>
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="text-orange-800 flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Volver a Fase de Zonas
          </CardTitle>
          <CardDescription className="text-orange-700">
            Revierte el torneo a fase de zonas, eliminando el bracket generado pero manteniendo los datos de zona intactos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleOpenDialog}
            variant="outline"
            className="w-full border-orange-300 hover:bg-orange-100 text-orange-800"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cargando información...
              </>
            ) : (
              <>
                <RotateCcw className="mr-2 h-4 w-4" />
                Revertir a Fase de Zonas
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              ¿Revertir a fase de zonas?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Esta acción eliminará <strong>permanentemente</strong> el bracket generado:</p>
              
              {previewData && (
                <div className="bg-orange-50 border border-orange-200 rounded-md p-3 space-y-1">
                  <h4 className="font-medium text-orange-900">Datos a eliminar:</h4>
                  <div className="text-sm text-orange-800 space-y-1">
                    {previewData.seedsCount > 0 && (
                      <p>• {previewData.seedsCount} seed{previewData.seedsCount !== 1 ? 's' : ''} del bracket</p>
                    )}
                    {previewData.hierarchyCount > 0 && (
                      <p>• {previewData.hierarchyCount} relación{previewData.hierarchyCount !== 1 ? 'es' : ''} de jerarquía</p>
                    )}
                    {previewData.bracketMatchesCount > 0 && (
                      <p>• {previewData.bracketMatchesCount} partido{previewData.bracketMatchesCount !== 1 ? 's' : ''} de bracket</p>
                    )}
                    {totalItems === 0 && (
                      <p>• No hay datos de bracket para eliminar</p>
                    )}
                  </div>
                </div>
              )}

              {hasFinishedMatches && (
                <div className="bg-red-100 border-2 border-red-300 rounded-md p-3 space-y-1">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-red-900">¡ATENCIÓN!</h4>
                      <p className="text-sm text-red-800 mt-1">
                        Hay <strong>{previewData?.finishedBracketMatches}</strong> partido{previewData?.finishedBracketMatches !== 1 ? 's' : ''} de bracket ya finalizado{previewData?.finishedBracketMatches !== 1 ? 's' : ''}.
                        Se perderán todos estos resultados permanentemente.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  ℹ️ Los datos de zona (partidos, posiciones, estadísticas) se mantendrán intactos.
                  Podrás regenerar el bracket cuando estés listo.
                </p>
              </div>
              
              <p className="text-orange-800 font-medium">
                ⚠️ Esta acción no se puede deshacer.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="confirm-bracket-reset" 
                checked={isConfirmed}
                onCheckedChange={(checked) => setIsConfirmed(checked as boolean)}
              />
              <label 
                htmlFor="confirm-bracket-reset" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Entiendo que se eliminará el bracket y sus resultados
              </label>
            </div>
          </div>

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel 
              onClick={() => {
                setIsDialogOpen(false)
                setIsConfirmed(false)
              }}
              disabled={isConfirming}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReset}
              disabled={!isConfirmed || isConfirming}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Revirtiendo...
                </>
              ) : (
                'Confirmar y Revertir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
