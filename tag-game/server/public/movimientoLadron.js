(function () {
  const speedCPS = 3.0;       // celdas por segundo
  const DT = 1 / 120;         // paso fijo de simulación
  let acc = 0, last = 0;      // acumulador y marca de tiempo

  const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
  addEventListener("keydown", e => { if (e.key in keys) keys[e.key] = true; });
  addEventListener("keyup",   e => { if (e.key in keys) keys[e.key] = false; });

  function getUnitDir() {
    let vx = 0, vy = 0;
    if (keys.ArrowUp)    vy -= 1;
    if (keys.ArrowDown)  vy += 1;
    if (keys.ArrowLeft)  vx -= 1;
    if (keys.ArrowRight) vx += 1;
    return window.TagGame.Rules.normalizeDiagonal(vx, vy, window.TagGame.Rules.diagFactor);
  }

  function simStep(state, dt) {
    const { murosP, halfCell, agentRadiusCell, GRID_SIZE } = window.TagGame;
    const l = state.entities.ladron;
    const r = agentRadiusCell ?? 0.4;
    const G = GRID_SIZE || 20;

    const dir = getUnitDir();                  // unidad
    const vx = dir.vx * speedCPS * dt;         // celdas/seg
    const vy = dir.vy * speedCPS * dt;

    let CX = l.x + 0.5, CY = l.y + 0.5;
    const moved = window.TagGame.Rules.moveCenter(CX, CY, vx, vy, murosP, halfCell, r, G);
    l.x = moved.CX - 0.5;
    l.y = moved.CY - 0.5;
  }

  function loop(state, t) {
    if (window.TagGame.Rules.gameOver) return;
    if (!last) last = t;
    acc += Math.min(0.05, (t - last) / 1000);  // cap 50 ms para estabilidad
    last = t;

    while (acc >= DT) {
      simStep(state, DT);
      acc -= DT;
      window.TagGame.Rules.checkCaptureAndEnd(state, undefined, 0.35);
      if (window.TagGame.Rules.gameOver) break;
    }

    window.TagGame.renderLoop(state.entities);
    if (!window.TagGame.Rules.gameOver) requestAnimationFrame(tt => loop(state, tt));
  }

  window.startLadronControl = function (state) {
    acc = 0; last = 0;
    requestAnimationFrame(tt => loop(state, tt));
  };
})();
