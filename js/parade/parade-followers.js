/* ============ parade-followers.js — following parade manager ============
 * Manages the ordered line of Pokémon parading behind James.
 * Key features:
 *  - Individual PMD Idle and Walk animations via G.Sprites.Animator
 *  - Path-history sampling ensures crisp path following and smooth turning
 *  - Dynamic spacing based on Pokémon body sizes
 *  - Zero clumping, snapping, shaking, or blocking of the trainer
 *  - Supports 30+ simultaneous followers at 60 FPS
 *  - Automatic regrouping and manual whistle recall
 */
window.G = window.G || {};
G.Parade = G.Parade || {};

G.Parade.Follower = class Follower {
  constructor(dex, spawnX, spawnY, slotIndex, shiny = false) {
    this.dex = dex;
    this.shiny = shiny && G.Sprites.hasShiny(dex);
    this.scale = G.Sprites.playerScale(dex);
    this.anim = new G.Sprites.Animator(dex, this.scale, this.shiny);
    this.bodyR = G.Sprites.bodyRadius(dex, this.scale);
    this.bodyH = G.Sprites.bodyHeight(dex, this.scale);

    const mon = G.DEX.find(d => d.dex === dex);
    this.name = mon ? mon.name : ('#' + dex);

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
  }

  update(dt, trail, isLeaderWalking, celebrateMode = false, boss = null) {
    this.prevX = this.x;
    this.prevY = this.y;

    // --- Boss battle swarm & attack mode ---
    if (boss && boss.active && boss.boss) {
      if (boss.boss.state === 'battle') {
        const ring = this.slotIndex % 3;
        const ringDist = 58 + ring * 28;
        const total = Math.max(30, trail ? 50 : 30);
        const ang = (this.slotIndex / total) * Math.PI * 2 + Math.sin(boss.boss.timer * 0.5 + ring);
        const targetX = boss.boss.x + Math.cos(ang) * ringDist;
        const targetY = boss.boss.y + Math.sin(ang) * ringDist * 0.72;

        this.x = G.U.damp(this.x, targetX, 10, dt);
        this.y = G.U.damp(this.y, targetY, 10, dt);

        // Face towards Weezing
        this.dir = G.Sprites.dirFromAngle(Math.atan2(boss.boss.y - this.y, boss.boss.x - this.x));
        this.anim.dir = this.dir;
        this.anim.loop('Walk', 1.2);
        this.anim.update(dt);

        // Periodic elemental attack
        this.attackTimer += dt;
        const cadence = 0.75 + (this.slotIndex % 5) * 0.12;
        if (this.attackTimer >= cadence) {
          this.attackTimer = 0;
          let type = 'star';
          if ([25, 921].includes(this.dex)) type = 'electric';
          else if ([7, 363, 183, 194, 258, 60].includes(this.dex)) type = 'water';
          else if ([4, 255, 37].includes(this.dex)) type = 'fire';
          else if ([1, 722].includes(this.dex)) type = 'grass';
          boss.addProjectile(
            this.x, this.y - 8,
            boss.boss.x + G.U.rand(-12, 12), boss.boss.y - 12 + G.U.rand(-12, 12),
            type
          );
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
    this.currentDist = G.U.damp(this.currentDist, this.nominalDist, 10, dt);

    // Sample path trail at follower's current distance
    const pt = trail.sample(this.currentDist);
    this.tangent = pt.angle;

    // Smoothly interpolate follower position towards sampled trail position
    this.x = G.U.damp(this.x, pt.x, 16, dt);
    this.y = G.U.damp(this.y, pt.y, 16, dt);

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
    // Shadow
    G.Sprites.drawShadow(ctx, this.dex, this.x, this.y, this.scale);
    // Sprite
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
    let accDist = 28; // Distance behind James for 1st follower
    for (let i = 0; i < this.followers.length; i++) {
      const f = this.followers[i];
      f.slotIndex = i;
      f.nominalDist = accDist;
      // Add padding for next follower according to body radius
      const nextR = (i + 1 < this.followers.length) ? this.followers[i + 1].bodyR : 12;
      const step = Math.max(26, f.bodyR + nextR + 8);
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
  }

  draw(ctx) {
    // Sort followers by Y position so characters in front render over characters in back
    const sorted = this.followers.slice().sort((a, b) => a.y - b.y);
    for (const f of sorted) {
      f.draw(ctx);
    }
  }
};
