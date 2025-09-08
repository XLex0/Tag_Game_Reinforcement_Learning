// movimientoLadron.js
(function () {
    const speed = 0.03; // celdas por frame
    const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

    addEventListener("keydown", e => { if (e.key in keys) keys[e.key] = true; });
    addEventListener("keyup", e => { if (e.key in keys) keys[e.key] = false; });

    function getVelocity() {
        let vx = 0, vy = 0;
        if (keys.ArrowUp) vy -= 1;
        if (keys.ArrowDown) vy += 1;
        if (keys.ArrowLeft) vx -= 1;
        if (keys.ArrowRight) vx += 1;
        const n = window.TagGame.Rules.normalizeDiagonal(vx, vy, window.TagGame.Rules.diagFactor);
        return { vx: n.vx * speed, vy: n.vy * speed };
    }

    function gameLoop(state) {
        const { murosP, halfCell, agentRadiusCell, GRID_SIZE } = window.TagGame;
        if (window.TagGame.Rules.gameOver) return; // ← stop si ya terminó

        const l = state.entities.ladron;
        const { vx, vy } = getVelocity();
        const r = agentRadiusCell ?? 0.4;
        const G = GRID_SIZE || 20;

        let CX = l.x + 0.5, CY = l.y + 0.5;
        const moved = window.TagGame.Rules.moveCenter(CX, CY, vx, vy, murosP, halfCell, r, G);
        l.x = moved.CX - 0.5; l.y = moved.CY - 0.5;

        window.TagGame.Rules.checkCaptureAndEnd(state, r, 0.35);

        window.TagGame.renderLoop(state.entities);
        if (!window.TagGame.Rules.gameOver) requestAnimationFrame(() => gameLoop(state));
    }
      
    window.startLadronControl = function (state) {
        gameLoop(state);
    };
})();
  