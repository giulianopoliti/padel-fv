import { useState, useCallback } from 'react';
import { MatchValidationResult } from '@/lib/services/match-validation.service';

interface UseMatchValidationOptions {
  onValidationError?: (errors: string[]) => void;
  onValidationWarning?: (warnings: string[]) => void;
}

export function useMatchValidation(options: UseMatchValidationOptions = {}) {
  const [isValidating, setIsValidating] = useState(false);
  const [lastValidation, setLastValidation] = useState<MatchValidationResult | null>(null);

  const validateMatch = useCallback(async (
    zoneId: string,
    couple1Id: string,
    couple2Id: string
  ): Promise<MatchValidationResult> => {
    setIsValidating(true);
    
    try {
      const response = await fetch(`/api/zones/${zoneId}/validate-match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          couple1Id,
          couple2Id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to validate match');
      }

      const validation: MatchValidationResult = await response.json();
      setLastValidation(validation);

      // Call option handlers
      if (!validation.isValid && options.onValidationError) {
        const errorMessages = validation.errors.map(err => err.message);
        options.onValidationError(errorMessages);
      }

      if (validation.warnings && validation.warnings.length > 0 && options.onValidationWarning) {
        options.onValidationWarning(validation.warnings);
      }

      return validation;

    } catch (error) {
      console.error('Error validating match:', error);
      const errorResult: MatchValidationResult = {
        isValid: false,
        errors: [{
          field: 'network',
          message: 'Error de conexión al validar el partido',
          code: 'NETWORK_ERROR'
        }]
      };
      
      setLastValidation(errorResult);
      return errorResult;
      
    } finally {
      setIsValidating(false);
    }
  }, [options]);

  const clearValidation = useCallback(() => {
    setLastValidation(null);
  }, []);

  return {
    validateMatch,
    clearValidation,
    isValidating,
    lastValidation,
    isValid: lastValidation?.isValid ?? null,
    errors: lastValidation?.errors ?? [],
    warnings: lastValidation?.warnings ?? []
  };
}

// Hook específico para componentes de drag & drop
export function useDragDropValidation() {
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  const { validateMatch, isValidating } = useMatchValidation({
    onValidationError: setValidationErrors,
    onValidationWarning: setValidationWarnings
  });

  const validateDragDrop = useCallback(async (
    zoneId: string,
    draggedCoupleId: string,
    targetCoupleId: string
  ): Promise<boolean> => {
    // Clear previous validations
    setValidationErrors([]);
    setValidationWarnings([]);

    const validation = await validateMatch(zoneId, draggedCoupleId, targetCoupleId);
    return validation.isValid;
  }, [validateMatch]);

  const clearMessages = useCallback(() => {
    setValidationErrors([]);
    setValidationWarnings([]);
  }, []);

  return {
    validateDragDrop,
    clearMessages,
    isValidating,
    errors: validationErrors,
    warnings: validationWarnings,
    hasErrors: validationErrors.length > 0,
    hasWarnings: validationWarnings.length > 0
  };
}