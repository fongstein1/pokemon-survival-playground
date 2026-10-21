/* ============ parade-wild.js — wild Pokémon wandering the Safari ============
 * 8-12 recognizable, cute species roaming the colourful Safari Park.
 * Includes Pikachu, Pawmi, Spheal, Bulbasaur, Charmander, Squirtle, Eevee, etc.
 * Features:
 *  - Idle, gentle wander, and playful avoidance
 *  - Individual PMD sprite animations via G.Sprites.Animator
 *  - Easy and satisfying to catch for all players
 */
window.G = window.G || {};
G.Parade = G.Parade || {};

G.Parade.SPECIES = [
  // Core favorites
  { dex: 25,  name: 'Pikachu',    weight: 12 },
  { dex: 921, name: 'Pawmi',      weight: 12 },
  { dex: 363, name: 'Spheal',     weight: 12 },
  // Classic starters & iconic cute companions
  { dex: 1,   name: 'Bulbasaur',  weight: 8 },
  { dex: 4,   name: 'Charmander', weight: 8 },
  { dex: 7,   name: 'Squirtle',   weight: 8 },
  { dex: 133, name: 'Eevee',      weight: 10 },
  { dex: 39,  name: 'Jigglypuff', weight: 8 },
  { dex: 54,  name: 'Psyduck',    weight: 8 },
  { dex: 175, name: 'Togepi',     weight: 8 },
  { dex: 183, name: 'Marill',     weight: 8 },
  { dex: 399, name: 'Bidoof',     weight: 8 },
  // 10 Additional Species
  { dex: 143, name: 'Snorlax',    weight: 7 },
  { dex: 52,  name: 'Meowth',     weight: 8 },
  { dex: 79,  name: 'Slowpoke',   weight: 8 },
  { dex: 37,  name: 'Vulpix',     weight: 8 },
  { dex: 194, name: 'Wooper',     weight: 8 },
  { dex: 258, name: 'Mudkip',     weight: 8 },
  { dex: 255, name: 'Torchic',    weight: 8 },
  { dex: 393, name: 'Piplup',     weight: 8 },
  { dex: 722, name: 'Rowlet',     weight: 8 },
  { dex: 60,  name: 'Poliwag',    weight: 8 }
];

