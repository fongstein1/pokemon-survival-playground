/* ============ parade-path.js — path-history sampling for the parade ============
 * Samples the exact recent trail of James the trainer.
 * Key properties:
 *  - Arc-length parameterization ensures uniform, smooth spacing between followers.
 *  - Followers follow the exact ground curve rather than cutting corners or clustering.
 *  - Amortized O(1) sampling queries with binary search fallback.
 *  - Bounded memory footprint (retains just enough trail for 60+ followers).
 */
window.G = window.G || {};
G.Parade = G.Parade || {};

G.Parade.PathTrail = class PathTrail {
  constructor(initialX = 0, initialY = 0) {
    this.points = [];
    this.totalDist = 0;
    this.minStep = 2.5; // Record point every 2.5 world pixels
    this.reset(initialX, initialY);
  }

  reset(x, y) {
    this.points = [
      { x, y, angle: Math.PI / 2, dist: 0 }
    ];
    this.totalDist = 0;
  }

  update(leaderX, leaderY, leaderAngle = Math.PI / 2) {
    if (!this.points.length) {
      this.reset(leaderX, leaderY);
      return;
    }

    const last = this.points[this.points.length - 1];
    const dx = leaderX - last.x;
    const dy = leaderY - last.y;
    const d = Math.hypot(dx, dy);

    if (d >= this.minStep) {
      const segAngle = Math.atan2(dy, dx);
      this.totalDist += d;
      this.points.push({
        x: leaderX,
        y: leaderY,
        angle: segAngle,
        dist: this.totalDist
      });

      // Memory cleanup: keep up to 2500 units of trail behind current distance
      const keepDist = this.totalDist - 2200;
      if (this.points.length > 1200 && this.points[0].dist < keepDist) {
        // Find cut index
        let cut = 0;
        while (cut < this.points.length - 100 && this.points[cut + 1].dist < keepDist) {
          cut++;
        }
        if (cut > 0) {
          this.points.splice(0, cut);
        }
      }
    }
  }

  /**
   * Sample position and tangent angle at a given distance behind the leader.
   * @param {number} distBehind - Positive distance behind leader (e.g. 28, 56, ...)
   * @returns {{ x: number, y: number, angle: number }}
   */
  sample(distBehind) {
    if (!this.points.length) {
      return { x: 0, y: 0, angle: Math.PI / 2 };
    }
    if (this.points.length === 1 || distBehind <= 0) {
      const last = this.points[this.points.length - 1];
      return { x: last.x, y: last.y, angle: last.angle };
    }

    const targetDist = this.totalDist - distBehind;
    const first = this.points[0];
    if (targetDist <= first.dist) {
      return { x: first.x, y: first.y, angle: first.angle };
    }

    // Binary search for segment where points[lo].dist <= targetDist <= points[hi].dist
    let lo = 0;
    let hi = this.points.length - 1;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.points[mid].dist < targetDist) {
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    const idx0 = Math.max(0, lo - 1);
    const idx1 = Math.min(this.points.length - 1, idx0 + 1);

    const p0 = this.points[idx0];
    const p1 = this.points[idx1];

    if (idx0 === idx1 || p1.dist === p0.dist) {
      return { x: p0.x, y: p0.y, angle: p0.angle };
    }

    const t = G.U.clamp((targetDist - p0.dist) / (p1.dist - p0.dist), 0, 1);
    const x = p0.x + (p1.x - p0.x) * t;
    const y = p0.y + (p1.y - p0.y) * t;

    // Smooth angle interpolation
    let a0 = p0.angle;
    let a1 = p1.angle;
    // Normalize angular difference
    let diff = (a1 - a0) % (Math.PI * 2);
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > Math.PI) diff -= Math.PI * 2;
    const angle = a0 + diff * t;

    return { x, y, angle };
  }
};
