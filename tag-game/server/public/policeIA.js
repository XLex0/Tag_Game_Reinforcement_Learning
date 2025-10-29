(function () {
  const WS_URL = "ws://127.0.0.1:8090";
  const DT = 1 / 120;
  const V_POLICE = 2.8;

  let ws = null;
  let acc = 0, last = 0;
  let want = { p0: { dx: 0, dy: 0 }, p1: { dx: 0, dy: 0 } };
  let stateRef = null;

  function connectWS(G) {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      console.log("[PoliceIA] WS abierto");
      // opcional: cachear G en el server
      try { ws.send(JSON.stringify({ cmd: "init", G })); } catch {}
    };
    ws.onclose = () => {
      console.log("[PoliceIA] WS cerrado, reintentando…");
      setTimeout(() => connectWS(G), 1000);
    };
    ws.onerror = (e) => console.log("[PoliceIA] WS error", e);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg && msg.aP0 && msg.aP1) {
          want.p0.dx = Number(msg.aP0[0] || 0);
          want.p0.dy = Number(msg.aP0[1] || 0);
          want.p1.dx = Number(msg.aP1[0] || 0);
          want.p1.dy = Number(msg.aP1[1] || 0);
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

  // consulta acciones a ~10 Hz
  let qTimer = null;
  function startQueryLoop(state) {
    if (qTimer) clearInterval(qTimer);
    qTimer = setInterval(() => {
      if (window.TagGame.Rules?.gameOver) return;
      sendObs(state);
    }, 100);
  }

  function stepPolice(state, dt) {
    const Core = window.TagGame.Rules;
    const { murosP, halfCell, policeRadiusCell, GRID_SIZE } = window.TagGame;
    const G = GRID_SIZE || 20;
    const rP = policeRadiusCell ?? 0.35;
    const ps = state.entities.policias || [];

    for (let i = 0; i < ps.length; i++) {
      const pi = ps[i];
      const sel = i === 0 ? want.p0 : want.p1;
      const dir = Core.normalizeDiagonal(sel.dx, sel.dy, Core.diagFactor);
      const vx = dir.vx * V_POLICE * dt;
      const vy = dir.vy * V_POLICE * dt;
      let CX = pi.x + 0.5, CY = pi.y + 0.5;
      const moved = Core.moveCenter(CX, CY, vx, vy, murosP, halfCell, rP, G);
      pi.x = moved.CX - 0.5;
      pi.y = moved.CY - 0.5;
    }
  }

  function loop(t) {
    if (window.TagGame.Rules?.gameOver) return;
    if (!last) last = t;
    acc += Math.min(0.05, (t - last) / 1000);
    last = t;

    while (acc >= DT) {
      stepPolice(stateRef, DT);
      acc -= DT;
    }
    if (!window.TagGame.Rules?.gameOver) requestAnimationFrame(loop);
  }

  window.startPoliceAI = function (state) {
    stateRef = state;
    const G = window.TagGame.GRID_SIZE || 15;
    connectWS(G);
    startQueryLoop(state);
    acc = 0; last = 0;
    requestAnimationFrame(loop);
  };
})();
