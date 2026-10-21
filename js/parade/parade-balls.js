/* ============ parade-balls.js — Poké Ball throwing and capture effects ============
 * Handles auto-throwing, manual throwing, parabolic ball trajectory,
 * ground shadow, capture wobble, star burst, and joining the parade.
 */
window.G = window.G || {};
G.Parade = G.Parade || {};

// Lightweight visual effects system for celebrations, sparkles, and step dust
G.Parade.FX = (() => {
  const particles = [];
  const texts = [];

  function spawn(p) {
    particles.push(p);
  }

  return {
    reset() {
      particles.length = 0;
      texts.length = 0;
    },

    dust(x, y, color = '#e8f5e9') {
      spawn({
        x, y,
        vx: G.U.rand(-12, 12),
        vy: G.U.rand(-6, -18),
        r: G.U.rand(2, 4),
        alpha: 0.7,
        decay: 1.8,
        color
      });
    },

    stars(x, y, count = 10) {
      const colors = ['#ffee58', '#ffd54f', '#ffca28', '#ffffff'];
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count + G.U.rand(-0.2, 0.2);
        const spd = G.U.rand(60, 140);
        spawn({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 30,
          r: G.U.rand(3, 5),
          star: true,
          alpha: 1,
          decay: 1.4,
          color: G.U.pick(colors)
        });
      }
    },

    confetti(x, y, count = 18) {
      const colors = ['#ff5252', '#ff4081', '#e040fb', '#7c4dff', '#536dfe', '#40c4ff', '#18ffff', '#64ffda', '#69f0ae', '#b2ff59', '#eeff41', '#ffff00', '#ffd740', '#ff6e40'];
      for (let i = 0; i < count; i++) {
        spawn({
          x, y,
          vx: G.U.rand(-140, 140),
          vy: G.U.rand(-160, -50),
          w: G.U.rand(4, 7),
          h: G.U.rand(4, 7),
          rot: G.U.rand(0, 6.28),
          rotSpd: G.U.rand(-12, 12),
          alpha: 1,
          decay: 0.8,
          gravity: 280,
          color: G.U.pick(colors)
        });
      }
    },

    popText(x, y, text, color = '#ffffff') {
      texts.push({
        x, y,
        text,
        color,
        vy: -35,
        alpha: 1,
        life: 0.9
      });
    },

    update(dt) {
      // Update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.gravity) p.vy += p.gravity * dt;
        if (p.rotSpd) p.rot += p.rotSpd * dt;
        p.alpha -= p.decay * dt;
        if (p.alpha <= 0) particles.splice(i, 1);
      }
      // Update floating texts
      for (let i = texts.length - 1; i >= 0; i--) {
        const t = texts[i];
        t.y += t.vy * dt;
        t.life -= dt;
        if (t.life < 0.3) t.alpha = t.life / 0.3;
        if (t.life <= 0) texts.splice(i, 1);
      }
    },

    draw(ctx) {
      // Draw particles
      for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        if (p.star) {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.w) {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot || 0);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Draw floating texts
      if (texts.length) {
        ctx.save();
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        for (const t of texts) {
          ctx.globalAlpha = Math.max(0, t.alpha);
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          ctx.strokeText(t.text, t.x, t.y);
          ctx.fillStyle = t.color;
          ctx.fillText(t.text, t.x, t.y);
        }
        ctx.restore();
      }
    }
  };
})();

