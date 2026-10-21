/* ============ parade-world.js — Safari Park and Pokémon Center ============
 * Generates and renders the colourful Safari Park environment:
 *  - Iconic Pokémon Center with red roof, Poké Ball emblem, and festive Plaza
 *  - Meadow trails, wildflower patches, lush trees, decorative wooden fences, ponds
 *  - Bounded perimeter and collision resolution
 *  - Welcome Plaza trigger for the Grand Celebration
 */
window.G = window.G || {};
G.Parade = G.Parade || {};

G.Parade.World = (() => {
  // World bounds
  const MIN_X = -560, MAX_X = 560;
  const MIN_Y = -560, MAX_Y = 560;

  // Obstacles list: trees, rocks, fences, building
  const props = [];

  // Pokémon Center geometry
  const CENTER = {
    x: 0,
    y: -80,
    w: 160,
    h: 110,
    plazaY: 20,
    plazaRadius: 85
  };

  function init() {
    props.length = 0;

    // 1. Pokémon Center solid box
    props.push({
      type: 'building',
      x: CENTER.x,
      y: CENTER.y,
      w: CENTER.w,
      h: CENTER.h,
      solid: true,
      r: 65
    });

    // 2. Decorative festive banners flanking Plaza
    props.push({ type: 'banner', x: -90, y: 30, solid: true, r: 8 });
    props.push({ type: 'banner', x: 90, y: 30, solid: true, r: 8 });
    props.push({ type: 'bush', x: -65, y: -20, solid: true, r: 12 });
    props.push({ type: 'bush', x: 65, y: -20, solid: true, r: 12 });

    // 3. Natural obstacle clusters (trees, rocks, flowers) placed to create open trails
    const treeCoords = [
      // North groves
      [-220, -280], [-160, -320], [-100, -350], [100, -350], [160, -320], [220, -280],
      // East orchard
      [280, -180], [340, -120], [380, -40], [320, 60], [360, 150], [290, 240],
      // South forest
      [200, 340], [120, 380], [40, 420], [-60, 410], [-150, 370], [-230, 320],
      // West woodland
      [-320, 220], [-360, 140], [-330, 40], [-380, -60], [-340, -160], [-280, -220],
      // Middle meadow scattered shade trees
      [-160, -90], [-190, 80], [180, -80], [170, 120]
    ];

    for (const [tx, ty] of treeCoords) {
      props.push({
        type: 'tree',
        x: tx,
        y: ty,
        solid: true,
        r: 16,
        fruit: Math.random() < 0.4
      });
    }

    // Rocks / Boulders
    const rockCoords = [
      [-120, 200], [130, 220], [-260, -40], [240, -20], [-80, -250], [80, -250]
    ];
    for (const [rx, ry] of rockCoords) {
      props.push({
        type: 'rock',
        x: rx,
        y: ry,
        solid: true,
        r: 14
      });
    }

    // Boundary perimeter trees and fence
    for (let x = MIN_X; x <= MAX_X; x += 45) {
      props.push({ type: 'tree', x, y: MIN_Y, solid: true, r: 18 });
      props.push({ type: 'tree', x, y: MAX_Y, solid: true, r: 18 });
    }
    for (let y = MIN_Y + 45; y <= MAX_Y - 45; y += 45) {
      props.push({ type: 'tree', x: MIN_X, y, solid: true, r: 18 });
      props.push({ type: 'tree', x: MAX_X, y, solid: true, r: 18 });
    }
  }

  // Check if position is inside the Pokémon Center Welcome Plaza
  function isInWelcomePlaza(x, y) {
    const dx = x - CENTER.x;
    const dy = y - CENTER.plazaY;
    return Math.hypot(dx, dy) < CENTER.plazaRadius;
  }

  function isFree(x, y, r = 12) {
    if (x - r < MIN_X + 25 || x + r > MAX_X - 25 || y - r < MIN_Y + 25 || y + r > MAX_Y - 25) {
      return false;
    }
    for (const p of props) {
      if (!p.solid) continue;
      if (p.type === 'building') {
        const bx0 = p.x - p.w / 2;
        const bx1 = p.x + p.w / 2;
        const by0 = p.y - p.h / 2;
        const by1 = p.y + p.h / 2;
        if (x + r > bx0 && x - r < bx1 && y + r > by0 && y - r < by1) return false;
      } else {
        const dSq = (x - p.x) ** 2 + (y - p.y) ** 2;
        if (dSq < (r + p.r) ** 2) return false;
      }
    }
    return true;
  }

  function collide(e) {
    const r = e.r || 12;

    // Boundaries
    if (e.x - r < MIN_X + 30) e.x = MIN_X + 30 + r;
    if (e.x + r > MAX_X - 30) e.x = MAX_X - 30 - r;
    if (e.y - r < MIN_Y + 30) e.y = MIN_Y + 30 + r;
    if (e.y + r > MAX_Y - 30) e.y = MAX_Y - 30 - r;

    // Building collision box
    const b = props.find(p => p.type === 'building');
    if (b) {
      const bx0 = b.x - b.w / 2;
      const bx1 = b.x + b.w / 2;
      const by0 = b.y - b.h / 2;
      const by1 = b.y + b.h / 2;
      if (e.x + r > bx0 && e.x - r < bx1 && e.y + r > by0 && e.y - r < by1) {
        // Push out on closest edge
        const dl = (e.x + r) - bx0;
        const dr = bx1 - (e.x - r);
        const dt = (e.y + r) - by0;
        const db = by1 - (e.y - r);
        const m = Math.min(dl, dr, dt, db);
        if (m === dl) e.x = bx0 - r;
        else if (m === dr) e.x = bx1 + r;
        else if (m === dt) e.y = by0 - r;
        else e.y = by1 + r;
      }
    }

    // Circular props (trees, rocks, banners)
    for (const p of props) {
      if (!p.solid || p.type === 'building') continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const minDist = r + p.r;
      const dSq = dx * dx + dy * dy;
      if (dSq < minDist * minDist) {
        const d = Math.sqrt(dSq) || 0.001;
        const push = minDist - d;
        e.x += (dx / d) * push;
        e.y += (dy / d) * push;
      }
    }
  }

  // Draw ground tiles, path carpets, and Welcome Plaza
  function drawGround(ctx) {
    // 1. Base vibrant meadow grass
    ctx.fillStyle = '#55b248';
    ctx.fillRect(MIN_X - 100, MIN_Y - 100, (MAX_X - MIN_X) + 200, (MAX_Y - MIN_Y) + 200);

    // 2. Gentle checkered grass variations (pixel look)
    ctx.fillStyle = '#4ea742';
    const step = 48;
    for (let y = MIN_Y; y < MAX_Y; y += step) {
      for (let x = MIN_X; x < MAX_X; x += step) {
        if (((x + y) / step) % 2 === 0) {
          ctx.fillRect(x, y, step, step);
        }
      }
    }

    // 3. Flower patches scattered in meadows
    const flowerSpots = [
      [-140, 60], [-80, 160], [110, 80], [160, 180], [-220, -120], [210, -140],
      [-50, -220], [70, -210], [-240, 120], [230, 220]
    ];
    for (const [fx, fy] of flowerSpots) {
      drawFlowerPatch(ctx, fx, fy);
    }

    // 4. Welcome Plaza Cobblestone Area
    const px = CENTER.x;
    const py = CENTER.plazaY;
    const pr = CENTER.plazaRadius;

    // Outer warm border
    ctx.fillStyle = '#d7ccc8';
    ctx.beginPath();
    ctx.ellipse(px, py, pr + 4, (pr + 4) * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner pavers
    ctx.fillStyle = '#efebe9';
    ctx.beginPath();
    ctx.ellipse(px, py, pr, pr * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cobblestone paver lines
    ctx.strokeStyle = '#bcaaa4';
    ctx.lineWidth = 1.5;
    for (let r = 18; r < pr; r += 18) {
      ctx.beginPath();
      ctx.ellipse(px, py, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Festive Plaza Welcome Star in center
    ctx.fillStyle = '#ffe082';
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffca28';
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFlowerPatch(ctx, x, y) {
    const colors = ['#fff59d', '#f48fb1', '#90caf9', '#ffffff'];
    for (let i = 0; i < 7; i++) {
      const ox = x + Math.sin(i * 2.3) * 18;
      const oy = y + Math.cos(i * 1.7) * 12;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.arc(ox, oy, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffb300';
      ctx.beginPath();
      ctx.arc(ox, oy, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw scenery props and Pokémon Center building
  function drawScenery(ctx) {
    // Sort props by Y so characters and trees layer properly
    const sorted = props.slice().sort((a, b) => a.y - b.y);

    for (const p of sorted) {
      if (p.type === 'building') {
        drawPokemonCenter(ctx, p.x, p.y, p.w, p.h);
      } else if (p.type === 'tree') {
        drawTree(ctx, p.x, p.y, p.r, p.fruit);
      } else if (p.type === 'rock') {
        drawRock(ctx, p.x, p.y, p.r);
      } else if (p.type === 'banner') {
        drawBanner(ctx, p.x, p.y);
      } else if (p.type === 'bush') {
        drawBush(ctx, p.x, p.y);
      }
    }
  }

  function drawPokemonCenter(ctx, cx, cy, w, h) {
    const x0 = cx - w / 2;
    const y0 = cy - h / 2;

    // Building ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, y0 + h + 2, w / 2 + 10, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main building front wall (Clean white / modern warm grey)
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(x0 + 8, y0 + 36, w - 16, h - 36);

    // Wall base trim (red stripe)
    ctx.fillStyle = '#e53935';
    ctx.fillRect(x0 + 8, y0 + 44, w - 16, 4);
    ctx.fillRect(x0 + 8, y0 + h - 6, w - 16, 6);

    // Front Windows with blue glass reflection
    ctx.fillStyle = '#81d4fa';
    ctx.fillRect(x0 + 16, y0 + 56, 32, 28);
    ctx.fillRect(x0 + w - 48, y0 + 56, 32, 28);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x0 + 20, y0 + 58, 6, 24); // glass shine
    ctx.fillRect(x0 + w - 44, y0 + 58, 6, 24);

    // Automatic Glass Front Doors
    ctx.fillStyle = '#29b6f6';
    ctx.fillRect(cx - 22, y0 + 60, 44, h - 60);
    ctx.fillStyle = '#e1f5fe';
    ctx.fillRect(cx - 18, y0 + 64, 15, h - 68);
    ctx.fillRect(cx + 3, y0 + 64, 15, h - 68);
    // Door frame
    ctx.strokeStyle = '#37474f';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - 22, y0 + 60, 44, h - 60);

    // Blue Welcome entrance mat outside doors
    ctx.fillStyle = '#1e88e5';
    ctx.fillRect(cx - 26, y0 + h, 52, 10);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WELCOME', cx, y0 + h + 7);

    // Iconic Red Roof
    ctx.fillStyle = '#d32f2f';
    ctx.beginPath();
    ctx.moveTo(x0, y0 + 38);
    ctx.lineTo(x0 + 16, y0 + 6);
    ctx.lineTo(x0 + w - 16, y0 + 6);
    ctx.lineTo(x0 + w, y0 + 38);
    ctx.closePath();
    ctx.fill();

    // Roof highlight & trim
    ctx.fillStyle = '#ef5350';
    ctx.fillRect(x0 + 16, y0 + 6, w - 32, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x0 - 2, y0 + 36, w + 4, 4);

    // Center illuminated Poké Ball Emblem over entrance
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, y0 + 26, 16, 0, Math.PI * 2);
    ctx.fill();

    // Outer ring
    ctx.strokeStyle = '#212121';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, y0 + 26, 15, 0, Math.PI * 2);
    ctx.stroke();

    // Red top
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.arc(cx, y0 + 26, 14, Math.PI, 0);
    ctx.fill();

    // White bottom
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, y0 + 26, 14, 0, Math.PI);
    ctx.fill();

    // Black seam & center button
    ctx.fillStyle = '#212121';
    ctx.fillRect(cx - 14, y0 + 25, 28, 2);
    ctx.beginPath();
    ctx.arc(cx, y0 + 26, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, y0 + 26, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTree(ctx, x, y, r, fruit = false) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 2, r + 4, (r + 4) * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(x - 5, y - 18, 10, 20);
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(x - 2, y - 18, 4, 20);

    // Foliage canopy (layered lush green spheres)
    const canopies = [
      { ox: 0, oy: -32, cr: r + 6, col: '#2e7d32' },
      { ox: -10, oy: -28, cr: r + 2, col: '#388e3c' },
      { ox: 10, oy: -28, cr: r + 2, col: '#388e3c' },
      { ox: 0, oy: -36, cr: r + 1, col: '#43a047' }
    ];

    for (const c of canopies) {
      ctx.fillStyle = c.col;
      ctx.beginPath();
      ctx.arc(x + c.ox, y + c.oy, c.cr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fruit (apples / berries)
    if (fruit) {
      ctx.fillStyle = '#f44336';
      const spots = [[-8, -32], [6, -35], [2, -26], [-3, -40]];
      for (const [fx, fy] of spots) {
        ctx.beginPath();
        ctx.arc(x + fx, y + fy, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawRock(ctx, x, y, r) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 2, r + 3, (r + 3) * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rock body
    ctx.fillStyle = '#78909c';
    ctx.beginPath();
    ctx.ellipse(x, y - 4, r, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();

    // Moss / Highlight
    ctx.fillStyle = '#90a4ae';
    ctx.beginPath();
    ctx.ellipse(x - 2, y - 7, r * 0.7, r * 0.45, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#81c784'; // moss patch
    ctx.beginPath();
    ctx.arc(x - 4, y - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBanner(ctx, x, y) {
    // Pole
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(x - 2, y - 36, 4, 38);
    ctx.fillStyle = '#ffca28';
    ctx.beginPath();
    ctx.arc(x, y - 36, 4, 0, Math.PI * 2);
    ctx.fill();

    // Bunting / Ribbon
    const colors = ['#e53935', '#fdd835', '#1e88e5'];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.moveTo(x + 2, y - 32 + i * 8);
      ctx.lineTo(x + 18, y - 28 + i * 8);
      ctx.lineTo(x + 2, y - 24 + i * 8);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawBush(ctx, x, y) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2e7d32';
    ctx.beginPath();
    ctx.arc(x, y - 8, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#43a047';
    ctx.beginPath();
    ctx.arc(x - 2, y - 10, 8, 0, Math.PI * 2);
    ctx.fill();
    // Yellow flower bud
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.arc(x, y - 9, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  init();

  return {
    init,
    CENTER,
    isInWelcomePlaza,
    isFree,
    collide,
    drawGround,
    drawScenery
  };
})();
