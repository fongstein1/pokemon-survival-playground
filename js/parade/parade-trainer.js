/* ============ parade-trainer.js — James the young Pokémon trainer ============
 * Pixel-art protagonist for "James and the Pokémon Parade".
 * Features:
 *  - Authentic Pokémon Mystery Dungeon / Pokémon RPG sprite aesthetic
 *  - 1px crisp dark contour outlines matching PMD sprites
 *  - 3-tone shading (highlights, midtones, deep shadow)
 *  - Cap with visor and badge, tufts of hair, yellow adventure backpack, sneakers
 *  - 8-direction movement, bouncy walk animations, throw, and victory cheer
 */
window.G = window.G || {};
G.Parade = G.Parade || {};

G.Parade.Trainer = class Trainer {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.r = 13;             // Collision radius
    this.bodyH = 28 * G.Sprites.PX;
    this.speed = 135;        // Responsive movement speed (world units / sec)
    this.vx = 0;
    this.vy = 0;
    this.dir = 0;            // 0..7 direction
    this.moveAngle = Math.PI / 2;
    this.walking = false;
    this.cheering = false;
    this.throwing = false;
    this.throwTimer = 0;
    this.walkTimer = 0;
    this.cheerTimer = 0;
    this.stepDustTimer = 0;

    // Sprite dimensions at 1x art resolution
    this.frameW = 28;
    this.frameH = 30;
    this.ax = 14;
    this.ay = 28;

    this._sheet = Trainer.getSheet();
  }

  static getSheet() {
    if (Trainer._cachedSheet) return Trainer._cachedSheet;
    const FW = 28, FH = 30;
    const cols = 9, rows = 8;
    const cv = document.createElement('canvas');
    cv.width = cols * FW;
    cv.height = rows * FH;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Rich Pokémon Mystery Dungeon / Gen 3-4 palette
    const C = {
      // 1px Dark Outline (essential for matching PMD sprites)
      out: '#19131d',
      outSoft: '#312330',

      // Cap (Rich red with highlights and deep crease)
      capHi: '#ff6659',
      capMid: '#d32f2f',
      capShd: '#8b0000',
      capDark: '#560000',
      capWhite: '#ffffff',
      capVisor: '#b71c1c',

      // Hair (Chestnut brown with shine and shadow)
      hairHi: '#8d6e63',
      hairMid: '#5d4037',
      hairShd: '#3e2723',
      hairDark: '#271714',

      // Skin & Face (Warm anime skin tone with shading and blush)
      skinHi: '#ffecb3',
      skinMid: '#ffcc80',
      skinShd: '#f59e0b',
      skinDark: '#d97706',
      blush: '#ff8a80',

      // Eyes
      eyeBorder: '#0b132b',
      eyeIris: '#1c3d5a',
      eyePupil: '#000814',
      eyeShine: '#ffffff',

      // Vest / Jacket (Pokemon blue with highlight and depth)
      vestHi: '#64b5f6',
      vestMid: '#1e88e5',
      vestShd: '#1565c0',
      vestDark: '#0d47a1',
      shirtWhite: '#f5f5f5',
      shirtShd: '#cfd8dc',

      // Adventure Backpack (Bright golden yellow with rich amber shadow)
      packHi: '#fff59d',
      packMid: '#fdd835',
      packShd: '#f57f17',
      packDark: '#bf360c',
      packStrap: '#4e342e',
      packBuckle: '#ffffff',

      // Shorts & Shoes
      shortsHi: '#3949ab',
      shortsMid: '#283593',
      shortsShd: '#1a237e',
      shoeRed: '#d32f2f',
      shoeWhite: '#ffffff',
      shoeSole: '#212121'
    };

    // Render directions 0..4 (Down, DownRight, Right, UpRight, Up)
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < cols; c++) {
        const ox = c * FW;
        const oy = r * FH;

        let bobY = 0;
        let legOffset = 0;
        let armPose = 'normal';

        if (c === 0) { legOffset = -1; armPose = 'swingL'; }
        else if (c === 1) { bobY = -1; legOffset = 0; armPose = 'normal'; }
        else if (c === 2) { legOffset = 1; armPose = 'swingR'; }
        else if (c === 3) { bobY = -1; legOffset = 0; armPose = 'normal'; }
        else if (c === 4) { armPose = 'throw0'; }
        else if (c === 5) { armPose = 'throw1'; }
        else if (c === 6) { armPose = 'throw2'; }
        else if (c === 7) { bobY = -3; armPose = 'cheer0'; legOffset = 1; }
        else if (c === 8) { bobY = -1; armPose = 'cheer1'; legOffset = 0; }

        // Render frame onto offscreen canvas
        const frameCv = document.createElement('canvas');
        frameCv.width = FW;
        frameCv.height = FH;
        const fctx = frameCv.getContext('2d');
        fctx.imageSmoothingEnabled = false;

        drawJamesDetailed(fctx, r, legOffset, armPose, C);

        // Apply authentic 1px PMD dark contour outline
        const outlinedCv = applyPmdOutline(frameCv, C.out);

        ctx.save();
        ctx.translate(ox, oy + bobY);

        // Elliptical PMD ground shadow
        if (bobY >= -1) {
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.beginPath();
          ctx.ellipse(14, 28 - bobY, 8, 3.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.drawImage(outlinedCv, 0, 0);
        ctx.restore();
      }
    }

    // Directions 5, 6, 7 are horizontally flipped versions of 3, 2, 1
    const flipMap = { 5: 3, 6: 2, 7: 1 };
    for (let targetR of [5, 6, 7]) {
      const sourceR = flipMap[targetR];
      for (let c = 0; c < cols; c++) {
        ctx.save();
        ctx.translate((c + 1) * FW, targetR * FH);
        ctx.scale(-1, 1);
        ctx.drawImage(cv, c * FW, sourceR * FH, FW, FH, 0, 0, FW, FH);
        ctx.restore();
      }
    }

    Trainer._cachedSheet = cv;
    return cv;
  }

  update(dt, inputAxis = null) {
    if (this.throwing) {
      this.throwTimer += dt;
      if (this.throwTimer > 0.35) {
        this.throwing = false;
        this.throwTimer = 0;
      }
    }

    if (this.cheering) {
      this.cheerTimer += dt;
      this.walking = false;
      this.vx = 0;
      this.vy = 0;
      return;
    }

    const [ax, ay] = inputAxis || G.Input.axis();
    this.walking = ax !== 0 || ay !== 0;

    if (this.walking) {
      this.moveAngle = Math.atan2(ay, ax);
      this.dir = G.Sprites.dirFromAngle(this.moveAngle);
      this.walkTimer += dt * 8.5;
      this.stepDustTimer += dt;

      if (this.stepDustTimer > 0.16) {
        this.stepDustTimer = 0;
        if (G.Parade && G.Parade.FX) {
          G.Parade.FX.dust(this.x + (Math.random() * 8 - 4), this.y, '#bbf7d0');
        }
      }

      this.vx = ax * this.speed;
      this.vy = ay * this.speed;
    } else {
      this.vx = G.U.damp(this.vx, 0, 16, dt);
      this.vy = G.U.damp(this.vy, 0, 16, dt);
      this.walkTimer = 0;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (G.Parade && G.Parade.World) {
      G.Parade.World.collide(this);
    }
  }

  triggerThrow() {
    this.throwing = true;
    this.throwTimer = 0;
  }

  setCheer(cheer = true) {
    this.cheering = cheer;
    this.cheerTimer = 0;
  }

  draw(ctx) {
    const k = G.Sprites.PX;
    const sheet = this._sheet;
    let col = 0;

    if (this.cheering) {
      col = (Math.floor(this.cheerTimer * 6) % 2) === 0 ? 7 : 8;
    } else if (this.throwing) {
      if (this.throwTimer < 0.1) col = 4;
      else if (this.throwTimer < 0.22) col = 5;
      else col = 6;
    } else if (this.walking) {
      col = Math.floor(this.walkTimer) % 4;
    } else {
      col = 1; // Idle confident pose
    }

    const row = Math.min(Math.max(0, this.dir), 7);
    const sx = col * this.frameW;
    const sy = row * this.frameH;
    const dx = Math.round(this.x - this.ax * k);
    const dy = Math.round(this.y - this.ay * k);

    ctx.drawImage(sheet, sx, sy, this.frameW, this.frameH, dx, dy, this.frameW * k, this.frameH * k);
  }
};

