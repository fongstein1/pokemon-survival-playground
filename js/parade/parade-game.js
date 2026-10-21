/* ============ parade-game.js — main game loop and controller ============
 * Coordinates the prototype:
 *  - James the trainer, path trail, following parade, wild Pokémon, Poké Balls
 *  - Keyboard and touch joystick controls
 *  - Smooth camera tracking
 *  - Objective checking (10 caught -> return to Center -> Grand Celebration)
 *  - Replay and sandbox continue
 */
window.G = window.G || {};
G.Parade = G.Parade || {};

G.Parade.Game = (() => {
  let canvas, ctx;
  let trainer;
  let trail;
  let parade;
  let wild;
  let balls;

  const TARGET_GOAL = 10;
  let state = 'playing'; // 'playing', 'paused', 'celebrating'
  let lastTime = 0;
  let musicStarted = false;

  // Touch joystick state
  const touchState = {
    active: false,
    id: null,
    baseX: 0,
    baseY: 0,
    curX: 0,
    curY: 0,
    axisX: 0,
    axisY: 0
  };

  function init() {
    canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    // Reset components
    trainer = new G.Parade.Trainer(0, 45); // Start on Welcome Plaza
    trail = new G.Parade.PathTrail(trainer.x, trainer.y);
    parade = new G.Parade.ParadeManager();
    wild = new G.Parade.WildManager();
    balls = new G.Parade.BallManager();
    G.Parade.FX.reset();

    wild.populateInitial(20);

    // Camera initial setup
    G.Camera.x = trainer.x;
    G.Camera.y = trainer.y;

    // HUD setup
    G.Parade.HUD.init(
      // Replay callback
      () => restart(),
      // Keep playing callback
      () => keepPlaying()
    );

    // Event listeners
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKeyDown);
    setupTouchControls();
    setupButtonEvents();

    resize();

    // Start loop
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function resize() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    G.Camera.resize(w, h, dpr);
  }

  function setupButtonEvents() {
    // Throw button
    const btnThrow = document.getElementById('btn-throw');
    if (btnThrow) {
      btnThrow.addEventListener('click', e => {
        e.preventDefault();
        triggerThrow();
      });
      btnThrow.addEventListener('touchstart', e => {
        e.preventDefault();
        triggerThrow();
      }, { passive: false });
    }

    // Whistle / Recall button
    const btnRecall = document.getElementById('btn-recall');
    if (btnRecall) {
      btnRecall.addEventListener('click', e => {
        e.preventDefault();
        triggerRecall();
      });
      btnRecall.addEventListener('touchstart', e => {
        e.preventDefault();
        triggerRecall();
      }, { passive: false });
    }

    // Pause button
    const btnPause = document.getElementById('btn-pause');
    if (btnPause) {
      btnPause.addEventListener('click', () => togglePause());
    }

    // Modal buttons
    const btnResume = document.getElementById('btn-resume');
    if (btnResume) btnResume.addEventListener('click', () => togglePause(false));

    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) btnRestart.addEventListener('click', () => restart());

    const btnPlayAgain = document.getElementById('btn-play-again');
    if (btnPlayAgain) btnPlayAgain.addEventListener('click', () => restart());

    const btnKeepParading = document.getElementById('btn-keep-parading');
    if (btnKeepParading) btnKeepParading.addEventListener('click', () => keepPlaying());
  }

  function setupTouchControls() {
    const joyZone = document.getElementById('touch-zone');
    const joyBase = document.getElementById('joy-base');
    const joyStick = document.getElementById('joy-stick');

    if (!joyZone) return;

    joyZone.addEventListener('touchstart', e => {
      e.preventDefault();
      ensureAudio();
      for (const t of e.changedTouches) {
        if (!touchState.active && t.clientX < window.innerWidth * 0.65) {
          touchState.active = true;
          touchState.id = t.identifier;
          touchState.baseX = t.clientX;
          touchState.baseY = t.clientY;
          touchState.curX = t.clientX;
          touchState.curY = t.clientY;
          touchState.axisX = 0;
          touchState.axisY = 0;

          if (joyBase && joyStick) {
            joyBase.style.left = t.clientX + 'px';
            joyBase.style.top = t.clientY + 'px';
            joyBase.classList.remove('hidden');
            joyStick.style.transform = 'translate(-50%, -50%)';
          }
        }
      }
    }, { passive: false });

    joyZone.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (touchState.active && t.identifier === touchState.id) {
          touchState.curX = t.clientX;
          touchState.curY = t.clientY;
          const dx = touchState.curX - touchState.baseX;
          const dy = touchState.curY - touchState.baseY;
          const dist = Math.hypot(dx, dy);
          const maxR = 48;

          if (dist > 0) {
            const clamped = Math.min(dist, maxR);
            touchState.axisX = (dx / dist) * (clamped / maxR);
            touchState.axisY = (dy / dist) * (clamped / maxR);
            if (joyStick) {
              const sx = (dx / dist) * clamped;
              const sy = (dy / dist) * clamped;
              joyStick.style.transform = `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px))`;
            }
          } else {
            touchState.axisX = 0;
            touchState.axisY = 0;
          }
        }
      }
    }, { passive: false });

    const endTouch = e => {
      for (const t of e.changedTouches) {
        if (touchState.active && t.identifier === touchState.id) {
          touchState.active = false;
          touchState.id = null;
          touchState.axisX = 0;
          touchState.axisY = 0;
          if (joyBase) joyBase.classList.add('hidden');
        }
      }
    };

    joyZone.addEventListener('touchend', endTouch);
    joyZone.addEventListener('touchcancel', endTouch);
  }

  function ensureAudio() {
    if (!musicStarted && G.Audio) {
      musicStarted = true;
      if (G.Audio.music) G.Audio.music('village');
    }
  }

  function onKeyDown(e) {
    ensureAudio();
    const code = e.code.toLowerCase();

    if (code === 'space') {
      e.preventDefault();
      triggerThrow();
    } else if (code === 'keyr') {
      e.preventDefault();
      triggerRecall();
    } else if (code === 'keyp' || code === 'escape') {
      e.preventDefault();
      togglePause();
    }
  }

  function triggerThrow() {
    ensureAudio();
    balls.manualThrow(trainer, wild);
  }

  function triggerRecall() {
    ensureAudio();
    parade.recallAll(trail);
    if (G.Audio && G.Audio.sfx) G.Audio.sfx('heal');
    G.Parade.FX.stars(trainer.x, trainer.y - 20, 8);
    G.Parade.FX.popText(trainer.x, trainer.y - 30, 'Parade Assemble! 🎶', '#64b5f6');
  }

  function togglePause(force = null) {
    if (state === 'celebrating') return;
    state = (force !== null) ? (force ? 'paused' : 'playing') : (state === 'paused' ? 'playing' : 'paused');
    const modal = document.getElementById('parade-pause-modal');
    if (modal) {
      if (state === 'paused') modal.classList.remove('hidden');
      else modal.classList.add('hidden');
    }
  }

  function triggerCelebration() {
    if (state === 'celebrating') return;
    state = 'celebrating';
    trainer.setCheer(true);
    parade.setCelebrate(true);

    if (G.Audio && G.Audio.sfx) {
      G.Audio.sfx('legend');
      G.Audio.sfx('shinyGet');
    }

    // Launch massive shower of confetti and sparkles
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        G.Parade.FX.confetti(trainer.x + G.U.rand(-100, 100), trainer.y - 50 + G.U.rand(-40, 40), 25);
        G.Parade.FX.stars(trainer.x + G.U.rand(-80, 80), trainer.y - 40 + G.U.rand(-30, 30), 12);
      }, i * 350);
    }

    G.Parade.HUD.setCelebration(true);
  }

  function restart() {
    state = 'playing';
    trainer = new G.Parade.Trainer(0, 45);
    trail.reset(trainer.x, trainer.y);
    parade.reset();
    wild.reset();
    wild.populateInitial(20);
    balls.reset();
    G.Parade.FX.reset();
    G.Parade.HUD.setCelebration(false);

    const pauseModal = document.getElementById('parade-pause-modal');
    if (pauseModal) pauseModal.classList.add('hidden');
  }

  function keepPlaying() {
    state = 'playing';
    trainer.setCheer(false);
    parade.setCelebrate(false);
    G.Parade.HUD.setCelebration(false);
    G.Parade.FX.popText(trainer.x, trainer.y - 30, 'Keep Parading! 🎈', '#ffca28');
  }

  function onPokemonCaptured(dex, x, y, shiny) {
    parade.add(dex, x, y, shiny);
  }

  function loop(now) {
    requestAnimationFrame(loop);

    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (state !== 'paused') {
      // Input
      let axis = null;
      if (touchState.active) {
        axis = [touchState.axisX, touchState.axisY];
      }

      // Update trainer
      trainer.update(dt, axis);

      // Record path trail
      trail.update(trainer.x, trainer.y, trainer.moveAngle);

      // Update following parade
      parade.update(dt, trail, trainer.walking);

      // Update wild Pokémon
      wild.update(dt, trainer.x, trainer.y);

      // Update Poké Balls and captures
      balls.update(dt, trainer, wild, onPokemonCaptured);

      // Update visual FX
      G.Parade.FX.update(dt);

      // Check objective: 10 Pokémon returned to Welcome Plaza
      if (state === 'playing' && parade.count >= TARGET_GOAL && G.Parade.World.isInWelcomePlaza(trainer.x, trainer.y)) {
        triggerCelebration();
      }

      // Camera follow
      G.Camera.follow(trainer.x, trainer.y, dt);
    }

    // --- RENDER ---
    render();
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Camera world transform
    G.Camera.apply(ctx);

    // 1. Ground tiles and Welcome Plaza
    G.Parade.World.drawGround(ctx);

    // 2. Wild Pokémon
    wild.draw(ctx);

    // 3. Following Parade
    parade.draw(ctx);

    // 4. James the trainer
    trainer.draw(ctx);

    // 5. Flying and wobbling Poké Balls
    balls.draw(ctx);

    // 6. Trees, rocks, and Pokémon Center building (Y-sorted)
    G.Parade.World.drawScenery(ctx);

    // 7. Visual particles and floating texts
    G.Parade.FX.draw(ctx);

    ctx.restore();

    // 8. Screen space HUD
    G.Parade.HUD.draw(ctx, parade.count, TARGET_GOAL, trainer.x, trainer.y, state === 'paused');
  }

  return {
    init,
    restart,
    keepPlaying,
    get trainer() { return trainer; },
    get trail() { return trail; },
    get parade() { return parade; },
    get wild() { return wild; },
    get balls() { return balls; },
    get state() { return state; }
  };
})();
