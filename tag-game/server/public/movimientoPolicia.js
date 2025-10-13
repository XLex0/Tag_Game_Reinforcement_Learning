(function () {
  const speedCPS = 3.0;    // celdas/segundo
  const DT = 1 / 120;
  const policeRadiusCell = 0.35;
  let acc = 0, last = 0;

  const keysWASD   = { w: false, a: false, s: false, d: false };
  const keysArrows = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

  addEventListener("keydown", e => {
    if (e.key in keysWASD) keysWASD[e.key] = true;
    if (e.key in keysArrows) keysArrows[e.key] = true;
  });
  addEventListener("keyup", e => {
    if (e.key in keysWASD) keysWASD[e.key] = false;
    if (e.key in keysArrows) keysArrows[e.key] = false;
  });

  function dirFrom(keysObj, map) {
    let vx = 0, vy = 0;
    if (keysObj[map.up])    vy -= 1;
    if (keysObj[map.down])  vy += 1;
    if (keysObj[map.left])  vx -= 1;
    if (keysObj[map.right]) vx += 1;
    return window.TagGame.Rules.normalizeDiagonal(vx, vy, window.TagGame.Rules.diagFactor);
  }

  function movePoliceByIndex(state, index, vx, vy) {
    const { murosP, halfCell, GRID_SIZE } = window.TagGame;
    const p = state.entities.policias[index];
    if (!p) return;
    const G = GRID_SIZE || 20;
    const r = policeRadiusCell;

    let CX = p.x + 0.5, CY = p.y + 0.5;
    const moved = window.TagGame.Rules.moveCenter(CX, CY, vx, vy, murosP, halfCell, r, G);
    p.x = moved.CX - 0.5;
    p.y = moved.CY - 0.5;
  }

  function simStep(state, dt) {
    const dA = dirFrom(keysArrows, { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" });
    const dB = dirFrom(keysWASD,   { up: "w", down: "s", left: "a", right: "d" });

    movePoliceByIndex(state, 0, dA.vx * speedCPS * dt, dA.vy * speedCPS * dt);
    movePoliceByIndex(state, 1, dB.vx * speedCPS * dt, dB.vy * speedCPS * dt);
  }

  function loop(state, t) {
    if (window.TagGame.Rules.gameOver) return;
    if (!last) last = t;
    acc += Math.min(0.05, (t - last) / 1000);
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

  window.startPoliciasControl = function (state) {
    acc = 0; last = 0;
    requestAnimationFrame(tt => loop(state, tt));
  };
})();
