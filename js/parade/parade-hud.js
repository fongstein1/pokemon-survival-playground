/* ============ parade-hud.js — simple, icon-driven HUD and Celebration UI ============
 * Child-friendly interface designed for a 5-year-old:
 *  - Big Poké Ball count badge: X / 10
 *  - Subtle animated compass indicator pointing to Pokémon Center once goal is met
 *  - Touch Throw button (big friendly Poké Ball)
 *  - Touch Whistle / Recall button
 *  - Pause modal with run shiny summary
 *  - Grand Celebration banner with run shiny summary
 *  - Boss Victory modal with multi-boss progression & shiny summary
 */
window.G = window.G || {};
G.Parade = G.Parade || {};

G.Parade.HUD = (() => {
  let celebrationActive = false;
  let victoryActive = false;
  let onReplayCb = null;
  let onKeepPlayingCb = null;

  function renderShinyBox(container, summary) {
    if (!container) return;
    if (!summary || summary.shinyCount === 0) {
      container.innerHTML = `
        <div class="shiny-summary-title">✨ Shiny Pokémon: 0 ✨</div>
        <p class="shiny-empty-text">Rare Shiny Pokémon sparkle in the meadows — keep an eye out as your parade grows!</p>
      `;
    } else {
      container.innerHTML = `
        <div class="shiny-summary-title">✨ Shiny Pokémon Caught: <strong>${summary.shinyCount}</strong> ✨</div>
        <div class="shiny-chips">
          ${summary.shinies.map(s => `
            <span class="shiny-chip" title="Shiny ${s.name} (${s.type || 'Normal'})">
              ⭐ Shiny ${s.name}
            </span>
          `).join('')}
        </div>
      `;
    }
  }

  return {
    init(onReplay, onKeepPlaying) {
      onReplayCb = onReplay;
      onKeepPlayingCb = onKeepPlaying;
    },

    setCelebration(active, count = null, shinySummary = null) {
      celebrationActive = active;
      const el = document.getElementById('parade-celebrate');
      if (el) {
        if (active) el.classList.remove('hidden');
        else el.classList.add('hidden');
      }
      const body = document.getElementById('celebrate-modal-body');
      if (body && count) {
        body.textContent = `Wonderful job! You brought ${count} happy Pokémon back to the Pokémon Center in a grand parade!`;
      }
      renderShinyBox(document.getElementById('celebrate-shiny-box'), shinySummary);
    },

    setVictory(active, count = 50, bossName = 'Weezing', nextBossGoal = 100, shinySummary = null) {
      victoryActive = active;
      const el = document.getElementById('parade-victory');
      if (el) {
        if (active) el.classList.remove('hidden');
        else el.classList.add('hidden');
      }
      const title = el ? el.querySelector('.modal-title') : null;
      if (title && bossName) {
        title.textContent = `🏆 ${bossName.toUpperCase()} DEFEATED! 🏆`;
      }
      const body = document.getElementById('victory-modal-body');
      if (body && count) {
        body.textContent = `Spectacular! Your ${count}-Pokémon parade defeated ${bossName}! Keep going — the next boss awaits at ${nextBossGoal} Pokémon!`;
      }
      renderShinyBox(document.getElementById('victory-shiny-box'), shinySummary);
    },

    setPause(active, shinySummary = null) {
      const el = document.getElementById('parade-pause-modal');
      if (el) {
        if (active) el.classList.remove('hidden');
        else el.classList.add('hidden');
      }
      renderShinyBox(document.getElementById('pause-shiny-box'), shinySummary);
    },

    draw(ctx, count, targetCount, trainerX, trainerY, isPaused, boss = null) {
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

      // 2. Boss Alert Banner across the top if active
      if (boss && boss.banner) {
        ctx.fillStyle = 'rgba(183, 28, 28, 0.92)';
        ctx.beginPath();
        ctx.roundRect(sw / 2 - 130, 16, 260, 34, 17);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(boss.banner, sw / 2, 33);
      }

      // 3. Minimalist Center Indicator (small compass token) once goal is met
      if (count >= targetCount && !celebrationActive && !victoryActive && (!boss || !boss.active)) {
        const centerWorldX = 0;
        const centerWorldY = 20;
        const dx = centerWorldX - trainerX;
        const dy = centerWorldY - trainerY;
        const dist = Math.hypot(dx, dy);

        // Only show if not already standing in the Plaza
        if (dist > 90) {
          const angle = Math.atan2(dy, dx);
          // Compact 34px circular navigation token at top-center
          const compassX = sw / 2;
          const compassY = 32;
          const compR = 17;

          // Soft drop shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
          ctx.beginPath();
          ctx.arc(compassX, compassY + 1.5, compR + 1, 0, Math.PI * 2);
          ctx.fill();

          // Frosted white circular badge
          ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
          ctx.beginPath();
          ctx.arc(compassX, compassY, compR, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#e53935';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Sleek directional arrow pointing toward Pokémon Center
          ctx.save();
          ctx.translate(compassX, compassY);
          ctx.rotate(angle);

          // Arrow head & body
          ctx.fillStyle = '#e53935';
          ctx.beginPath();
          ctx.moveTo(9, 0);
          ctx.lineTo(-6, -6);
          ctx.lineTo(-3, 0);
          ctx.lineTo(-6, 6);
          ctx.closePath();
          ctx.fill();

          // Small white center pivot
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      }

      ctx.restore();
    }
  };
})();
