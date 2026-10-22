/* ============ parade-world.js — Safari Park & Kanto Route 1 Scenes ============
 * Generates and renders the rich multi-scene environments:
 *  - Scene 1: Safari Park (Pokémon Center, red roof, festive Plaza, meadows)
 *  - Scene 2: Kanto: Route 1 & Pallet Town (Prof. Oak's Research Lab, blue roof,
 *             winding Route 1 dirt paths, white wooden picket fences, signposts)
 *  - Full collision resolution and boundary safety clamping
 *  - Welcome Plaza trigger for the Grand Celebration
 */
window.G = window.G || {};
G.Parade = G.Parade || {};

G.Parade.World = (() => {
  // World bounds
  const MIN_X = -560, MAX_X = 560;
  const MIN_Y = -560, MAX_Y = 560;

  let currentScene = 'safari'; // 'safari' | 'kanto'

  // Obstacles list: trees, rocks, fences, buildings, signposts
  const props = [];

  // Active Center geometry
  let CENTER = {
    x: 0,
    y: -80,
    w: 160,
    h: 110,
    plazaY: 20,
    plazaRadius: 85,
    name: 'Pokémon Center'
  };

  function setScene(sceneName) {
    if (sceneName !== 'safari' && sceneName !== 'kanto') return;
    currentScene = sceneName;
    init(sceneName);
  }

  function getScene() {
    return currentScene;
  }

  function getSceneName() {
    return currentScene === 'kanto' ? 'Kanto: Route 1' : 'Safari Park';
  }

  function init(scene = currentScene) {
    currentScene = scene;
    props.length = 0;

    if (scene === 'kanto') {
      CENTER = {
        x: 0,
        y: -90,
        w: 180,
        h: 120,
        plazaY: 25,
        plazaRadius: 90,
        name: "Prof. Oak's Lab"
      };

      // 1. Professor Oak's Research Lab solid box
      props.push({
        type: 'building',
        buildingType: 'oakLab',
        x: CENTER.x,
        y: CENTER.y,
        w: CENTER.w,
        h: CENTER.h,
        solid: true,
        r: 70
      });

      // 2. Pallet Town White Picket Fences flanking the road and courtyard
      const fenceCoords = [
        [-95, 15], [95, 15],
        [-95, 95], [95, 95],
        [-130, 200], [130, 200],
        [-130, -210], [130, -210]
      ];
      for (const [fx, fy] of fenceCoords) {
        props.push({ type: 'fence', x: fx, y: fy, solid: true, r: 12, w: 42, h: 12 });
      }

      // 3. Route 1 Wooden Signposts
      props.push({ type: 'sign', x: -110, y: 155, solid: true, r: 10, title: 'ROUTE 1', sub: 'Viridian City ↑' });
      props.push({ type: 'sign', x: 110, y: -160, solid: true, r: 10, title: 'PALLET TOWN', sub: 'Shades of Journey' });

      // 4. Kanto Route shade trees
      const kantoTreeCoords = [
        // North route to Viridian
        [-180, -320], [-120, -360], [120, -360], [180, -320],
        // Orchard & groves
        [240, -180], [310, -90], [350, 20], [280, 140], [320, 240],
        // South Pallet border
        [180, 360], [80, 400], [-80, 400], [-180, 360],
        // West hills
        [-290, 210], [-340, 110], [-300, 10], [-340, -110], [-260, -210],
        // Mid-route shade trees
        [-190, -70], [-210, 80], [200, -60], [190, 100]
      ];
      for (const [tx, ty] of kantoTreeCoords) {
        props.push({
          type: 'tree',
          x: tx,
          y: ty,
          solid: true,
          r: 16,
          fruit: Math.random() < 0.5
        });
      }

      // 5. Rocks
      const kantoRocks = [
        [-150, 170], [160, 180], [-220, -30], [210, 10], [-70, -240], [70, -240]
      ];
      for (const [rx, ry] of kantoRocks) {
        props.push({ type: 'rock', x: rx, y: ry, solid: true, r: 14 });
      }

    } else {
      // --- Safari Park scene ---
      CENTER = {
        x: 0,
        y: -80,
        w: 160,
        h: 110,
        plazaY: 20,
        plazaRadius: 85,
        name: 'Pokémon Center'
      };

      // 1. Pokémon Center solid box
      props.push({
        type: 'building',
        buildingType: 'pokemonCenter',
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

      // 3. Natural obstacle clusters
      const treeCoords = [
        [-220, -280], [-160, -320], [-100, -350], [100, -350], [160, -320], [220, -280],
        [280, -180], [340, -120], [380, -40], [320, 60], [360, 150], [290, 240],
        [200, 340], [120, 380], [40, 420], [-60, 410], [-150, 370], [-230, 320],
        [-320, 220], [-360, 140], [-330, 40], [-380, -60], [-340, -160], [-280, -220],
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

      // Rocks
      const rockCoords = [
        [-120, 200], [130, 220], [-260, -40], [240, -20], [-80, -250], [80, -250]
      ];
      for (const [rx, ry] of rockCoords) {
        props.push({ type: 'rock', x: rx, y: ry, solid: true, r: 14 });
      }
    }

    // Boundary perimeter trees (same robust boundary for both scenes)
    for (let x = MIN_X; x <= MAX_X; x += 45) {
      props.push({ type: 'tree', x, y: MIN_Y, solid: true, r: 18 });
      props.push({ type: 'tree', x, y: MAX_Y, solid: true, r: 18 });
    }
    for (let y = MIN_Y + 45; y <= MAX_Y - 45; y += 45) {
      props.push({ type: 'tree', x: MIN_X, y, solid: true, r: 18 });
      props.push({ type: 'tree', x: MAX_X, y, solid: true, r: 18 });
    }
  }

  // Check if position is inside the active Plaza / Courtyard
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

    // Circular props (trees, rocks, fences, banners)
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

  // Draw ground tiles, path carpets, and Plaza
  function drawGround(ctx) {
    if (currentScene === 'kanto') {
      drawKantoGround(ctx);
    } else {
      drawSafariGround(ctx);
    }
  }

  function drawSafariGround(ctx) {
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

  function drawKantoGround(ctx) {
    // 1. Classic Kanto rich turf
    ctx.fillStyle = '#43a047';
    ctx.fillRect(MIN_X - 100, MIN_Y - 100, (MAX_X - MIN_X) + 200, (MAX_Y - MIN_Y) + 200);

    // 2. Kanto pixel checkerboard
    ctx.fillStyle = '#388e3c';
    const step = 48;
    for (let y = MIN_Y; y < MAX_Y; y += step) {
      for (let x = MIN_X; x < MAX_X; x += step) {
        if (((x + y) / step) % 2 === 0) {
          ctx.fillRect(x, y, step, step);
        }
      }
    }

    // 3. Iconic Route 1 Winding Golden Dirt Road
    // Outer dirt road shoulder
    ctx.strokeStyle = '#c49f57';
    ctx.lineWidth = 56;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 480);
    ctx.quadraticCurveTo(20, 260, 0, 100);
    ctx.lineTo(0, -90);
    ctx.stroke();

    // Branch leading North-East to Viridian City
    ctx.beginPath();
    ctx.moveTo(0, 50);
    ctx.quadraticCurveTo(80, -140, 40, -480);
    ctx.stroke();

    // Inner golden sand surface
    ctx.strokeStyle = '#edd89b';
    ctx.lineWidth = 46;
    ctx.beginPath();
    ctx.moveTo(0, 480);
    ctx.quadraticCurveTo(20, 260, 0, 100);
    ctx.lineTo(0, -90);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 50);
    ctx.quadraticCurveTo(80, -140, 40, -480);
    ctx.stroke();

    // 4. Tall Wild Grass Patches along Route 1
    const tallGrassSpots = [
      [-70, 280], [70, 290], [-60, 360], [60, 370],
      [110, -80], [130, -180], [90, -280], [110, -380],
      [-160, 60], [-180, 160], [160, 80], [210, 180]
    ];
    for (const [gx, gy] of tallGrassSpots) {
      drawTallGrassPatch(ctx, gx, gy);
    }

    // 5. Pallet Town Courtyard in front of Oak's Lab
    const px = CENTER.x;
    const py = CENTER.plazaY;
    const pr = CENTER.plazaRadius;

    // Stone courtyard base
    ctx.fillStyle = '#b0bec5';
    ctx.beginPath();
    ctx.ellipse(px, py, pr + 4, (pr + 4) * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#eceff1';
    ctx.beginPath();
    ctx.ellipse(px, py, pr, pr * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inlaid Stone Poké Ball in center of Pallet Town courtyard
    const ir = 24;
    // Outer black ring
    ctx.fillStyle = '#263238';
    ctx.beginPath(); ctx.ellipse(px, py, ir + 2, (ir + 2) * 0.55, 0, 0, Math.PI * 2); ctx.fill();

    // Red top half
    ctx.fillStyle = '#d32f2f';
    ctx.beginPath(); ctx.ellipse(px, py, ir, ir * 0.55, Math.PI, 0); ctx.fill();

    // White bottom half
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(px, py, ir, ir * 0.55, 0, Math.PI); ctx.fill();

    // Center button
    ctx.fillStyle = '#263238';
    ctx.beginPath(); ctx.ellipse(px, py, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(px, py, 3.5, 2, 0, 0, Math.PI * 2); ctx.fill();

    // Route 1 Flower Patches
    const kantoFlowers = [
      [-130, 40], [130, 40], [-150, -120], [160, -120]
    ];
    for (const [fx, fy] of kantoFlowers) {
      drawFlowerPatch(ctx, fx, fy);
    }
  }

  function drawTallGrassPatch(ctx, x, y) {
    ctx.fillStyle = '#2e7d32';
    for (let i = 0; i < 9; i++) {
      const ox = x + (i % 3) * 12 - 12;
      const oy = y + Math.floor(i / 3) * 10 - 10;
      // Grass blade cluster
      ctx.fillRect(ox - 3, oy - 6, 2, 8);
      ctx.fillRect(ox, oy - 9, 2, 11);
      ctx.fillRect(ox + 3, oy - 7, 2, 9);
      // Bright tips
      ctx.fillStyle = '#66bb6a';
      ctx.fillRect(ox - 3, oy - 6, 2, 2);
      ctx.fillRect(ox, oy - 9, 2, 2);
      ctx.fillRect(ox + 3, oy - 7, 2, 2);
      ctx.fillStyle = '#2e7d32';
    }
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

  // Draw scenery props and active scene building
  function drawScenery(ctx) {
    const sorted = props.slice().sort((a, b) => a.y - b.y);

    for (const p of sorted) {
      if (p.type === 'building') {
        if (p.buildingType === 'oakLab') {
          drawProfOakLab(ctx, p.x, p.y, p.w, p.h);
        } else {
          drawPokemonCenter(ctx, p.x, p.y, p.w, p.h);
        }
      } else if (p.type === 'tree') {
        drawTree(ctx, p.x, p.y, p.r, p.fruit);
      } else if (p.type === 'rock') {
        drawRock(ctx, p.x, p.y, p.r);
      } else if (p.type === 'banner') {
        drawBanner(ctx, p.x, p.y);
      } else if (p.type === 'bush') {
        drawBush(ctx, p.x, p.y);
      } else if (p.type === 'fence') {
        drawPicketFence(ctx, p.x, p.y, p.w || 40);
      } else if (p.type === 'sign') {
        drawSignpost(ctx, p.x, p.y, p.title, p.sub);
      }
    }
  }

  /**
   * Professor Oak's Pokémon Research Lab (Kanto: Pallet Town)
   * Iconic blue tiled roof, clean research walls, front porch, and weather antenna.
   */
  function drawProfOakLab(ctx, cx, cy, w, h) {
    const x0 = cx - w / 2;
    const y0 = cy - h / 2;

    // Lab ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, y0 + h + 2, w / 2 + 12, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main Lab front walls (Clean stone research building)
    ctx.fillStyle = '#eceff1';
    ctx.fillRect(x0 + 8, y0 + 36, w - 16, h - 36);

    // Blue foundation brick trim
    ctx.fillStyle = '#1565c0';
    ctx.fillRect(x0 + 8, y0 + 42, w - 16, 4);
    ctx.fillRect(x0 + 8, y0 + h - 6, w - 16, 6);

    // Large Research Laboratory Windows (with visible computer monitors inside)
    ctx.fillStyle = '#1e88e5';
    ctx.fillRect(x0 + 16, y0 + 54, 38, 30);
    ctx.fillRect(x0 + w - 54, y0 + 54, 38, 30);

    // Computer screen glow inside windows
    ctx.fillStyle = '#80d8ff';
    ctx.fillRect(x0 + 20, y0 + 60, 14, 10);
    ctx.fillRect(x0 + w - 34, y0 + 60, 14, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x0 + 22, y0 + 56, 4, 24); // glass shine
    ctx.fillRect(x0 + w - 48, y0 + 56, 4, 24);

    // Window frames
    ctx.strokeStyle = '#263238';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0 + 16, y0 + 54, 38, 30);
    ctx.strokeRect(x0 + w - 54, y0 + 54, 38, 30);

    // Lab Entrance Porch & Double Wooden Doors
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(cx - 24, y0 + 60, 48, h - 60);
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(cx - 20, y0 + 64, 18, h - 68);
    ctx.fillRect(cx + 2, y0 + 64, 18, h - 68);

    // Gold door handles
    ctx.fillStyle = '#ffca28';
    ctx.fillRect(cx - 5, y0 + 78, 2, 4);
    ctx.fillRect(cx + 3, y0 + 78, 2, 4);

    // Front porch stone steps
    ctx.fillStyle = '#cfd8dc';
    ctx.fillRect(cx - 28, y0 + h - 2, 56, 10);
    ctx.fillStyle = '#b0bec5';
    ctx.fillRect(cx - 30, y0 + h + 4, 60, 6);

    // "OAK LAB" Wooden Signboard over entrance
    ctx.fillStyle = '#ffecb3';
    ctx.fillRect(cx - 26, y0 + 44, 52, 14);
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - 26, y0 + 44, 52, 14);
    ctx.fillStyle = '#3e2723';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('OAK LAB', cx, y0 + 54);

    // Iconic Blue Gable Shingle Roof
    ctx.fillStyle = '#1976d2';
    ctx.beginPath();
    ctx.moveTo(x0 - 4, y0 + 38);
    ctx.lineTo(x0 + 18, y0 + 4);
    ctx.lineTo(x0 + w - 18, y0 + 4);
    ctx.lineTo(x0 + w + 4, y0 + 38);
    ctx.closePath();
    ctx.fill();

    // Roof ridge highlight & eaves
    ctx.fillStyle = '#42a5f5';
    ctx.fillRect(x0 + 18, y0 + 4, w - 36, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x0 - 6, y0 + 36, w + 12, 4);

    // Rooftop Weather Radar / Antenna
    ctx.strokeStyle = '#37474f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, y0 + 4);
    ctx.lineTo(cx, y0 - 18);
    ctx.stroke();

    // Antenna crossbar & satellite dish
    ctx.beginPath();
    ctx.moveTo(cx - 8, y0 - 12);
    ctx.lineTo(cx + 8, y0 - 12);
    ctx.stroke();

    ctx.fillStyle = '#ffca28';
    ctx.beginPath();
    ctx.arc(cx, y0 - 18, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Pallet Town White Picket Fence
   */
  function drawPicketFence(ctx, x, y, len = 40) {
    const x0 = x - len / 2;
    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x0, y + 2, len, 4);

    // Horizontal rails
    ctx.fillStyle = '#cfd8dc';
    ctx.fillRect(x0, y - 10, len, 3);
    ctx.fillRect(x0, y - 4, len, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x0, y - 11, len, 2);
    ctx.fillRect(x0, y - 5, len, 2);

    // Vertical pickets
    const posts = Math.floor(len / 10);
    for (let i = 0; i <= posts; i++) {
      const px = x0 + i * (len / posts);
      // Picket body
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px - 2, y - 16, 4, 18);
      // Pointed picket top
      ctx.beginPath();
      ctx.moveTo(px - 2, y - 16);
      ctx.lineTo(px, y - 20);
      ctx.lineTo(px + 2, y - 16);
      ctx.closePath();
      ctx.fill();
      // Picket shadow side
      ctx.fillStyle = '#b0bec5';
      ctx.fillRect(px + 1, y - 16, 1, 18);
    }
  }

  /**
   * Kanto Route 1 Signpost
   */
  function drawSignpost(ctx, x, y, title = 'ROUTE 1', sub = 'Viridian City ↑') {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(x, y + 2, 8, 3.5, 0, 0, Math.PI * 2); ctx.fill();

    // Wooden post
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(x - 2, y - 24, 4, 26);

    // Signboard
    ctx.fillStyle = '#d7ccc8';
    ctx.fillRect(x - 22, y - 36, 44, 16);
    ctx.strokeStyle = '#4e342e';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 22, y - 36, 44, 16);

    ctx.fillStyle = '#3e2723';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, x, y - 28);
    ctx.font = '6px sans-serif';
    ctx.fillText(sub, x, y - 22);
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
    ctx.beginPath(); ctx.arc(cx, y0 + 26, 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#212121';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, y0 + 26, 15, 0, Math.PI * 2); ctx.stroke();

    ctx.fillStyle = '#e53935';
    ctx.beginPath(); ctx.arc(cx, y0 + 26, 14, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx, y0 + 26, 14, 0, Math.PI); ctx.fill();

    ctx.fillStyle = '#212121';
    ctx.fillRect(cx - 14, y0 + 25, 28, 2);
    ctx.beginPath(); ctx.arc(cx, y0 + 26, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx, y0 + 26, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  function drawTree(ctx, x, y, r, fruit = false) {
    if (window.G && G.Tiles && G.Tiles.propSprite) {
      const sprite = G.Tiles.propSprite(0, 'tree');
      if (sprite) {
        const px = (G.Sprites && G.Sprites.PX) || 2;
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.ellipse(x, y + 2, 18, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        const w = 30 * px;
        const h = 40 * px;
        ctx.drawImage(sprite, x - 15 * px, y - 38 * px, w, h);

        if (fruit) {
          const berries = [[-14, -46], [12, -50], [4, -36], [-8, -60]];
          for (const [bx, by] of berries) {
            ctx.fillStyle = '#14200f';
            ctx.fillRect(x + bx - 1, y + by - 1, 6, 6);
            ctx.fillStyle = '#e53935';
            ctx.fillRect(x + bx, y + by, 4, 4);
            ctx.fillStyle = '#fff59d';
            ctx.fillRect(x + bx + 1, y + by, 1, 1);
          }
        }
        return;
      }
    }

    // Procedural fallback
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.beginPath(); ctx.ellipse(x + 2, y + 2, r + 4, (r + 4) * 0.45, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#5d4037';
    ctx.fillRect(x - 5, y - 18, 10, 20);

    const canopies = [
      { ox: 0, oy: -32, cr: r + 6, col: '#2e7d32' },
      { ox: -10, oy: -28, cr: r + 2, col: '#388e3c' },
      { ox: 10, oy: -28, cr: r + 2, col: '#388e3c' },
      { ox: 0, oy: -36, cr: r + 1, col: '#43a047' }
    ];
    for (const c of canopies) {
      ctx.fillStyle = c.col;
      ctx.beginPath(); ctx.arc(x + c.ox, y + c.oy, c.cr, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawRock(ctx, x, y, r) {
    if (window.G && G.Tiles && G.Tiles.propSprite) {
      const sprite = G.Tiles.propSprite(0, 'rock');
      if (sprite) {
        const px = (G.Sprites && G.Sprites.PX) || 2;
        ctx.fillStyle = 'rgba(0,0,0,0.20)';
        ctx.beginPath();
        ctx.ellipse(x, y + 2, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        const w = 22 * px;
        const h = 17 * px;
        ctx.drawImage(sprite, x - 11 * px, y - 15 * px, w, h);
        return;
      }
    }

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(x + 2, y + 2, r + 3, (r + 3) * 0.45, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#78909c';
    ctx.beginPath(); ctx.ellipse(x, y - 4, r, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#90a4ae';
    ctx.beginPath(); ctx.ellipse(x - 2, y - 7, r * 0.7, r * 0.45, -0.2, 0, Math.PI * 2); ctx.fill();
  }

  function drawBanner(ctx, x, y) {
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(x - 2, y - 36, 4, 38);
    ctx.fillStyle = '#ffca28';
    ctx.beginPath(); ctx.arc(x, y - 36, 4, 0, Math.PI * 2); ctx.fill();

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
    ctx.beginPath(); ctx.ellipse(x, y + 2, 14, 6, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#2e7d32';
    ctx.beginPath(); ctx.arc(x, y - 8, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#43a047';
    ctx.beginPath(); ctx.arc(x - 2, y - 10, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath(); ctx.arc(x, y - 9, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  init('safari');

  return {
    init,
    get CENTER() { return CENTER; },
    isInWelcomePlaza,
    isFree,
    collide,
    drawGround,
    drawScenery,
    setScene,
    getScene,
    getSceneName,
    MIN_X, MAX_X, MIN_Y, MAX_Y
  };
})();
