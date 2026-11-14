import {z} from 'zod';
import type{Context} from './router.ts';
import {id,parse} from './validation.ts';
import {ApiError} from './errors.ts';
import {insideFloor} from '../../lib/floor-layout.ts';

const feature=z.object({id:z.string().min(1).max(80),kind:z.enum(['driveway','entrance','exit']),label:z.string().trim().min(1).max(60),x:z.number().int().min(0).max(10000),y:z.number().int().min(0).max(30000),width:z.number().int().min(20).max(10000),height:z.number().int().min(20).max(30000)}).strict();
const space=z.object({id,label:z.string().trim().min(1).max(40),x:z.number().int().min(0).max(10000),y:z.number().int().min(0).max(30000),width:z.number().int().min(36).max(240),height:z.number().int().min(48).max(300),rotation:z.number().int().min(0).max(359),reservable:z.boolean()}).strict();
const document=z.object({width:z.number().int().min(400).max(10000),height:z.number().int().min(400).max(30000),spaces:z.array(space).max(500),features:z.array(feature).max(100)}).strict().superRefine((doc,ctx)=>{
  if(doc.spaces.some(s=>!insideFloor(s,doc.width,doc.height))||doc.features.some(f=>f.x+f.width>doc.width||f.y+f.height>doc.height))ctx.addIssue({code:'custom',message:'Keep elements inside the floor.'});
  if(new Set(doc.spaces.map(s=>s.id)).size!==doc.spaces.length||new Set(doc.spaces.map(s=>s.label.toLowerCase())).size!==doc.spaces.length||new Set(doc.features.map(f=>f.id)).size!==doc.features.length)ctx.addIssue({code:'custom',message:'Identifiers and labels must be unique.'});
});
export async function floorRoute(ctx:Context):Promise<unknown|undefined>{
  const{db,user,url,method,body}=ctx,path=url.pathname.replace(/^\/api\/v1/,'');
  const layout=/^\/facilities\/([^/]+)\/layout$/.exec(path);
  if(layout&&method==='GET'){
    const facilityId=parse(id,layout[1]),window=parse(z.object({start:z.coerce.number().int().safe().nonnegative(),end:z.coerce.number().int().safe().nonnegative()}).strict(),Object.fromEntries(url.searchParams));
    if(window.start<Date.now()||window.start>Date.now()+90*86400000||window.end<=window.start||window.end-window.start>86400000||window.start%3600000||window.end%3600000)throw new ApiError(400,'INVALID_WINDOW','Choose future whole-hour arrival and departure, up to 24 hours, within 90 days.');
    return db.transaction(user,async c=>{
      const facility=(await c.query(`SELECT f.id,f.name,f.address,f.area,f.rules,f.inventory_source,f.occupancy_source,p.hourly_kzt AS price FROM app.facilities f JOIN app.pricing_rules p ON p.facility_id=f.id AND p.active WHERE f.id=$1 AND f.approved`,[facilityId])).rows[0];
      if(!facility)throw new ApiError(404,'NOT_FOUND','Approved facility not found.');
      const spaces=(await c.query('SELECT a.* FROM app.available_spaces($1,$2,$3) a JOIN app.spaces s ON s.id=a.id WHERE s.map_published',[facilityId,new Date(window.start).toISOString(),new Date(window.end).toISOString()])).rows;
      const floors=(await c.query('SELECT id,name,layout_width AS width,layout_height AS height,features,published_version AS version FROM app.floors WHERE facility_id=$1 ORDER BY name,id',[facilityId])).rows;
      const serverNow=Number((await c.query('SELECT extract(epoch FROM clock_timestamp())*1000 AS now')).rows[0].now);
      return{facility,floors:floors.map(f=>({...f,spaces:spaces.filter(s=>s.floor_id===f.id)})),quote:{hourly:facility.price,total:facility.price*(window.end-window.start)/3600000,currency:'KZT',start:window.start,end:window.end},serverNow,physicalOccupancy:'not_available'};
    });
  }
  const editor=/^\/operator\/floors\/([^/]+)\/(layout|publish|spaces)$/.exec(path);
  if(!editor)return undefined;
  if(!user)throw new ApiError(401,'AUTH_REQUIRED','Sign in to continue.');
  const floorId=parse(id,editor[1]);
  if(editor[2]==='layout'&&method==='GET')return db.transaction(user,async c=>{
    const floor=(await c.query('SELECT *,app.can_manage(facility_id) AS allowed FROM app.floors WHERE id=$1',[floorId])).rows[0];
    if(!floor?.allowed)throw new ApiError(403,'FACILITY_ACCESS','Assigned facility access is required.');
    const saved=(await c.query('SELECT document FROM app.floor_layout_drafts WHERE floor_id=$1',[floorId])).rows[0]?.document;
    const records=(await c.query('SELECT id,label,x,y,width,height,rotation,reservable,map_published FROM app.spaces WHERE floor_id=$1 ORDER BY label',[floorId])).rows;
    // New inventory is merged into a saved draft; unknown/deleted IDs are never trusted.
    const spaces=records.map(r=>{const prior=saved?.spaces.find((s:{id:string})=>s.id===r.id);return prior||{id:r.id,label:r.label,x:r.x,y:r.y,width:r.width,height:r.height,rotation:r.rotation,reservable:r.reservable};});
    return{floor:{id:floor.id,name:floor.name},version:floor.draft_version,publishedVersion:floor.published_version,hasDraft:!!saved,
      document:{width:saved?.width||floor.layout_width,height:Math.max(saved?.height||floor.layout_height,...spaces.map(s=>s.y+s.height+30)),features:saved?.features||floor.features,spaces}};
  });
  if(editor[2]==='layout'&&method==='PATCH'){
    const a=parse(z.object({version:z.number().int().nonnegative(),document}).strict(),body);
    return db.call(user,'SELECT app.save_floor_layout($1,$2,$3) AS result',[floorId,a.version,JSON.stringify(a.document)]);
  }
  if(editor[2]==='publish'&&method==='POST'){
    const a=parse(z.object({version:z.number().int().nonnegative()}).strict(),body);
    return db.call(user,'SELECT app.publish_floor_layout($1,$2) AS result',[floorId,a.version]);
  }
  if(editor[2]==='spaces'&&method==='POST'){
    const a=parse(z.object({label:z.string().trim().min(1).max(40)}).strict(),body);
    return db.transaction(user,async c=>({id:(await c.query('SELECT app.add_draft_space($1,$2) AS id',[floorId,a.label])).rows[0].id}));
  }
  throw new ApiError(404,'NOT_FOUND','Floor API route not found.');
}
