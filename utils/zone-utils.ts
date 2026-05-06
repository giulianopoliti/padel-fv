/**
 * Devuelve un arreglo de zonas (slots vacíos) indicando únicamente
 * el nombre y la capacidad en parejas de cada zona.
 * 
 * Regla de distribución:
 * - Zonas de 4 parejas por defecto.
 * - Si el resto al dividir totalCouples por 4 es 1 → requiere al menos 9 parejas
 *   y se usan 3 zonas de 3 (restando 2 zonas de 4).
 * - Resto 2  → 2 zonas de 3 (y se quita 1 de 4).
 * - Resto 3  → 1 zona de 3 (el resto de 4).
 */
export type ZoneSkeleton = {
  name: string;   // "Zone A", "Zone B", etc.
  capacity: number; // 3 ó 4
};

export function createEmptyZones(totalCouples: number): ZoneSkeleton[] {
  if (totalCouples < 6) {
    throw new Error(`El torneo requiere al menos 6 parejas. Recibidas: ${totalCouples}.`);
  }

  let numZonesOf4 = 0;
  let numZonesOf3 = 0;

  switch (totalCouples % 4) {
    case 0:
      numZonesOf4 = totalCouples / 4;
      break;
    case 1:
      if (totalCouples < 9) {
        throw new Error(`No se pueden formar zonas con ${totalCouples} parejas (resto 1). Se requieren al menos 9.`);
      }
      numZonesOf4 = Math.floor(totalCouples / 4) - 2;
      numZonesOf3 = 3;
      break;
    case 2:
      numZonesOf4 = Math.floor(totalCouples / 4) - 1;
      numZonesOf3 = 2;
      break;
    case 3:
      numZonesOf4 = Math.floor(totalCouples / 4);
      numZonesOf3 = 1;
      break;
  }

  const zones: ZoneSkeleton[] = [];
  let zoneCounter = 0;

  const pushZone = (cap: number) => {
    zones.push({
      name: `Zone ${String.fromCharCode(65 + zoneCounter)}`,
      capacity: cap,
    });
    zoneCounter++;
  };

  for (let i = 0; i < numZonesOf4; i++) pushZone(4);
  for (let i = 0; i < numZonesOf3; i++) pushZone(3);

  return zones;
} 

// -----------------------------------------------------------------------------
// Asigna parejas a zonas en patrón de serpiente (snake seeding)
// -----------------------------------------------------------------------------

export type Couple = { couple_id: string; [key: string]: any };

export function snakeAssignCouplesToZones<T extends Couple>(
  couples: T[],
  zoneSkeletons: (ZoneSkeleton & { couples?: T[] })[],
): (ZoneSkeleton & { couples: T[] })[] {
  // Crear copia sólida de las zonas con arreglo couples inicializado
  const zones = zoneSkeletons.map((z) => ({ ...z, couples: (z.couples ?? []) as T[] }));

  const remaining: T[] = [...couples];
  let dir = 1; // +1 = bajar / avanzar, -1 = subir / retroceder
  let z = 0;   // zona actual

  while (remaining.length) {
    // 1) insertar si hay espacio
    if (zones[z].couples.length < zones[z].capacity) {
      zones[z].couples.push(remaining.shift() as T);
    }

    if (!remaining.length) break;

    // 2) calcular próxima zona
    const next = z + dir;

    // 3) ¿salimos del rango?  → invertimos dirección PERO nos quedamos
    if (next < 0 || next >= zones.length) {
      dir *= -1; // cambiar sentido
      // z se mantiene; en la próxima iteración agregaremos otra pareja a la misma zona límite
    } else {
      z = next; // movimiento normal dentro del rango
    }
  }
   
  return zones;
} 