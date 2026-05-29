import type {
  AdvancementConfig,
  BracketKey,
  CouplesPerZone,
} from '@/types/tournament-format-v2'

export interface QualificationPolicyEntry {
  localPosition: number | null
  zoneId: string | null
}

export function isValidCouplesPerZone(value: unknown): value is CouplesPerZone {
  return value === 2 || value === 3 || value === 'ALL'
}

export function selectPerZoneTopEntries<T extends QualificationPolicyEntry>(
  entries: T[],
  couplesPerZone: CouplesPerZone
): T[] {
  if (couplesPerZone === 'ALL') {
    return entries
  }

  return entries.filter((entry) => (
    entry.zoneId !== null &&
    entry.localPosition !== null &&
    entry.localPosition <= couplesPerZone
  ))
}

export function selectQualifiedEntries<T extends QualificationPolicyEntry>(
  entries: T[],
  advancementConfig: AdvancementConfig,
  bracketKey: BracketKey = 'MAIN'
): T[] {
  if (advancementConfig.kind === 'PER_ZONE_TOP') {
    return selectPerZoneTopEntries(entries, advancementConfig.couplesPerZone)
  }

  if (advancementConfig.kind === 'SINGLE') {
    return entries.slice(0, advancementConfig.advanceCount)
  }

  if (advancementConfig.kind === 'GOLD_SILVER') {
    if (bracketKey === 'GOLD') {
      return entries.slice(0, advancementConfig.goldCount)
    }

    if (bracketKey === 'SILVER') {
      const offset = advancementConfig.goldCount
      return entries.slice(offset, offset + advancementConfig.silverCount)
    }
  }

  return entries
}
