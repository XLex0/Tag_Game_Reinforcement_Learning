(function () {
  console.log("rulesUi.js cargado");

  const Core = window.TagGame.RulesCore;
  console.log("RulesCore disponible:", !!Core);

  // --- estilos + overlay ---
  function ensureOverlayStyles() {
    if (document.getElementById("tg-ol")) return;
    const s = document.createElement("style");
    s.id = "tg-ol";
    s.textContent = `
      .tg-overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);z-index:9999}
      .tg-card{padding:24px 32px;border-radius:12px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.5);font-family:Segoe UI,sans-serif}
      .tg-win{background:#0e1a10;border:1px solid #3cff86;color:#b9ffcf}
      .tg-lose{background:#1a0e0e;border:1px solid #ff5b5b;color:#ffd6d6}
      .tg-card h2{margin:0 0 8px;font-size:2rem}
      .tg-card p{margin:0 0 16px;opacity:.9}
      .tg-card button{padding:10px 16px;border-radius:10px;border:0;cursor:pointer;font-weight:600}
    `;
    document.head.appendChild(s);
  }

  function showEndMessage(thiefWins) {
    ensureOverlayStyles();
    const isLadron = (location.pathname || "").toLowerCase().includes("ladron");
    let title, sub, cls;
    if (isLadron) {
      if (thiefWins) {
        title = "¡Victoria del ladrón!";
        sub = "Se acabó el tiempo";
        cls = "tg-win";
      } else {
        title = "Derrota";
        sub = "Te atraparon";
        cls = "tg-lose";
      }
    } else {
      if (thiefWins) {
        title = "Derrota";
        sub = "El ladrón escapó";
        cls = "tg-lose";
      } else {
        title = "¡Victoria de la policía!";
        sub = "Atraparon al ladrón";
        cls = "tg-win";
      }
    }
    const d = document.createElement("div");
    d.className = "tg-overlay";
    d.innerHTML = `<div class="tg-card ${cls}">
        <h2>${title}</h2>
        <p>${sub}</p>
        <button id="tg-r">Jugar de nuevo</button>
      </div>`;
    document.body.appendChild(d);
    d.querySelector("#tg-r").onclick = () => location.reload();
  }

  // --- lógica UI y timer ---
  const RulesUI = {
    ...Core,
    secondsLeft: 30,
    timerId: null,
    gameOver: false,
    ganarLadron: true,

    startTimer(seconds = 30, sel = ".reloj") {
      console.log("startTimer ejecutado");
      this.clearTimer();
      this.secondsLeft = Math.max(0, Math.floor(seconds));
      this.gameOver = false;

      const reloj = document.querySelector(sel);
      if (reloj) reloj.textContent = `${this.secondsLeft}s`;

      this.timerId = setInterval(() => {
        console.log("tick:", this.secondsLeft);
        if (this.gameOver) {
          this.clearTimer();
          return;
        }

        this.secondsLeft = Math.max(0, this.secondsLeft - 1);
        if (reloj) reloj.textContent = `${this.secondsLeft}s`;

        if (this.secondsLeft <= 0) {
          console.log("tiempo terminado → gana ladrón");
          this.endGame(true);
        }
      }, 1000);
    },

    clearTimer() {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
    },

    endGame(thiefWins) {
      if (this.gameOver) return;
      this.gameOver = true;
      this.clearTimer();
      console.log("endGame ejecutado:", thiefWins ? "gana ladrón" : "gana policía");
      showEndMessage(!!thiefWins);
    },

    checkCaptureAndEnd(state, rT, rP) {
      if (this.gameOver) return;
      const rt = rT ?? (window.TagGame.agentRadiusCell ?? 0.4);
      const rp = rP ?? 0.35;
      const captured = Core.checkCapture(state, rt, rp);
      if (captured) {
        console.log("¡Captura detectada!");
        this.endGame(false);
      }
    },
  };

  window.TagGame.Rules = RulesUI;
  console.log("RulesUI publicado:", !!window.TagGame.Rules);
})();
