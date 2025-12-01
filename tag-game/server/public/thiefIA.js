(function () {
  const WS_URL = "ws://127.0.0.1:8091";   // ← puerto WS para el ladrón
  const DT = 1 / 120;
  const V_THIEF = 3.0;

  let ws = null;
  let acc = 0, last = 0;
  let want = { dx: 0, dy: 0 };
  let stateRef = null;

  function connectWS(G) {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      console.log("[ThiefIA] WS abierto");
      try { ws.send(JSON.stringify({ cmd: "init", G })); } catch {}
    };
    ws.onclose = () => {
      console.log("[ThiefIA] WS cerrado, reintentando…");
      setTimeout(() => connectWS(G), 1000);
    };
    ws.onerror = (e) => console.log("[ThiefIA] WS error", e);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg && msg.aThief) {
          want.dx = Number(msg.aThief[0] || 0);
          want.dy = Number(msg.aThief[1] || 0);
        }
      } catch {}
    };
  }

  function sendObs(state) {
    if (!ws || ws.readyState !== 1) return;
    const l = state.entities.ladron;
    const p = state.entities.policias || [];
    const p0 = p[0] || { x: 0, y: 0 }, p1 = p[1] || { x: 0, y: 0 };
    const G = window.TagGame.GRID_SIZE || 15;

    ws.send(JSON.stringify({
      cmd: "act",
      pos: [l.x, l.y, p0.x, p0.y, p1.x, p1.y],
      G
    }));
  }

  let qTimer = null;
  function startQueryLoop(state) {
    if (qTimer) clearInterval(qTimer);
    qTimer = setInterval(() => {
      if (window.TagGame.Rules?.gameOver) return;
      sendObs(state);
    }, 100); // ~10 Hz
  }

  function stepThief(state, dt) {
    const Core = window.TagGame.Rules;
    const { murosP, halfCell, thiefRadiusCell, GRID_SIZE } = window.TagGame;
    const rT = thiefRadiusCell ?? 0.35;
    const l = state.entities.ladron;

    const dir = Core.normalizeDiagonal(want.dx, want.dy, Core.diagFactor);
    const vx = dir.vx * V_THIEF * dt;
    const vy = dir.vy * V_THIEF * dt;
    let CX = l.x + 0.5, CY = l.y + 0.5;
    const moved = Core.moveCenter(CX, CY, vx, vy, murosP, halfCell, rT, GRID_SIZE || 20);
    l.x = moved.CX - 0.5;
    l.y = moved.CY - 0.5;
  }

  function loop(t) {
    if (window.TagGame.Rules?.gameOver) return;
    if (!last) last = t;
    acc += Math.min(0.05, (t - last) / 1000);
    last = t;

    while (acc >= DT) {
      stepThief(stateRef, DT);
      acc -= DT;
    }
    if (!window.TagGame.Rules?.gameOver) requestAnimationFrame(loop);
  }

  window.startThiefAI = function (state) {
    stateRef = state;
    const G = window.TagGame.GRID_SIZE || 15;
    connectWS(G);          // ← conecta al bridge del ladrón (8091 → 7779)
    startQueryLoop(state);
    acc = 0; last = 0;
    requestAnimationFrame(loop);
  };
})();
