import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createMockRepository} from './services/mock';
import {createLocalApiRepository} from './services/local-api';
import {serviceConfig} from './config';
import type {AppData,ParklyRepository} from './models';
type Result<T>={ok:true;value:T}|{ok:false};
type State={data:AppData;repository:ParklyRepository;loading:boolean;busy:boolean;error:string;notice:string;clearError:()=>void;notify:(s:string)=>void;refresh:()=>Promise<void>;run:<T>(fn:()=>Promise<T>)=>Promise<Result<T>>};
const Context=createContext<State|null>(null);
const empty:AppData={user:null,lots:[],bookings:[]};
export function ParklyProvider({children}:{children:React.ReactNode}){const repository=useMemo(()=>serviceConfig.mode==='local-api'?createLocalApiRepository(serviceConfig.localApiUrl):createMockRepository(AsyncStorage),[]);const [data,D]=useState(empty),[loading,L]=useState(true),[busy,B]=useState(false),[error,E]=useState(''),[notice,N]=useState('');
  async function refresh(){L(true);E('');try{D(await repository.load());}catch(e){E((e as Error).message);}finally{L(false)}}
  useEffect(()=>{void refresh()},[]);
  async function run<T>(fn:()=>Promise<T>):Promise<Result<T>>{B(true);E('');N('');try{const value=await fn();D(await repository.load());return {ok:true,value};}catch(e){E((e as Error).message||'Something went wrong. Try again.');return {ok:false};}finally{B(false)}}
  return <Context.Provider value={{data,repository,loading,busy,error,notice,clearError:()=>E(''),notify:N,refresh,run}}>{children}</Context.Provider>;
}
export function useParkly(){const ctx=useContext(Context);if(!ctx)throw Error('ParklyProvider is missing');return ctx;}
