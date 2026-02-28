/**
 * ═══════════════════════════════════════════════════════════════
 *  Wave Function Collapse — Interactive Explainer
 *  A complete, educational WFC implementation with visualization.
 * ═══════════════════════════════════════════════════════════════
 *
 *  Concepts:
 *    • Superposition — each cell begins with ALL tiles as options
 *    • Entropy — the count of remaining valid options for a cell
 *    • Collapse — picking one definitive state for the lowest-entropy cell
 *    • Propagation — removing invalid options from neighbors recursively
 */

// ─────────────────────────────────────────────
//  §1  TILE DEFINITIONS & ADJACENCY RULES
// ─────────────────────────────────────────────

/**
 * SOCKET-BASED ADJACENCY
 * ──────────────────────
 * Each tile face has a "socket" label. Two tiles can sit next to each other
 * only if their touching faces share the same socket.
 *
 * Socket alphabet (terrain elevation):
 *   0 = water, 1 = sand, 2 = grass, 3 = forest, 4 = mountain
 *
 * Base tiles have the same socket on all four faces.
 * Transition tiles blend two adjacent terrain types,
 * with appropriate sockets on each face.
 */

// Helper to create a tile entry
function makeTile(name, sockets, drawFn, weight = 1) {
  return { name, sockets, draw: drawFn, weight };
}

// ── Drawing helpers ──────────────────────────

function drawWater(ctx, x, y, s) {
  ctx.fillStyle = '#3478b2';
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#4090cc';
  ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  ctx.strokeStyle = 'rgba(200,230,255,0.2)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const wy = y + (s / 4) * i;
    ctx.beginPath();
    ctx.moveTo(x + 3, wy);
    ctx.quadraticCurveTo(x + s * 0.3, wy - 2.5, x + s * 0.5, wy);
    ctx.quadraticCurveTo(x + s * 0.7, wy + 2.5, x + s - 3, wy);
    ctx.stroke();
  }
}