/**
 * Procedural pixel drawer with authentic PMD shading
 */
function drawJamesDetailed(ctx, dir, legOffset, armPose, C) {
  const isDown = dir === 0;
  const isDownDiag = dir === 1;
  const isSide = dir === 2;
  const isUpDiag = dir === 3;
  const isUp = dir === 4;

  // 1. BACKPACK (rendered behind body in Up / UpDiag / Side)
  if (isUp) {
    // Back of golden backpack with pocket and zipper
    ctx.fillStyle = C.packShd;
    ctx.fillRect(9, 13, 10, 8);
    ctx.fillStyle = C.packMid;
    ctx.fillRect(10, 12, 8, 8);
    ctx.fillStyle = C.packHi;
    ctx.fillRect(10, 13, 7, 2);
    // Pouch & Buckle
    ctx.fillStyle = C.packDark;
    ctx.fillRect(11, 16, 6, 4);
    ctx.fillStyle = C.packBuckle;
    ctx.fillRect(13, 16, 2, 2);
    // Harness straps
    ctx.fillStyle = C.packStrap;
    ctx.fillRect(8, 12, 2, 9);
    ctx.fillRect(18, 12, 2, 9);
  } else if (isUpDiag) {
    ctx.fillStyle = C.packShd;
    ctx.fillRect(8, 13, 8, 8);
    ctx.fillStyle = C.packMid;
    ctx.fillRect(9, 12, 7, 7);
    ctx.fillStyle = C.packHi;
    ctx.fillRect(9, 13, 5, 2);
    ctx.fillStyle = C.packStrap;
    ctx.fillRect(7, 12, 2, 8);
  } else if (isSide) {
    // Side profile of backpack
    ctx.fillStyle = C.packShd;
    ctx.fillRect(7, 13, 4, 7);
    ctx.fillStyle = C.packMid;
    ctx.fillRect(8, 14, 3, 5);
    ctx.fillStyle = C.packHi;
    ctx.fillRect(8, 14, 2, 2);
  }

  // 2. LEGS & SNEAKERS
  ctx.fillStyle = C.shortsMid;
  if (isDown || isDownDiag) {
    // Shorts
    ctx.fillRect(10, 19, 3, 3);
    ctx.fillRect(15, 19, 3, 3);
    ctx.fillStyle = C.shortsShd;
    ctx.fillRect(13, 19, 2, 2);

    // Bare legs
    ctx.fillStyle = C.skinMid;
    ctx.fillRect(10, 22, 2, 2);
    ctx.fillRect(16, 22, 2, 2);

    // Red sneakers with white toe caps
    const ly = legOffset < 0 ? 23 : 24;
    const ry = legOffset > 0 ? 23 : 24;
    ctx.fillStyle = C.shoeRed;
    ctx.fillRect(9, ly, 4, 3);
    ctx.fillRect(15, ry, 4, 3);
    ctx.fillStyle = C.shoeWhite;
    ctx.fillRect(9, ly + 2, 4, 1);
    ctx.fillRect(15, ry + 2, 4, 1);
    ctx.fillStyle = C.shoeSole;
    ctx.fillRect(9, ly + 3, 4, 1);
    ctx.fillRect(15, ry + 3, 4, 1);
  } else if (isSide) {
    ctx.fillRect(12, 19, 4, 4);
    ctx.fillStyle = C.skinMid;
    ctx.fillRect(13, 23, 2, 2);

    ctx.fillStyle = C.shoeRed;
    if (legOffset === 0) {
      ctx.fillRect(12, 24, 6, 3);
      ctx.fillStyle = C.shoeWhite;
      ctx.fillRect(15, 25, 3, 2);
      ctx.fillStyle = C.shoeSole;
      ctx.fillRect(12, 27, 6, 1);
    } else if (legOffset < 0) {
      ctx.fillRect(10, 24, 5, 3);
      ctx.fillRect(15, 23, 5, 3);
      ctx.fillStyle = C.shoeWhite;
      ctx.fillRect(13, 25, 2, 2);
      ctx.fillRect(18, 24, 2, 2);
    } else {
      ctx.fillRect(15, 24, 5, 3);
      ctx.fillRect(10, 23, 5, 3);
      ctx.fillStyle = C.shoeWhite;
      ctx.fillRect(18, 25, 2, 2);
      ctx.fillRect(13, 24, 2, 2);
    }
  } else {
    // Up / UpDiag
    ctx.fillRect(10, 19, 3, 4);
    ctx.fillRect(15, 19, 3, 4);
    ctx.fillStyle = C.shoeRed;
    const ly = legOffset < 0 ? 23 : 24;
    const ry = legOffset > 0 ? 23 : 24;
    ctx.fillRect(10, ly, 3, 3);
    ctx.fillRect(15, ry, 3, 3);
    ctx.fillStyle = C.shoeSole;
    ctx.fillRect(10, ly + 3, 3, 1);
    ctx.fillRect(15, ry + 3, 3, 1);
  }

  // 3. TORSO / JACKET
  ctx.fillStyle = C.vestMid;
  if (isDown) {
    ctx.fillRect(9, 13, 10, 7);
    ctx.fillStyle = C.vestHi;
    ctx.fillRect(10, 14, 2, 5);
    // White undershirt with neck collar
    ctx.fillStyle = C.shirtWhite;
    ctx.fillRect(13, 13, 2, 6);
    // Shoulder straps
    ctx.fillStyle = C.packMid;
    ctx.fillRect(10, 13, 1, 6);
    ctx.fillRect(17, 13, 1, 6);
  } else if (isDownDiag) {
    ctx.fillRect(10, 13, 9, 7);
    ctx.fillStyle = C.shirtWhite;
    ctx.fillRect(13, 13, 2, 6);
    ctx.fillStyle = C.packMid;
    ctx.fillRect(11, 13, 1, 6);
  } else if (isSide) {
    ctx.fillRect(11, 13, 7, 7);
    ctx.fillStyle = C.shirtWhite;
    ctx.fillRect(15, 14, 2, 5);
    ctx.fillStyle = C.packMid;
    ctx.fillRect(12, 13, 1, 6);
  } else {
    // Up / UpDiag
    ctx.fillRect(9, 13, 10, 7);
  }

  // 4. ARMS & HANDS
  ctx.fillStyle = C.vestMid;
  if (armPose === 'cheer0' || armPose === 'cheer1') {
    // Joyous raised arms
    ctx.fillRect(7, 9, 3, 5);
    ctx.fillRect(18, 9, 3, 5);
    ctx.fillStyle = C.skinMid;
    ctx.fillRect(6, 7, 3, 3);
    ctx.fillRect(19, 7, 3, 3);
  } else if (armPose === 'throw0') {
    // Windup arm back
    ctx.fillRect(7, 14, 3, 4);
    ctx.fillStyle = C.skinMid;
    ctx.fillRect(6, 17, 3, 3);
    // Small Poké Ball held in hand
    ctx.fillStyle = '#e53935';
    ctx.fillRect(5, 16, 2, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(5, 17, 2, 1);
  } else if (armPose === 'throw1' || armPose === 'throw2') {
    // Extended throwing arm
    ctx.fillRect(17, 13, 5, 3);
    ctx.fillStyle = C.skinMid;
    ctx.fillRect(21, 13, 3, 3);
  } else {
    // Walking swing
    if (isDown) {
      const ly = armPose === 'swingL' ? 12 : 14;
      const ry = armPose === 'swingR' ? 12 : 14;
      ctx.fillRect(7, ly, 3, 4);
      ctx.fillRect(18, ry, 3, 4);
      ctx.fillStyle = C.skinMid;
      ctx.fillRect(7, ly + 4, 3, 2);
      ctx.fillRect(18, ry + 4, 3, 2);
    } else if (isSide) {
      const ay = armPose === 'swingL' ? 13 : 15;
      ctx.fillRect(13, ay, 3, 4);
      ctx.fillStyle = C.skinMid;
      ctx.fillRect(13, ay + 4, 3, 2);
    } else {
      ctx.fillRect(7, 13, 3, 5);
      ctx.fillRect(18, 13, 3, 5);
      ctx.fillStyle = C.skinMid;
      ctx.fillRect(7, 17, 3, 2);
      ctx.fillRect(18, 17, 3, 2);
    }
  }

  // 5. HEAD, HAIR, FACE & CAP (Authentic PMD detailing)
  if (isDown || isDownDiag) {
    // Face skin
    ctx.fillStyle = C.skinMid;
    ctx.fillRect(9, 5, 10, 8);
    ctx.fillRect(11, 12, 6, 2); // Chin

    // Hair under cap and sideburns
    ctx.fillStyle = C.hairMid;
    ctx.fillRect(8, 7, 2, 5);
    ctx.fillRect(18, 7, 2, 5);
    ctx.fillRect(11, 6, 4, 2); // Forehead tuft
    ctx.fillStyle = C.hairHi;
    ctx.fillRect(12, 6, 2, 1);

    // Big expressive anime eyes with specular shine
    ctx.fillStyle = C.eyeBorder;
    ctx.fillRect(10, 8, 3, 4);
    ctx.fillRect(15, 8, 3, 4);
    ctx.fillStyle = C.eyeIris;
    ctx.fillRect(11, 9, 2, 3);
    ctx.fillRect(16, 9, 2, 3);
    ctx.fillStyle = C.eyeShine;
    ctx.fillRect(11, 8, 1, 2);
    ctx.fillRect(16, 8, 1, 2);

    // Rosy anime cheeks
    ctx.fillStyle = C.blush;
    ctx.fillRect(9, 11, 2, 1);
    ctx.fillRect(17, 11, 2, 1);

    // Warm smile
    ctx.fillStyle = C.hairDark;
    ctx.fillRect(13, 12, 2, 1);

    // Cap (Grounded red dome with highlight)
    ctx.fillStyle = C.capMid;
    ctx.fillRect(8, 2, 12, 5);
    ctx.fillRect(10, 1, 8, 2);
    ctx.fillStyle = C.capHi;
    ctx.fillRect(10, 2, 8, 2);
    // Cap visor (brim)
    ctx.fillStyle = C.capVisor;
    ctx.fillRect(7, 6, 14, 2);
    // White Poké Ball emblem on front
    ctx.fillStyle = C.capWhite;
    ctx.fillRect(13, 3, 2, 2);
  } else if (isSide) {
    // Side profile face
    ctx.fillStyle = C.skinMid;
    ctx.fillRect(11, 5, 8, 8);
    ctx.fillRect(13, 12, 5, 2);

    // Nape hair
    ctx.fillStyle = C.hairMid;
    ctx.fillRect(8, 7, 4, 6);
    ctx.fillStyle = C.hairHi;
    ctx.fillRect(9, 8, 2, 3);

    // Eye profile
    ctx.fillStyle = C.eyeBorder;
    ctx.fillRect(15, 8, 3, 4);
    ctx.fillStyle = C.eyeIris;
    ctx.fillRect(16, 9, 2, 3);
    ctx.fillStyle = C.eyeShine;
    ctx.fillRect(16, 8, 1, 2);
    ctx.fillStyle = C.blush;
    ctx.fillRect(16, 11, 2, 1);

    // Cap side view
    ctx.fillStyle = C.capMid;
    ctx.fillRect(9, 2, 10, 5);
    ctx.fillRect(10, 1, 8, 2);
    ctx.fillStyle = C.capHi;
    ctx.fillRect(11, 2, 6, 2);
    // Visor extending forward to right
    ctx.fillStyle = C.capVisor;
    ctx.fillRect(15, 6, 7, 2);
    ctx.fillStyle = C.capWhite;
    ctx.fillRect(13, 3, 2, 2);
  } else {
    // Back of head (Up / UpDiag)
    ctx.fillStyle = C.hairMid;
    ctx.fillRect(8, 6, 12, 7);
    ctx.fillStyle = C.hairShd;
    ctx.fillRect(9, 10, 10, 3);

    // Cap back
    ctx.fillStyle = C.capMid;
    ctx.fillRect(8, 2, 12, 5);
    ctx.fillRect(10, 1, 8, 2);
    ctx.fillStyle = C.capHi;
    ctx.fillRect(10, 2, 8, 2);
    // Cap adjustment arch
    ctx.fillStyle = C.capDark;
    ctx.fillRect(12, 6, 4, 2);
    ctx.fillStyle = C.hairMid;
    ctx.fillRect(13, 6, 2, 1); // Hair peeking through
  }
}

/**
 * Applies a 1-pixel dark contour outline around opaque pixels,
 * giving James the exact crisp outline signature of PMD sprites.
 */
function applyPmdOutline(srcCanvas, outlineColor) {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const ctx = outCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const srcCtx = srcCanvas.getContext('2d');
  const imgData = srcCtx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Draw 1px offset shadow copies in 4 orthogonal directions
  ctx.save();
  // Tint silhouette to outline color
  const silCanvas = document.createElement('canvas');
  silCanvas.width = w;
  silCanvas.height = h;
  const silCtx = silCanvas.getContext('2d');
  silCtx.drawImage(srcCanvas, 0, 0);
  silCtx.globalCompositeOperation = 'source-in';
  silCtx.fillStyle = outlineColor;
  silCtx.fillRect(0, 0, w, h);

  // Stamp in 4 cardinal directions
  ctx.drawImage(silCanvas, -1, 0);
  ctx.drawImage(silCanvas, 1, 0);
  ctx.drawImage(silCanvas, 0, -1);
  ctx.drawImage(silCanvas, 0, 1);

  // Draw main shaded body on top
  ctx.drawImage(srcCanvas, 0, 0);
  ctx.restore();

  return outCanvas;
}
