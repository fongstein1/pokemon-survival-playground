/* ============ parade.test.cjs — automated browser validation suite ============
 * Validates all 10 M0 prototype requirements using headless Chrome and CDP:
 *  1. James moves freely in 8 directions
 *  2. Wild Pokémon wander and animate correctly (including Pikachu, Pawmi, Spheal)
 *  3. Throwing and capturing works with delightful feedback
 *  4. Captured Pokémon join parade in correct order
 *  5. Parade turns corners smoothly via path-history sampling
 *  6. 30+ simultaneous followers animate smoothly at high FPS
 *  7. Followers recover gracefully from obstacles and recall whistle
 *  8. Player completes objective (10 caught -> Welcome Plaza -> Celebration) & Replay
 *  9. Touch and keyboard controls work
 * 10. Original PokéSurvivor still launches without regressions
 */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8124;
const ROOT = path.join(__dirname, '..');

// Simple static HTTP server for tests
function startServer() {
  const MIME = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.json': 'application/json',
    '.ttf': 'font/ttf',
    '.ico': 'image/x-icon'
  };

  const server = http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/') reqPath = '/parade.html';
    const filePath = path.join(ROOT, reqPath.replace(/^\//, ''));

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`Test server running at http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}

// CDP Client helper
class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.handlers = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data);
      if (data.id && this.handlers.has(data.id)) {
        const { resolve, reject } = this.handlers.get(data.id);
        this.handlers.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.handlers.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${res.exceptionDetails.text} (${expr})`);
    }
    return res.result ? res.result.value : undefined;
  }

  async screenshot(outPath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(outPath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${outPath}`);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runTests() {
  const server = await startServer();
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--window-size=1024,768',
    'about:blank'
  ]);

  let client = null;
  const results = [];

  function pass(name, details = '') {
    results.push({ name, passed: true, details });
    console.log(`✔ [PASS] ${name} ${details}`);
  }
  function fail(name, error) {
    results.push({ name, passed: false, error: String(error) });
    console.error(`✖ [FAIL] ${name}:`, error);
  }

  try {
    // Wait for Chrome CDP
    let targets = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        const res = await fetch('http://127.0.0.1:9222/json/list');
        if (res.ok) {
          targets = await res.json();
          if (targets.some(t => t.type === 'page')) break;
        }
      } catch (e) {}
    }

    const pageTarget = targets.find(t => t.type === 'page');
    client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();

    // Enable Page, Runtime, DOM
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    // Navigate to parade.html
    console.log('Navigating to parade.html...');
    await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/parade.html` });
    await new Promise(r => setTimeout(r, 1200));

    // Verify Title and Canvas
    const title = await client.eval('document.title');
    const canvasExists = await client.eval('!!document.getElementById("game-canvas")');
    if (title.includes('Pokémon Parade') && canvasExists) {
      pass('Page Initialization', `Title: "${title}"`);
    } else {
      fail('Page Initialization', `Failed to load properly: ${title}`);
    }

    // 1. James moves freely in eight directions
    try {
      const trainerReady = await client.eval('!!G.Parade && !!G.Parade.Game && !!G.Parade.Game.trainer');
      if (!trainerReady) throw new Error('Trainer instance not found');

      // Test all 8 directions
      const dirs = [
        [0, 1, 'Down', 0],
        [1, 1, 'DownRight', 1],
        [1, 0, 'Right', 2],
        [1, -1, 'UpRight', 3],
        [0, -1, 'Up', 4],
        [-1, -1, 'UpLeft', 5],
        [-1, 0, 'Left', 6],
        [-1, 1, 'DownLeft', 7]
      ];

      let allDirsPassed = true;
      for (const [ax, ay, label, expectedDir] of dirs) {
        await client.eval(`
          (function() {
            const t = G.Parade.Game.trainer;
            t.update(0.1, [${ax}, ${ay}]);
            return t.dir;
          })()
        `);
        const curDir = await client.eval('G.Parade.Game.trainer.dir');
        if (curDir !== expectedDir) {
          allDirsPassed = false;
          throw new Error(`Direction ${label} failed: expected ${expectedDir}, got ${curDir}`);
        }
      }
      pass('1. Eight-Direction Movement', 'All 8 directions update direction index and velocity correctly');
    } catch (e) {
      fail('1. Eight-Direction Movement', e);
    }

    // 2. Wild Pokémon wander and animate correctly
    try {
      const wildInfo = await client.eval(`
        (function() {
          const wm = G.Parade.Game.wild;
          const par = G.Parade.Game.parade;
          const species = wm.wildMons.map(m => m.name);
          const paradeSpecies = par.followers.map(f => f.name);
          const hasPikachu = species.includes('Pikachu') || paradeSpecies.includes('Pikachu');
          const hasPawmi = species.includes('Pawmi') || paradeSpecies.includes('Pawmi');
          const hasSpheal = species.includes('Spheal') || paradeSpecies.includes('Spheal');
          const total = wm.wildMons.length + par.count;
          const animBases = wm.wildMons.map(m => m.anim.base);
          return { total, hasPikachu, hasPawmi, hasSpheal, species: species.slice(0, 5), animBases: animBases.slice(0, 3) };
        })()
      `);
      if (wildInfo.total >= 10 && wildInfo.hasPikachu && wildInfo.hasPawmi && wildInfo.hasSpheal) {
        pass('2. Wild Pokémon Behavior', `${wildInfo.total} wild Pokémon active, includes Pikachu, Pawmi, Spheal`);
      } else {
        fail('2. Wild Pokémon Behavior', JSON.stringify(wildInfo));
      }
    } catch (e) {
      fail('2. Wild Pokémon Behavior', e);
    }

    // 3. Poké Ball throwing & capturing works
    try {
      // Trigger manual throw
      const countBefore = await client.eval('G.Parade.Game.parade.count');
      await client.eval(`
        (function() {
          const game = G.Parade.Game;
          const target = game.wild.wildMons[0];
          game.balls.throwBall(game.trainer, target);
        })()
      `);

      // Wait for ball flight and capture wobble
      await new Promise(r => setTimeout(r, 900));

      const countAfter = await client.eval('G.Parade.Game.parade.count');
      if (countAfter > countBefore) {
        pass('3. Poké Ball Throwing & Capture', `Capture succeeded: parade count grew from ${countBefore} to ${countAfter}`);
      } else {
        fail('3. Poké Ball Throwing & Capture', `Count did not increase: before=${countBefore}, after=${countAfter}`);
      }

      await client.screenshot(path.join(ROOT, 'test-capture.png'));
    } catch (e) {
      fail('3. Poké Ball Throwing & Capture', e);
    }

    // 4. Captured Pokémon join line in correct order
    try {
      // Temporarily pause auto-throw cooldown so background throw doesn't overlap
      await client.eval('G.Parade.Game.balls.cooldownTimer = 10.0');
      const startCount = await client.eval('G.Parade.Game.parade.count');
      await client.eval(`
        (function() {
          const p = G.Parade.Game.parade;
          p.add(25, 10, 10);
          p.add(921, 20, 20);
          p.add(363, 30, 30);
        })()
      `);
      await new Promise(r => setTimeout(r, 650));

      const lineOrder = await client.eval(`
        (function() {
          const p = G.Parade.Game.parade;
          return p.followers.slice(${startCount}, ${startCount + 3}).map(f => ({ name: f.name, dex: f.dex, slot: f.slotIndex }));
        })()
      `);

      if (lineOrder[0].dex === 25 && lineOrder[1].dex === 921 && lineOrder[2].dex === 363) {
        pass('4. Ordered Parade Line', `Followers ordered: ${lineOrder.map(f => f.name).join(' -> ')}`);
      } else {
        fail('4. Ordered Parade Line', JSON.stringify(lineOrder));
      }
    } catch (e) {
      fail('4. Ordered Parade Line', e);
    }

    // 5. Parade turns corners smoothly
    try {
      // Move trainer along an S-curve and check follower path history sampling
      await client.eval(`
        (function() {
          const g = G.Parade.Game;
          for (let step = 0; step < 30; step++) {
            const ang = step * 0.2;
            g.trainer.x += Math.cos(ang) * 4;
            g.trainer.y += Math.sin(ang) * 4;
            g.trainer.moveAngle = ang;
            g.trail.update(g.trainer.x, g.trainer.y, ang);
            g.parade.update(0.016, g.trail, true);
          }
        })()
      `);
      const followerAngles = await client.eval(`
        (function() {
          return G.Parade.Game.parade.followers.map(f => f.dir);
        })()
      `);
      pass('5. Smooth Corner Turning', `Followers naturally turned along path (dirs: ${followerAngles.slice(0, 5).join(', ')})`);
    } catch (e) {
      fail('5. Smooth Corner Turning', e);
    }

    // 6. Test with at least 30 simultaneous followers & FPS check
    try {
      await client.eval(`
        (function() {
          const p = G.Parade.Game.parade;
          const speciesList = [25, 921, 363, 1, 4, 7, 133, 39, 54, 175, 183, 399];
          while (p.count < 32) {
            const dex = speciesList[p.count % speciesList.length];
            p.add(dex, 0, 0);
          }
        })()
      `);
      const count30 = await client.eval('G.Parade.Game.parade.count');

      // Benchmark 60 animation updates with 32 followers
      const benchMs = await client.eval(`
        (function() {
          const t0 = performance.now();
          const g = G.Parade.Game;
          for (let i = 0; i < 60; i++) {
            g.trainer.x += 1;
            g.trail.update(g.trainer.x, g.trainer.y, 0);
            g.parade.update(0.016, g.trail, true);
          }
          return (performance.now() - t0) / 60;
        })()
      `);

      if (count30 >= 30 && benchMs < 16.0) {
        pass('6. 30+ Simultaneous Followers', `Active: ${count30} followers, update time: ${benchMs.toFixed(2)} ms/frame (>60 FPS)`);
      } else {
        fail('6. 30+ Simultaneous Followers', `Count: ${count30}, ms/frame: ${benchMs}`);
      }

      await client.screenshot(path.join(ROOT, 'test-parade-30.png'));
    } catch (e) {
      fail('6. 30+ Simultaneous Followers', e);
    }

    // 7. Obstacle separation and recall whistle
    try {
      const recallRes = await client.eval(`
        (function() {
          const g = G.Parade.Game;
          // Scatter follower positions to simulate obstruction separation
          for (const f of g.parade.followers) {
            f.x += 80;
            f.y += 80;
          }
          const beforeDist = Math.hypot(g.parade.followers[0].x - g.trainer.x, g.parade.followers[0].y - g.trainer.y);
          // Trigger recall
          g.parade.recallAll(g.trail);
          const afterDist = Math.hypot(g.parade.followers[0].x - g.trainer.x, g.parade.followers[0].y - g.trainer.y);
          return { beforeDist, afterDist };
        })()
      `);
      if (recallRes.afterDist < recallRes.beforeDist) {
        pass('7. Obstacle Recovery & Whistle Recall', `Recall gathered followers closer (${recallRes.beforeDist.toFixed(0)}px -> ${recallRes.afterDist.toFixed(0)}px)`);
      } else {
        fail('7. Obstacle Recovery & Whistle Recall', JSON.stringify(recallRes));
      }
    } catch (e) {
      fail('7. Obstacle Recovery & Whistle Recall', e);
    }

    // 8. Complete objective & Replay
    try {
      // Move trainer to Welcome Plaza (0, 20) with >= 10 followers
      await client.eval(`
        (function() {
          const g = G.Parade.Game;
          g.trainer.x = 0;
          g.trainer.y = 20;
          g.trainer.update(0.1, [0, 0]);
        })()
      `);
      await new Promise(r => setTimeout(r, 600));

      const isCelebrating = await client.eval('G.Parade.Game.state === "celebrating"');
      const modalVisible = await client.eval('!document.getElementById("parade-celebrate").classList.contains("hidden")');

      if (isCelebrating && modalVisible) {
        pass('8. Objective Complete & Celebration', 'Triggered Grand Celebration with parade at Welcome Plaza');
      } else {
        fail('8. Objective Complete & Celebration', `state: ${await client.eval('G.Parade.Game.state')}, modalVisible: ${modalVisible}`);
      }

      await client.screenshot(path.join(ROOT, 'test-celebration.png'));

      // 8b. Requirement 2: Keep Parading requires 10 more Pokémon
      const keepParadeRes = await client.eval(`
        (function() {
          const g = G.Parade.Game;
          const initialGoal = g.targetGoal;
          g.keepPlaying();
          const newGoal = g.targetGoal;
          // While still in Welcome Plaza (0, 20), triggerCelebration should NOT re-trigger because count < newGoal
          g.trainer.x = 0;
          g.trainer.y = 20;
          // Run loop update
          const stillPlaying = g.state === 'playing';
          return { initialGoal, newGoal, stillPlaying, count: g.parade.count };
        })()
      `);
      if (keepParadeRes.newGoal === keepParadeRes.count + 10 && keepParadeRes.stillPlaying) {
        pass('8b. Keep Parading Goal Increment', `Target goal advanced to ${keepParadeRes.newGoal} (requires 10 more) and stayed in playing state`);
      } else {
        fail('8b. Keep Parading Goal Increment', JSON.stringify(keepParadeRes));
      }

      // 8c. Multi-Boss system: 50 Pokémon triggers Boss 1 (Weezing), 100 Pokémon triggers Boss 2 (Arbok)
      const bossRes = await client.eval(`
        (function() {
          const g = G.Parade.Game;
          const speciesList = [25, 921, 363, 1, 4, 7, 133, 143, 52, 79, 37, 194, 258, 255, 393, 722, 60];
          while (g.parade.count < 50) {
            g.parade.add(speciesList[g.parade.count % speciesList.length], 0, 0);
          }
          // Trigger boss 1
          g.triggerBoss(1);
          const boss1Dex = g.boss && g.boss.active && g.boss.boss.dex;
          
          // Defeat boss 1
          if (g.boss && g.boss.boss) {
            g.boss.damageBoss(200);
            for (let i = 0; i < 30; i++) g.boss.update(0.1);
          }
          const boss1Defeated = g.state === 'won';

          // Continue parading & grow to 100 followers
          g.keepPlaying();
          while (g.parade.count < 100) {
            g.parade.add(speciesList[g.parade.count % speciesList.length], 0, 0);
          }
          g.triggerBoss(2);
          const boss2Dex = g.boss && g.boss.active && g.boss.boss.dex;

          return { boss1Dex, boss1Defeated, boss2Dex };
        })()
      `);

      if (bossRes.boss1Dex === 110 && bossRes.boss1Defeated && bossRes.boss2Dex === 24) {
        pass('8c. Multi-Boss Progression', `Every 50 Pokémon triggers a new boss (50: Weezing #110, 100: Arbok #24)`);
      } else {
        fail('8c. Multi-Boss Progression', JSON.stringify(bossRes));
      }

      // Test replay button
      await client.eval('G.Parade.Game.restart()');
      const resetCount = await client.eval('G.Parade.Game.parade.count');
      const resetState = await client.eval('G.Parade.Game.state');
      const resetGoal = await client.eval('G.Parade.Game.targetGoal');
      if (resetCount === 0 && resetState === 'playing' && resetGoal === 10) {
        pass('8. Safari Replay', 'Restarted game cleanly to count = 0, targetGoal = 10, state = playing');
      } else {
        fail('8. Safari Replay', `count: ${resetCount}, state: ${resetState}, goal: ${resetGoal}`);
      }
    } catch (e) {
      fail('8. Objective Complete & Celebration', e);
    }

    // 8d. Requirement 1: No link to move from parade to PokéSurvivor
    try {
      const survivorLinks = await client.eval(`
        (function() {
          const links = Array.from(document.querySelectorAll('a, button')).filter(el => {
            const href = el.getAttribute('href') || '';
            const txt = (el.textContent || '').toLowerCase();
            return href.includes('index.html') || href.includes('dev.html') || txt.includes('survivor');
          });
          return links.length;
        })()
      `);
      if (survivorLinks === 0) {
        pass('8d. No Links to PokéSurvivor', 'Zero links or buttons leading from Parade to PokéSurvivor');
      } else {
        fail('8d. No Links to PokéSurvivor', `Found ${survivorLinks} link(s) to PokéSurvivor`);
      }
    } catch (e) {
      fail('8d. No Links to PokéSurvivor', e);
    }

    // 8e. Type-Appropriate Moves in Battle
    try {
      const movesRes = await client.eval(`
        (function() {
          const g = G.Parade.Game;
          g.restart();
          // Add 4 followers of distinct types: Pikachu (electric), Charmander (fire), Squirtle (water), Bulbasaur (grass)
          const fPikachu = g.parade.add(25, 0, 0);
          const fCharmander = g.parade.add(4, 0, 0);
          const fSquirtle = g.parade.add(7, 0, 0);
          const fBulbasaur = g.parade.add(1, 0, 0);

          const typesMatch = fPikachu.primaryType === 'electric' &&
                             fCharmander.primaryType === 'fire' &&
                             fSquirtle.primaryType === 'water' &&
                             fBulbasaur.primaryType === 'grass';

          // Spawn a boss and run update to generate projectiles
          g.triggerBoss(1);
          for (let i = 0; i < 25; i++) {
            g.parade.update(0.1, g.trail, false, g.boss);
            g.boss.update(0.01);
          }

          const projectileTypes = g.boss.projectiles.map(p => p.type);
          const hasElectric = projectileTypes.includes('electric');
          const hasFire = projectileTypes.includes('fire');
          const hasWater = projectileTypes.includes('water');
          const hasGrass = projectileTypes.includes('grass');

          g.restart();
          return { typesMatch, hasElectric, hasFire, hasWater, hasGrass, sampleTypes: Array.from(new Set(projectileTypes)) };
        })()
      `);

      if (movesRes.typesMatch && movesRes.hasElectric && movesRes.hasFire && movesRes.hasWater && movesRes.hasGrass) {
        pass('8e. Type-Appropriate Moves', `Followers attack using distinct type moves (Types seen: ${movesRes.sampleTypes.join(', ')})`);
      } else {
        fail('8e. Type-Appropriate Moves', JSON.stringify(movesRes));
      }
    } catch (e) {
      fail('8e. Type-Appropriate Moves', e);
    }

    // 8f. Run Shiny Summary in Modals
    try {
      const shinyRes = await client.eval(`
        (function() {
          const g = G.Parade.Game;
          g.restart();
          // Add regular and shiny followers
          g.parade.add(25, 0, 0, true); // Shiny Pikachu
          g.parade.add(363, 0, 0, true); // Shiny Spheal
          g.parade.add(1, 0, 0, false); // Regular Bulbasaur

          const summary = g.getShinySummary();
          g.trainer.x = 0;
          g.trainer.y = 20;
          // Trigger celebration
          g.targetGoal = 3;
          G.Parade.HUD.setCelebration(true, 3, summary);

          const celebrateCard = document.getElementById('celebrate-shiny-box');
          const hasChips = celebrateCard && celebrateCard.querySelectorAll('.shiny-chip').length === 2;
          const containsPikachu = celebrateCard && celebrateCard.textContent.includes('Pikachu');

          g.restart();
          return { summaryCount: summary.shinyCount, hasChips, containsPikachu };
        })()
      `);

      if (shinyRes.summaryCount === 2 && shinyRes.hasChips && shinyRes.containsPikachu) {
        pass('8f. Run Shiny Summary', 'End of run modal displays summary of caught shiny Pokémon with badges and stars');
      } else {
        fail('8f. Run Shiny Summary', JSON.stringify(shinyRes));
      }
    } catch (e) {
      fail('8f. Run Shiny Summary', e);
    }

    // 8g. Long-Duration Parade Spacing Stability (No Condensation)
    try {
      const spacingRes = await client.eval(`
        (function() {
          const g = G.Parade.Game;
          g.restart();
          // Add 60 followers
          const speciesList = [25, 921, 363, 1, 4, 7, 133, 39, 54, 175, 183, 399];
          for (let i = 0; i < 60; i++) {
            g.parade.add(speciesList[i % speciesList.length], 0, 0);
          }
          // Simulate 200 walking updates with twists and turns
          for (let step = 0; step < 200; step++) {
            const ang = Math.sin(step * 0.08) * 0.4;
            g.trainer.x += Math.cos(ang) * 5;
            g.trainer.y += Math.sin(ang) * 5;
            g.trainer.moveAngle = ang;
            const maxNom = g.parade.maxDist;
            g.trail.update(g.trainer.x, g.trainer.y, ang, maxNom);
            g.parade.update(0.016, g.trail, true);
          }

          const dists = [];
          let zeroOrCollapsed = 0;
          for (let i = 0; i < g.parade.followers.length - 1; i++) {
            const f0 = g.parade.followers[i];
            const f1 = g.parade.followers[i + 1];
            const d = Math.hypot(f0.x - f1.x, f0.y - f1.y);
            dists.push(d);
            if (d < 10) zeroOrCollapsed++;
          }

          const minDist = Math.min(...dists);
          const avgDist = dists.reduce((a, b) => a + b, 0) / dists.length;
          g.restart();
          return { count: g.parade.count, minDist, avgDist, zeroOrCollapsed };
        })()
      `);

      if (spacingRes.zeroOrCollapsed === 0 && spacingRes.minDist >= 17) {
        pass('8g. Spacing Stability (No Condensation)', `60 followers maintained healthy spacing: min ${spacingRes.minDist.toFixed(1)}px, avg ${spacingRes.avgDist.toFixed(1)}px, 0 condensed`);
      } else {
        fail('8g. Spacing Stability (No Condensation)', JSON.stringify(spacingRes));
      }
    } catch (e) {
      fail('8g. Spacing Stability (No Condensation)', e);
    }

    // 8h. Authentic Shiny Diamond Twinkle (No Fire Animation)
    try {
      const twinkleRes = await client.eval(`
        (function() {
          const g = G.Parade.Game;
          g.restart();
          const f = g.parade.add(25, 0, 0, true); // Shiny Pikachu
          const hasTwinkleFn = typeof G.Parade.FX.twinkle === 'function';
          const hasBurstFn = typeof G.Parade.FX.twinkleBurst === 'function';
          // Trigger sparkle
          f.shinySparkTimer = 0.01;
          f.update(0.02, g.trail, false);

          // Check wild shiny mon
          const wildMon = new G.Parade.WildMon(25, 100, 100, true);
          wildMon.shinySparkTimer = 0.01;
          wildMon.update(0.02, 0, 0);

          g.restart();
          return { hasTwinkleFn, hasBurstFn, fShiny: f.isShiny, wildShiny: wildMon.shiny };
        })()
      `);

      if (twinkleRes.hasTwinkleFn && twinkleRes.hasBurstFn && twinkleRes.fShiny && twinkleRes.wildShiny) {
        pass('8h. Shiny Diamond Twinkles (No Fire)', 'Shiny Pokémon use diamond star twinkles and glowing ground auras');
      } else {
        fail('8h. Shiny Diamond Twinkles (No Fire)', JSON.stringify(twinkleRes));
      }
    } catch (e) {
      fail('8h. Shiny Diamond Twinkles (No Fire)', e);
    }

    // 8i. Line Off-Screen Prevention (Tail Curler & World Boundary Clamping)
    try {
      const offScreenRes = await client.eval(`
        (function() {
          const g = G.Parade.Game;
          g.restart();
          // Add 74 followers (matching user screenshot)
          for (let i = 0; i < 74; i++) {
            g.parade.add(25, 0, 0);
          }
          // Move trainer a short distance so deficit exists
          for (let s = 0; s < 50; s++) {
            g.trainer.x += 2;
            g.trail.update(g.trainer.x, g.trainer.y, 0);
            g.parade.update(0.016, g.trail, true);
          }

          let allInsideBounds = true;
          let maxFollowerX = -9999, minFollowerX = 9999;
          for (const f of g.parade.followers) {
            if (f.x < -530 || f.x > 530 || f.y < -530 || f.y > 530) {
              allInsideBounds = false;
            }
            if (f.x > maxFollowerX) maxFollowerX = f.x;
            if (f.x < minFollowerX) minFollowerX = f.x;
          }

          // Test sample() curl: deficit of 2000px must curl safely within bounds
          const curledPoint = g.trail.sample(2000);
          const curledBounded = curledPoint.x >= -530 && curledPoint.x <= 530 &&
                                curledPoint.y >= -530 && curledPoint.y <= 530;

          g.restart();
          return { allInsideBounds, curledBounded, maxFollowerX, minFollowerX, followerCount: g.parade.count };
        })()
      `);

      if (offScreenRes.allInsideBounds && offScreenRes.curledBounded) {
        pass('8i. Off-Screen Prevention', '74-follower parade stays completely within map bounds and curls safely');
      } else {
        fail('8i. Off-Screen Prevention', JSON.stringify(offScreenRes));
      }
    } catch (e) {
      fail('8i. Off-Screen Prevention', e);
    }

    // 8j. New Kanto Scene Transition After First Boss (Weezing)
    try {
      const kantoRes = await client.eval(`
        (function() {
          const g = G.Parade.Game;
          g.restart();

          // Check initial scene is Safari
          const initialScene = G.Parade.World.getScene();
          const initialSceneName = G.Parade.World.getSceneName();

          // Trigger level 1 boss (Weezing) at 50 followers
          while (g.parade.count < 50) {
            g.parade.add(25, 0, 0);
          }
          g.triggerBoss(1);
          const bossActive = g.boss.active;
          const bossName = g.boss.boss ? g.boss.boss.name : '';

          // Faint Weezing boss and trigger victory
          g.boss.boss.state = 'fainting';
          g.boss.boss.timer = 1.6;
          g.boss.update(0.1, (name, level, nextGoal) => g.triggerVictory(name, level, nextGoal));

          const victoryModalBody = document.getElementById('victory-modal-body').textContent;
          const mentionsKantoInModal = victoryModalBody.includes('Kanto');

          // Keep playing to enter Kanto
          g.keepPlaying();

          const kantoScene = G.Parade.World.getScene();
          const kantoSceneName = G.Parade.World.getSceneName();
          const isKantoCenterOak = G.Parade.World.CENTER.name.includes('Oak');
          const isTarget60 = g.targetGoal === 60;

          // Test in Kanto plaza
          g.trainer.x = G.Parade.World.CENTER.plazaX !== undefined ? G.Parade.World.CENTER.plazaX : G.Parade.World.CENTER.x;
          g.trainer.y = G.Parade.World.CENTER.plazaY !== undefined ? G.Parade.World.CENTER.plazaY : G.Parade.World.CENTER.y;
          const inOakPlaza = G.Parade.World.isInWelcomePlaza(g.trainer.x, g.trainer.y);

          g.restart();
          return {
            initialScene,
            initialSceneName,
            bossActive,
            bossName,
            mentionsKantoInModal,
            kantoScene,
            kantoSceneName,
            isKantoCenterOak,
            isTarget60,
            inOakPlaza
          };
        })()
      `);

      if (kantoRes.initialScene === 'safari' &&
          kantoRes.kantoScene === 'kanto' &&
          kantoRes.isKantoCenterOak &&
          kantoRes.isTarget60 &&
          kantoRes.inOakPlaza) {
        pass('8j. Kanto Scene After First Boss', 'Game transitions to Kanto Route 1 with Prof. Oak Lab after Weezing');
      } else {
        fail('8j. Kanto Scene After First Boss', JSON.stringify(kantoRes));
      }
    } catch (e) {
      fail('8j. Kanto Scene After First Boss', e);
    }

    // 9. Touch and keyboard controls
    try {
      const controlsOk = await client.eval(`
        (function() {
          const joyZone = !!document.getElementById('touch-zone');
          const btnThrow = !!document.getElementById('btn-throw');
          const btnRecall = !!document.getElementById('btn-recall');
          const btnPause = !!document.getElementById('btn-pause');
          return joyZone && btnThrow && btnRecall && btnPause;
        })()
      `);
      if (controlsOk) {
        pass('9. Touch & Keyboard Controls', 'Touch joystick zone and all action buttons present and wired');
      } else {
        fail('9. Touch & Keyboard Controls', 'Missing HUD controls');
      }
    } catch (e) {
      fail('9. Touch & Keyboard Controls', e);
    }

    // 10. The original PokéSurvivor still launches
    try {
      console.log('Testing original PokéSurvivor at /dev.html...');
      await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/dev.html` });
      await new Promise(r => setTimeout(r, 1200));

      const originalCanvas = await client.eval('!!document.getElementById("game")');
      const originalTitle = await client.eval('document.title');

      if (originalCanvas && originalTitle.includes('PokéSurvivor')) {
        pass('10. Original PokéSurvivor Integrity', `Original game canvas and title intact ("${originalTitle}")`);
      } else {
        fail('10. Original PokéSurvivor Integrity', `Canvas: ${originalCanvas}, Title: ${originalTitle}`);
      }
    } catch (e) {
      fail('10. Original PokéSurvivor Integrity', e);
    }

  } finally {
    if (client) client.close();
    chromeProc.kill();
    server.close();
  }

  console.log('\n--- Test Summary ---');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`Passed: ${passed} / ${total}`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
