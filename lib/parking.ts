import type { Lot } from './contracts';

export type ParkingFilters = { query: string; maxPrice: number | null; type: string; onlyAvailable: boolean };
export function filterParking(lots: Lot[], filters: ParkingFilters): Lot[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return lots.filter(lot => lot.approved === 1 &&
    `${lot.name} ${lot.area}`.toLocaleLowerCase().includes(query) &&
    (filters.maxPrice === null || lot.price <= filters.maxPrice) &&
    (filters.type === 'All' || lot.type === filters.type) &&
    (!filters.onlyAvailable || lot.available > 0));
}
