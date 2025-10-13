(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else { root.TagGame = root.TagGame || {}; root.TagGame.RulesCore = factory(); }
})(typeof self !== "undefined" ? self : this, function () {
  const eps = 1e-4, diagFactor = 0.707;
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  function normalizeDiagonal(vx,vy,f=diagFactor){ if(vx&&vy){vx*=f;vy*=f;} return {vx,vy}; }
  function blocksX_center(nextCX,CY,murosP,half,r){ const hx=half.hx+r, hy=half.hy+r;
    for(const m of murosP) if(Math.abs(CY-m.cy)<=hy-eps && Math.abs(nextCX-m.cx)<=hx-eps) return true; return false; }
  function blocksY_center(CX,nextCY,murosP,half,r){ const hx=half.hx+r, hy=half.hy+r;
    for(const m of murosP) if(Math.abs(CX-m.cx)<=hx-eps && Math.abs(nextCY-m.cy)<=hy-eps) return true; return false; }
  function moveCenter(CX,CY,vx,vy,murosP,half,r,G){
    const tryCX=CX+vx; if(!blocksX_center(tryCX,CY,murosP,half,r)) CX=tryCX;
    const tryCY=CY+vy; if(!blocksY_center(CX,tryCY,murosP,half,r)) CY=tryCY;
    return { CX: clamp(CX,r+1e-4,G-r-1e-4), CY: clamp(CY,r+1e-4,G-r-1e-4) };
  }
  function checkCapture(state,rThief=0.4,rPolice=0.35){
    const l=state.entities?.ladron, ps=state.entities?.policias||[]; if(!l||ps.length===0) return false;
    const tCX=l.x+0.5, tCY=l.y+0.5;
    for(const p of ps){ if(Math.hypot(tCX-(p.x+0.5), tCY-(p.y+0.5)) <= rThief+rPolice) return true; }
    return false;
  }
  return { diagFactor, normalizeDiagonal, moveCenter, checkCapture };
});
