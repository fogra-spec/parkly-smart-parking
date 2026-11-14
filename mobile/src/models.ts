// DTO field names match the existing D1/API records; no server runtime imports.
export type ParkingLot={id:string;owner:string;name:string;area:string;lat:string;lng:string;type:string;price:number;capacity:number;approved:number;available:number};
export type BookingStatus='confirmed'|'completed'|'cancelled'|'operator_cancelled';
export type Booking={id:string;user_id:string;lot_id:string;name:string;start:number;end:number;total:number;status:BookingStatus;created:number};
export type Profile={id:string;name:string;email:string;role:'driver';active:1};
export type AppData={user:Profile|null;lots:ParkingLot[];bookings:Booking[]};
export type Filters={query:string;maxPrice:number;type:'All'|'Covered'|'Outdoor';availableOnly:boolean};
export type BookingRequest={lotId:string;start:number;hours:number;quotedPrice:number};
export interface ParklyRepository{
  readonly mode:'mock'|'local-api';
  load():Promise<AppData>;
  signIn(email:string):Promise<AppData>;
  signUp(name:string,email:string):Promise<AppData>;
  signOut():Promise<void>;
  availability(lotId:string,start:number,end:number):Promise<number>;
  book(request:BookingRequest):Promise<Booking>;
  cancel(id:string):Promise<void>;
  updateProfile(name:string):Promise<void>;
}
