/* ============ parade-boss.js — Multi-Boss Battle Encounter ============
 * Escalating boss battles for "James and the Pokémon Parade":
 *  - Every 50 Pokémon caught triggers a new, unique boss:
 *     50: Weezing   (Dex 110) — Poison smoke clouds
 *    100: Arbok     (Dex 24)  — Toxic venom fangs
 *    150: Gengar    (Dex 94)  — Shadow ghost orbs
 *    200: Gyarados  (Dex 130) — Raging tidal blasts
 *    250: Tyranitar (Dex 248) — Earthquake sandstorm
 *    300: Dragonite (Dex 149) — Dragon firestorm
 *    350: Rayquaza  (Dex 384) — Celestial emerald aura
 *    400: Mewtwo    (Dex 150) — Ultimate psionic barrier
 *  - All parade followers form an attacking swarm in concentric rings
 *  - Elemental projectile barrages and dynamic damage scaling
 *  - Celebratory victory and level over on defeat, preparing for the next boss!
 */
window.G = window.G || {};
G.Parade = G.Parade || {};

G.Parade.BOSSES = [
  { dex: 110, name: 'Weezing',   title: 'WILD WEEZING',    icon: '☠️', scale: 1.4,  baseHp: 100, particleColor: '#9c27b0' },
  { dex: 24,  name: 'Arbok',     title: 'WILD ARBOK',      icon: '🐍', scale: 1.45, baseHp: 140, particleColor: '#7b1fa2' },
  { dex: 94,  name: 'Gengar',    title: 'SHADOW GENGAR',   icon: '👻', scale: 1.4,  baseHp: 180, particleColor: '#512da8' },
  { dex: 130, name: 'Gyarados',  title: 'RAGING GYARADOS', icon: '🌊', scale: 1.5,  baseHp: 220, particleColor: '#0288d1' },
  { dex: 248, name: 'Tyranitar', title: 'MIGHTY TYRANITAR',icon: '🌋', scale: 1.5, baseHp: 260, particleColor: '#8d6e63' },
  { dex: 149, name: 'Dragonite', title: 'WILD DRAGONITE',  icon: '🐲', scale: 1.45, baseHp: 300, particleColor: '#f57c00' },
  { dex: 384, name: 'Rayquaza',  title: 'SKY RAYQUAZA',    icon: '🐉', scale: 1.55, baseHp: 350, particleColor: '#2e7d32' },
  { dex: 150, name: 'Mewtwo',    title: 'LEGENDARY MEWTWO',icon: '🔮', scale: 1.5, baseHp: 400, particleColor: '#7e57c2' }
];

