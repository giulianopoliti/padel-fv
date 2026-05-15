import type { BracketMatchV2, CoupleData, ParticipantSlot, SeedInfo } from '../types/bracket-types'

type SlotPosition = 'slot1' | 'slot2'

interface CoupleZoneInfo {
  slot: SlotPosition
  coupleId: string
  coupleName?: string
  zoneId: string
  zoneName?: string | null
}

interface PlaceholderZoneInfo {
  slot: SlotPosition
  label: string
  zoneId: string
  zoneName?: string | null
  position?: number | null
}

export interface SameZonePlaceholderConflict {
  coupleSlot: SlotPosition
  placeholderSlot: SlotPosition
  coupleId: string
  coupleName?: string
  placeholderLabel: string
  zoneId: string
  zoneName?: string | null
  placeholderPosition?: number | null
}

const getCoupleName = (couple: CoupleData): string | undefined => {
  if (couple.name) return couple.name

  if (couple.player1_details && couple.player2_details) {
    return `${couple.player1_details.first_name} ${couple.player1_details.last_name} / ${couple.player2_details.first_name} ${couple.player2_details.last_name}`
  }

  return undefined
}

const getSeedForCouple = (coupleId: string, slotSeed: SeedInfo | undefined, seeds: SeedInfo[]): SeedInfo | undefined => {
  if (slotSeed?.couple_id === coupleId) return slotSeed
  return seeds.find(seed => seed.couple_id === coupleId)
}

const getCoupleZoneInfo = (
  slot: ParticipantSlot,
  slotName: SlotPosition,
  seeds: SeedInfo[]
): CoupleZoneInfo | null => {
  if (slot.type !== 'couple' || !slot.couple?.id) return null

  const seed = getSeedForCouple(slot.couple.id, slot.seed || slot.couple.seed, seeds)
  const zoneId = seed?.zone_id
  if (!zoneId) return null

  return {
    slot: slotName,
    coupleId: slot.couple.id,
    coupleName: getCoupleName(slot.couple),
    zoneId,
    zoneName: seed?.zone_name
  }
}

const getPlaceholderZoneInfo = (
  slot: ParticipantSlot,
  slotName: SlotPosition
): PlaceholderZoneInfo | null => {
  if (slot.type !== 'placeholder' || !slot.placeholder) return null

  const zoneId = slot.placeholder.zoneId || slot.placeholder.rule.zoneId || slot.seed?.placeholder_zone_id || slot.seed?.zone_id
  if (!zoneId) return null

  return {
    slot: slotName,
    label: slot.placeholder.display,
    zoneId,
    zoneName: slot.placeholder.zoneName || slot.seed?.zone_name,
    position: slot.placeholder.position || slot.placeholder.rule.position || slot.seed?.placeholder_position || slot.seed?.zone_position
  }
}

const buildConflict = (
  couple: CoupleZoneInfo | null,
  placeholder: PlaceholderZoneInfo | null
): SameZonePlaceholderConflict | null => {
  if (!couple || !placeholder) return null
  if (couple.zoneId !== placeholder.zoneId) return null

  return {
    coupleSlot: couple.slot,
    placeholderSlot: placeholder.slot,
    coupleId: couple.coupleId,
    coupleName: couple.coupleName,
    placeholderLabel: placeholder.label,
    zoneId: couple.zoneId,
    zoneName: couple.zoneName || placeholder.zoneName,
    placeholderPosition: placeholder.position
  }
}

export function detectSameZonePlaceholderConflict(
  match: BracketMatchV2,
  seeds: SeedInfo[] = []
): SameZonePlaceholderConflict | null {
  const slot1 = match.participants?.slot1
  const slot2 = match.participants?.slot2
  if (!slot1 || !slot2) return null

  return (
    buildConflict(getCoupleZoneInfo(slot1, 'slot1', seeds), getPlaceholderZoneInfo(slot2, 'slot2')) ||
    buildConflict(getCoupleZoneInfo(slot2, 'slot2', seeds), getPlaceholderZoneInfo(slot1, 'slot1'))
  )
}
