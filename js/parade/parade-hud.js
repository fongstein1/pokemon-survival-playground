/* ============ parade-hud.js — simple, icon-driven HUD and Celebration UI ============
 * Child-friendly interface designed for a 5-year-old:
 *  - Big Poké Ball count badge: X / 10
 *  - Subtle animated compass indicator pointing to Pokémon Center once 10 are caught
 *  - Touch Throw button (big friendly Poké Ball)
 *  - Touch Whistle / Recall button
 *  - Pause modal
 *  - Grand Celebration banner & Replay controls
 */
window.G = window.G || {};
G.Parade = G.Parade || {};

G.Parade.HUD = (() => {
  let celebrationActive = false;
  let onReplayCb = null;
  let onKeepPlayingCb = null;

  return {
    init(onReplay, onKeepPlaying) {
      onReplayCb = onReplay;
      onKeepPlayingCb = onKeepPlaying;
    },

    setCelebration(active) {
      celebrationActive = active;
      const el = document.getElementById('parade-celebrate');
      if (el) {
        if (active) el.classList.remove('hidden');
        else el.classList.add('hidden');
      }
    },

    draw(ctx, count, targetCount, trainerX, trainerY, isPaused) {
      const cw = ctx.canvas.width;
      const ch = ctx.canvas.height;
      const dpr = window.devicePixelRatio || 1;

      ctx.save();
      // Reset transform to draw in screen space
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sw = cw / dpr;
      const sh = ch / dpr;

      // 1. Top Caught Badge: [Poké Ball Icon] X / 10
      const badgeW = 150;
      const badgeH = 46;
      const badgeX = 16;
      const badgeY = 16;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 23);
      ctx.fill();

      ctx.strokeStyle = count >= targetCount ? '#43a047' : '#e53935';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Mini Poké Ball icon
      const ix = badgeX + 24;
      const iy = badgeY + 23;
      const ir = 14;

      ctx.fillStyle = '#212121';
      ctx.beginPath(); ctx.arc(ix, iy, ir + 1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e53935';
      ctx.beginPath(); ctx.arc(ix, iy, ir, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ix, iy, ir, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#212121';
      ctx.fillRect(ix - ir, iy - 1.5, ir * 2, 3);
      ctx.beginPath(); ctx.arc(ix, iy, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ix, iy, 2.5, 0, Math.PI * 2); ctx.fill();

      // Text counter
      ctx.font = 'bold 20px "Pixelify", sans-serif';
      ctx.fillStyle = '#212121';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const text = `${count} / ${targetCount}`;
      ctx.fillText(text, badgeX + 48, badgeY + 23);

      if (count >= targetCount) {
        ctx.fillStyle = '#ffb300';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('⭐', badgeX + badgeW - 28, badgeY + 23);
      }

      // 2. Center Indicator (compass) once 10 Pokémon are caught
      if (count >= targetCount && !celebrationActive) {
        const centerWorldX = 0;
        const centerWorldY = 20;
        const dx = centerWorldX - trainerX;
        const dy = centerWorldY - trainerY;
        const dist = Math.hypot(dx, dy);

        // Only show if not already standing in the Plaza
        if (dist > 90) {
          const angle = Math.atan2(dy, dx);
          // Draw compass badge at bottom-center of screen
          const compassX = sw / 2;
          const compassY = 40;

          ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
          ctx.beginPath();
          ctx.roundRect(compassX - 110, compassY - 18, 220, 36, 18);
          ctx.fill();

          ctx.strokeStyle = '#e53935';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Hospital / Center icon
          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🏥 Pokémon Center', compassX - 20, compassY);

          // Animated pointing arrow
          ctx.save();
          ctx.translate(compassX + 80, compassY);
          ctx.rotate(angle);
          ctx.fillStyle = '#e53935';
          ctx.beginPath();
          ctx.moveTo(10, 0);
          ctx.lineTo(-6, -6);
          ctx.lineTo(-3, 0);
          ctx.lineTo(-6, 6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      ctx.restore();
    }
  };
})();