G.Parade.BossManager = class BossManager {
  constructor() {
    this.boss = null;
    this.active = false;
    this.defeated = false;
    this.bossLevel = 1;
    this.projectiles = [];
    this.banner = null;
    this.bannerTimer = 0;
    this.victoryTriggered = false;
    this.onVictoryCb = null;
  }

  reset() {
    this.boss = null;
    this.active = false;
    this.defeated = false;
    this.bossLevel = 1;
    this.projectiles = [];
    this.banner = null;
    this.bannerTimer = 0;
    this.victoryTriggered = false;
  }

  init(onVictory) {
    this.onVictoryCb = onVictory;
  }

  /**
   * Spawns the appropriate boss based on bossLevel (1, 2, 3...)
   */
  spawn(trainerX, trainerY, trainerAngle = 0, bossLevel = 1) {
    if (this.active) return;
    this.active = true;
    this.defeated = false;
    this.victoryTriggered = false;
    this.bossLevel = bossLevel;

    // Pick boss definition
    const bossIdx = (bossLevel - 1) % G.Parade.BOSSES.length;
    const loopNum = Math.floor((bossLevel - 1) / G.Parade.BOSSES.length);
    const def = G.Parade.BOSSES[bossIdx];
    const maxHp = def.baseHp + loopNum * 150;

    // Spawn ~135px ahead of James in open space
    const dist = 135;
    let bx = trainerX + Math.cos(trainerAngle) * dist;
    let by = trainerY + Math.sin(trainerAngle) * dist;
    bx = G.U.clamp(bx, -420, 420);
    by = G.U.clamp(by, -420, 420);

    this.boss = {
      dex: def.dex,
      name: def.name,
      title: def.title,
      icon: def.icon,
      particleColor: def.particleColor,
      x: bx,
      y: by,
      baseY: by,
      scale: def.scale,
      anim: new G.Sprites.Animator(def.dex, def.scale, false),
      hp: maxHp,
      maxHp: maxHp,
      state: 'battle', // 'battle', 'fainting', 'defeated'
      timer: 0,
      hurtTimer: 0,
      auraTimer: 0,
      faintTimer: 0
    };

    this.boss.anim.loop('Idle', 1.0);

    // Boss announcement
    this.banner = `⚠️ BOSS ${bossLevel}: ${def.title} APPEARED! ⚠️`;
    this.bannerTimer = 3.2;

    // Audio & screen shake
    if (G.Audio && G.Audio.sfx) {
      G.Audio.sfx('boss');
      G.Audio.sfx('surge');
    }
    if (G.Camera && G.Camera.kick) {
      G.Camera.kick(0.45);
    }
    if (G.Parade.FX) {
      G.Parade.FX.popText(bx, by - 46, `${def.icon} ${def.name.toUpperCase()}! ${def.icon}`, '#e53935');
    }
  }

  addProjectile(startX, startY, targetX, targetY, type = 'star', damage = 0.45) {
    this.projectiles.push({
      x: startX,
      y: startY,
      startX,
      startY,
      targetX,
      targetY,
      type,
      damage,
      progress: 0,
      speed: 3.4,
      color: type === 'electric' ? '#ffeb3b' :
             type === 'water' ? '#29b6f6' :
             type === 'fire' ? '#ff5722' :
             type === 'grass' ? '#4caf50' : '#ffd54f'
    });
  }

  update(dt, onVictory) {
    if (!this.active || !this.boss) return;

    const b = this.boss;
    b.timer += dt;

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner = null;
    }

    // 1. Elemental / aura particle emission
    b.auraTimer += dt;
    if (b.auraTimer > 0.15 && b.state !== 'defeated') {
      b.auraTimer = 0;
      if (G.Parade.FX) {
        const ox = G.U.rand(-26, 26);
        const oy = G.U.rand(-32, 12);
        G.Parade.FX.dust(b.x + ox, b.y + oy, b.particleColor);
      }
    }

    // 2. Fainting state
    if (b.state === 'fainting') {
      b.faintTimer += dt;
      b.anim.update(dt);

      if (Math.random() < 0.4 && G.Parade.FX) {
        G.Parade.FX.confetti(b.x + G.U.rand(-45, 45), b.y + G.U.rand(-45, 45), 6);
        G.Parade.FX.stars(b.x + G.U.rand(-35, 35), b.y + G.U.rand(-35, 35), 4);
      }

      if (b.faintTimer > 2.2 && !this.victoryTriggered) {
        this.victoryTriggered = true;
        b.state = 'defeated';
        this.active = false;
        this.defeated = true;
        const cb = onVictory || this.onVictoryCb;
        if (cb) {
          const nextGoal = (this.bossLevel + 1) * 50;
          cb(b.name, this.bossLevel, nextGoal);
        }
      }
      return;
    }

    // 3. Normal battle state
    // Gentle floating motion
    b.y = b.baseY + Math.sin(b.timer * 3) * 6;

    if (b.hurtTimer > 0) {
      b.hurtTimer -= dt;
      b.anim.loop('Hurt', 1.0);
    } else {
      b.anim.loop('Idle', 1.0);
    }
    b.anim.update(dt);

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.progress += dt * p.speed;
      p.x = G.U.lerp(p.startX, p.targetX, p.progress);
      p.y = G.U.lerp(p.startY, p.targetY, p.progress);

      if (p.progress >= 1) {
        this.projectiles.splice(i, 1);
        this.damageBoss(p.damage || 0.45);
      }
    }
  }

  damageBoss(amount) {
    if (!this.boss || this.boss.state !== 'battle') return;
    const b = this.boss;
    b.hp = Math.max(0, b.hp - amount);
    b.hurtTimer = 0.12;

    if (Math.random() < 0.12 && G.Audio && G.Audio.sfx) {
      G.Audio.sfx('hit');
    }

    if (Math.random() < 0.22 && G.Parade.FX) {
      G.Parade.FX.stars(b.x + G.U.rand(-18, 18), b.y - 14 + G.U.rand(-18, 18), 2);
    }

    if (b.hp <= 0) {
      b.state = 'fainting';
      b.faintTimer = 0;
      b.anim.loop('Faint', 0.8);

      if (G.Audio && G.Audio.sfx) {
        G.Audio.sfx('bossDown');
        G.Audio.sfx('shinyGet');
        G.Audio.sfx('legend');
      }
      if (G.Camera && G.Camera.kick) {
        G.Camera.kick(0.65);
      }
      if (G.Parade.FX) {
        G.Parade.FX.popText(b.x, b.y - 48, `💥 ${b.name.toUpperCase()} FAINTED! 💥`, '#ffeb3b');
        G.Parade.FX.confetti(b.x, b.y - 20, 50);
        G.Parade.FX.stars(b.x, b.y - 20, 30);
      }
    }
  }

  draw(ctx) {
    if (!this.boss || this.boss.state === 'defeated') return;
    const b = this.boss;

    // 1. Ground shadow
    G.Sprites.drawShadow(ctx, b.dex, b.x, b.y + 12, b.scale);

    // 2. Boss Sprite
    b.anim.draw(ctx, b.x, b.y);

    // 3. Projectiles
    for (const p of this.projectiles) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Boss Health Bar (only during battle)
    if (b.state === 'battle') {
      const barW = 84;
      const barH = 9;
      const barX = b.x - barW / 2;
      const barY = b.y - 50;

      // Dark shadow background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.roundRect(barX - 2, barY - 2, barW + 4, barH + 4, 4);
      ctx.fill();

      // HP fill
      const pct = G.U.clamp(b.hp / b.maxHp, 0, 1);
      ctx.fillStyle = pct > 0.4 ? '#43a047' : pct > 0.2 ? '#fbc02d' : '#e53935';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * pct, barH, 3);
      ctx.fill();

      // Boss Label with Level & Icon
      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(`${b.icon} ${b.name.toUpperCase()} (BOSS ${this.bossLevel})`, b.x, barY - 4);
    }
  }
};
