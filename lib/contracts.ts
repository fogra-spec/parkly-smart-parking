export type Role = 'driver' | 'operator' | 'admin';
export type AuthMode = 'demo' | 'sites' | 'disabled' | 'password';
export type User = { id: string; name: string; role: Role; active: number; roles?: Role[] };
export type Lot = {
  id: string; code?: string; owner: string; name: string; area: string; lat: string; lng: string;
  type: string; price: number; capacity: number; available: number; approved: number;
  managed?: boolean; inventory_source?: string; occupancy_source?: string; address?:string; rules?: string; hours?: string;
  bookable_capacity?: number; reserved_now?: number;
};
export type Booking = {
  id: string; user_id: string; lot_id: string; name: string; start: number;
  end: number; total: number; status: 'confirmed' | 'cancelled' | 'operator_cancelled' | 'completed' | 'expired';
  hourly_price: number | null; created: number;
  reference?: string; space_label?: string; floor_name?:string; address?:string; session_id?: string; session_state?: string;
};
export type ParklyData = {
  user: User | null; lots: Lot[]; bookings: Booking[]; users: User[];
  favorites: { lot_id: string }[];
  summary?:{bookings:{total:number;active:number;upcoming:number;completedValue:number};operations:{total:number;active:number;completedGmv:number}|null;administration:{users:number;operators:number;pendingFacilities:number;pendingApplications:number;openCases:number}|null}|null;
  auth?: { mode: AuthMode; signInPath: string; signOutPath: string };
};
