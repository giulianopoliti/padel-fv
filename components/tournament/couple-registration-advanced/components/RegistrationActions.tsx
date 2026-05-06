"use client"

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Users, RotateCcw, Loader2, CheckCircle } from 'lucide-react'

interface RegistrationActionsProps {
  isSelectionComplete: boolean
  hasErrors: boolean
  isSubmitting: boolean
  onSubmit: () => void
  onReset: () => void
}

export default function RegistrationActions({
  isSelectionComplete,
  hasErrors,
  isSubmitting,
  onSubmit,
  onReset
}: RegistrationActionsProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <Button
            variant="outline"
            onClick={onReset}
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Limpiar Selección
          </Button>
          
          <Button
            onClick={onSubmit}
            disabled={!isSelectionComplete || hasErrors || isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registrando pareja...
              </>
            ) : isSelectionComplete && !hasErrors ? (
              <>
                <CheckCircle className="h-4 w-4" />
                Registrar Pareja en el Torneo
              </>
            ) : (
              <>
                <Users className="h-4 w-4" />
                Registrar Pareja
              </>
            )}
          </Button>
        </div>
        
        {!isSelectionComplete && !hasErrors && (
          <div className="text-center mt-3">
            <p className="text-sm text-gray-500">
              Seleccione ambos jugadores para continuar
            </p>
          </div>
        )}
        
        {hasErrors && (
          <div className="text-center mt-3">
            <p className="text-sm text-red-500">
              Corrija los errores para continuar
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 