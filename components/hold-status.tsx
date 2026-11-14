'use client';
import {useEffect,useState} from 'react';
export default function HoldStatus({expiresAt,onExpired}:{expiresAt:number;onExpired:()=>void}){
  const[now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{if(now>=expiresAt)onExpired();},[now,expiresAt,onExpired]);
  const seconds=Math.max(0,Math.ceil((expiresAt-now)/1000));
  return <p className="hold-status" role="status">Space held for {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}. Confirm before this server deadline. No payment is collected.</p>;
}
