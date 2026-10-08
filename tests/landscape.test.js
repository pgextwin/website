const test = require("node:test");
const assert = require("node:assert/strict");
const view = require("../landscape-view.js");
const source = {provider:"Test vendor",type:"vendor",url:"https://example.org/downloads",availability:"commercial-bundled",postgresqlDistribution:"vendor-postgresql",compatibility:"vendor-specific",notes:"Subscription required."};
const base = {schemaVersion:1,name:"example",displayName:"Example",description:"Example extension",upstreamRepository:"example/repo",lastReviewed:"2026-10-08",evidenceUrls:["https://example.org/evidence"],windowsBinarySources:[]};
const candidate = () => ({...base,status:"candidate",license:"MIT",currentStableVersion:"1.0",pg18Support:"unknown",pg19Readiness:"unknown",windowsUpstreamSupport:"unknown",knownWindowsBinaryAvailability:"none-identified",estimatedWindowsEffort:"high",preliminaryPriority:"unranked",candidateRationale:"Research further"});
const notPlanned = () => ({...base,status:"not-planned",notPlannedReason:"Vendor ships it",reasonCode:"existing-windows-distribution",windowsBinarySources:[source]});
test("valid implemented and catalog reference",()=>{const r={...base,status:"implemented",pgextwinCatalogName:"example"}; assert.equal(view.validateRecord(r).valid,true);r.pgextwinCatalogName="other";assert.equal(view.validateRecord(r).valid,false);});
test("valid candidate without binary",()=>assert.equal(view.validateRecord(candidate()).valid,true));
test("candidate rationale required",()=>{const r=candidate();delete r.candidateRationale;assert.equal(view.validateRecord(r).valid,false);});
test("valid not-planned with commercial source",()=>assert.equal(view.validateRecord(notPlanned()).valid,true));
test("not-planned reason and source required",()=>{const r=notPlanned();r.notPlannedReason="";assert.equal(view.validateRecord(r).valid,false);r.notPlannedReason="yes";r.windowsBinarySources=[];assert.equal(view.validateRecord(r).valid,false);});
test("multiple binary sources",()=>{const r=notPlanned();r.windowsBinarySources.push({...source,type:"upstream-official",availability:"public",postgresqlDistribution:"standard-postgresql",compatibility:"standard-postgresql"});assert.equal(view.validateRecord(r).valid,true);assert.equal(r.windowsBinarySources.length,2);});
test("commercial vendor and community distinction",()=>{assert.match(view.sourceLabel(source),/Commercial bundle/);assert.match(view.sourceLabel(source),/Vendor-specific/);assert.match(view.sourceLabel({...source,type:"community",availability:"public"}),/Community/);});
test("no binary candidate stays eligible",()=>assert.equal(view.filterRecords([candidate()],{status:"candidate"}).length,1));
test("status and name/provider search",()=>{const items=[{...candidate(),name:"wal2json"}, {...notPlanned(),name:"postgis"}];assert.deepEqual(view.filterRecords(items,{status:"not-planned"}).map(x=>x.name),["postgis"]);assert.equal(view.filterRecords(items,{query:"vendor"}).length,1);assert.equal(view.filterRecords(items,{query:"WAL2JSON"}).length,1);});
test("source filter",()=>assert.equal(view.filterRecords([candidate(),notPlanned()],{sourceType:"vendor"}).length,1));
test("reject javascript, http, credentials",()=>{for(const u of ["javascript:alert(1)","http://example.org","https://user:pass@example.org"])assert.equal(view.safeHttpsUrl(u),null);});
test("invalid source link rejected",()=>{const r=notPlanned();r.windowsBinarySources[0]={...source,url:"javascript:alert(1)"};assert.equal(view.validateRecord(r).valid,false);});
test("index rejects duplicate names",()=>assert.equal(view.validateIndex({schemaVersion:1,extensions:["x","x"]}).valid,false));
test("partial record failures keep successful items",()=>{const out=view.partitionResults([{status:"fulfilled",value:candidate()},{status:"rejected",reason:"HTTP 500"},{status:"fulfilled",value:{...base,status:"broken"}}],["example","failed","bad"]);assert.equal(out.records.length,1);assert.equal(out.failures.length,2);});
test("landscape index failure isolated at fetch boundary",async()=>{await assert.rejects(view.load(async()=>({ok:false,status:503}),"https://example.org"),/Landscape index HTTP 503/);});
test("partial fetch failure is non-fatal",async()=>{const f=async url=>({ok:!url.endsWith("bad.json"),status:404,json:async()=>url.endsWith("index.json")?{schemaVersion:1,extensions:["example","bad"]}:candidate()});const out=await view.load(f,"https://example.org");assert.equal(out.records.length,1);assert.equal(out.failures.length,1);});

test("formal Wave 2 labels and ranked candidate order",()=>{
  const make=(name,decision,order)=>({...candidate(),name,displayName:name,roadmap:{decision,decisionDate:"2026-10-08",rationale:"Reviewed upstream sources",...(order?{order}:{})}});
  const records=[make("z_last","wave-2",3),make("a_reserve","reserve"),make("h_first","wave-2",1),make("b_second","wave-2",2),make("c_research","research")];
  assert.deepEqual(view.sortRecords(records).map(x=>x.name),["h_first","b_second","z_last","a_reserve","c_research"]);
  assert.match(view.roadmapLabel(records[2]),/Wave 2 #1/);
  assert.match(view.roadmapLabel(records[1]),/Reserve candidate/);
  assert.match(view.roadmapLabel(records[4]),/Further research/);
});
test("legacy candidate without roadmap uses nonbreaking fallback",()=>{
  const record=candidate();
  assert.equal(view.validateRecord(record).valid,true);
  assert.match(view.roadmapLabel(record),/Decision pending/);
});
test("invalid candidate roadmap rejected",()=>{
  for(const bad of [{decision:"wave-2",decisionDate:"2026-10-08",rationale:"ok"},
    {decision:"wave-2",order:2,decisionDate:"2026-02-31",rationale:"ok"},
    {decision:"reserve",order:1,decisionDate:"2026-10-08",rationale:"ok"},
    {decision:"research",decisionDate:"2026-10-08",rationale:" "}]){
    assert.equal(view.validateRecord({...candidate(),roadmap:bad}).valid,false);
  }
  assert.equal(view.validateRecord({...notPlanned(),roadmap:{decision:"research",decisionDate:"2026-10-08",rationale:"x"}}).valid,false);
});
test("formal roadmap search and existing non-candidate alphabetizing",()=>{
  const a={...candidate(),name:"x",displayName:"Z candidate",roadmap:{decision:"wave-2",order:1,decisionDate:"2026-10-08",rationale:"Important planner evidence"}};
  assert.equal(view.filterRecords([a],{query:"planner evidence"}).length,1);
  const sorted=view.sortRecords([{...notPlanned(),name:"z",displayName:"Z not planned"},a,{...notPlanned(),name:"a",displayName:"A not planned"}]);
  assert.deepEqual(sorted.filter(x=>x.status!=="candidate").map(x=>x.displayName),["A not planned","Z not planned"]);
});
