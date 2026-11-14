import credits from '../public/photos/credits.json';
import type { Lot } from './contracts';

export type ParkingPhoto = typeof credits.p1;
export const parkingPhotoCredits: Record<string, ParkingPhoto> = credits;

/** These depict nearby areas, never a verified parking entrance or partnership. */
export function photoForLot(lot: Pick<Lot, 'id' | 'code'>): ParkingPhoto {
  const photo = parkingPhotoCredits[lot.code || lot.id];
  return photo || { ...credits.p4, alt: 'Astana skyline seen from Nur Alem', caption: 'Astana city photo' };
}
