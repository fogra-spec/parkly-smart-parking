import test from 'node:test';
import assert from 'node:assert/strict';
import {zoomAt,insideFloor,spaceState} from '../lib/floor-layout.ts';
const space={id:'one',label:'A-12',x:100,y:100,width:90,height:150,rotation:0,reservable:true,available:true};
test('zoom preserves the world point under the pointer and clamps the scale',()=>{
  const view={zoom:1,x:10,y:20},anchor={x:200,y:180},next=zoomAt(view,2,anchor);
  assert.equal((anchor.x-next.x)/next.zoom,(anchor.x-view.x)/view.zoom);
  assert.equal((anchor.y-next.y)/next.zoom,(anchor.y-view.y)/view.zoom);
  assert.equal(zoomAt(view,100,anchor).zoom,4);assert.equal(zoomAt(view,0,anchor).zoom,.6);
});
test('rotated bays must remain inside the structured floor bounds',()=>{
  assert.ok(insideFloor(space,800,700));assert.ok(insideFloor({...space,rotation:90},800,700));
  assert.equal(insideFloor({...space,x:0,rotation:90},800,700),false);
  assert.equal(insideFloor({...space,y:650},800,700),false);
});
test('map colors describe interval allocation status, with own hold taking precedence',()=>{
  assert.equal(spaceState(space,'',''),'available');assert.equal(spaceState(space,'one',''),'selected');
  assert.equal(spaceState(space,'one','one'),'held');assert.equal(spaceState({...space,available:false},'',''),'unavailable');
});
