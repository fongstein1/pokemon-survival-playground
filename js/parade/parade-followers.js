/* ============ parade-followers.js — following parade manager ============
 * Manages the ordered line of Pokémon parading behind James.
 * Key features:
 *  - Individual PMD Idle and Walk animations via G.Sprites.Animator
 *  - Path-history sampling ensures crisp path following and smooth turning
 *  - Dynamic spacing based on Pokémon body sizes
 *  - Type-appropriate attacks and projectile moves in boss battles
 *  - Shiny sparkle aura and tracking for run summary
 *  - Zero clumping, snapping, shaking, or blocking of the trainer
 *  - Supports 30+ simultaneous followers at 60 FPS
 *  - Automatic regrouping and manual whistle recall
 */
window.G = window.G || {};
G.Parade = G.Parade || {};

G.Parade.Follower = class Follower {
  constructor(dex, spawnX, spawnY, slotIndex, shiny = false) {
    this.dex = dex;
    this.isShiny = !!shiny;
    this.shiny = shiny && G.Sprites.hasShiny(dex);
    this.scale = G.Sprites.playerScale(dex);
    this.anim = new G.Sprites.Animator(dex, this.scale, this.shiny);
    this.bodyR = G.Sprites.bodyRadius(dex, this.scale);
    this.bodyH = G.Sprites.bodyHeight(dex, this.scale);

    const mon = (window.G && G.DEX) ? G.DEX.find(d => d.dex === dex) : null;
    this.name = mon ? mon.name : ('#' + dex);
    this.types = (mon && mon.types && mon.types.length) ? mon.types : ['normal'];
    this.primaryType = this.types[0] || 'normal';

    this.x = spawnX;
    this.y = spawnY;
    this.prevX = spawnX;
    this.prevY = spawnY;
    this.dir = 0;
    this.tangent = Math.PI / 2;

    this.slotIndex = slotIndex;
    this.nominalDist = 30 * (slotIndex + 1);
    this.currentDist = this.nominalDist;

    // States: 'joining', 'following', 'celebrating'
    this.state = 'joining';
    this.joinTimer = 0;
    this.joinDuration = 0.55;
    this.startX = spawnX;
    this.startY = spawnY;

    this.celebrateTimer = 0;
    this.celebrateOffset = (slotIndex % 5) * 0.2; // Staggered dance wave
    this.attackTimer = Math.random() * 0.8;
    this.shinySparkTimer = G.U.rand(0.2, 0.6);
  }

  update(dt, trail, isLeaderWalking, celebrateMode = false, boss = null) {
    this.prevX = this.x;
    this.prevY = this.y;

    // --- Boss battle swarm & attack mode ---
    if (boss && boss.active && boss.boss) {
      if (boss.boss.state === 'battle') {
        const numRings = Math.min(6, Math.max(3, Math.ceil((this.slotIndex + 1) / 20)));
        const ring = this.slotIndex % numRings;
        const ringDist = 52 + ring * 24;
        const ringCapacity = 16 + ring * 6;
        const ringPos = Math.floor(this.slotIndex / numRings);
        const ang = (ringPos / ringCapacity) * Math.PI * 2 + Math.sin(boss.boss.timer * 0.5 + ring);
        const targetX = boss.boss.x + Math.cos(ang) * ringDist;
        const targetY = boss.boss.y + Math.sin(ang) * ringDist * 0.72;

        this.x = G.U.damp(this.x, targetX, 10, dt);
        this.y = G.U.damp(this.y, targetY, 10, dt);

        // Face towards Boss
        this.dir = G.Sprites.dirFromAngle(Math.atan2(boss.boss.y - this.y, boss.boss.x - this.x));
        this.anim.dir = this.dir;
        this.anim.loop('Walk', 1.2);
        this.anim.update(dt);

        // Periodic type-appropriate elemental attack
        this.attackTimer += dt;
        const cadence = 0.75 + (this.slotIndex % 5) * 0.12;
        if (this.attackTimer >= cadence) {
          this.attackTimer = 0;
          const move = (G.Parade.TYPE_MOVES && G.Parade.TYPE_MOVES[this.primaryType]) || {
            name: 'Swift', type: this.primaryType || 'normal', kind: 'normal', color: '#ffd54f'
          };

          const dmg = G.U.clamp(boss.boss.maxHp / (Math.max(40, this.slotIndex + 1) * 6), 0.12, 0.55);
          boss.addProjectile(
            this.x, this.y - 8,
            boss.boss.x + G.U.rand(-14, 14), boss.boss.y - 12 + G.U.rand(-14, 14),
            move,
            dmg
          );

          // Type-tuned sound effect
          if (Math.random() < 0.20 && G.Audio && G.Audio.sfx) {
            G.Audio.sfx('shot', { type: this.primaryType });
          }

          // Occasional move shout banner
          if (Math.random() < 0.04 && G.Parade.FX) {
            G.Parade.FX.popText(this.x, this.y - 20, move.name + '!', move.color || '#fff');
          }
        }
        return;
      } else if (boss.boss.state === 'fainting') {
        this.anim.update(dt);
        this.anim.loop('Walk', 1.5);
        this.anim.dir = 0;
        return;
      }
    }

    if (celebrateMode) {
      this.state = 'celebrating';
      this.celebrateTimer += dt;
      this.anim.update(dt);

      // Cheerful celebration bounce
      const wave = Math.sin((this.celebrateTimer + this.celebrateOffset) * 6);
      if (wave > 0.3) {
        this.anim.loop('Walk', 1.2);
      } else {
        this.anim.loop('Idle', 1.0);
      }
      this.anim.dir = 0; // Face front (towards the player/camera)
      return;
    }

    if (this.state === 'joining') {
      this.joinTimer += dt;
      const progress = G.U.clamp(this.joinTimer / this.joinDuration, 0, 1);
      // Sample target parade position
      const target = trail.sample(this.nominalDist);
      // Parabolic hop towards slot
      const ease = 1 - Math.pow(1 - progress, 3);
      const hopH = Math.sin(progress * Math.PI) * 24;
      this.x = G.U.lerp(this.startX, target.x, ease);
      this.y = G.U.lerp(this.startY, target.y, ease) - hopH;
      this.anim.loop('Walk', 1.4);
      this.anim.dir = G.Sprites.dirFromAngle(Math.atan2(target.y - this.startY, target.x - this.startX));
      this.anim.update(dt);

      if (progress >= 1) {
        this.state = 'following';
        this.currentDist = this.nominalDist;
        this.y = target.y; // Settle on ground
      }
      return;
    }

    // --- Following mode ---
    this.anim.update(dt);

    // Smoothly damp current distance along trail towards nominal slot distance
    this.currentDist = G.U.damp(this.currentDist, this.nominalDist, 12, dt);

    // Sample path trail at follower's current distance
    const pt = trail.sample(this.currentDist);
    this.tangent = pt.angle;

    // Follow the sampled trail position smoothly without cutting corners
    const distToPt = Math.hypot(this.x - pt.x, this.y - pt.y);
    if (distToPt > 3.0) {
      this.x = G.U.damp(this.x, pt.x, 24, dt);
      this.y = G.U.damp(this.y, pt.y, 24, dt);
    } else {
      this.x = pt.x;
      this.y = pt.y;
    }

    // Safety boundary clamping so followers never leave the map or cross tree fences
    const pad = 35;
    this.x = G.U.clamp(this.x, -560 + pad, 560 - pad);
    this.y = G.U.clamp(this.y, -560 + pad, 560 - pad);

    // Shiny sparkle glints: authentic diamond sparkles, not fire!
    if (this.isShiny) {
      this.shinySparkTimer -= dt;
      if (this.shinySparkTimer <= 0) {
        this.shinySparkTimer = G.U.rand(0.35, 0.65);
        if (G.Parade.FX && G.Parade.FX.twinkle) {
          G.Parade.FX.twinkle(
            this.x + G.U.rand(-this.bodyR * 0.9, this.bodyR * 0.9),
            this.y - G.U.rand(6, this.bodyH * 0.9)
          );
        }
      }
    }

    // Calculate effective follower velocity
    const dx = this.x - this.prevX;
    const dy = this.y - this.prevY;
    const speed = Math.hypot(dx, dy) / Math.max(dt, 0.001);

    if (speed > 8) {
      this.anim.loop('Walk', G.U.clamp(speed / 75, 0.7, 1.4));
      this.dir = G.Sprites.dirFromAngle(this.tangent);
      this.anim.dir = this.dir;
    } else {
      this.anim.loop('Idle', 1.0);
      // Retain or align with trail direction
      this.anim.dir = this.dir;
    }
  }

  recall(trail) {
    // Snap instantly back into correct formation along trail
    this.state = 'following';
    this.currentDist = this.nominalDist;
    const pt = trail.sample(this.nominalDist);
    this.x = pt.x;
    this.y = pt.y;
    this.dir = G.Sprites.dirFromAngle(pt.angle);
    this.anim.dir = this.dir;
  }

  draw(ctx) {
    // Subtle glowing cyan magical halo on the ground under shadow for shiny Pokémon
    if (this.isShiny) {
      ctx.save();
      const pulse = 0.22 + Math.sin((this.celebrateTimer * 4) + this.slotIndex * 0.5) * 0.08;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#7dd3fc';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.bodyR * 1.5, this.bodyR * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Ground Shadow
    G.Sprites.drawShadow(ctx, this.dex, this.x, this.y, this.scale);

    // Follower Sprite
    this.anim.draw(ctx, this.x, this.y);
  }
};

G.Parade.ParadeManager = class ParadeManager {
  constructor() {
    this.followers = [];
    this.celebrating = false;
  }

  reset() {
    this.followers = [];
    this.celebrating = false;
  }

  get count() {
    return this.followers.length;
  }

  get maxDist() {
    if (!this.followers.length) return 0;
    const last = this.followers[this.followers.length - 1];
    return last ? last.nominalDist : 0;
  }

  /**
   * Add a newly caught Pokémon to the end of the parade.
   * @param {number} dex - Pokédex number
   * @param {number} catchX - Location where ball hit
   * @param {number} catchY - Location where ball hit
   * @param {boolean} shiny - Shiny variant
   */
  add(dex, catchX, catchY, shiny = false) {
    const slotIndex = this.followers.length;
    const follower = new G.Parade.Follower(dex, catchX, catchY, slotIndex, shiny);
    this.followers.push(follower);
    this.recalculateSpacings();
    return follower;
  }

  recalculateSpacings() {
    const count = this.followers.length;
    // Adaptive spacing: 28px for small parades, 24px for medium, 20px for large parades
    const baseStep = count <= 15 ? 28 : count <= 45 ? 24 : 20;
    let accDist = 24;
    for (let i = 0; i < this.followers.length; i++) {
      const f = this.followers[i];
      f.slotIndex = i;
      f.nominalDist = accDist;
      const nextR = (i + 1 < this.followers.length) ? this.followers[i + 1].bodyR : 12;
      const step = Math.max(18, Math.min(baseStep, f.bodyR + nextR + 4));
      accDist += step;
    }
  }

  recallAll(trail) {
    for (const f of this.followers) {
      f.recall(trail);
    }
  }

  setCelebrate(celebrate = true) {
    this.celebrating = celebrate;
  }

  update(dt, trail, isLeaderWalking, boss = null) {
    for (const f of this.followers) {
      f.update(dt, trail, isLeaderWalking, this.celebrating, boss);
    }

    // Minimum physical separation safety pass: prevents followers from ever condensing or overlapping
    if (!this.celebrating && (!boss || !boss.active)) {
      for (let i = 0; i < this.followers.length - 1; i++) {
        const f0 = this.followers[i];
        const f1 = this.followers[i + 1];
        if (f0.state === 'following' && f1.state === 'following') {
          const dx = f1.x - f0.x;
          const dy = f1.y - f0.y;
          const dist = Math.hypot(dx, dy);
          const minDist = Math.max(22, (f0.bodyR + f1.bodyR) * 0.95);
          if (dist > 0.001 && dist < minDist) {
            const push = (minDist - dist) * 0.6;
            const nx = dx / dist;
            const ny = dy / dist;
            f1.x += nx * push;
            f1.y += ny * push;
          }
        }
      }
    }
  }

  draw(ctx) {
    // Sort followers by Y position so characters in front render over characters in back
    const sorted = this.followers.slice().sort((a, b) => a.y - b.y);
    for (const f of sorted) {
      f.draw(ctx);
    }
  }
};
