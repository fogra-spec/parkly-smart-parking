import {bookingPrice} from '../../lib/finance.ts';
import type {Booking,Filters,ParkingLot} from './models.ts';
export {bookingPrice};
export const HOUR=3600000;
export const defaultFilters:Filters={query:'',maxPrice:1000,type:'All',availableOnly:false};
export function filterLots(lots:ParkingLot[],f:Filters){const q=f.query.trim().toLowerCase();return lots.filter(l=>l.approved===1&&`${l.name} ${l.area}`.toLowerCase().includes(q)&&l.price<=f.maxPrice&&(f.type==='All'||l.type===f.type)&&(!f.availableOnly||l.available>0));}
export function availableSlots(lot:ParkingLot,bookings:Booking[],start:number,end:number){return Math.max(0,lot.capacity-bookings.filter(b=>b.lot_id===lot.id&&b.status==='confirmed'&&b.start<end&&b.end>start).length);}
export function validateTime(start:number,hours:number,now=Date.now()){if(!Number.isSafeInteger(start)||!Number.isInteger(hours)||hours<1||hours>24||start%HOUR!==0||start<now||start>now+90*24*HOUR)throw Error('Choose a future whole-hour start within 90 days and a duration of 1–24 hours.');return start+hours*HOUR;}
export function parseAstanaTime(day:string,hour:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^\d{1,2}$/.test(hour)||+hour>23)throw Error('Enter a valid date and an hour from 00 to 23.');const value=Date.parse(`${day}T${hour.padStart(2,'0')}:00:00+05:00`);if(!Number.isFinite(value)||astanaParts(value).day!==day)throw Error('This calendar date is invalid.');return value;}
export function astanaParts(ms:number){const iso=new Date(ms+5*HOUR).toISOString();return {day:iso.slice(0,10),hour:iso.slice(11,13)};}
export function nextStart(now=Date.now()){return Math.ceil((now+HOUR)/HOUR)*HOUR;}
export function money(n:number){return `${new Intl.NumberFormat('en-KZ',{maximumFractionDigits:2}).format(n)} ₸`;}
export function timeLabel(ms:number){return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Almaty',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(ms);}
export function validateProfile(name:string,email:string){const n=name.trim(),e=email.trim().toLowerCase();if(n.length<2||n.length>60)throw Error('Use a display name with 2–60 characters.');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)||e.length>120)throw Error('Enter a valid fictional email address.');return {name:n,email:e};}
