/**
 * Shared DNI utilities for player conflict detection.
 * Extracted from app/(main)/register/actions.ts for reuse across registration flows.
 */

/**
 * Helper function to check if a player exists by DNI
 */
export async function checkPlayerByDNI(dni: string, supabase: any) {
  const { data: existingPlayer, error } = await supabase
    .from('players')
    .select('id, first_name, last_name, dni, user_id, score, category_name, is_categorized')
    .eq('dni', dni)
    .maybeSingle();

  if (error) {
    console.error(`[checkPlayerByDNI] Error searching player by DNI ${dni}:`, error);
    return { success: false, error: error.message };
  }

  return { success: true, player: existingPlayer };
}

/**
 * Helper function to link a user to an existing player
 */
export async function linkUserToExistingPlayer(
  playerId: string,
  userId: string,
  supabase: any,
  extraData?: { phone?: string | null; gender?: string | null; dateOfBirth?: string | null }
) {
  const updateData: any = { user_id: userId };

  if (extraData) {
    if (extraData.phone && extraData.phone.trim() !== '') {
      updateData.phone = extraData.phone;
    }
    if (extraData.gender && extraData.gender.trim() !== '') {
      updateData.gender = extraData.gender as 'MALE' | 'FEMALE' | 'MIXED';
    }
    if (extraData.dateOfBirth && extraData.dateOfBirth.trim() !== '') {
      updateData.date_of_birth = extraData.dateOfBirth;
    }
  }

  const { error } = await supabase
    .from('players')
    .update(updateData)
    .eq('id', playerId);

  if (error) {
    console.error(`[linkUserToExistingPlayer] Error linking user to player:`, error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Advanced normalize function for flexible string comparison
 */
export function advancedNormalize(str: string | null | undefined): string {
  if (!str) return '';

  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,-]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity percentage between two strings
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Super flexible name matching algorithm (5 levels)
 */
export function superFlexibleNameMatch(existing: string, provided: string): {
  isMatch: boolean;
  confidence: number;
  reason: string;
} {
  const normalizedExisting = advancedNormalize(existing);
  const normalizedProvided = advancedNormalize(provided);

  // NIVEL 1: Match exacto normalizado
  if (normalizedExisting === normalizedProvided) {
    return { isMatch: true, confidence: 1.0, reason: 'exact_match' };
  }

  // NIVEL 2: Uno contiene al otro
  if (normalizedExisting.includes(normalizedProvided) || normalizedProvided.includes(normalizedExisting)) {
    if (normalizedProvided.startsWith(normalizedExisting + ' ') ||
        normalizedExisting.startsWith(normalizedProvided + ' ')) {
      return { isMatch: true, confidence: 0.98, reason: 'middle_name_match' };
    }
    const similarity = calculateSimilarity(normalizedExisting, normalizedProvided);
    if (similarity >= 0.7) {
      return { isMatch: true, confidence: 0.95, reason: 'contains_match' };
    }
  }

  // NIVEL 3: Palabras en común
  const existingWords = normalizedExisting.split(' ').filter(w => w.length > 1);
  const providedWords = normalizedProvided.split(' ').filter(w => w.length > 1);

  if (existingWords.length > 0 && providedWords.length > 0) {
    let commonWords = 0;
    const totalWords = Math.max(existingWords.length, providedWords.length);

    for (const existingWord of existingWords) {
      for (const providedWord of providedWords) {
        if (existingWord === providedWord) {
          commonWords += 1;
          break;
        }
        if (existingWord.length > 2 && providedWord.length > 2) {
          if (levenshteinDistance(existingWord, providedWord) <= 1) {
            commonWords += 0.8;
            break;
          }
        }
      }
    }

    const wordSimilarity = commonWords / totalWords;
    if (wordSimilarity >= 0.6) {
      return { isMatch: true, confidence: wordSimilarity, reason: 'word_similarity' };
    }
  }

  // NIVEL 4: Similitud por distancia de edición (mínimo 80%)
  const similarity = calculateSimilarity(normalizedExisting, normalizedProvided);
  if (similarity >= 0.8) {
    return { isMatch: true, confidence: similarity, reason: 'edit_distance' };
  }

  // NIVEL 5: Match de iniciales + apellido completo
  const existingParts = normalizedExisting.split(' ');
  const providedParts = normalizedProvided.split(' ');

  if (existingParts.length >= 2 && providedParts.length >= 2) {
    const existingFirst = existingParts[0];
    const existingLast = existingParts[existingParts.length - 1];
    const providedFirst = providedParts[0];
    const providedLast = providedParts[providedParts.length - 1];

    if (existingLast === providedLast && existingFirst.charAt(0) === providedFirst.charAt(0)) {
      return { isMatch: true, confidence: 0.75, reason: 'initial_lastname_match' };
    }
  }

  return { isMatch: false, confidence: similarity, reason: 'no_match' };
}

/**
 * Validates whether a new registration can be linked to an existing player
 */
export function validatePlayerLinking(
  existingPlayer: { first_name?: string | null; last_name?: string | null },
  firstName: string,
  lastName: string
) {
  const firstNameResult = superFlexibleNameMatch(existingPlayer.first_name || '', firstName || '');
  const lastNameResult = superFlexibleNameMatch(existingPlayer.last_name || '', lastName || '');

  const fullExistingName = `${existingPlayer.first_name || ''} ${existingPlayer.last_name || ''}`.trim();
  const fullProvidedName = `${firstName || ''} ${lastName || ''}`.trim();
  const fullNameResult = superFlexibleNameMatch(fullExistingName, fullProvidedName);

  const isValid =
    (firstNameResult.isMatch && lastNameResult.isMatch &&
     Math.min(firstNameResult.confidence, lastNameResult.confidence) >= 0.7) ||
    (fullNameResult.isMatch && fullNameResult.confidence >= 0.8) ||
    (firstNameResult.reason === 'middle_name_match' && lastNameResult.isMatch && lastNameResult.confidence >= 0.95);

  const avgConfidence = (firstNameResult.confidence + lastNameResult.confidence + fullNameResult.confidence) / 3;

  return {
    isValid,
    confidence: avgConfidence,
    existingName: fullExistingName,
    providedName: fullProvidedName,
    details: { firstName: firstNameResult, lastName: lastNameResult, fullName: fullNameResult }
  };
}