function drawSand(ctx, x, y, s) {
  ctx.fillStyle = '#c6a84b';
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#dbbf66';
  ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  ctx.fillStyle = 'rgba(160,130,60,0.35)';
  const seed = ((x * 7 + y * 13) & 0xffff) % 97;
  for (let i = 0; i < 5; i++) {
    const dx = ((seed + i * 17) % (s - 6)) + 3;
    const dy = ((seed + i * 23) % (s - 6)) + 3;
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, 1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGrass(ctx, x, y, s) {
  ctx.fillStyle = '#3fa85e';
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#58c478';
  ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  ctx.strokeStyle = 'rgba(30,80,40,0.3)';
  ctx.lineWidth = 1;
  const seed = ((x * 11 + y * 7) & 0xffff) % 97;
  for (let i = 0; i < 4; i++) {
    const bx = x + ((seed + i * 19) % (s - 8)) + 4;
    const by = y + s - 5;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + (i % 2 === 0 ? 2 : -2), by - 5);
    ctx.stroke();
  }
}

function drawForest(ctx, x, y, s) {
  ctx.fillStyle = '#1b5e35';
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#236b40';
  ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  const cx = x + s / 2;
  ctx.fillStyle = '#2d8c52';
  ctx.beginPath();
  ctx.moveTo(cx, y + 4);
  ctx.lineTo(cx + s * 0.3, y + s - 7);
  ctx.lineTo(cx - s * 0.3, y + s - 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4a3020';
  ctx.fillRect(cx - 1.5, y + s - 7, 3, 4);
}

function drawMountain(ctx, x, y, s) {
  ctx.fillStyle = '#5a5a6e';
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#6a6a7e';
  ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  const cx = x + s * 0.5;
  ctx.fillStyle = '#7e7e90';
  ctx.beginPath();
  ctx.moveTo(cx, y + 3);
  ctx.lineTo(cx + s * 0.36, y + s - 4);
  ctx.lineTo(cx - s * 0.36, y + s - 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c8c8d8';
  ctx.beginPath();
  ctx.moveTo(cx, y + 3);
  ctx.lineTo(cx + s * 0.11, y + s * 0.28);
  ctx.lineTo(cx - s * 0.11, y + s * 0.28);
  ctx.closePath();
  ctx.fill();
}

/**
 * Transition drawer: blends two terrain colors with a gradient.
 * gradDir: 'h' (left→right) or 'v' (top→bottom)
 */
function makeTransitionDraw(color1, color2, gradDir) {
  return function (ctx, x, y, s) {
    let grad;
    if (gradDir === 'h') {
      grad = ctx.createLinearGradient(x, y, x + s, y);
    } else {
      grad = ctx.createLinearGradient(x, y, x, y + s);
    }
    grad.addColorStop(0, color1);
    grad.addColorStop(1, color2);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, s, s);
    // Subtle dither line
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    if (gradDir === 'h') {
      ctx.beginPath();
      ctx.moveTo(x + s * 0.5, y);
      ctx.lineTo(x + s * 0.5, y + s);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.5);
      ctx.lineTo(x + s, y + s * 0.5);
      ctx.stroke();
    }
  };
}

// ── Build the tile set ───────────────────────

const TERRAIN_COLORS = {
  0: '#4090cc', // water
  1: '#dbbf66', // sand
  2: '#58c478', // grass
  3: '#236b40', // forest
  4: '#6a6a7e', // mountain
};

const TERRAIN_NAMES = {
  0: 'Water',
  1: 'Sand',
  2: 'Grass',
  3: 'Forest',
  4: 'Mountain',
};

const TERRAIN_DRAWS = {
  0: drawWater,
  1: drawSand,
  2: drawGrass,
  3: drawForest,
  4: drawMountain,
};

const TILES = [];

// 1) Five base tiles (all faces same socket), each with higher weight
//    to make the map more natural (prefer pure terrain over transitions)
for (let t = 0; t <= 4; t++) {
  TILES.push(makeTile(
    TERRAIN_NAMES[t],
    { north: t, east: t, south: t, west: t },
    TERRAIN_DRAWS[t],
    3 // prefer base tiles
  ));
}

// 2) Transition tiles between adjacent terrain types (0↔1, 1↔2, 2↔3, 3↔4)
//    Each transition needs 4 orientation variants so it can appear at any edge.
const TRANSITIONS = [
  [0, 1], // water ↔ sand
  [1, 2], // sand  ↔ grass
  [2, 3], // grass ↔ forest
  [3, 4], // forest ↔ mountain
];

for (const [a, b] of TRANSITIONS) {
  const nameAB = `${TERRAIN_NAMES[a]}→${TERRAIN_NAMES[b]}`;
  const cA = TERRAIN_COLORS[a];
  const cB = TERRAIN_COLORS[b];

  // Horizontal: a on west, b on east
  TILES.push(makeTile(nameAB, { north: a, east: b, south: a, west: a }, makeTransitionDraw(cA, cB, 'h'), 1));
  TILES.push(makeTile(nameAB, { north: b, east: b, south: b, west: a }, makeTransitionDraw(cA, cB, 'h'), 1));
  TILES.push(makeTile(nameAB, { north: a, east: a, south: a, west: b }, makeTransitionDraw(cB, cA, 'h'), 1));
  TILES.push(makeTile(nameAB, { north: b, east: a, south: b, west: b }, makeTransitionDraw(cB, cA, 'h'), 1));

  // Vertical: a on north, b on south
  TILES.push(makeTile(nameAB, { north: a, east: a, south: b, west: a }, makeTransitionDraw(cA, cB, 'v'), 1));
  TILES.push(makeTile(nameAB, { north: a, east: b, south: b, west: b }, makeTransitionDraw(cA, cB, 'v'), 1));
  TILES.push(makeTile(nameAB, { north: b, east: a, south: a, west: a }, makeTransitionDraw(cB, cA, 'v'), 1));
  TILES.push(makeTile(nameAB, { north: b, east: b, south: a, west: b }, makeTransitionDraw(cB, cA, 'v'), 1));
}

// Total: 5 base + 4 transitions × 8 variants = 37 tiles

/**
 * Pre-compute valid neighbor tile indices for each tile+direction.
 * Two tiles can be adjacent along a direction if their touching sockets match.
 */
const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };
const DIRS = ['north', 'east', 'south', 'west'];
const DIR_OFFSETS = {
  north: [0, -1],
  east: [1, 0],
  south: [0, 1],
  west: [-1, 0],
};

