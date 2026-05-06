import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const INSCRIPTION_PROOFS_BUCKET = 'inscription-proofs'

function sanitizeFileName(fileName: string): string {
  const normalized = fileName
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || `proof-${randomUUID()}`
}

export function buildInscriptionProofPath(
  tournamentId: string,
  inscriptionId: string,
  fileName: string
): string {
  const safeFileName = sanitizeFileName(fileName)
  return `tournament/${tournamentId}/inscription/${inscriptionId}/${Date.now()}-${safeFileName}`
}

export async function uploadInscriptionProof(params: {
  tournamentId: string
  inscriptionId: string
  fileName: string
  fileBytes: ArrayBuffer
  contentType: string
}) {
  const { tournamentId, inscriptionId, fileName, fileBytes, contentType } = params
  const filePath = buildInscriptionProofPath(tournamentId, inscriptionId, fileName)

  const { error } = await supabaseAdmin.storage
    .from(INSCRIPTION_PROOFS_BUCKET)
    .upload(filePath, Buffer.from(fileBytes), {
      contentType,
      upsert: false,
    })

  if (error) {
    return {
      success: false as const,
      error: error.message,
    }
  }

  return {
    success: true as const,
    filePath,
  }
}

export async function deleteInscriptionProof(filePath: string | null | undefined) {
  if (!filePath) {
    return { success: true as const }
  }

  const { error } = await supabaseAdmin.storage
    .from(INSCRIPTION_PROOFS_BUCKET)
    .remove([filePath])

  if (error) {
    return {
      success: false as const,
      error: error.message,
    }
  }

  return { success: true as const }
}

export async function createInscriptionProofSignedUrl(filePath: string, expiresInSeconds = 60 * 10) {
  const { data, error } = await supabaseAdmin.storage
    .from(INSCRIPTION_PROOFS_BUCKET)
    .createSignedUrl(filePath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    return {
      success: false as const,
      error: error?.message || 'No se pudo generar la URL firmada',
    }
  }

  return {
    success: true as const,
    signedUrl: data.signedUrl,
  }
}
