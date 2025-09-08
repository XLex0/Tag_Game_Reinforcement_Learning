// ------------------------
// Configuración básica
// ------------------------
const GRID_SIZE = 15;
const EMPTY = "VACIO";
const WALL = "MURO";
const POLICE = "POLICIA";
const THIEF = "LADRON";

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
 * 1) Crea matriz 20x20 y coloca muros/personajes.
 * 2) Llama a renderFirst (que dibuja en continuo y guarda coords continuas de muros).
 * Devuelve { map, entities, wallsRC }:
 *   - wallsRC: muros en (r,c) discretos.
 */
function creaElMapa() {
    const map = createMatrix(GRID_SIZE, GRID_SIZE, EMPTY);

    // Parámetros de spawns (para no bloquear lados)
    const leftSpawnCols = Math.floor(GRID_SIZE * 0.35);
    const rightSpawnStart = Math.floor(GRID_SIZE * 0.65);

    // 1) MUROS: primero en matriz (10% aprox.)
    const density = 0.035;
    const targetWalls = Math.floor(GRID_SIZE * GRID_SIZE * density);
    let placedWalls = 0;

    while (placedWalls < targetWalls) {
        const r = Math.floor(Math.random() * GRID_SIZE);
        const c = Math.floor(Math.random() * GRID_SIZE);
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
        const r = Math.floor(Math.random() * GRID_SIZE);
        const c = Math.floor(Math.random() * leftSpawnCols);
        if (map[r][c].type === EMPTY) {
            map[r][c] = { type: POLICE };
            policePositions.push({ r, c });
        }
    }

    // LADRÓN (derecha)
    let thiefPosition = null;
    while (!thiefPosition) {
        const r = Math.floor(Math.random() * GRID_SIZE);
        const c = Math.floor(Math.random() * (GRID_SIZE - rightSpawnStart)) + rightSpawnStart;
        if (map[r][c].type === EMPTY) {
            map[r][c] = { type: THIEF };
            thiefPosition = { r, c };
        }
    }

    const entities = {
        // posiciones continuas referidas a celdas (no px): x=c, y=r
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

    // 2) Dibujar en continuo y guardar coords continuas de muros
    renderFirst(map, wallsRC);

    // publicar referencias útiles
    window.TagGame.map = map;
    window.TagGame.wallsRC = wallsRC;

    return { map, entities, wallsRC };
}

/**
 * renderFirst(map, wallsRC)
 * - Crea canvas (espacio continuo)
 * - Dibuja fondo + muros
 * - Guarda:
 *    - cellSize (px)
 *    - wallRects (coordenadas continuas de cada muro: {x,y,w,h} en px)
 *    - funciones toCell / toXY para discretizar y volver a continuo después
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // coordenadas en px CSS

    const cellW = cssW / GRID_SIZE;
    const cellH = cssH / GRID_SIZE;

    // Fondo
    ctx.fillStyle = "#1a1f29";
    ctx.fillRect(0, 0, cssW, cssH);

    // Muros (dibujados y guardados)
    const wallRects = [];
    const murosP = []; // centros en unidades de celda
    const halfCell = { hx: 0.5, hy: 0.5 }; // distancia al borde en celdas

    for (const { r, c } of wallsRC) {
        const x = c * cellW;
        const y = r * cellH;

        // dibujar
        ctx.fillStyle = "#3a4250";
        ctx.fillRect(x, y, cellW, cellH);
        ctx.strokeStyle = "#2a313d";
        ctx.strokeRect(x, y, cellW, cellH);

        // guardar rectángulo en píxeles
        wallRects.push({ x, y, w: cellW, h: cellH });

        // guardar centro en unidades de celda (coordenadas continuas del grid)
        murosP.push({ cx: c + 0.5, cy: r + 0.5 });
    }

    // Guardar en TagGame para usar en movimiento
    window.TagGame.canvas = canvas;
    window.TagGame.ctx = ctx;
    window.TagGame.cellSize = { w: cellW, h: cellH };
    window.TagGame.wallRects = wallRects;

    // exporta también para movimientoLadron.js
    window.TagGame.murosP = murosP;
    window.TagGame.halfCell = halfCell;

    // Radio del ladrón en UNIDADES DE CELDA (coincide con el dibujo: /2.5)
    const thiefRadiusCell = Math.min(cellW, cellH) / (2.5 * cellW); // ~0.4 si cellW==cellH
    window.TagGame.agentRadiusCell = thiefRadiusCell;

    // También publica el GRID_SIZE para que movimiento lo use
    window.TagGame.GRID_SIZE = GRID_SIZE;


    // Helpers de transformación (guardados)
    window.TagGame.toCell = function toCell(xPx, yPx) {
        // continuo(px) -> discreto(r,c)
        const c = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(xPx / cellW)));
        const r = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(yPx / cellH)));
        return { r, c };
    };
    window.TagGame.toXY = function toXY(r, c) {
        // discreto(r,c) -> continuo(px) en la esquina sup-izq de la celda
        return { x: c * cellW, y: r * cellH };
    };
}

/**
 * renderLoop(entities)
 * - Redibuja fondo + muros (desde wallRects guardados) + personajes.
 * - entities usan coordenadas CONTINUAS en unidades de celda (x=celdas, y=celdas).
 */
function renderLoop(entities) {
    const { ctx, canvas, wallRects, cellSize } = window.TagGame;
    if (!ctx) return;

    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const { w: cellW, h: cellH } = cellSize;

    // Fondo
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "#1a1f29";
    ctx.fillRect(0, 0, cssW, cssH);

    // Muros desde coordenadas CONTINUAS guardadas
    for (const rct of wallRects) {
        ctx.fillStyle = "#3a4250";
        ctx.fillRect(rct.x, rct.y, rct.w, rct.h);
        ctx.strokeStyle = "#2a313d";
        ctx.strokeRect(rct.x, rct.y, rct.w, rct.h);
    }

    // Policías (cuadrados) — posiciones continuas en unidades de celda
    for (const p of entities.policias) {
        const xPx = p.x * cellW;
        const yPx = p.y * cellH;
        ctx.fillStyle = "#1e90ff";
        ctx.fillRect(xPx + cellW * 0.15, yPx + cellH * 0.15, cellW * 0.7, cellH * 0.7);
    }

    // Ladrón (círculo)
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