// validNeighbors[i][dir] = Set of tile indices j that can go in direction `dir` from tile i
const validNeighbors = TILES.map((tile, _i) => {
  const map = {};
  for (const dir of DIRS) {
    map[dir] = new Set();
    const mySocket = tile.sockets[dir];
    const oppDir = OPPOSITE[dir];
    for (let j = 0; j < TILES.length; j++) {
      if (TILES[j].sockets[oppDir] === mySocket) {
        map[dir].add(j);
      }
    }
  }
  return map;
});


// ─────────────────────────────────────────────
//  §2  CELL & GRID
// ─────────────────────────────────────────────

class Cell {
  constructor(x, y, totalTiles) {
    this.x = x;
    this.y = y;
    this.collapsed = false;
    // Bitset-like: which tiles are still valid options
    this.options = new Set();
    for (let i = 0; i < totalTiles; i++) this.options.add(i);
    // Flash animation: { type: 'collapse'|'propagate', timer: 0..1 }
    this.flash = null;
  }

  /** Entropy = number of remaining options. Collapsed → Infinity. */
  get entropy() {
    return this.collapsed ? Infinity : this.options.size;
  }

  /** Collapse to one random option, weighted by tile weight. */
  collapse() {
    const arr = [...this.options];
    // Weighted random selection
    const totalWeight = arr.reduce((sum, idx) => sum + TILES[idx].weight, 0);
    let r = Math.random() * totalWeight;
    let pick = arr[0];
    for (const idx of arr) {
      r -= TILES[idx].weight;
      if (r <= 0) { pick = idx; break; }
    }
    this.options = new Set([pick]);
    this.collapsed = true;
    this.flash = { type: 'collapse', timer: 1.0 };
    return pick;
  }

  /** Reset to full superposition. */
  reset(totalTiles) {
    this.collapsed = false;
    this.options = new Set();
    for (let i = 0; i < totalTiles; i++) this.options.add(i);
    this.flash = null;
  }
}

class Grid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cells = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.cells.push(new Cell(x, y, TILES.length));
      }
    }
  }

  get(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return undefined;
    return this.cells[y * this.width + x];
  }

  get isFullyCollapsed() {
    return this.cells.every(c => c.collapsed);
  }

  get collapsedCount() {
    let n = 0;
    for (const c of this.cells) if (c.collapsed) n++;
    return n;
  }

  /** Reset all cells to superposition. */
  reset() {
    for (const c of this.cells) c.reset(TILES.length);
  }
}


// ─────────────────────────────────────────────
//  §3  WFC SOLVER
// ─────────────────────────────────────────────

/**
 * The WFC solver implements:
 *   1. Observe  — find lowest-entropy cell, collapse it
 *   2. Propagate — stack-based constraint propagation
 *
 * On contradiction, it automatically retries (up to a limit)
 * with a fresh grid — this is standard WFC behavior.
 */
class WFCSolver {
  constructor(grid) {
    this.grid = grid;
    this.propagationStack = []; // [{x, y}]
    this.state = 'idle';       // 'idle'|'observing'|'propagating'|'done'|'error'
    this.stepCount = 0;
    this.lastCollapsed = null;
    this.lastPropagated = [];
    this.retryCount = 0;
    this.maxRetries = 10;
  }

