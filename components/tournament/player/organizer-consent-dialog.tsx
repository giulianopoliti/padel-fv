"use client"

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Shield, Check, X, Info } from 'lucide-react'
import type { ConsentDialogProps } from '@/types/organizer-consent'

/**
 * 🏢 DIALOG DE CONSENTIMIENTO DE ORGANIZADOR
 *
 * Componente que muestra información del organizador del torneo
 * y solicita consentimiento del jugador para gestionar sus datos.
 */
export default function OrganizerConsentDialog({
  open,
  organizador,
  tournamentName,
  onAccept,
  onReject,
  isLoading = false
}: ConsentDialogProps) {

  const handleAccept = () => {
    console.log(`[OrganizerConsentDialog] Usuario acepta organizador: ${organizador.name}`)
    onAccept()
  }

  const handleReject = () => {
    console.log(`[OrganizerConsentDialog] Usuario rechaza organizador: ${organizador.name}`)
    onReject()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !isLoading && onReject()}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader className="text-center pb-4">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-8 w-8 text-blue-600" />
          </div>
          <DialogTitle className="text-xl font-semibold">
            Gestión de Datos del Torneo
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600 mt-2">
            Este torneo es gestionado por una organización externa
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Información del torneo */}
          <Card className="border-blue-100 bg-blue-50">
            <CardContent className="p-4">
              <div className="text-center">
                <h3 className="font-medium text-gray-900 mb-1">{tournamentName}</h3>
                <Badge variant="secondary" className="text-xs">
                  Torneo Oficial
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Información del organizador */}
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{organizador.name}</h4>
                  {organizador.description && (
                    <p className="text-sm text-gray-600 mt-1">{organizador.description}</p>
                  )}
                  <Badge variant="outline" className="mt-2 text-xs">
                    Organizador Oficial
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información sobre el uso de datos */}
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center text-sm text-green-800">
                  <Shield className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="font-medium">¿Cómo se usarán tus datos?</span>
                </div>

                <div className="space-y-2 text-xs text-green-700">
                  <div className="flex items-start">
                    <Check className="h-3 w-3 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Solo para comunicaciones relacionadas con este torneo</span>
                  </div>
                  <div className="flex items-start">
                    <Check className="h-3 w-3 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Coordinar horarios y emparejamientos</span>
                  </div>
                  <div className="flex items-start">
                    <Check className="h-3 w-3 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Enviar resultados y actualizaciones del torneo</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Nota informativa */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-3">
              <div className="flex items-start text-xs text-blue-700">
                <Info className="h-3 w-3 mr-2 mt-0.5 flex-shrink-0" />
                <span>
                  Puedes solicitar la eliminación de tus datos en cualquier momento
                  contactando directamente al organizador.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex gap-3 pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleReject}
            disabled={isLoading}
            className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <X className="h-4 w-4 mr-2" />
            No acepto
          </Button>
          <Button
            type="button"
            onClick={handleAccept}
            disabled={isLoading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Check className="h-4 w-4 mr-2" />
            {isLoading ? 'Registrando...' : 'Sí, acepto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}