G.Parade.WildMon = class WildMon {
  constructor(dex, x, y, shiny = false) {
    this.dex = dex;
    this.shiny = shiny && G.Sprites.hasShiny(dex);
    this.scale = G.Sprites.playerScale(dex);
    this.anim = new G.Sprites.Animator(dex, this.scale, this.shiny);
    this.bodyR = G.Sprites.bodyRadius(dex, this.scale);
    this.bodyH = G.Sprites.bodyHeight(dex, this.scale);

    const info = G.Parade.SPECIES.find(s => s.dex === dex);
    this.name = info ? info.name : ('#' + dex);

    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.dir = Math.floor(Math.random() * 8);

    // States: 'idle', 'wander', 'scamper', 'captured'
    this.state = 'idle';
    this.stateTimer = G.U.rand(1.5, 3.5);
    this.wanderTargetX = x;
    this.wanderTargetY = y;
    this.captured = false;
    this.targeted = false; // Targeted by flying ball
  }

  update(dt, trainerX, trainerY) {
    if (this.captured) return;

    this.anim.update(dt);
    this.stateTimer -= dt;

    const distToTrainer = Math.hypot(this.x - trainerX, this.y - trainerY);

    // If James gets very close (< 45px), playfully scamper away a few paces
    if (this.state !== 'scamper' && distToTrainer < 45) {
      this.state = 'scamper';
      this.stateTimer = G.U.rand(0.8, 1.4);
      const escapeAngle = Math.atan2(this.y - trainerY, this.x - trainerX) + G.U.rand(-0.4, 0.4);
      this.vx = Math.cos(escapeAngle) * 55;
      this.vy = Math.sin(escapeAngle) * 55;
      this.dir = G.Sprites.dirFromAngle(escapeAngle);
      this.anim.dir = this.dir;
      this.anim.loop('Walk', 1.3);
    }

    if (this.stateTimer <= 0) {
      if (this.state === 'idle') {
        // Switch to wander
        this.state = 'wander';
        this.stateTimer = G.U.rand(2.0, 4.0);
        const wanderAngle = G.U.rand(0, Math.PI * 2);
        const speed = G.U.rand(20, 36);
        this.vx = Math.cos(wanderAngle) * speed;
        this.vy = Math.sin(wanderAngle) * speed;
        this.dir = G.Sprites.dirFromAngle(wanderAngle);
        this.anim.dir = this.dir;
        this.anim.loop('Walk', 0.9);
      } else {
        // Switch to idle
        this.state = 'idle';
        this.stateTimer = G.U.rand(1.8, 3.8);
        this.vx = 0;
        this.vy = 0;
        this.anim.loop('Idle', 1.0);
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Collide with world obstacles
    if (G.Parade && G.Parade.World) {
      G.Parade.World.collide(this);
    }
  }

  draw(ctx) {
    if (this.captured) return;
    G.Sprites.drawShadow(ctx, this.dex, this.x, this.y, this.scale);
    this.anim.draw(ctx, this.x, this.y);
  }
};

G.Parade.WildManager = class WildManager {
  constructor() {
    this.wildMons = [];
    this.maxWild = 28; // Keep ~28 wild Pokémon active across the 22 species
    this.spawnTimer = 0;
  }

  reset() {
    this.wildMons = [];
    this.spawnTimer = 0;
  }

  /** Populate initial wild Pokémon scattered across the Safari meadows */
  populateInitial(count = 20) {
    this.wildMons = [];
    // Ensure Pikachu (25), Pawmi (921), and Spheal (363) are always present
    const mustInclude = [25, 921, 363];
    for (const dex of mustInclude) {
      const ang = G.U.rand(0, Math.PI * 2);
      const dist = G.U.rand(140, 360);
      const mon = new G.Parade.WildMon(dex, Math.cos(ang) * dist, Math.sin(ang) * dist, false);
      this.wildMons.push(mon);
    }
    // Fill remaining spots
    for (let i = mustInclude.length; i < count; i++) {
      this.spawnRandom(true);
    }
  }

  spawnRandom(initial = false, nearX = 0, nearY = 0) {
    // Pick weighted species
    const species = G.U.pick(G.Parade.SPECIES);
    const shiny = Math.random() < 0.05; // 5% pleasant shiny chance!

    let x, y;
    if (initial) {
      // Scatter in meadow ring between 120 and 500 units from Center
      const ang = G.U.rand(0, Math.PI * 2);
      const dist = G.U.rand(130, 480);
      x = Math.cos(ang) * dist;
      y = Math.sin(ang) * dist;
    } else {
      // Spawn near camera outer edge
      const ang = G.U.rand(0, Math.PI * 2);
      const dist = G.U.rand(340, 520);
      x = nearX + Math.cos(ang) * dist;
      y = nearY + Math.sin(ang) * dist;
    }

    // Ensure spawn location is walkable
    if (G.Parade.World && !G.Parade.World.isFree(x, y, 14)) {
      x += G.U.rand(-30, 30);
      y += G.U.rand(-30, 30);
    }

    const mon = new G.Parade.WildMon(species.dex, x, y, shiny);
    this.wildMons.push(mon);
    return mon;
  }

  findNearestUncaught(x, y, maxDist = 260) {
    let nearest = null;
    let bestDistSq = maxDist * maxDist;
    for (const mon of this.wildMons) {
      if (mon.captured || mon.targeted) continue;
      const dx = mon.x - x;
      const dy = mon.y - y;
      const dSq = dx * dx + dy * dy;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        nearest = mon;
      }
    }
    return nearest;
  }

  update(dt, trainerX, trainerY) {
    // Spawn replenishment
    this.spawnTimer += dt;
    if (this.wildMons.length < this.maxWild && this.spawnTimer > 1.2) {
      this.spawnTimer = 0;
      this.spawnRandom(false, trainerX, trainerY);
    }

    // Filter out captured
    this.wildMons = this.wildMons.filter(m => !m.captured);

    for (const mon of this.wildMons) {
      mon.update(dt, trainerX, trainerY);
    }
  }

  draw(ctx) {
    for (const mon of this.wildMons) {
      mon.draw(ctx);
    }
  }
};