// Active Poké Ball projectile & capture animation
G.Parade.FlyingBall = class FlyingBall {
  constructor(startX, startY, targetMon, optTargetX = null, optTargetY = null) {
    this.startX = startX;
    this.startY = startY;
    this.targetMon = targetMon;
    this.targetX = targetMon ? targetMon.x : optTargetX;
    this.targetY = targetMon ? targetMon.y : optTargetY;

    if (this.targetMon) {
      this.targetMon.targeted = true;
    }

    this.t = 0;
    this.duration = 0.42; // Flight time in seconds
    this.maxHeight = 38;
    this.angle = 0;
    this.rotSpeed = 18;

    this.x = startX;
    this.y = startY;
    this.groundY = startY;

    // States: 'flying', 'wobbling', 'done'
    this.state = 'flying';
    this.wobbleTimer = 0;
    this.wobbleCount = 0;
    this.done = false;
  }

  update(dt, onCaptured) {
    if (this.done) return;

    if (this.state === 'flying') {
      this.t += dt / this.duration;
      this.angle += this.rotSpeed * dt;

      // Track target if moving slightly
      if (this.targetMon && !this.targetMon.captured) {
        this.targetX = this.targetMon.x;
        this.targetY = this.targetMon.y;
      }

      const p = Math.min(1, this.t);
      this.x = G.U.lerp(this.startX, this.targetX, p);
      this.groundY = G.U.lerp(this.startY, this.targetY, p);
      // Parabolic arc: 4 * H * p * (1 - p)
      const arcH = 4 * this.maxHeight * p * (1 - p);
      this.y = this.groundY - arcH;

      if (this.t >= 1) {
        // Impact!
        this.state = 'wobbling';
        this.wobbleTimer = 0;
        this.y = this.groundY;
        if (G.Audio && G.Audio.sfx) G.Audio.sfx('ball');
        G.Parade.FX.stars(this.x, this.y, 6);

        if (this.targetMon) {
          this.targetMon.captured = true;
        }
      }
    } else if (this.state === 'wobbling') {
      this.wobbleTimer += dt;
      // Wobble left, then right, then click!
      if (this.wobbleTimer < 0.16) {
        this.angle = Math.sin(this.wobbleTimer * 28) * 0.45;
      } else if (this.wobbleTimer < 0.32) {
        this.angle = Math.sin((this.wobbleTimer - 0.16) * 28) * 0.35;
      } else {
        // Successful capture!
        this.angle = 0;
        this.state = 'done';
        this.done = true;

        if (G.Audio && G.Audio.sfx) {
          G.Audio.sfx('confirm');
          G.Audio.sfx('shinyGet');
        }

        G.Parade.FX.stars(this.x, this.y, 14);
        G.Parade.FX.confetti(this.x, this.y, 8);

        if (this.targetMon) {
          G.Parade.FX.popText(this.x, this.y - 18, `Got ${this.targetMon.name}! ✨`, '#ffd54f');
          onCaptured(this.targetMon.dex, this.x, this.y, this.targetMon.shiny);
        }
      }
    }
  }

  draw(ctx) {
    if (this.done) return;

    // Ground shadow
    const shadowR = Math.max(3, 7 - (this.groundY - this.y) * 0.1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.groundY, shadowR, shadowR * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Poké Ball
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const r = 6;
    // Outer black border
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(0, 0, r + 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Top red half
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, 0);
    ctx.fill();

    // Bottom white half
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI);
    ctx.fill();

    // Black center equator band
    ctx.fillStyle = '#212121';
    ctx.fillRect(-r, -1, r * 2, 2);

    // Center button
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 1.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
};

G.Parade.BallManager = class BallManager {
  constructor() {
    this.balls = [];
    this.autoThrowCooldown = 1.3;
    this.cooldownTimer = 0.5;
  }

  reset() {
    this.balls = [];
    this.cooldownTimer = 0.5;
  }

  update(dt, trainer, wildManager, onCaptured) {
    this.cooldownTimer -= dt;

    // Auto-throw logic: if cooldown ready, throw at closest uncaught Pokémon
    if (this.cooldownTimer <= 0 && !trainer.cheering) {
      const nearest = wildManager.findNearestUncaught(trainer.x, trainer.y, 230);
      if (nearest) {
        this.throwBall(trainer, nearest);
        this.cooldownTimer = this.autoThrowCooldown;
      }
    }

    // Update active flying/wobbling balls
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.update(dt, onCaptured);
      if (b.done) {
        this.balls.splice(i, 1);
      }
    }
  }

  manualThrow(trainer, wildManager) {
    if (trainer.cheering) return false;
    // Find nearest or throw in facing direction
    let target = wildManager.findNearestUncaught(trainer.x, trainer.y, 280);
    if (target) {
      this.throwBall(trainer, target);
      this.cooldownTimer = this.autoThrowCooldown;
      return true;
    } else {
      // Throw in facing direction
      const dist = 140;
      const targetX = trainer.x + Math.cos(trainer.moveAngle) * dist;
      const targetY = trainer.y + Math.sin(trainer.moveAngle) * dist;
      trainer.triggerThrow();
      const ball = new G.Parade.FlyingBall(trainer.x, trainer.y - 14, null, targetX, targetY);
      this.balls.push(ball);
      this.cooldownTimer = this.autoThrowCooldown;
      return true;
    }
  }

  throwBall(trainer, targetMon) {
    trainer.triggerThrow();
    const ball = new G.Parade.FlyingBall(trainer.x, trainer.y - 14, targetMon);
    this.balls.push(ball);
  }

  draw(ctx) {
    for (const b of this.balls) {
      b.draw(ctx);
    }
  }
};
