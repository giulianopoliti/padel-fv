import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlayerScore } from '@/types';
import { Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface PointsReviewDialogProps {
  tournamentId: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

interface PointsPreview {
  playerScores: PlayerScore[];
  totalMatches: number;
  tournamentType: 'AMERICAN' | 'LONG';
  config: {
    bonusChampion: number;
    bonusFinalist: number;
  };
}

export function PointsReviewDialog({ 
  tournamentId, 
  isOpen, 
  onClose,
  onConfirm 
}: PointsReviewDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [pointsPreview, setPointsPreview] = useState<PointsPreview | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const { toast } = useToast();

  // Cargar preview de puntos al abrir el diálogo
  React.useEffect(() => {
    if (isOpen && !pointsPreview) {
      loadPointsPreview();
    }
  }, [isOpen]);

  const loadPointsPreview = async () => {
    setIsLoading(true);
    try {
        const response = await fetch(`/api/tournaments/${tournamentId}/points`);
    if (!response.ok) throw new Error('Error al cargar preview');
      const data = await response.json();
      setPointsPreview(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cargar la previsualización de puntos",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!isConfirmed) {
      toast({
        title: "Atención",
        description: "Debes confirmar que entiendes que esta acción es irreversible",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      await onConfirm();
      toast({
        title: "¡Éxito!",
        description: "Los puntos han sido calculados y aplicados correctamente",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron aplicar los puntos",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <TooltipProvider delayDuration={0}>
        <DialogHeader>
          <DialogTitle>Revisión de Puntos del Torneo</DialogTitle>
          <DialogDescription>
            Revisa los puntos que serán otorgados a cada jugador. Esta acción es irreversible.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : pointsPreview ? (
          <>
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jugador</TableHead>
                    <TableHead className="text-right">Puntos Actuales</TableHead>
                    <TableHead className="text-right">Puntos Ganados/Perdidos</TableHead>
                    <TableHead className="text-right">Puntos Finales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pointsPreview.playerScores.map((score) => (
                    <TableRow key={score.playerId}>
                      <TableCell className="whitespace-nowrap">
                        {score.playerName}
                        {score.bonus ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={`ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${score.bonus === 40 ? 'bg-green-600 text-white' : 'bg-yellow-500 text-white'}`}>
                                +{score.bonus}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {score.bonus === 40 ? 'Bonus por ganar el torneo' : 'Bonus por llegar a la final'}
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">{score.pointsBefore}</TableCell>
                      <TableCell className={`text-right ${score.pointsEarned >= 0 ? 'text-green-600' : 'text-red-600'}`}> 
                        {score.pointsEarned >= 0 ? '+' : ''}{score.pointsEarned}
                      </TableCell>
                      <TableCell className="text-right font-medium">{score.pointsAfter}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Bonus final: +{pointsPreview.config.bonusChampion} pts para cada jugador de la pareja campeona y +{pointsPreview.config.bonusFinalist} pts para cada jugador de la pareja finalista.
            </p>

            <div className="flex items-center space-x-2 py-4">
              <Checkbox 
                id="confirm" 
                checked={isConfirmed} 
                onCheckedChange={(checked) => setIsConfirmed(checked as boolean)} 
              />
              <label
                htmlFor="confirm"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Entiendo que esta acción es irreversible y los puntos serán aplicados permanentemente
              </label>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={isLoading}>
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirm} 
                disabled={!isConfirmed || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  'Confirmar y Aplicar Puntos'
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            No se pudieron cargar los datos de puntos
          </div>
        )}
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
} 