// movimientoPolicia.js
(function () {
    const speed = 0.03; // celdas por frame
    // Radio aproximado del policía (dibujado como cuadrado ~0.7 de celda -> half ≈ 0.35)
    const policeRadiusCell = 0.35;

    // Dos sets de teclas: WASD (Policía B) y Flechas (Policía A)
    const keysWASD = { w: false, a: false, s: false, d: false };
    const keysArrows = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

    addEventListener("keydown", e => {
        if (e.key in keysWASD) keysWASD[e.key] = true;
        if (e.key in keysArrows) keysArrows[e.key] = true;
    });
    addEventListener("keyup", e => {
        if (e.key in keysWASD) keysWASD[e.key] = false;
        if (e.key in keysArrows) keysArrows[e.key] = false;
    });

    function velFromWASD() {
        let vx = 0, vy = 0;
        if (keysWASD.w) vy -= 1;
        if (keysWASD.s) vy += 1;
        if (keysWASD.a) vx -= 1;
        if (keysWASD.d) vx += 1;
        const { vx: nx, vy: ny } = window.TagGame.Rules.normalizeDiagonal(vx, vy, window.TagGame.Rules.diagFactor);
        return { vx: nx * speed, vy: ny * speed };
    }

    function velFromArrows() {
        let vx = 0, vy = 0;
        if (keysArrows.ArrowUp) vy -= 1;
        if (keysArrows.ArrowDown) vy += 1;
        if (keysArrows.ArrowLeft) vx -= 1;
        if (keysArrows.ArrowRight) vx += 1;
        const { vx: nx, vy: ny } = window.TagGame.Rules.normalizeDiagonal(vx, vy, window.TagGame.Rules.diagFactor);
        return { vx: nx * speed, vy: ny * speed };
    }

    function movePoliceByIndex(state, index, vx, vy) {
        const { murosP, halfCell, GRID_SIZE } = window.TagGame;
        const p = state.entities.policias[index];
        if (!p) return;

        const G = GRID_SIZE || 20;
        const r = policeRadiusCell;

        // esquina -> centro
        let CX = p.x + 0.5;
        let CY = p.y + 0.5;

        // aplicar movimiento con colisión por ejes
        const moved = window.TagGame.Rules.moveCenter(CX, CY, vx, vy, murosP, halfCell, r, G);
        CX = moved.CX; CY = moved.CY;

        // centro -> esquina
        p.x = CX - 0.5;
        p.y = CY - 0.5;
    }

    function gameLoop(state) {
        if (window.TagGame.Rules.gameOver) return; // ← stop si ya terminó

        const vA = velFromArrows(); movePoliceByIndex(state, 0, vA.vx, vA.vy);
        const vB = velFromWASD(); movePoliceByIndex(state, 1, vB.vx, vB.vy);

        // 🔔 Checar captura (usa radios por defecto: ladrón ~0.4, policía ~0.35)
        window.TagGame.Rules.checkCaptureAndEnd(state, undefined, 0.35);

        window.TagGame.renderLoop(state.entities);
        if (!window.TagGame.Rules.gameOver) requestAnimationFrame(() => gameLoop(state));
    }
      

    // Público: inicia control dual de policías
    window.startPoliciasControl = function (state) {
        gameLoop(state);
    };
})();
  