  /**
   * Execute one logical "step."
   *   - If propagation stack is non-empty → propagate one batch
   *   - Otherwise → observe (collapse lowest-entropy cell)
   */
  step() {
    if (this.state === 'done' || this.state === 'error') return this.state;

    if (this.propagationStack.length > 0) {
      this._propagate();
      this.stepCount++;
      return this.state;
    }

    if (this.grid.isFullyCollapsed) {
      this.state = 'done';
      return this.state;
    }

    this._observe();
    this.stepCount++;
    return this.state;
  }

  /** Find the minimum-entropy uncollapsed cell and collapse it. */
  _observe() {
    this.state = 'observing';
    this.lastPropagated = [];

    const uncollapsed = this.grid.cells.filter(c => !c.collapsed);
    if (uncollapsed.length === 0) {
      this.state = 'done';
      return;
    }

    // Find minimum entropy (with small random noise for balanced spread)
    let minEntropy = Infinity;
    for (const c of uncollapsed) {
      if (c.entropy < minEntropy) minEntropy = c.entropy;
    }

    const candidates = uncollapsed.filter(c => c.entropy === minEntropy);
    const cell = candidates[Math.floor(Math.random() * candidates.length)];

    if (cell.options.size === 0) {
      this._handleContradiction();
      return;
    }

    cell.collapse();
    this.lastCollapsed = cell;

    // Push this cell for propagation
    this.propagationStack.push({ x: cell.x, y: cell.y });
    this.state = 'propagating';
  }

  /**
   * Pop entries off the stack and constrain neighbors.
   * Processes a limited batch per step for visual clarity.
   */
  _propagate() {
    this.state = 'propagating';
    this.lastPropagated = [];

    // Process the entire stack (full propagation pass per step)
    // but limit to N items to keep the UI snappy
    const batchSize = Math.min(this.propagationStack.length, 40);

    for (let i = 0; i < batchSize; i++) {
      if (this.propagationStack.length === 0) break;
      const { x, y } = this.propagationStack.pop();
      const cell = this.grid.get(x, y);
      if (!cell) continue;

      for (const dir of DIRS) {
        const [dx, dy] = DIR_OFFSETS[dir];
        const neighbor = this.grid.get(x + dx, y + dy);
        if (!neighbor || neighbor.collapsed) continue;

        // Collect all tile indices the neighbor is allowed to be,
        // given every remaining option in the current cell
        const allowed = new Set();
        for (const optIdx of cell.options) {
          for (const nIdx of validNeighbors[optIdx][dir]) {
            allowed.add(nIdx);
          }
        }

        // Intersect with neighbor's current options
        const before = neighbor.options.size;
        const newOptions = new Set();
        for (const idx of neighbor.options) {
          if (allowed.has(idx)) newOptions.add(idx);
        }
        neighbor.options = newOptions;

        if (neighbor.options.size === 0) {
          this._handleContradiction();
          return;
        }

        // If we reduced options, propagate from this neighbor too
        if (neighbor.options.size < before) {
          neighbor.flash = { type: 'propagate', timer: 1.0 };
          this.lastPropagated.push(neighbor);
          this.propagationStack.push({ x: neighbor.x, y: neighbor.y });

          // Auto-collapse if exactly one option remains
          if (neighbor.options.size === 1) {
            neighbor.collapsed = true;
            neighbor.flash = { type: 'collapse', timer: 1.0 };
          }
        }
      }
    }

    // If stack is empty, proceed to next observe
    if (this.propagationStack.length === 0) {
      this.state = this.grid.isFullyCollapsed ? 'done' : 'observing';
    }
  }

  /** On contradiction: retry with a fresh grid, or give up. */
  _handleContradiction() {
    this.retryCount++;
    if (this.retryCount <= this.maxRetries) {
      // Silent retry: reset and restart
      this.grid.reset();
      this.propagationStack = [];
      this.stepCount = 0;
      this.state = 'idle';
      this.lastCollapsed = null;
      this.lastPropagated = [];
    } else {
      this.state = 'error';
    }
  }
}


// ─────────────────────────────────────────────
//  §4  RENDERER
// ─────────────────────────────────────────────

