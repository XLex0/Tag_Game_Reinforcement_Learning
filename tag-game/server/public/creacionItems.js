// ------------------------
// Configuración básica
// ------------------------
const GRID_SIZE = 15;
const EMPTY = "VACIO";
const WALL = "MURO";
const POLICE = "POLICIA";
const THIEF = "LADRON";

// ------------------------
// PRNG determinista (mulberry32)
// ------------------------
function makeRNG(seed = 2023014) {
  let t = seed >>> 0;
  return {
    rand() {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    },
    int(max) {
      return Math.floor(this.rand() * max);
    }
  };
}

// ------------------------
// Utilidad para crear matriz 2D
// ------------------------
function createMatrix(rows, cols, fill = EMPTY) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ type: fill }))
  );
}

/**
 * creaElMapa
 * 1) Crea matriz 15x15 y coloca muros/personajes de forma determinista.
 * 2) Llama a renderFirst (que dibuja en continuo y guarda coords de muros).
 */
function creaElMapa(seed = 2023014) {
  const rng = makeRNG(seed);
  const map = createMatrix(GRID_SIZE, GRID_SIZE, EMPTY);

  // Parámetros de spawns (para no bloquear lados)
  const leftSpawnCols = Math.floor(GRID_SIZE * 0.35);
  const rightSpawnStart = Math.floor(GRID_SIZE * 0.65);

  // 1) MUROS: primero en matriz (≈3.5%)
  const density = 0.035;
  const targetWalls = Math.floor(GRID_SIZE * GRID_SIZE * density);
  let placedWalls = 0;

  while (placedWalls < targetWalls) {
    const r = rng.int(GRID_SIZE);
    const c = rng.int(GRID_SIZE);
    const inLeftSpawn = c < leftSpawnCols;
    const inRightSpawn = c >= rightSpawnStart;
    if (inLeftSpawn || inRightSpawn) continue;
    if (map[r][c].type !== EMPTY) continue;
    map[r][c] = { type: WALL };
    placedWalls++;
  }

  // POLICÍAS (izquierda)
  const policePositions = [];
  while (policePositions.length < 2) {
    const r = rng.int(GRID_SIZE);
    const c = rng.int(leftSpawnCols);
    if (map[r][c].type === EMPTY) {
      map[r][c] = { type: POLICE };
      policePositions.push({ r, c });
    }
  }

  // LADRÓN (derecha)
  let thiefPosition = null;
  while (!thiefPosition) {
    const r = rng.int(GRID_SIZE);
    const c = rng.int(GRID_SIZE - rightSpawnStart) + rightSpawnStart;
    if (map[r][c].type === EMPTY) {
      map[r][c] = { type: THIEF };
      thiefPosition = { r, c };
    }
  }

  const entities = {
    policias: policePositions.map(p => ({ x: p.c, y: p.r, vx: 0, vy: 0 })),
    ladron: { x: thiefPosition.c, y: thiefPosition.r, vx: 0, vy: 0 }
  };

  // walls (discretos r,c)
  const wallsRC = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (map[r][c].type === WALL) wallsRC.push({ r, c });
    }
  }

  // 2) Dibujar en continuo y guardar coords de muros
  renderFirst(map, wallsRC);

  // publicar referencias útiles
  window.TagGame.map = map;
  window.TagGame.wallsRC = wallsRC;
  window.TagGame.seed = seed;

  return { map, entities, wallsRC };
}

/**
 * renderFirst(map, wallsRC)
 * - Crea canvas (espacio continuo)
 * - Dibuja fondo + muros
 * - Guarda helpers y tamaños
 */
function renderFirst(map, wallsRC) {
  injectBaseStyles();

  const container = document.getElementById("canva");
  container.innerHTML = "";

  const canvas = document.createElement("canvas");
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cssW = container.clientWidth;
  const cssH = container.clientHeight;

  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const cellW = cssW / GRID_SIZE;
  const cellH = cssH / GRID_SIZE;

  // Fondo
  ctx.fillStyle = "#1a1f29";
  ctx.fillRect(0, 0, cssW, cssH);

  // Muros
  const wallRects = [];
  const murosP = [];
  const halfCell = { hx: 0.5, hy: 0.5 };

  for (const { r, c } of wallsRC) {
    const x = c * cellW;
    const y = r * cellH;

    ctx.fillStyle = "#3a4250";
    ctx.fillRect(x, y, cellW, cellH);
    ctx.strokeStyle = "#2a313d";
    ctx.strokeRect(x, y, cellW, cellH);

    wallRects.push({ x, y, w: cellW, h: cellH });
    murosP.push({ cx: c + 0.5, cy: r + 0.5 });
  }

  window.TagGame.canvas = canvas;
  window.TagGame.ctx = ctx;
  window.TagGame.cellSize = { w: cellW, h: cellH };
  window.TagGame.wallRects = wallRects;

  // exporta también para movimiento
  window.TagGame.murosP = murosP;
  window.TagGame.halfCell = halfCell;

  const thiefRadiusCell = Math.min(cellW, cellH) / (2.5 * cellW);
  window.TagGame.agentRadiusCell = thiefRadiusCell;

  window.TagGame.GRID_SIZE = GRID_SIZE;

  window.TagGame.toCell = function toCell(xPx, yPx) {
    const c = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(xPx / cellW)));
    const r = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(yPx / cellH)));
    return { r, c };
  };
  window.TagGame.toXY = function toXY(r, c) {
    return { x: c * cellW, y: r * cellH };
  };
}

/**
 * renderLoop(entities)
 */
function renderLoop(entities) {
  const { ctx, canvas, wallRects, cellSize } = window.TagGame;
  if (!ctx) return;

  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const { w: cellW, h: cellH } = cellSize;

  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = "#1a1f29";
  ctx.fillRect(0, 0, cssW, cssH);

  for (const rct of wallRects) {
    ctx.fillStyle = "#3a4250";
    ctx.fillRect(rct.x, rct.y, rct.w, rct.h);
    ctx.strokeStyle = "#2a313d";
    ctx.strokeRect(rct.x, rct.y, rct.w, rct.h);
  }

  for (const p of entities.policias) {
    const xPx = p.x * cellW;
    const yPx = p.y * cellH;
    ctx.fillStyle = "#1e90ff";
    ctx.fillRect(xPx + cellW * 0.15, yPx + cellH * 0.15, cellW * 0.7, cellH * 0.7);
  }

  const l = entities.ladron;
  const lx = l.x * cellW;
  const ly = l.y * cellH;
  ctx.fillStyle = "#ff3b3b";
  ctx.beginPath();
  ctx.arc(lx + cellW / 2, ly + cellH / 2, Math.min(cellW, cellH) / 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function injectBaseStyles() {
  if (document.getElementById("taggame-style")) return;
  const style = document.createElement("style");
  style.id = "taggame-style";
  style.textContent = `
    #canva {
      width: 90vmin;
      height: 90vmin;
      max-width: 600px;
      max-height: 600px;
      background: #0d0f13;
      border-radius: 10px;
      margin: 0 auto;
    }
  `;
  document.head.appendChild(style);
}

window.TagGame = window.TagGame || {};
window.TagGame.creaElMapa = creaElMapa;
window.TagGame.renderFirst = renderFirst;
window.TagGame.renderLoop = renderLoop;
