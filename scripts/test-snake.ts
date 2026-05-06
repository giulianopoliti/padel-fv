import { createEmptyZones, snakeAssignCouplesToZones, Couple, ZoneSkeleton } from "../utils/zone-utils";

function mockCouples(n: number): Couple[] {
  return Array.from({ length: n }, (_, i) => ({
    couple_id: `${i + 1}`,
    player1: { id: `p${i+1}a`, first_name: "", last_name: "", score: 0 },
    player2: { id: `p${i+1}b`, first_name: "", last_name: "", score: 0 },
  }));
}

function runTest(totalCouples: number) {
  const couples = mockCouples(totalCouples);
  const zonesSkeleton: (ZoneSkeleton & { couples?: Couple[] })[] = createEmptyZones(totalCouples).map(z => ({ ...z, couples: [] }));
  const filled = snakeAssignCouplesToZones(couples, zonesSkeleton);
  console.log(`\nTest ${totalCouples} parejas:`);
  filled.forEach((z) => {
    console.log(`${z.name} -> ${z.couples.map(c => c.couple_id).join(', ')}`);
  });
}

runTest(8);  // Esperado: Zone A 1,4,5,8 ; Zone B 2,3,6,7
runTest(12); // Extra: comprobar 3 zonas serpiente 