class Renderer {
  constructor(canvas, grid) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.grid = grid;
    this.cellSize = 0;
    this.resize();
  }

  resize() {
    const wrapper = document.getElementById('canvas-wrapper');
    const maxW = wrapper.clientWidth - 48;
    const maxH = wrapper.clientHeight - 48;
    const maxDim = Math.min(maxW, maxH, 720);
    this.cellSize = Math.floor(maxDim / Math.max(this.grid.width, this.grid.height));
    const totalW = this.cellSize * this.grid.width;
    const totalH = this.cellSize * this.grid.height;
    this.canvas.width = totalW;
    this.canvas.height = totalH;
    this.canvas.style.width = totalW + 'px';
    this.canvas.style.height = totalH + 'px';
  }

  draw(dt) {
    const { ctx, cellSize: s, grid } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const cell of grid.cells) {
      const px = cell.x * s;
      const py = cell.y * s;

      if (cell.collapsed) {
        const tileIdx = [...cell.options][0];
        TILES[tileIdx].draw(ctx, px, py, s);
      } else {
        this._drawSuperposition(ctx, px, py, s, cell);
      }

      // Flash overlay
      if (cell.flash && cell.flash.timer > 0) {
        this._drawFlash(ctx, px, py, s, cell.flash);
        cell.flash.timer -= dt * 3;
        if (cell.flash.timer <= 0) cell.flash = null;
      }

      // Entropy count on uncollapsed cells
      if (!cell.collapsed) {
        this._drawEntropy(ctx, px, py, s, cell.options.size);
      }

      // Grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px, py, s, s);
    }
  }

  _drawSuperposition(ctx, x, y, s, cell) {
    ctx.fillStyle = '#14171f';
    ctx.fillRect(x, y, s, s);

    // Show mini swatches of remaining base-terrain options
    const opts = [...cell.options];
    const baseTerrains = new Set();
    for (const idx of opts) {
      // Identify primary terrain from southern socket for simplicity
      baseTerrains.add(TILES[idx].sockets.south);
    }

    if (baseTerrains.size <= 5 && s >= 24) {
      const terrainArr = [...baseTerrains];
      const gap = 2;
      const swatchS = Math.min((s - gap * (terrainArr.length + 1)) / terrainArr.length, s / 3);
      const totalW = terrainArr.length * swatchS + (terrainArr.length - 1) * gap;
      const startX = x + (s - totalW) / 2;
      const startY = y + s - swatchS - 4;
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < terrainArr.length; i++) {
        ctx.fillStyle = TERRAIN_COLORS[terrainArr[i]] || '#555';
        ctx.fillRect(startX + i * (swatchS + gap), startY, swatchS, swatchS);
      }
      ctx.globalAlpha = 1.0;
    }
  }

  _drawFlash(ctx, x, y, s, flash) {
    const alpha = flash.timer * 0.55;
    if (flash.type === 'collapse') {
      ctx.fillStyle = `rgba(245, 197, 66, ${alpha})`;
      ctx.strokeStyle = `rgba(255, 220, 100, ${alpha})`;
    } else {
      ctx.fillStyle = `rgba(245, 112, 112, ${alpha})`;
      ctx.strokeStyle = `rgba(255, 130, 130, ${alpha})`;
    }
    ctx.fillRect(x, y, s, s);
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
  }

  _drawEntropy(ctx, x, y, s, count) {
    const fontSize = Math.max(9, Math.min(s * 0.35, 18));
    ctx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Color-code by entropy level
    if (count <= 2) {
      ctx.fillStyle = 'rgba(245,197,66,0.85)';  // gold = almost decided
    } else if (count <= 5) {
      ctx.fillStyle = 'rgba(200,200,255,0.65)';
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
    }
    ctx.fillText(count.toString(), x + s / 2, y + s / 2);
  }

  getCellAt(canvasX, canvasY) {
    const col = Math.floor(canvasX / this.cellSize);
    const row = Math.floor(canvasY / this.cellSize);
    return this.grid.get(col, row) || null;
  }
}


