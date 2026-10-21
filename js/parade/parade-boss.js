/* ============ parade-boss.js — Weezing Boss Battle Encounter ============
 * Climax boss battle for "James and the Pokémon Parade":
 *  - Triggered when the parade reaches 50 Pokémon
 *  - Wild Weezing (Dex 110) appears with ominous poison gas and boss fanfare
 *  - All 50 Pokémon in the parade break formation and form an attacking swarm
 *  - Followers barrage Weezing with elemental projectiles and tackles
 *  - Weezing takes damage, shows HP bar, and faints with celebratory fanfare
 *  - Level is over: user wins the game!
 */
window.G = window.G || {};
G.Parade = G.Parade || {};

G.Parade.BossManager = class BossManager {
  constructor() {
    this.boss = null;
    this.active = false;
    this.defeated = false;
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
    this.projectiles = [];
    this.banner = null;
    this.bannerTimer = 0;
    this.victoryTriggered = false;
  }

  init(onVictory) {
    this.onVictoryCb = onVictory;
  }

  /**
   * Spawns Weezing boss in front of James
   */
  spawn(trainerX, trainerY, trainerAngle = 0) {
    if (this.active || this.defeated) return;
    this.active = true;
    this.defeated = false;
    this.victoryTriggered = false;

    // Spawn ~130px ahead of James in open space
    const dist = 130;
    let bx = trainerX + Math.cos(trainerAngle) * dist;
    let by = trainerY + Math.sin(trainerAngle) * dist;
    bx = G.U.clamp(bx, -420, 420);
    by = G.U.clamp(by, -420, 420);

    this.boss = {
      dex: 110,
      x: bx,
      y: by,
      baseY: by,
      scale: 1.4, // Big boss scale
      anim: new G.Sprites.Animator(110, 1.4, false),
      hp: 100,
      maxHp: 100,
      state: 'battle', // 'battle', 'fainting', 'defeated'
      timer: 0,
      hurtTimer: 0,
      smokeTimer: 0,
      faintTimer: 0
    };

    this.boss.anim.loop('Idle', 1.0);

    // Boss announcement
    this.banner = '⚠️ WILD WEEZING APPEARED! ⚠️';
    this.bannerTimer = 3.0;

    // Fanfare and rumble
    if (G.Audio && G.Audio.sfx) {
      G.Audio.sfx('boss');
      G.Audio.sfx('surge');
    }
    if (G.Camera && G.Camera.kick) {
      G.Camera.kick(0.4);
    }
    if (G.Parade.FX) {
      G.Parade.FX.popText(bx, by - 44, '☠️ WEEZING! ☠️', '#e53935');
    }
  }

  addProjectile(startX, startY, targetX, targetY, type = 'star') {
    this.projectiles.push({
      x: startX,
      y: startY,
      startX,
      startY,
      targetX,
      targetY,
      type,
      progress: 0,
      speed: 3.4, // Fast travel time (~0.3s)
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

    // 1. Poison smoke puffs from Weezing
    b.smokeTimer += dt;
    if (b.smokeTimer > 0.16 && b.state !== 'defeated') {
      b.smokeTimer = 0;
      if (G.Parade.FX) {
        const ox = G.U.rand(-26, 26);
        const oy = G.U.rand(-32, 10);
        G.Parade.FX.dust(b.x + ox, b.y + oy, Math.random() < 0.5 ? '#9c27b0' : '#7b1fa2');
      }
    }

    // 2. Fainting state
    if (b.state === 'fainting') {
      b.faintTimer += dt;
      b.anim.update(dt);

      if (Math.random() < 0.35 && G.Parade.FX) {
        G.Parade.FX.confetti(b.x + G.U.rand(-40, 40), b.y + G.U.rand(-40, 40), 6);
        G.Parade.FX.stars(b.x + G.U.rand(-30, 30), b.y + G.U.rand(-30, 30), 4);
      }

      if (b.faintTimer > 2.2 && !this.victoryTriggered) {
        this.victoryTriggered = true;
        b.state = 'defeated';
        this.active = false;
        this.defeated = true;
        const cb = onVictory || this.onVictoryCb;
        if (cb) cb();
      }
      return;
    }

    // 3. Normal battle state
    // Floating sinusoidal bob
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
        this.damageBoss(0.45);
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
      G.Parade.FX.stars(b.x + G.U.rand(-16, 16), b.y - 14 + G.U.rand(-16, 16), 2);
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
        G.Camera.kick(0.6);
      }
      if (G.Parade.FX) {
        G.Parade.FX.popText(b.x, b.y - 45, '💥 WEEZING FAINTED! 💥', '#ffeb3b');
        G.Parade.FX.confetti(b.x, b.y - 20, 45);
        G.Parade.FX.stars(b.x, b.y - 20, 25);
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
      const barW = 76;
      const barH = 8;
      const barX = b.x - barW / 2;
      const barY = b.y - 48;

      // Dark background container
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.beginPath();
      ctx.roundRect(barX - 2, barY - 2, barW + 4, barH + 4, 4);
      ctx.fill();

      // HP fill
      const pct = G.U.clamp(b.hp / b.maxHp, 0, 1);
      ctx.fillStyle = pct > 0.4 ? '#43a047' : pct > 0.2 ? '#fbc02d' : '#e53935';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * pct, barH, 3);
      ctx.fill();

      // Boss Label
      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('☠️ WEEZING', b.x, barY - 4);
    }
  }
};
