// --- SHIM para usar rulesCore UMD en Node ESM ---
if (typeof globalThis.self === "undefined") globalThis.self = globalThis;
globalThis.TagGame = globalThis.TagGame || {};
await import("../public/rulesCore.js");
const { diagFactor, normalizeDiagonal, moveCenter, checkCapture } = globalThis.TagGame.RulesCore;

// ---- Config básica y mapa determinista (sin DOM) ----
export const GRID_SIZE = 15;
const EMPTY="VACIO", WALL="MURO", POLICE="POLICIA", THIEF="LADRON";

function makeRNG(seed=2023014){ let t=seed>>>0; return {
  rand(){ t+=0x6D2B79F5; let r=Math.imul(t^(t>>>15),1|t); r^=r+Math.imul(r^(r>>>7),61|r); return ((r^(r>>>14))>>>0)/4294967296; },
  int(m){ return Math.floor(this.rand()*m); }
};}
function createMatrix(n,m,fill=EMPTY){ return Array.from({length:n},()=>Array.from({length:m},()=>({type:fill}))); }

function genMap(seed){
  const rng=makeRNG(seed), map=createMatrix(GRID_SIZE,GRID_SIZE,EMPTY);
  const L=Math.floor(GRID_SIZE*0.35), R0=Math.floor(GRID_SIZE*0.65);
  let w=0, targetWalls=Math.floor(GRID_SIZE*GRID_SIZE*0.035);
  while(w<targetWalls){ const r=rng.int(GRID_SIZE), c=rng.int(GRID_SIZE);
    if(c<L||c>=R0) continue; if(map[r][c].type!==EMPTY) continue; map[r][c]={type:WALL}; w++; }
  const ps=[]; while(ps.length<2){ const r=rng.int(GRID_SIZE), c=rng.int(L);
    if(map[r][c].type===EMPTY){ map[r][c]={type:POLICE}; ps.push({r,c}); } }
  let th=null; while(!th){ const r=rng.int(GRID_SIZE), c=rng.int(GRID_SIZE-R0)+R0;
    if(map[r][c].type===EMPTY){ map[r][c]={type:THIEF}; th={r,c}; } }
  const wallsRC=[], murosP=[];
  for(let r=0;r<GRID_SIZE;r++) for(let c=0;c<GRID_SIZE;c++)
    if(map[r][c].type===WALL){ wallsRC.push({r,c}); murosP.push({cx:c+0.5, cy:r+0.5}); }
  const entities={ policias: ps.map(p=>({x:p.c,y:p.r,vx:0,vy:0})), ladron:{x:th.c,y:th.r,vx:0,vy:0} };
  return { map, entities, wallsRC, murosP, halfCell:{hx:0.5,hy:0.5}, agentRadiusCell:0.4, policeRadiusCell:0.35 };
}

// ---- Entorno mínimo ----
let ENV=null;

export function reset(seed=2023014){
  const world=genMap(seed);
  ENV={ world, state:{ entities: JSON.parse(JSON.stringify(world.entities)), t:0 } };
  return context();
}

// step controlado por MATLAB: acciones opcionales
export function step({ aThief=[0,0], aP0=[0,0], aP1=[0,0] } = {}, n=1, dt=0.01){
  if(!ENV) throw new Error("reset primero");
  const { murosP, halfCell, agentRadiusCell, policeRadiusCell } = ENV.world;
  const st=ENV.state, G=GRID_SIZE;
  const vThief=3.0, vPolice=2.8; // celdas/seg

  for(let i=0;i<n;i++){
    // ladrón
    const dT=normalizeDiagonal(aThief[0], aThief[1], diagFactor);
    const l=st.entities.ladron;
    let CX=l.x+0.5, CY=l.y+0.5;
    const mvT=moveCenter(CX,CY, dT.vx*vThief*dt, dT.vy*vThief*dt, murosP, halfCell, agentRadiusCell, G);
    l.x=mvT.CX-0.5; l.y=mvT.CY-0.5;

    // policía 0
    const p0=st.entities.policias[0];
    if(p0){ const d0=normalizeDiagonal(aP0[0], aP0[1], diagFactor);
      let PCX=p0.x+0.5, PCY=p0.y+0.5;
      const mvP0=moveCenter(PCX,PCY, d0.vx*vPolice*dt, d0.vy*vPolice*dt, murosP, halfCell, policeRadiusCell, G);
      p0.x=mvP0.CX-0.5; p0.y=mvP0.CY-0.5; }

    // policía 1
    const p1=st.entities.policias[1];
    if(p1){ const d1=normalizeDiagonal(aP1[0], aP1[1], diagFactor);
      let PCX=p1.x+0.5, PCY=p1.y+0.5;
      const mvP1=moveCenter(PCX,PCY, d1.vx*vPolice*dt, d1.vy*vPolice*dt, murosP, halfCell, policeRadiusCell, G);
      p1.x=mvP1.CX-0.5; p1.y=mvP1.CY-0.5; }

    st.t+=dt;
  }
  return context();
}

export function context(){
  const l=ENV.state.entities.ladron, p=ENV.state.entities.policias;
  const captured = checkCapture({entities:ENV.state.entities}, ENV.world.agentRadiusCell, ENV.world.policeRadiusCell);
  return {
    obs: { thief:[l.x,l.y], p0:[p[0].x,p[0].y], p1:[p[1].x,p[1].y] },
    info: {
      t: ENV.state.t,
      captured,
      gridSize: GRID_SIZE,
      radii: { thief: ENV.world.agentRadiusCell, police: ENV.world.policeRadiusCell }
      // wallsRC: ENV.world.wallsRC // destapar si necesitas mapa
    }
  };
}