// ─────────────────────────────────────────────
//  §5  APPLICATION CONTROLLER
// ─────────────────────────────────────────────

class App {
  constructor() {
    this.gridSize = 10;
    this.speed = 200;
    this.playing = false;
    this.lastAutoStep = 0;

    this.canvas = document.getElementById('wfc-canvas');
    this.tooltipEl = document.getElementById('tooltip');
    this.statusEl = document.getElementById('status-text');
    this.collapsedEl = document.getElementById('collapsed-count');
    this.stepEl = document.getElementById('step-count');
    this.playBtn = document.getElementById('btn-play');
    this.speedSlider = document.getElementById('speed-slider');
    this.speedValueEl = document.getElementById('speed-value');

    this._initGrid();
    this._buildLegend();
    this._bindEvents();

    this._lastFrame = performance.now();
    requestAnimationFrame(this._loop.bind(this));
  }

  _initGrid() {
    this.grid = new Grid(this.gridSize, this.gridSize);
    this.solver = new WFCSolver(this.grid);
    this.renderer = new Renderer(this.canvas, this.grid);
    this.playing = false;
    this.playBtn.textContent = '▶ Play';
    this.playBtn.classList.remove('playing');
    this._updateStatus();
  }

  _buildLegend() {
    const container = document.getElementById('legend');
    container.innerHTML = '';
    // Show only the 5 base terrain types + a Transition entry
    const entries = [
      { name: 'Water', color: TERRAIN_COLORS[0] },
      { name: 'Sand', color: TERRAIN_COLORS[1] },
      { name: 'Grass', color: TERRAIN_COLORS[2] },
      { name: 'Forest', color: TERRAIN_COLORS[3] },
      { name: 'Mountain', color: TERRAIN_COLORS[4] },
    ];
    for (const { name, color } of entries) {
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `<span class="legend-swatch" style="background:${color}"></span>${name}`;
      container.appendChild(item);
    }
  }

