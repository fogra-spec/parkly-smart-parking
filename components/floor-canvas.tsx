'use client';
import {useRef,useState,useEffect} from 'react';
import {ZoomIn,ZoomOut,LocateFixed} from 'lucide-react';
import {zoomAt,spaceState,type MapFloor,type MapView} from '../lib/floor-layout';

type Props={floor:MapFloor;selected:string;held?:string;onSelect:(id:string)=>void;editing?:boolean;disabled?:boolean;onMove?:(id:string,x:number,y:number)=>void};
export default function FloorCanvas({floor,selected,held='',onSelect,editing=false,disabled=false,onMove}:Props){
  const svg=useRef<SVGSVGElement>(null),[view,V]=useState<MapView>({zoom:1,x:0,y:0}),viewRef=useRef(view);
  const pointers=useRef(new Map<number,{x:number;y:number}>()),gesture=useRef<{point:{x:number;y:number};view:MapView;space:string;start:{x:number;y:number};moved:boolean;distance?:number;center?:{x:number;y:number}}|null>(null);
  const setView=(next:MapView)=>{viewRef.current=next;V(next);};
  useEffect(()=>{setView({zoom:1,x:0,y:0});pointers.current.clear();gesture.current=null;},[floor.id]);
  function point(clientX:number,clientY:number){const matrix=svg.current?.getScreenCTM();if(!matrix)return{x:0,y:0};const p=new DOMPoint(clientX,clientY).matrixTransform(matrix.inverse());return{x:p.x,y:p.y};}
  function world(p:{x:number;y:number},v=viewRef.current){return{x:(p.x-v.x)/v.zoom,y:(p.y-v.y)/v.zoom};}
  const chosen=floor.spaces.find(s=>s.id===selected);
  return <div className="floor-canvas-wrap">
    <svg ref={svg} className="floor-canvas" viewBox={`0 0 ${floor.width} ${floor.height}`} aria-label={`${floor.name} interactive parking layout`} role="group"
      onWheel={e=>{const p=point(e.clientX,e.clientY);setView(zoomAt(viewRef.current,viewRef.current.zoom*(e.deltaY<0?1.12:.89),p));}}
      onPointerDown={e=>{if(e.pointerType==='mouse'&&e.button!==0)return;const p=point(e.clientX,e.clientY);pointers.current.set(e.pointerId,p);e.currentTarget.setPointerCapture(e.pointerId);const id=(e.target as Element).closest('[data-space]')?.getAttribute('data-space')||'';
        if(pointers.current.size===1)gesture.current={point:p,view:{...viewRef.current},space:id,start:world(p),moved:false};
        if(pointers.current.size===2){const[a,b]=[...pointers.current.values()];gesture.current={point:p,view:{...viewRef.current},space:'',start:world(p),moved:true,distance:Math.hypot(a.x-b.x,a.y-b.y),center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};}}}
      onPointerMove={e=>{if(!pointers.current.has(e.pointerId)||!gesture.current)return;const p=point(e.clientX,e.clientY);pointers.current.set(e.pointerId,p);const g=gesture.current;
        if(pointers.current.size===2&&g.distance&&g.center){const[a,b]=[...pointers.current.values()],center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};const next=zoomAt(g.view,g.view.zoom*Math.hypot(a.x-b.x,a.y-b.y)/g.distance,g.center);setView({...next,x:next.x+center.x-g.center.x,y:next.y+center.y-g.center.y});return;}
        const dx=p.x-g.point.x,dy=p.y-g.point.y;if(Math.hypot(dx,dy)>5)g.moved=true;
        if(!editing||!g.space)setView({...g.view,x:g.view.x+dx,y:g.view.y+dy});
      }}
      onPointerUp={e=>{const g=gesture.current,p=point(e.clientX,e.clientY);pointers.current.delete(e.pointerId);if(g&&pointers.current.size===0){if(!disabled&&g.space&&(!g.moved||editing)){onSelect(g.space);if(editing&&g.moved){const s=floor.spaces.find(s=>s.id===g.space);if(s){const to=world(p,g.view);onMove?.(s.id,Math.round(s.x+to.x-g.start.x),Math.round(s.y+to.y-g.start.y));}}}gesture.current=null;}}}
      onPointerCancel={()=>{pointers.current.clear();gesture.current=null;}}>
      <rect width={floor.width} height={floor.height} fill="#F8FAFC"/>
      <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
        <rect x="14" y="14" width={floor.width-28} height={floor.height-28} rx="22" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="3"/>
        {floor.features.map(f=><g key={f.id} aria-label={f.label}><rect x={f.x} y={f.y} width={f.width} height={f.height} rx="10" fill={f.kind==='driveway'?'#E5E7EB':'#fff'} stroke="#CBD5E1" strokeDasharray={f.kind==='driveway'?'5 9':undefined}/><text x={f.x+f.width/2} y={f.y+f.height/2} textAnchor="middle" dominantBaseline="central" fontSize={f.kind==='driveway'?20:17} fill="#64748B">{f.label}</text></g>)}
        {floor.spaces.map(s=>{const state=editing?(s.id===selected?'selected':s.reservable?'available':'unavailable'):spaceState(s,selected,held),enabled=!disabled&&(editing||s.available||s.id===held);return <g key={s.id} data-space={s.id} role="button" tabIndex={enabled?0:-1} aria-label={`Space ${s.label}, ${state}${editing?', arrow keys move':''}`} aria-pressed={s.id===selected} aria-disabled={!enabled}
          className={'floor-space '+state} transform={`rotate(${s.rotation} ${s.x+s.width/2} ${s.y+s.height/2})`}
          onKeyDown={e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();if(enabled)onSelect(s.id);}if(editing&&s.id===selected&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const step=e.shiftKey?1:10;onMove?.(s.id,s.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),s.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0));}}}>
          <rect x={s.x} y={s.y} width={s.width} height={s.height} rx="10" strokeWidth={s.id===selected?5:3}/><path d={`M ${s.x+15} ${s.y+12} h ${s.width-30}`} stroke="currentColor" opacity=".35"/>
          <text x={s.x+s.width/2} y={s.y+s.height/2} dominantBaseline="central" textAnchor="middle" fontSize={Math.min(24,s.width/Math.max(3,s.label.length)*1.6)}>{s.label}</text>
          {s.id===selected&&<text x={s.x+s.width/2} y={s.y+s.height-22} textAnchor="middle" fontSize="22">✓</text>}
        </g>;})}
      </g>
    </svg>
    <div className="floor-map-tools"><button aria-label="Zoom in on floor" onClick={()=>setView(zoomAt(viewRef.current,viewRef.current.zoom*1.25,{x:floor.width/2,y:floor.height/2}))}><ZoomIn size={19}/></button><button aria-label="Zoom out on floor" onClick={()=>setView(zoomAt(viewRef.current,viewRef.current.zoom/1.25,{x:floor.width/2,y:floor.height/2}))}><ZoomOut size={19}/></button><button aria-label="Fit floor layout" onClick={()=>setView({zoom:1,x:0,y:0})}><LocateFixed size={19}/></button></div>
    <p className="floor-map-hint">Drag to {editing?'move a space; drag the background to pan':'pan'} · Pinch or use + / − to zoom</p>
    {editing&&chosen&&<p className="fine-print">Selected {chosen.label}. Drag to move, use arrow keys for precise movement, or edit coordinates below.</p>}
  </div>;
}
