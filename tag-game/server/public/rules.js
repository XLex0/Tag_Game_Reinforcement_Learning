// rules.js
(function () {
    const eps = 1e-4;

    function ensureOverlayStyles() {
        if (document.getElementById("taggame-overlay-style")) return;
        const st = document.createElement("style");
        st.id = "taggame-overlay-style";
        st.textContent = `
        .tg-overlay {
          position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.6); z-index: 9999;
        }
        .tg-card {
          padding: 24px 32px; border-radius: 12px; text-align: center;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          font-family: 'Segoe UI', sans-serif;
        }
        .tg-win  { background: #0e1a10; border: 1px solid #3cff86; color: #b9ffcf; }
        .tg-lose { background: #1a0e0e; border: 1px solid #ff5b5b; color: #ffd6d6; }
        .tg-card h2 { margin: 0 0 8px; font-size: 2rem; }
        .tg-card p  { margin: 0 0 16px; opacity: 0.9; }
        .tg-card button {
          padding: 10px 16px; border-radius: 10px; border: 0; cursor: pointer; font-weight: 600;
        }
      `;
        document.head.appendChild(st);
    }

    function showEndMessage(ganarLadron) {
        ensureOverlayStyles();
        const path = (location.pathname || "").toLowerCase();
        const isLadron = path.includes("ladron");
        const thiefWins = !!ganarLadron;

        let title = "", subtitle = "", cls = "";
        if (isLadron) {
            if (thiefWins) { title = "¡Victoria del ladrón!"; subtitle = "Se acabó el tiempo y escapaste 👏"; cls = "tg-win"; }
            else { title = "Derrota"; subtitle = "Te atraparon antes de que acabara el tiempo."; cls = "tg-lose"; }
        } else { // policía
            if (thiefWins) { title = "Derrota"; subtitle = "El ladrón escapó. Se acabó el tiempo."; cls = "tg-lose"; }
            else { title = "¡Victoria de la policía!"; subtitle = "Atraparon al ladrón a tiempo 💪"; cls = "tg-win"; }
        }

        const overlay = document.createElement("div");
        overlay.className = "tg-overlay";
        overlay.innerHTML = `<div class="tg-card ${cls}">
        <h2>${title}</h2>
        <p>${subtitle}</p>
        <button id="tg-restart">Jugar de nuevo</button>
      </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector("#tg-restart").addEventListener("click", () => location.reload());
    }

    const Rules = {
        diagFactor: 0.707,

        // Estado de juego / timer
        secondsLeft: 30,
        timerId: null,
        gameOver: false,
        ganarLadron: true, // por defecto, si llega a 0 el tiempo, gana el ladrón

        setGanarLadron(flag) { this.ganarLadron = !!flag; },

        startTimer(seconds = 30, relojSelector = ".reloj") {
            this.clearTimer();
            this.secondsLeft = Math.max(0, Math.floor(seconds));
            this.gameOver = false;

            const relojEl = document.querySelector(relojSelector);
            if (relojEl) relojEl.textContent = `${this.secondsLeft}s`;

            this.timerId = setInterval(() => {
                if (this.gameOver) { this.clearTimer(); return; }
                this.secondsLeft = Math.max(0, this.secondsLeft - 1);
                if (relojEl) relojEl.textContent = `${this.secondsLeft}s`;

                if (this.secondsLeft <= 0) {
                    this.endGame(this.ganarLadron);
                }
            }, 1000);
        },

        clearTimer() {
            if (this.timerId) { clearInterval(this.timerId); this.timerId = null; }
        },

        endGame(ganarLadronFlag) {
            if (this.gameOver) return;
            this.gameOver = true;
            this.ganarLadron = !!ganarLadronFlag;
            this.clearTimer();
            showEndMessage(this.ganarLadron);
        },

        clamp(val, min, max) {
            return Math.max(min, Math.min(max, val));
        },

        normalizeDiagonal(vx, vy, factor = 0.707) {
            if (vx !== 0 && vy !== 0) { vx *= factor; vy *= factor; }
            return { vx, vy };
        },

        // AABB inflado por el radio del agente (COORDENADAS DE CENTRO)
        blocksX_center(nextCX, CY, murosP, half, r) {
            const hx = half.hx + r, hy = half.hy + r;
            for (const m of murosP) {
                if (Math.abs(CY - m.cy) <= hy - eps) {
                    if (Math.abs(nextCX - m.cx) <= hx - eps) return true;
                }
            }
            return false;
        },

        blocksY_center(CX, nextCY, murosP, half, r) {
            const hx = half.hx + r, hy = half.hy + r;
            for (const m of murosP) {
                if (Math.abs(CX - m.cx) <= hx - eps) {
                    if (Math.abs(nextCY - m.cy) <= hy - eps) return true;
                }
            }
            return false;
        },

        moveCenter(CX, CY, vx, vy, murosP, half, r, G) {
            const tryCX = CX + vx;
            if (!this.blocksX_center(tryCX, CY, murosP, half, r)) CX = tryCX;

            const tryCY = CY + vy;
            if (!this.blocksY_center(CX, tryCY, murosP, half, r)) CY = tryCY;

            CX = this.clamp(CX, 0 + r + 1e-4, G - r - 1e-4);
            CY = this.clamp(CY, 0 + r + 1e-4, G - r - 1e-4);
            return { CX, CY };
        },

        /**
         * Chequea captura por distancia euclidiana entre centros.
         * rThief: radio del ladrón (celdas). rPolice: radio de policía (celdas).
         * Si hay captura, termina el juego con ganarLadron=false.
         */
        checkCaptureAndEnd(state, rThief, rPolice) {
            if (this.gameOver) return;
            const l = state.entities?.ladron;
            const ps = state.entities?.policias || [];
            if (!l || ps.length === 0) return;

            const tCX = l.x + 0.5;
            const tCY = l.y + 0.5;
            const rt = rThief ?? (window.TagGame.agentRadiusCell ?? 0.4);
            const rp = rPolice ?? 0.35;

            for (const p of ps) {
                const pCX = p.x + 0.5;
                const pCY = p.y + 0.5;
                const d = Math.hypot(tCX - pCX, tCY - pCY);
                if (d <= rt + rp) {
                    // policía captura → ladrón pierde
                    this.endGame(false);
                    return;
                }
            }
        },
    };

    window.TagGame = window.TagGame || {};
    window.TagGame.Rules = Rules;
})();
  