/* ============ parade-world.js — Safari Park & Pallet Town Scenes ============
 * Generates and renders the rich multi-scene environments:
 *  - Scene 1: Safari Park (Pokémon Center, festive Welcome Plaza, meadows)
 *  - Scene 2: Pallet Town & Route 1 (Prof. Oak's Research Lab, Red's Cottage,
 *             Rival's House, Town Square Monument, Route 21 Ocean Pier & Shore,
 *             Route 1 tall grass meadows, white picket fences, street lamps)
 *  - Full collision resolution and boundary safety clamping
 *  - Welcome Plaza trigger for the Grand Celebration
 */
window.G = window.G || {};
G.Parade = G.Parade || {};

G.Parade.World = (() => {
  // World bounds
  const MIN_X = -600, MAX_X = 600;
  const MIN_Y = -600, MAX_Y = 600;

  let currentScene = 'safari'; // 'safari' | 'kanto'
  let worldTime = 0;

  // Obstacles list: trees, rocks, fences, buildings, signposts, lamps
  const props = [];

  // Active Center / Welcome Plaza geometry
  let CENTER = {
    x: 0,
    y: -80,
    w: 160,
    h: 110,
    plazaX: 0,
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
    return currentScene === 'kanto' ? 'Pallet Town' : 'Safari Park';
  }

  function init(scene = currentScene) {
    currentScene = scene;
    props.length = 0;

    if (scene === 'kanto') {
      // --- Pallet Town & Route 1 ---
      // Professor Oak's Research Lab acts as the primary landmark and Welcome Plaza
      CENTER = {
        x: 160,
        y: 130,
        w: 190,
        h: 120,
        plazaX: 160,
        plazaY: 220,
        plazaRadius: 80,
        name: "Prof. Oak's Lab"
      };

      // 1. Professor Oak's Research Laboratory (Southeast)
      props.push({
        type: 'building',
        buildingType: 'oakLab',
        x: CENTER.x,
        y: CENTER.y,
        w: CENTER.w,
        h: CENTER.h,
        solid: true,
        r: 75
      });

      // 2. Red's House / James's Cottage (Northwest)
      props.push({
        type: 'building',
        buildingType: 'redHouse',
        x: -170,
        y: -190,
        w: 140,
        h: 110,
        solid: true,
        r: 60
      });

      // 3. Blue's / Rival's House (Northeast)
      props.push({
        type: 'building',
        buildingType: 'blueHouse',
        x: 170,
        y: -190,
        w: 140,
        h: 110,
        solid: true,
        r: 60
      });

      // 4. Pallet Town Central Monument (Southwest plaza)
      props.push({
        type: 'monument',
        x: -140,
        y: 140,
        solid: true,
        r: 18,
        title: 'PALLET TOWN',
        sub: 'Shades of your journey await!'
      });

      // 5. Ocean Pier (South, Route 21 dock)
      props.push({
        type: 'pier',
        x: 0,
        y: 500,
        w: 70,
        h: 120,
        solid: false
      });

      // 6. Wooden shore railings (Prevent walking off into ocean)
      const shoreFences = [
        [-380, 460], [-300, 460], [-220, 460], [-140, 460], [-60, 460],
        [60, 460], [140, 460], [220, 460], [300, 460], [380, 460]
      ];
      for (const [fx, fy] of shoreFences) {
        props.push({ type: 'fence', x: fx, y: fy, solid: true, r: 14, w: 70, h: 14 });
      }

      // 7. White picket fences enclosing cottage yards
      const yardFences = [
        // Red's yard
        [-250, -130], [-90, -130], [-250, -250],
        // Rival's yard
        [90, -130], [250, -130], [250, -250],
        // Oak Lab border
        [50, 130], [270, 130]
      ];
      for (const [fx, fy] of yardFences) {
        props.push({ type: 'fence', x: fx, y: fy, solid: true, r: 12, w: 50, h: 12 });
      }

      // 8. Signposts
      props.push({ type: 'sign', x: 75, y: 220, solid: true, r: 10, title: "OAK LAB", sub: "Pokémon Research" });
      props.push({ type: 'sign', x: -170, y: -125, solid: true, r: 10, title: "RED'S HOUSE", sub: "Home Sweet Home" });
      props.push({ type: 'sign', x: 170, y: -125, solid: true, r: 10, title: "RIVAL'S HOUSE", sub: "Daisy & Blue" });
      props.push({ type: 'sign', x: -45, y: -340, solid: true, r: 10, title: "ROUTE 1", sub: "Viridian City ↑" });
      props.push({ type: 'sign', x: -45, y: 445, solid: true, r: 10, title: "ROUTE 21", sub: "Cinnabar Island ↓" });

      // 9. Street Lamps at town intersections
      const streetLamps = [
        [-40, -130], [40, -130],
        [-40, 0], [40, 0],
        [-40, 140], [70, 140]
      ];
      for (const [lx, ly] of streetLamps) {
        props.push({ type: 'lamp', x: lx, y: ly, solid: true, r: 10 });
      }

      // 10. Kanto shade trees & groves
      const kantoTrees = [
        // Route 1 borders (North)
        [-130, -380], [-190, -440], [-140, -510], [-200, -560],
        [130, -380], [190, -440], [140, -510], [200, -560],
        // Cottage hill groves
        [-340, -260], [-380, -180], [-340, -100], [-390, -20],
        [340, -260], [380, -180], [340, -100], [390, -20],
        // Town Square grove
        [-240, 70], [-270, 150], [-240, 230], [-200, 310],
        // Oak Lab back garden
        [310, 80], [360, 160], [320, 240], [280, 310],
        // South beach palms & pines
        [-340, 390], [-260, 420], [-140, 420],
        [340, 390], [260, 420], [140, 420]
      ];
      for (const [tx, ty] of kantoTrees) {
        props.push({ type: 'tree', x: tx, y: ty, solid: true, r: 18, fruit: Math.random() < 0.45 });
      }

      // 11. Boulders & Rocks
      const rocks = [
        [-80, -440], [80, -480], [-300, 30], [300, 30], [-70, 430], [70, 430]
      ];
      for (const [rx, ry] of rocks) {
        props.push({ type: 'rock', x: rx, y: ry, solid: true, r: 14 });
      }

    } else {
      // --- Safari Park Scene ---
      CENTER = {
        x: 0,
        y: -80,
        w: 160,
        h: 110,
        plazaX: 0,
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
        props.push({ type: 'tree', x: tx, y: ty, solid: true, r: 16, fruit: Math.random() < 0.4 });
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

  // Check if position is inside the active Welcome Plaza
  function isInWelcomePlaza(x, y) {
    const px = CENTER.plazaX !== undefined ? CENTER.plazaX : CENTER.x;
    const py = CENTER.plazaY !== undefined ? CENTER.plazaY : 0;
    const dx = x - px;
    const dy = y - py;
    return Math.hypot(dx, dy) < CENTER.plazaRadius;
  }

  function isFree(x, y, r = 12) {
    if (x - r < MIN_X + 25 || x + r > MAX_X - 25 || y - r < MIN_Y + 25 || y + r > MAX_Y - 25) {
      return false;
    }

    // In Pallet Town, water occupies y > 470, except when on the pier (|x| < 30 and y < 550)
    if (currentScene === 'kanto' && y + r > 470) {
      if (!(Math.abs(x) < 32 && y < 550)) {
        return false;
      }
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

    // In Pallet Town, prevent walking into deep ocean unless on the pier
    if (currentScene === 'kanto' && e.y + r > 470) {
      if (!(Math.abs(e.x) < 32 && e.y < 550)) {
        e.y = 470 - r;
      }
    }

    // Building collision boxes
    for (const b of props) {
      if (b.type !== 'building' || !b.solid) continue;
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

    // Circular props (trees, rocks, fences, lamps, monuments)
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

  // Draw ground tiles, path carpets, water, and Plaza
  function drawGround(ctx) {
    worldTime += 0.016;
    if (currentScene === 'kanto') {
      drawKantoGround(ctx);
    } else {
      drawSafariGround(ctx);
    }
  }

  function drawSafariGround(ctx) {
    // 1. Base vibrant meadow grass
    ctx.fillStyle = '#55b248';
    ctx.fillRect(MIN_X - 120, MIN_Y - 120, (MAX_X - MIN_X) + 240, (MAX_Y - MIN_Y) + 240);

    // 2. Gentle checkered grass variations (pixel look)
    ctx.fillStyle = '#4ea742';
    const step = 48;
    const startX = Math.floor(MIN_X / step) * step;
    const startY = Math.floor(MIN_Y / step) * step;
    for (let y = startY; y < MAX_Y + step; y += step) {
      for (let x = startX; x < MAX_X + step; x += step) {
        if (((Math.floor(x / step) + Math.floor(y / step)) & 1) === 0) {
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
    const px = CENTER.plazaX !== undefined ? CENTER.plazaX : CENTER.x;
    const py = CENTER.plazaY !== undefined ? CENTER.plazaY : 20;
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
    ctx.fillRect(MIN_X - 120, MIN_Y - 120, (MAX_X - MIN_X) + 240, (MAX_Y - MIN_Y) + 240);

    // 2. Subtle Kanto pixel checkerboard
    ctx.fillStyle = '#3ba13f';
    const step = 48;
    const startX = Math.floor(MIN_X / step) * step;
    const startY = Math.floor(MIN_Y / step) * step;
    for (let y = startY; y < MAX_Y + step; y += step) {
      for (let x = startX; x < MAX_X + step; x += step) {
        if (((Math.floor(x / step) + Math.floor(y / step)) & 1) === 0) {
          ctx.fillRect(x, y, step, step);
        }
      }
    }

    // 3. Route 21 Southern Ocean Shore (Water & Beach)
    // Deep Ocean Water
    ctx.fillStyle = '#1e88e5';
    ctx.fillRect(MIN_X - 120, 485, (MAX_X - MIN_X) + 240, 240);

    // Ocean Shallows
    ctx.fillStyle = '#29b6f6';
    ctx.fillRect(MIN_X - 120, 470, (MAX_X - MIN_X) + 240, 18);

    // Animated gentle ocean waves / foam
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    const waveOffset = Math.sin(Date.now() * 0.003) * 6;
    for (let wx = MIN_X - 100; wx < MAX_X + 100; wx += 48) {
      ctx.beginPath();
      ctx.arc(wx + waveOffset, 475, 5, 0, Math.PI);
      ctx.fill();
    }

    // Sandy Beach
    ctx.fillStyle = '#ffe082';
    ctx.fillRect(MIN_X - 120, 445, (MAX_X - MIN_X) + 240, 26);
    ctx.fillStyle = '#ffd54f';
    ctx.fillRect(MIN_X - 120, 466, (MAX_X - MIN_X) + 240, 5);

    // 4. Authentic Pallet Town Road Network
    // Roads:
    // (a) Route 1 (North exit): from (0, -130) straight up to (0, -600)
    // (b) Residential Street (West-East): from Red's House (-170, -130) across to Rival's House (170, -130)
    // (c) South-East branch: to Oak's Lab (160, 220)
    // (d) South-West branch: to Town Square (-140, 140)
    // (e) South Pier branch: from (0, 140) down to the beach (0, 450)

    // Outer earthy dirt road border
    ctx.strokeStyle = '#c49f57';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 44;

    ctx.beginPath();
    // Route 1 (North)
    ctx.moveTo(0, -600);
    ctx.lineTo(0, -130);
    // Residential cross street
    ctx.moveTo(-170, -130);
    ctx.lineTo(170, -130);
    // Main street down through town
    ctx.moveTo(0, -130);
    ctx.lineTo(0, 140);
    // Oak Lab branch
    ctx.lineTo(160, 220);
    // Town Square branch
    ctx.moveTo(0, 140);
    ctx.lineTo(-140, 140);
    // South to pier & beach
    ctx.moveTo(0, 140);
    ctx.lineTo(0, 450);
    ctx.stroke();

    // Inner golden sand surface
    ctx.strokeStyle = '#edd89b';
    ctx.lineWidth = 36;
    ctx.stroke();

    // Cobblestone garden walkways to house doors
    ctx.fillStyle = '#cfd8dc';
    // Walkway to Red's door
    ctx.fillRect(-185, -165, 30, 36);
    // Walkway to Rival's door
    ctx.fillRect(155, -165, 30, 36);

    // 5. Professor Oak's Research Lab Welcome Courtyard
    const px = CENTER.plazaX;
    const py = CENTER.plazaY;
    const pr = CENTER.plazaRadius;

    // Outer cobblestone courtyard border
    ctx.fillStyle = '#b0bec5';
    ctx.beginPath();
    ctx.arc(px, py, pr + 4, 0, Math.PI * 2);
    ctx.fill();

    // Inner stone paving
    ctx.fillStyle = '#eceff1';
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();

    // Concentric paver circles
    ctx.strokeStyle = '#b0bec5';
    ctx.lineWidth = 2;
    for (let r = 20; r < pr; r += 20) {
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Inlaid Stone Poké Ball in center of Oak's courtyard
    const ir = 22;
    ctx.fillStyle = '#263238';
    ctx.beginPath();
    ctx.arc(px, py, ir + 2, 0, Math.PI * 2);
    ctx.fill();

    // Red top half
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.arc(px, py, ir, Math.PI, 0, false);
    ctx.fill();

    // White bottom half
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, ir, 0, Math.PI, false);
    ctx.fill();

    // Center button
    ctx.fillStyle = '#263238';
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // 6. Pallet Town Central Town Square (Southwest)
    const sqX = -140, sqY = 140, sqR = 48;
    ctx.fillStyle = '#d7ccc8';
    ctx.beginPath();
    ctx.arc(sqX, sqY, sqR + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#efebe9';
    ctx.beginPath();
    ctx.arc(sqX, sqY, sqR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#bcaaa4';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sqX, sqY, 24, 0, Math.PI * 2);
    ctx.stroke();

    // 7. Route 1 Tall Wild Grass Patches (North of town)
    const tallGrassSpots = [
      [-70, -380], [70, -380], [-80, -460], [80, -460], [-70, -530], [70, -530],
      [-130, -330], [130, -330]
    ];
    for (const [gx, gy] of tallGrassSpots) {
      drawTallGrassPatch(ctx, gx, gy);
    }

    // 8. Flower patches outside houses and in town
    const kantoFlowers = [
      // Red's garden
      [-230, -150], [-110, -150], [-230, -210],
      // Rival's garden
      [110, -150], [230, -150], [230, -210],
      // Town Square flowers
      [-180, 110], [-100, 110], [-180, 170], [-100, 170],
      // Beach flowers
      [-100, 420], [100, 420]
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
    const colors = ['#e53935', '#fbc02d', '#1e88e5', '#ffffff'];
    for (let i = 0; i < 6; i++) {
      const ox = x + Math.sin(i * 2.3) * 14;
      const oy = y + Math.cos(i * 1.7) * 10;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.arc(ox, oy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath();
      ctx.arc(ox, oy, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw scenery props and active scene buildings
  function drawScenery(ctx) {
    const sorted = props.slice().sort((a, b) => a.y - b.y);

    for (const p of sorted) {
      if (p.type === 'building') {
        if (p.buildingType === 'oakLab') {
          drawProfOakLab(ctx, p.x, p.y, p.w, p.h);
        } else if (p.buildingType === 'redHouse') {
          drawRedHouse(ctx, p.x, p.y, p.w, p.h);
        } else if (p.buildingType === 'blueHouse') {
          drawBlueHouse(ctx, p.x, p.y, p.w, p.h);
        } else {
          drawPokemonCenter(ctx, p.x, p.y, p.w, p.h);
        }
      } else if (p.type === 'tree') {
        drawTree(ctx, p.x, p.y, p.r, p.fruit);
      } else if (p.type === 'rock') {
        drawRock(ctx, p.x, p.y, p.r);
      } else if (p.type === 'pier') {
        drawPier(ctx, p.x, p.y, p.w, p.h);
      } else if (p.type === 'monument') {
        drawMonument(ctx, p.x, p.y, p.title, p.sub);
      } else if (p.type === 'banner') {
        drawBanner(ctx, p.x, p.y);
      } else if (p.type === 'bush') {
        drawBush(ctx, p.x, p.y);
      } else if (p.type === 'fence') {
        drawPicketFence(ctx, p.x, p.y, p.w || 40);
      } else if (p.type === 'lamp') {
        drawStreetLamp(ctx, p.x, p.y);
      } else if (p.type === 'sign') {
        drawSignpost(ctx, p.x, p.y, p.title, p.sub);
      }
    }
  }

  /**
   * Professor Oak's Pokémon Research Lab (Pallet Town)
   * Large 2-story research building with blue hipped roof, clean research walls,
   * research windows, computer consoles, and rotating rooftop weather antenna.
   */
  function drawProfOakLab(ctx, cx, cy, w, h) {
    const x0 = cx - w / 2;
    const y0 = cy - h / 2;

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.beginPath();
    ctx.ellipse(cx, y0 + h + 2, w / 2 + 10, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main Lab front walls (White stone research building)
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(x0 + 8, y0 + 36, w - 16, h - 36);

    // Foundation blue brick trim
    ctx.fillStyle = '#1565c0';
    ctx.fillRect(x0 + 8, y0 + 42, w - 16, 4);
    ctx.fillRect(x0 + 8, y0 + h - 6, w - 16, 6);

    // Large Research Laboratory Windows (computer screens visible inside)
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

    // "OAK LAB" Wooden Plaque over entrance
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

    // Antenna crossbar
    ctx.beginPath();
    ctx.moveTo(cx - 8, y0 - 12);
    ctx.lineTo(cx + 8, y0 - 12);
    ctx.stroke();

    // Radar dish beacon
    ctx.fillStyle = '#ffca28';
    ctx.beginPath();
    ctx.arc(cx, y0 - 18, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Red's House (Ash / James's Cottage, Pallet Town Northwest)
   * Bright red pitched roof, stone chimney with rising smoke puffs,
   * cream clapboard walls, front porch steps, flower box, and mailbox.
   */
  function drawRedHouse(ctx, cx, cy, w, h) {
    const x0 = cx - w / 2;
    const y0 = cy - h / 2;

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, y0 + h + 2, w / 2 + 8, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Brick Chimney (Behind roof)
    ctx.fillStyle = '#b71c1c';
    ctx.fillRect(x0 + w - 32, y0 - 14, 16, 32);
    ctx.fillStyle = '#7f0000';
    ctx.fillRect(x0 + w - 34, y0 - 16, 20, 4);

    // Rising smoke puffs from chimney
    const smokeOffset = (Date.now() * 0.002) % 3;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.arc(x0 + w - 24, y0 - 24 - smokeOffset * 10, 5 + smokeOffset * 2, 0, Math.PI * 2);
    ctx.arc(x0 + w - 22, y0 - 38 - smokeOffset * 10, 7 + smokeOffset * 3, 0, Math.PI * 2);
    ctx.fill();

    // House walls (Cozy warm cream clapboards)
    ctx.fillStyle = '#fff8e1';
    ctx.fillRect(x0 + 8, y0 + 36, w - 16, h - 36);

    // Clapboard lines
    ctx.strokeStyle = '#ffe082';
    ctx.lineWidth = 1;
    for (let ly = y0 + 44; ly < y0 + h - 6; ly += 8) {
      ctx.beginPath();
      ctx.moveTo(x0 + 8, ly);
      ctx.lineTo(x0 + w - 8, ly);
      ctx.stroke();
    }

    // Windows with flower boxes
    // Upper window
    ctx.fillStyle = '#80d8ff';
    ctx.fillRect(cx - 12, y0 + 44, 24, 18);
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - 12, y0 + 44, 24, 18);

    // Left lower window
    ctx.fillStyle = '#80d8ff';
    ctx.fillRect(x0 + 16, y0 + 58, 26, 22);
    ctx.strokeRect(x0 + 16, y0 + 58, 26, 22);

    // Flower box with red blossoms
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(x0 + 14, y0 + 80, 30, 6);
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.arc(x0 + 20, y0 + 79, 3, 0, Math.PI * 2);
    ctx.arc(x0 + 28, y0 + 78, 3, 0, Math.PI * 2);
    ctx.arc(x0 + 36, y0 + 79, 3, 0, Math.PI * 2);
    ctx.fill();

    // Wooden front door
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(cx + 10, y0 + 60, 26, h - 60);
    ctx.fillStyle = '#ffca28'; // doorknob
    ctx.beginPath();
    ctx.arc(cx + 30, y0 + 78, 2, 0, Math.PI * 2);
    ctx.fill();

    // Porch stone steps
    ctx.fillStyle = '#b0bec5';
    ctx.fillRect(cx + 6, y0 + h - 2, 34, 8);

    // Red Mailbox beside front door
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(cx + 42, y0 + h - 14, 3, 14);
    ctx.fillStyle = '#d32f2f';
    ctx.beginPath();
    ctx.arc(cx + 43, y0 + h - 14, 5, 0, Math.PI * 2);
    ctx.fill();

    // Red Pitched Tile Roof
    ctx.fillStyle = '#d32f2f';
    ctx.beginPath();
    ctx.moveTo(x0 - 4, y0 + 38);
    ctx.lineTo(cx, y0 + 2);
    ctx.lineTo(x0 + w + 4, y0 + 38);
    ctx.closePath();
    ctx.fill();

    // Roof ridge highlight
    ctx.fillStyle = '#ef5350';
    ctx.beginPath();
    ctx.moveTo(x0 - 4, y0 + 38);
    ctx.lineTo(cx, y0 + 2);
    ctx.lineTo(cx, y0 + 6);
    ctx.lineTo(x0 - 2, y0 + 40);
    ctx.closePath();
    ctx.fill();

    // White roof eaves
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x0 - 6, y0 + 36, w + 12, 4);
  }

  /**
   * Blue's House (Rival / Daisy's House, Pallet Town Northeast)
   * Cobalt-blue pitched roof, matching aesthetics, flower garden, and blue mailbox.
   */
  function drawBlueHouse(ctx, cx, cy, w, h) {
    const x0 = cx - w / 2;
    const y0 = cy - h / 2;

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, y0 + h + 2, w / 2 + 8, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Chimney
    ctx.fillStyle = '#78909c';
    ctx.fillRect(x0 + 16, y0 - 14, 16, 32);
    ctx.fillStyle = '#455a64';
    ctx.fillRect(x0 + 14, y0 - 16, 20, 4);

    // Rising smoke puffs
    const smokeOffset = (Date.now() * 0.002 + 1.5) % 3;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.arc(x0 + 24, y0 - 24 - smokeOffset * 10, 5 + smokeOffset * 2, 0, Math.PI * 2);
    ctx.arc(x0 + 26, y0 - 38 - smokeOffset * 10, 7 + smokeOffset * 3, 0, Math.PI * 2);
    ctx.fill();

    // House walls (Clean white stone)
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(x0 + 8, y0 + 36, w - 16, h - 36);

    // Clapboard lines
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let ly = y0 + 44; ly < y0 + h - 6; ly += 8) {
      ctx.beginPath();
      ctx.moveTo(x0 + 8, ly);
      ctx.lineTo(x0 + w - 8, ly);
      ctx.stroke();
    }

    // Windows with flower boxes
    ctx.fillStyle = '#80d8ff';
    ctx.fillRect(cx - 12, y0 + 44, 24, 18);
    ctx.strokeStyle = '#37474f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - 12, y0 + 44, 24, 18);

    // Right lower window
    ctx.fillStyle = '#80d8ff';
    ctx.fillRect(x0 + w - 42, y0 + 58, 26, 22);
    ctx.strokeRect(x0 + w - 42, y0 + 58, 26, 22);

    // Flower box with blue/yellow blossoms
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(x0 + w - 44, y0 + 80, 30, 6);
    ctx.fillStyle = '#1e88e5';
    ctx.beginPath();
    ctx.arc(x0 + w - 38, y0 + 79, 3, 0, Math.PI * 2);
    ctx.arc(x0 + w - 24, y0 + 79, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fbc02d';
    ctx.beginPath();
    ctx.arc(x0 + w - 31, y0 + 78, 3, 0, Math.PI * 2);
    ctx.fill();

    // Wooden front door
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(cx - 36, y0 + 60, 26, h - 60);
    ctx.fillStyle = '#ffca28';
    ctx.beginPath();
    ctx.arc(cx - 16, y0 + 78, 2, 0, Math.PI * 2);
    ctx.fill();

    // Porch stone steps
    ctx.fillStyle = '#b0bec5';
    ctx.fillRect(cx - 40, y0 + h - 2, 34, 8);

    // Blue Mailbox
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(cx - 48, y0 + h - 14, 3, 14);
    ctx.fillStyle = '#1976d2';
    ctx.beginPath();
    ctx.arc(cx - 47, y0 + h - 14, 5, 0, Math.PI * 2);
    ctx.fill();

    // Cobalt-Blue Pitched Tile Roof
    ctx.fillStyle = '#1976d2';
    ctx.beginPath();
    ctx.moveTo(x0 - 4, y0 + 38);
    ctx.lineTo(cx, y0 + 2);
    ctx.lineTo(x0 + w + 4, y0 + 38);
    ctx.closePath();
    ctx.fill();

    // Roof highlight
    ctx.fillStyle = '#42a5f5';
    ctx.beginPath();
    ctx.moveTo(x0 - 4, y0 + 38);
    ctx.lineTo(cx, y0 + 2);
    ctx.lineTo(cx, y0 + 6);
    ctx.lineTo(x0 - 2, y0 + 40);
    ctx.closePath();
    ctx.fill();

    // White roof eaves
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x0 - 6, y0 + 36, w + 12, 4);
  }

  /**
   * Pallet Town Central Town Monument
   */
  function drawMonument(ctx, x, y, title, sub) {
    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 24, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stone Pedestal
    ctx.fillStyle = '#90a4ae';
    ctx.fillRect(x - 20, y - 10, 40, 20);
    ctx.fillStyle = '#cfd8dc';
    ctx.fillRect(x - 18, y - 8, 36, 16);

    // Brass Plaque
    ctx.fillStyle = '#ffca28';
    ctx.fillRect(x - 16, y - 24, 32, 16);
    ctx.strokeStyle = '#b78103';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 16, y - 24, 32, 16);

    // Carved text
    ctx.fillStyle = '#3e2723';
    ctx.font = 'bold 6px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PALLET', x, y - 16);
    ctx.fillText('TOWN', x, y - 10);
  }

  /**
   * Route 21 Ocean Pier / Dock (South of Pallet Town)
   */
  function drawPier(ctx, x, y, w, h) {
    const x0 = x - w / 2;
    // Wooden dock floorboards
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(x0, y, w, h);

    // Planks shading
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 2;
    for (let py = y + 8; py < y + h; py += 8) {
      ctx.beginPath();
      ctx.moveTo(x0, py);
      ctx.lineTo(x0 + w, py);
      ctx.stroke();
    }

    // Support pilings / posts
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(x0 - 4, y, 6, h);
    ctx.fillRect(x0 + w - 2, y, 6, h);

    // Mooring cleats on dock ends
    ctx.fillStyle = '#263238';
    ctx.fillRect(x0 - 2, y + h - 10, 4, 8);
    ctx.fillRect(x0 + w - 2, y + h - 10, 4, 8);
  }

  /**
   * Victorian Wrought-Iron Street Lamp
   */
  function drawStreetLamp(ctx, x, y) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Base & Post
    ctx.fillStyle = '#263238';
    ctx.fillRect(x - 3, y - 4, 6, 6);
    ctx.fillRect(x - 1.5, y - 28, 3, 26);

    // Lantern fixture
    ctx.fillRect(x - 5, y - 32, 10, 4);
    ctx.fillRect(x - 4, y - 38, 8, 3);

    // Warm glowing amber lantern glass
    ctx.fillStyle = '#ffe082';
    ctx.fillRect(x - 3.5, y - 35, 7, 6);

    // Gentle ambient light halo
    const glow = ctx.createRadialGradient(x, y - 32, 2, x, y - 32, 18);
    glow.addColorStop(0, 'rgba(255, 238, 88, 0.35)');
    glow.addColorStop(1, 'rgba(255, 238, 88, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y - 32, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * White Picket Fence
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
    const posts = Math.max(3, Math.floor(len / 10));
    for (let i = 0; i <= posts; i++) {
      const px = x0 + (i / posts) * (len - 4);
      // Picket shadow
      ctx.fillStyle = '#b0bec5';
      ctx.fillRect(px - 1, y - 15, 4, 18);
      // Picket body
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px - 2, y - 16, 4, 18);
      // Pointed cap
      ctx.beginPath();
      ctx.moveTo(px - 2, y - 16);
      ctx.lineTo(px, y - 20);
      ctx.lineTo(px + 2, y - 16);
      ctx.closePath();
      ctx.fill();
    }
  }

  /**
   * Wooden Signpost
   */
  function drawSignpost(ctx, x, y, title = 'ROUTE 1', sub = '') {
    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wooden post
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(x - 2, y - 24, 4, 26);

    // Wooden sign board
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(x - 22, y - 36, 44, 16);
    ctx.fillStyle = '#a1887f';
    ctx.fillRect(x - 20, y - 34, 40, 12);

    // Text on sign
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, x, y - 27);
    if (sub) {
      ctx.font = '5px sans-serif';
      ctx.fillStyle = '#ffecb3';
      ctx.fillText(sub, x, y - 23);
    }
  }

  /**
   * Pokémon Center building (Safari Park)
   */
  function drawPokemonCenter(ctx, cx, cy, w, h) {
    const x0 = cx - w / 2;
    const y0 = cy - h / 2;

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, y0 + h + 2, w / 2 + 8, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Front main walls (Warm white stone)
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(x0 + 8, y0 + 36, w - 16, h - 36);

    // Foundation pink trim
    ctx.fillStyle = '#e91e63';
    ctx.fillRect(x0 + 8, y0 + 44, w - 16, 4);
    ctx.fillRect(x0 + 8, y0 + h - 6, w - 16, 6);

    // Windows
    ctx.fillStyle = '#81d4fa';
    ctx.fillRect(x0 + 16, y0 + 56, 32, 28);
    ctx.fillRect(x0 + w - 48, y0 + 56, 32, 28);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x0 + 20, y0 + 58, 6, 24);
    ctx.fillRect(x0 + w - 44, y0 + 58, 6, 24);

    // Glass sliding doors
    ctx.fillStyle = '#37474f';
    ctx.fillRect(cx - 22, y0 + 60, 44, h - 60);
    ctx.fillStyle = '#80deea';
    ctx.fillRect(cx - 18, y0 + 64, 15, h - 68);
    ctx.fillRect(cx + 3, y0 + 64, 15, h - 68);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 16, y0 + 66, 3, h - 72);
    ctx.fillRect(cx + 5, y0 + 66, 3, h - 72);

    // Stone entrance ramp
    ctx.fillStyle = '#b0bec5';
    ctx.fillRect(cx - 26, y0 + h, 52, 10);

    // Sloped red tiled roof
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.moveTo(x0, y0 + 36);
    ctx.lineTo(x0 + 16, y0 + 6);
    ctx.lineTo(x0 + w - 16, y0 + 6);
    ctx.lineTo(x0 + w, y0 + 36);
    ctx.closePath();
    ctx.fill();

    // White roof ridge & eaves
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x0 + 16, y0 + 6, w - 32, 5);
    ctx.fillRect(x0 - 2, y0 + 36, w + 4, 4);

    // Roof Center Emblem: Giant Poké Ball
    const pr = 20;
    const pcy = y0 + 26;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, pcy, pr + 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.arc(cx, pcy, pr, Math.PI, 0, false);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, pcy, pr, 0, Math.PI, false);
    ctx.fill();

    ctx.fillStyle = '#212121';
    ctx.fillRect(cx - 14, y0 + 25, 28, 2);
    ctx.beginPath();
    ctx.arc(cx, pcy, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, pcy, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Classic Pokémon World Tree
   */
  function drawTree(ctx, x, y, r = 16, fruit = false) {
    // Tree ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, r * 1.15, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk
    ctx.fillStyle = '#6d4c41';
    ctx.fillRect(x - 4, y - 12, 8, 14);
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(x - 4, y - 12, 3, 14);

    // Foliage tiers (Bottom to top)
    const tiers = [
      { dy: -14, r: r * 1.05, col: '#2e7d32' },
      { dy: -24, r: r * 0.90, col: '#388e3c' },
      { dy: -34, r: r * 0.70, col: '#43a047' }
    ];

    for (const t of tiers) {
      ctx.fillStyle = t.col;
      ctx.beginPath();
      ctx.arc(x, y + t.dy, t.r, 0, Math.PI * 2);
      ctx.fill();

      // Sunlit foliage highlight
      ctx.fillStyle = '#66bb6a';
      ctx.beginPath();
      ctx.arc(x - t.r * 0.35, y + t.dy - t.r * 0.35, t.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cute Berries
    if (fruit) {
      const berryPositions = [
        [-r * 0.4, -20],
        [r * 0.4, -22],
        [0, -32]
      ];
      for (const [bx, by] of berryPositions) {
        ctx.fillStyle = '#d32f2f';
        ctx.beginPath();
        ctx.arc(x + bx, y + by, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x + bx - 0.7, y + by - 0.7, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawRock(ctx, x, y, r = 14) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, r * 1.1, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rock body
    ctx.fillStyle = '#78909c';
    ctx.beginPath();
    ctx.arc(x, y - r * 0.5, r, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = '#b0bec5';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.7, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBush(ctx, x, y) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2e7d32';
    ctx.beginPath();
    ctx.arc(x, y - 6, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#43a047';
    ctx.beginPath();
    ctx.arc(x - 3, y - 8, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBanner(ctx, x, y) {
    // Festive flagpole
    ctx.fillStyle = '#455a64';
    ctx.fillRect(x - 2, y - 36, 4, 38);
    // Gold finial
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath();
    ctx.arc(x, y - 37, 3, 0, Math.PI * 2);
    ctx.fill();
    // Triangular Pennant banner
    ctx.fillStyle = '#e91e63';
    ctx.beginPath();
    ctx.moveTo(x + 2, y - 36);
    ctx.lineTo(x + 22, y - 28);
    ctx.lineTo(x + 2, y - 20);
    ctx.closePath();
    ctx.fill();
  }

  // Initialize on module load
  init();

  return {
    init,
    setScene,
    getScene,
    getSceneName,
    isInWelcomePlaza,
    isFree,
    collide,
    drawGround,
    drawScenery,
    get CENTER() { return CENTER; },
    get props() { return props; },
    get MIN_X() { return MIN_X; },
    get MAX_X() { return MAX_X; },
    get MIN_Y() { return MIN_Y; },
    get MAX_Y() { return MAX_Y; }
  };
})();
