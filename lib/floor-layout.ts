export type MapFeature={id:string;kind:'driveway'|'entrance'|'exit';label:string;x:number;y:number;width:number;height:number};
export type MapSpace={id:string;label:string;x:number;y:number;width:number;height:number;rotation:number;reservable:boolean;floor_id?:string;active?:boolean;available?:boolean;availability_status?:'available'|'unavailable'|'held'};
export type FloorDocument={width:number;height:number;spaces:MapSpace[];features:MapFeature[]};
export type MapFloor={id:string;name:string;width:number;height:number;features:MapFeature[];spaces:MapSpace[]};
export type MapView={zoom:number;x:number;y:number};
export function zoomAt(view:MapView,zoom:number,point:{x:number;y:number}):MapView{
  const next=Math.max(.6,Math.min(4,zoom)),ratio=next/view.zoom;
  return{zoom:next,x:point.x-(point.x-view.x)*ratio,y:point.y-(point.y-view.y)*ratio};
}
export function insideFloor(space:MapSpace,width:number,height:number):boolean{
  const angle=space.rotation*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
  const halfX=(space.width*c+space.height*s)/2,halfY=(space.width*s+space.height*c)/2;
  const cx=space.x+space.width/2,cy=space.y+space.height/2;
  return cx-halfX>=0&&cy-halfY>=0&&cx+halfX<=width&&cy+halfY<=height;
}
export function spaceState(space:MapSpace,selected:string,held:string):'available'|'unavailable'|'held'|'selected'{
  if(space.id===held)return'held';
  if(space.id===selected)return'selected';
  return space.availability_status||(space.available?'available':'unavailable');
}