  _bindEvents() {
    // Play / Pause
    this.playBtn.addEventListener('click', () => {
      if (this.solver.state === 'done' || this.solver.state === 'error') return;
      this.playing = !this.playing;
      this.playBtn.textContent = this.playing ? '⏸ Pause' : '▶ Play';
      this.playBtn.classList.toggle('playing', this.playing);
      this.lastAutoStep = performance.now();
    });

    // Step
    document.getElementById('btn-step').addEventListener('click', () => {
      if (this.solver.state === 'done' || this.solver.state === 'error') return;
      this.playing = false;
      this.playBtn.textContent = '▶ Play';
      this.playBtn.classList.remove('playing');
      this.solver.step();
      this._updateStatus();
    });

    // Reset
    document.getElementById('btn-reset').addEventListener('click', () => {
      this._initGrid();
    });

    // Speed slider: 0→1000ms, 100→10ms (exponential curve)
    this.speedSlider.addEventListener('input', () => {
      const v = parseInt(this.speedSlider.value);
      this.speed = Math.round(1000 * Math.pow(0.954, v));
      if (this.speed < 10) this.speed = 10;
      this.speedValueEl.textContent = this.speed >= 1000
        ? (this.speed / 1000).toFixed(1) + ' s'
        : this.speed + ' ms';
    });
    this.speedSlider.dispatchEvent(new Event('input'));

    // Grid size buttons
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.gridSize = parseInt(btn.dataset.size);
        this._initGrid();
      });
    });

    // Hover tooltip
    this.canvas.addEventListener('mousemove', this._onHover.bind(this));
    this.canvas.addEventListener('mouseleave', () => {
      this.tooltipEl.classList.add('hidden');
    });

    // Resize
    window.addEventListener('resize', () => {
      if (this.renderer) this.renderer.resize();
    });
  }

  // ─── Hover Inspector ───

  _onHover(e) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const cell = this.renderer.getCellAt(cx, cy);

    if (!cell) {
      this.tooltipEl.classList.add('hidden');
      return;
    }

    let html = `<div class="tip-title">Cell (${cell.x}, ${cell.y})</div>`;

    if (cell.collapsed) {
      const idx = [...cell.options][0];
      html += `<div class="tip-options">Collapsed → <strong>${TILES[idx].name}</strong></div>`;
    } else {
      // Show unique terrain names from options
      const names = new Set([...cell.options].map(i => TILES[i].name));
      const baseTerrain = new Set();
      for (const idx of cell.options) {
        // Identify which base terrains are still possible
        const s = TILES[idx].sockets;
        baseTerrain.add(TERRAIN_NAMES[s.north]);
        baseTerrain.add(TERRAIN_NAMES[s.south]);
      }
      html += `<div class="tip-options">Options: ${cell.options.size} tiles<br>Terrains: ${[...baseTerrain].join(', ')}</div>`;
    }

    // Neighbor reasoning
    const reasons = this._getNeighborReasons(cell);
    if (reasons.length > 0) {
      html += `<div class="tip-reason">${reasons.join('<br>')}</div>`;
    }

    this.tooltipEl.innerHTML = html;
    this.tooltipEl.classList.remove('hidden');
    this.tooltipEl.style.left = (e.clientX + 14) + 'px';
    this.tooltipEl.style.top = (e.clientY + 14) + 'px';

    // Keep on screen
    requestAnimationFrame(() => {
      const tipRect = this.tooltipEl.getBoundingClientRect();
      if (tipRect.right > window.innerWidth - 8) {
        this.tooltipEl.style.left = (e.clientX - tipRect.width - 10) + 'px';
      }
      if (tipRect.bottom > window.innerHeight - 8) {
        this.tooltipEl.style.top = (e.clientY - tipRect.height - 10) + 'px';
      }
    });
  }

  _getNeighborReasons(cell) {
    const reasons = [];
    const labels = { north: '↑ North', east: '→ East', south: '↓ South', west: '← West' };

    for (const dir of DIRS) {
      const [dx, dy] = DIR_OFFSETS[dir];
      const neighbor = this.grid.get(cell.x + dx, cell.y + dy);
      if (!neighbor) continue;
      if (neighbor.collapsed) {
        const idx = [...neighbor.options][0];
        const socket = TILES[idx].sockets[OPPOSITE[dir]];
        reasons.push(`${labels[dir]}: ${TILES[idx].name} (socket ${TERRAIN_NAMES[socket] || socket})`);
      }
    }
    return reasons;
  }

  _updateStatus() {
    const stateMap = {
      idle: 'Ready',
      observing: 'Observing…',
      propagating: 'Propagating…',
      done: '✓ Complete!',
      error: '✗ Contradiction (max retries)',
    };
    this.statusEl.textContent = stateMap[this.solver.state] || this.solver.state;
    const total = this.grid.width * this.grid.height;
    this.collapsedEl.textContent = `${this.grid.collapsedCount} / ${total}`;
    this.stepEl.textContent = this.solver.stepCount.toString();

    this.statusEl.style.color =
      this.solver.state === 'done' ? '#6bcf8e' :
        this.solver.state === 'error' ? '#f57070' :
          '#e4e6ed';
  }

  // ─── Animation Loop ───

  _loop(now) {
    const dt = (now - this._lastFrame) / 1000;
    this._lastFrame = now;

    if (this.playing && this.solver.state !== 'done' && this.solver.state !== 'error') {
      if (now - this.lastAutoStep >= this.speed) {
        this.solver.step();
        this._updateStatus();
        this.lastAutoStep = now;

        if (this.solver.state === 'done' || this.solver.state === 'error') {
          this.playing = false;
          this.playBtn.textContent = '▶ Play';
          this.playBtn.classList.remove('playing');
        }
      }
    }

    this.renderer.draw(dt);
    requestAnimationFrame(this._loop.bind(this));
  }
}


// ─────────────────────────────────────────────
//  §6  BOOTSTRAP
// ─────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  new App();
});
