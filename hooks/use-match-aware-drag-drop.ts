/**
 * Match-Aware Drag & Drop Hook
 * 
 * Extends the existing drag & drop system with match validation
 * Prevents invalid match creation while maintaining flexibility
 */

import { useCallback, useState } from 'react';
import { useDragDropOperations } from '@/components/tournament/zones/hooks/use-drag-drop';
import { useDragDropValidation } from './use-match-validation';
import type { DragItem, DropTarget, DragOperation } from '@/components/tournament/zones/types/drag-types';

interface MatchCreationOptions {
  court?: number;
  autoCreateMatch?: boolean; // If true, creates match automatically on valid drop
  onMatchCreated?: (matchId: string) => void;
  onMatchValidationError?: (errors: string[]) => void;
}

export function useMatchAwareDragDrop(
  tournamentId: string,
  options: MatchCreationOptions = {}
) {
  const [isCreatingMatch, setIsCreatingMatch] = useState(false);
  const [lastCreatedMatch, setLastCreatedMatch] = useState<string | null>(null);

  // Base drag & drop functionality
  const dragDrop = useDragDropOperations({
    maxCouplesPerZone: 5, // Allow up to 5 for edge cases
    allowSwapping: true,
    allowDeletion: true
  });

  // Match validation
  const validation = useDragDropValidation();

  /**
   * Enhanced drop handler that validates match creation
   */
  const handleMatchAwareDrop = useCallback(async (
    dropTarget: DropTarget,
    currentZoneCounts: Record<string, number> = {}
  ): Promise<{ success: boolean; message?: string; matchId?: string }> => {
    const { draggedItem } = dragDrop;
    
    if (!draggedItem) {
      return { success: false, message: 'No hay elemento siendo arrastrado' };
    }

    // First, validate the basic drag & drop operation
    const basicValidation = dragDrop.handleDrop(dropTarget, currentZoneCounts);
    
    if (!basicValidation.success) {
      return basicValidation;
    }

    // If dropping to create a match (zone to zone), validate match rules
    if (dropTarget.type === 'zone' && draggedItem.type === 'zone-couple') {
      const sourceZoneId = draggedItem.sourceZoneId;
      const targetZoneId = dropTarget.id;

      // Only validate if it's actually a match creation (different zones or same zone for pairing)
      if (sourceZoneId !== targetZoneId) {
        // This is a zone-to-zone move, not a match creation
        return basicValidation;
      }

      // If same zone, we might be creating a match between couples
      // This would need additional context about the target couple
      // For now, we'll handle this in a separate function
    }

    return basicValidation;
  }, [dragDrop]);

  /**
   * Create a match between two couples with validation
   */
  const createValidatedMatch = useCallback(async (
    zoneId: string,
    couple1Id: string,
    couple2Id: string,
    court: number = options.court || 1
  ): Promise<{ success: boolean; message?: string; matchId?: string }> => {
    
    setIsCreatingMatch(true);
    validation.clearMessages();

    try {
      // First validate the match
      const isValid = await validation.validateDragDrop(zoneId, couple1Id, couple2Id);
      
      if (!isValid) {
        if (options.onMatchValidationError) {
          options.onMatchValidationError(validation.errors);
        }
        return { 
          success: false, 
          message: validation.errors.join('. ') 
        };
      }

      // If auto-create is enabled, create the match
      if (options.autoCreateMatch) {
        const response = await fetch(`/api/tournaments/${tournamentId}/matches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            zoneId,
            couple1Id,
            couple2Id,
            court
          })
        });

        if (!response.ok) {
          const error = await response.json();
          return { 
            success: false, 
            message: error.error || 'Error al crear el partido' 
          };
        }

        const result = await response.json();
        const matchId = result.match?.id;
        
        if (matchId) {
          setLastCreatedMatch(matchId);
          if (options.onMatchCreated) {
            options.onMatchCreated(matchId);
          }
        }

        return { 
          success: true, 
          message: 'Partido creado exitosamente',
          matchId
        };
      }

      // If not auto-creating, just return validation success
      return { 
        success: true, 
        message: 'Partido válido para crear' 
      };

    } catch (error) {
      console.error('Error creating match:', error);
      return { 
        success: false, 
        message: 'Error interno al crear el partido' 
      };
    } finally {
      setIsCreatingMatch(false);
    }
  }, [tournamentId, validation, options]);

  /**
   * Enhanced drop handler specifically for match creation
   */
  const handleMatchCreationDrop = useCallback(async (
    zoneId: string,
    couple1Id: string,
    couple2Id: string,
    court?: number
  ) => {
    return createValidatedMatch(zoneId, couple1Id, couple2Id, court);
  }, [createValidatedMatch]);

  /**
   * Preview validation without creating match
   */
  const previewMatchValidation = useCallback(async (
    zoneId: string,
    couple1Id: string,
    couple2Id: string
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> => {
    const isValid = await validation.validateDragDrop(zoneId, couple1Id, couple2Id);
    
    return {
      isValid,
      errors: validation.errors,
      warnings: validation.warnings
    };
  }, [validation]);

  /**
   * Check if a couple can be used to create matches
   */
  const canCoupleCreateMatch = useCallback((coupleId: string): boolean => {
    // Check if couple can be dragged (from base system)
    const canDrag = dragDrop.canDragCouple(coupleId);
    
    // Add any additional match-specific restrictions here
    // For example: check if couple has already played maximum matches
    
    return canDrag;
  }, [dragDrop]);

  /**
   * Get comprehensive feedback for a potential match
   */
  const getMatchCreationFeedback = useCallback((
    zoneId: string,
    couple1Id: string,
    couple2Id: string
  ) => {
    // Get basic drag feedback
    const dragFeedback = dragDrop.getDragOverFeedback(zoneId);
    
    // Get match validation feedback
    const hasValidationErrors = validation.errors.length > 0;
    const hasValidationWarnings = validation.warnings.length > 0;
    
    return {
      ...dragFeedback,
      hasMatchErrors: hasValidationErrors,
      hasMatchWarnings: hasValidationWarnings,
      matchErrors: validation.errors,
      matchWarnings: validation.warnings,
      canCreateMatch: dragFeedback.canDrop && !hasValidationErrors
    };
  }, [dragDrop, validation]);

  return {
    // Base drag & drop functionality
    ...dragDrop,
    
    // Enhanced match-aware handlers
    handleDrop: handleMatchAwareDrop,
    handleMatchCreationDrop,
    createValidatedMatch,
    previewMatchValidation,
    getMatchCreationFeedback,
    
    // Match creation state
    isCreatingMatch,
    lastCreatedMatch,
    
    // Validation state
    isValidatingMatch: validation.isValidating,
    matchValidationErrors: validation.errors,
    matchValidationWarnings: validation.warnings,
    hasMatchValidationErrors: validation.hasErrors,
    hasMatchValidationWarnings: validation.hasWarnings,
    
    // Utilities
    canCoupleCreateMatch,
    clearMatchValidation: validation.clearMessages
  };
}