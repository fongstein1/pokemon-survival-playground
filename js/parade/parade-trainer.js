/* ============ parade-trainer.js — James the young Pokémon trainer ============
 * Pixel-art protagonist for "James and the Pokémon Parade".
 * Features:
 *  - Procedural pixel-art sprite sheet with cap, hair, backpack, sneakers
 *  - 8 directions (Down, DownRight, Right, UpRight, Up, UpLeft, Left, DownLeft)
 *  - Walk, Idle, Throw, and Cheer animations
 *  - Responsive movement and bouncy step
 */
window.G = window.G || {};
G.Parade = G.Parade || {};

G.Parade.Trainer = class Trainer {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.r = 13;             // Collision radius
    this.bodyH = 26 * G.Sprites.PX;
    this.speed = 130;        // Responsive movement speed (world units / sec)
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
    this.frameW = 24;
    this.frameH = 26;
    this.ax = 12;
    this.ay = 24;

    this._sheet = Trainer.getSheet();
  }

  static getSheet() {
    if (Trainer._cachedSheet) return Trainer._cachedSheet;
    // Build canvas with all animation frames:
    // Rows: 8 directions (0..7)
    // Columns:
    //  0..3: Walk / Idle frames (0: contact L, 1: pass L, 2: contact R, 3: pass R)
    //  4..6: Throw frames (4: windup, 5: toss, 6: follow-through)
    //  7..8: Cheer frames (7: hop up hands up, 8: land cheer)
    const FW = 24, FH = 26;
    const cols = 9, rows = 8;
    const cv = document.createElement('canvas');
    cv.width = cols * FW;
    cv.height = rows * FH;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Colors
    const C = {
      capRed: '#e53935',
      capDark: '#b71c1c',
      capWhite: '#ffffff',
      hair: '#5d4037',
      hairLight: '#795548',
      skin: '#ffcc80',
      skinShadow: '#f5b041',
      eye: '#1a237e',
      eyeShine: '#ffffff',
      blush: '#ff8a80',
      shirtBlue: '#1e88e5',
      shirtDark: '#1565c0',
      shirtWhite: '#f5f5f5',
      packYellow: '#fdd835',
      packDark: '#fbc02d',
      packStrap: '#6d4c41',
      shorts: '#283593',
      shoes: '#d32f2f',
      shoeSole: '#ffffff'
    };

    function px(x, y, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
    function rect(x, y, w, h, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    }

    // Render each direction (0..4 primary, 5..7 will be flipped from 3, 2, 1)
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < cols; c++) {
        const ox = c * FW;
        const oy = r * FH;

        // Base offsets for walk bounce and cheer
        let bobY = 0;
        let legOffset = 0;
        let armPose = 'normal'; // normal, swingL, swingR, throw0, throw1, throw2, cheer0, cheer1

        if (c === 0) { legOffset = -1; armPose = 'swingL'; }
        else if (c === 1) { bobY = -1; legOffset = 0; armPose = 'normal'; }
        else if (c === 2) { legOffset = 1; armPose = 'swingR'; }
        else if (c === 3) { bobY = -1; legOffset = 0; armPose = 'normal'; }
        else if (c === 4) { armPose = 'throw0'; }
        else if (c === 5) { armPose = 'throw1'; }
        else if (c === 6) { armPose = 'throw2'; }
        else if (c === 7) { bobY = -3; armPose = 'cheer0'; legOffset = 1; }
        else if (c === 8) { bobY = -1; armPose = 'cheer1'; legOffset = 0; }

        ctx.save();
        ctx.translate(ox, oy + bobY);

        // Draw shadow under feet (except when jumping high)
        if (bobY >= -1) {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.beginPath();
          ctx.ellipse(12, 24 - bobY, 7, 3, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw James character based on direction `r`
        drawJamesFrame(ctx, r, legOffset, armPose, C);
        ctx.restore();
      }
    }

    // Directions 5, 6, 7 are horizontally flipped versions of 3 (UpRight -> UpLeft), 2 (Right -> Left), 1 (DownRight -> DownLeft)
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
      this.walkTimer += dt * 8;
      this.stepDustTimer += dt;

      // Spawn subtle step dust
      if (this.stepDustTimer > 0.18) {
        this.stepDustTimer = 0;
        if (G.Parade && G.Parade.FX) {
          G.Parade.FX.dust(this.x + (Math.random() * 6 - 3), this.y, '#c5e1a5');
        }
      }

      this.vx = ax * this.speed;
      this.vy = ay * this.speed;
    } else {
      this.vx = G.U.damp(this.vx, 0, 15, dt);
      this.vy = G.U.damp(this.vy, 0, 15, dt);
      this.walkTimer = 0;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Collide with world obstacles
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
      col = 1; // Idle pleasant pose
    }

    const row = Math.min(Math.max(0, this.dir), 7);
    const sx = col * this.frameW;
    const sy = row * this.frameH;
    const dx = Math.round(this.x - this.ax * k);
    const dy = Math.round(this.y - this.ay * k);

    ctx.drawImage(sheet, sx, sy, this.frameW, this.frameH, dx, dy, this.frameW * k, this.frameH * k);
  }
};

// Procedural drawing helper for James
function drawJamesFrame(ctx, dir, legOffset, armPose, C) {
  // dir: 0=Down, 1=DownRight, 2=Right, 3=UpRight, 4=Up
  const isDown = dir === 0;
  const isDownDiag = dir === 1;
  const isSide = dir === 2;
  const isUpDiag = dir === 3;
  const isUp = dir === 4;

  // 1. BACKPACK (if facing Up or UpDiag, drawn behind body)
  if (isUp) {
    // Yellow backpack with pouch and straps
    ctx.fillStyle = C.packYellow;
    ctx.fillRect(8, 10, 8, 8);
    ctx.fillStyle = C.packDark;
    ctx.fillRect(9, 13, 6, 4); // front pouch
    ctx.fillRect(11, 10, 2, 2); // top loop
    ctx.fillStyle = C.packStrap;
    ctx.fillRect(7, 10, 2, 8);
    ctx.fillRect(15, 10, 2, 8);
  } else if (isUpDiag) {
    ctx.fillStyle = C.packYellow;
    ctx.fillRect(7, 10, 7, 7);
    ctx.fillStyle = C.packDark;
    ctx.fillRect(8, 12, 5, 4);
    ctx.fillStyle = C.packStrap;
    ctx.fillRect(6, 10, 2, 7);
  } else if (isSide) {
    // Backpack peeking from behind back
    ctx.fillStyle = C.packYellow;
    ctx.fillRect(6, 11, 4, 6);
    ctx.fillStyle = C.packDark;
    ctx.fillRect(5, 12, 2, 4);
  }

  // 2. LEGS & SHOES
  ctx.fillStyle = C.shorts;
  if (isDown) {
    ctx.fillRect(9, 17, 3, 3);
    ctx.fillRect(12, 17, 3, 3);
    // Legs & shoes
    ctx.fillStyle = C.skin;
    ctx.fillRect(9, 20, 2, 1);
    ctx.fillRect(13, 20, 2, 1);
    ctx.fillStyle = C.shoes;
    const lY = legOffset < 0 ? 21 : 22;
    const rY = legOffset > 0 ? 21 : 22;
    ctx.fillRect(8, lY, 3, 2);
    ctx.fillRect(13, rY, 3, 2);
    ctx.fillStyle = C.shoeSole;
    ctx.fillRect(8, lY + 1, 3, 1);
    ctx.fillRect(13, rY + 1, 3, 1);
  } else if (isSide) {
    ctx.fillRect(10, 17, 4, 3);
    ctx.fillStyle = C.skin;
    ctx.fillRect(11, 20, 2, 1);
    ctx.fillStyle = C.shoes;
    if (legOffset === 0) {
      ctx.fillRect(10, 21, 5, 2);
      ctx.fillStyle = C.shoeSole;
      ctx.fillRect(10, 22, 5, 1);
    } else if (legOffset < 0) {
      ctx.fillRect(8, 21, 4, 2);
      ctx.fillRect(13, 21, 4, 2);
      ctx.fillStyle = C.shoeSole;
      ctx.fillRect(8, 22, 4, 1);
      ctx.fillRect(13, 22, 4, 1);
    } else {
      ctx.fillRect(13, 21, 4, 2);
      ctx.fillRect(8, 21, 4, 2);
      ctx.fillStyle = C.shoeSole;
      ctx.fillRect(13, 22, 4, 1);
      ctx.fillRect(8, 22, 4, 1);
    }
  } else {
    // Diagonals / Up
    ctx.fillRect(9, 17, 3, 3);
    ctx.fillRect(12, 17, 3, 3);
    ctx.fillStyle = C.shoes;
    const lY = legOffset < 0 ? 21 : 22;
    const rY = legOffset > 0 ? 21 : 22;
    ctx.fillRect(8, lY, 3, 2);
    ctx.fillRect(13, rY, 3, 2);
    ctx.fillStyle = C.shoeSole;
    ctx.fillRect(8, lY + 1, 3, 1);
    ctx.fillRect(13, rY + 1, 3, 1);
  }

  // 3. BODY / JACKET
  ctx.fillStyle = C.shirtBlue;
  if (isDown) {
    ctx.fillRect(8, 11, 8, 6);
    // Inner white shirt
    ctx.fillStyle = C.shirtWhite;
    ctx.fillRect(11, 11, 2, 5);
    // Yellow backpack straps over shoulders
    ctx.fillStyle = C.packYellow;
    ctx.fillRect(9, 11, 1, 5);
    ctx.fillRect(14, 11, 1, 5);
  } else if (isDownDiag) {
    ctx.fillRect(8, 11, 7, 6);
    ctx.fillStyle = C.shirtWhite;
    ctx.fillRect(11, 11, 2, 5);
    ctx.fillStyle = C.packYellow;
    ctx.fillRect(9, 11, 1, 5);
  } else if (isSide) {
    ctx.fillRect(9, 11, 6, 6);
    ctx.fillStyle = C.shirtWhite;
    ctx.fillRect(13, 12, 1, 4);
    ctx.fillStyle = C.packYellow;
    ctx.fillRect(10, 11, 1, 5);
  } else if (isUpDiag || isUp) {
    ctx.fillRect(8, 11, 8, 6);
  }

  // 4. ARMS / HANDS
  ctx.fillStyle = C.skin;
  if (armPose === 'cheer0' || armPose === 'cheer1') {
    // Both arms raised high in joy!
    ctx.fillStyle = C.shirtBlue;
    ctx.fillRect(6, 8, 2, 4);
    ctx.fillRect(16, 8, 2, 4);
    ctx.fillStyle = C.skin;
    ctx.fillRect(5, 6, 3, 3);
    ctx.fillRect(16, 6, 3, 3);
  } else if (armPose === 'throw0') {
    // Windup arm back with Poké Ball
    ctx.fillStyle = C.shirtBlue;
    ctx.fillRect(6, 12, 2, 3);
    ctx.fillStyle = C.skin;
    ctx.fillRect(5, 14, 2, 2);
    // Small Poké Ball in hand
    ctx.fillStyle = '#ff1744';
    ctx.fillRect(4, 13, 2, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(4, 14, 2, 1);
  } else if (armPose === 'throw1' || armPose === 'throw2') {
    // Arm extended pointing forward
    ctx.fillStyle = C.shirtBlue;
    ctx.fillRect(15, 11, 4, 2);
    ctx.fillStyle = C.skin;
    ctx.fillRect(18, 11, 2, 2);
  } else {
    // Normal walk swing
    if (isDown) {
      const lY = armPose === 'swingL' ? 10 : 12;
      const rY = armPose === 'swingR' ? 10 : 12;
      ctx.fillStyle = C.shirtBlue;
      ctx.fillRect(6, lY, 2, 3);
      ctx.fillRect(16, rY, 2, 3);
      ctx.fillStyle = C.skin;
      ctx.fillRect(6, lY + 3, 2, 2);
      ctx.fillRect(16, rY + 3, 2, 2);
    } else if (isSide) {
      const aY = armPose === 'swingL' ? 10 : 12;
      ctx.fillStyle = C.shirtBlue;
      ctx.fillRect(11, aY, 2, 3);
      ctx.fillStyle = C.skin;
      ctx.fillRect(11, aY + 3, 2, 2);
    } else {
      ctx.fillStyle = C.shirtBlue;
      ctx.fillRect(6, 11, 2, 3);
      ctx.fillRect(16, 11, 2, 3);
      ctx.fillStyle = C.skin;
      ctx.fillRect(6, 14, 2, 2);
      ctx.fillRect(16, 14, 2, 2);
    }
  }

  // 5. HEAD, FACE, HAIR & CAP
  if (isDown || isDownDiag) {
    // Face skin
    ctx.fillStyle = C.skin;
    ctx.fillRect(8, 4, 8, 7);
    ctx.fillRect(9, 10, 6, 2); // chin

    // Hair peeking from sides and forehead
    ctx.fillStyle = C.hair;
    ctx.fillRect(7, 5, 2, 4);
    ctx.fillRect(15, 5, 2, 4);
    ctx.fillRect(9, 5, 3, 2); // tuft

    // Eyes
    ctx.fillStyle = C.eye;
    ctx.fillRect(9, 7, 2, 3);
    ctx.fillRect(13, 7, 2, 3);
    ctx.fillStyle = C.eyeShine;
    ctx.fillRect(9, 7, 1, 1);
    ctx.fillRect(13, 7, 1, 1);

    // Cheerful blush
    ctx.fillStyle = C.blush;
    ctx.fillRect(8, 9, 2, 1);
    ctx.fillRect(14, 9, 2, 1);

    // Smile
    ctx.fillStyle = C.hair;
    ctx.fillRect(11, 10, 2, 1);

    // Cap
    ctx.fillStyle = C.capRed;
    ctx.fillRect(7, 2, 10, 4);
    ctx.fillRect(8, 1, 8, 2);
    // Cap visor (brim)
    ctx.fillStyle = C.capDark;
    ctx.fillRect(6, 5, 12, 1);
    // White cap button / logo
    ctx.fillStyle = C.capWhite;
    ctx.fillRect(11, 2, 2, 2);
  } else if (isSide) {
    // Profile face
    ctx.fillStyle = C.skin;
    ctx.fillRect(9, 4, 7, 7);
    ctx.fillRect(10, 10, 5, 2);

    // Hair at nape
    ctx.fillStyle = C.hair;
    ctx.fillRect(7, 5, 3, 5);

    // Eye
    ctx.fillStyle = C.eye;
    ctx.fillRect(13, 7, 2, 3);
    ctx.fillStyle = C.eyeShine;
    ctx.fillRect(13, 7, 1, 1);
    ctx.fillStyle = C.blush;
    ctx.fillRect(13, 9, 2, 1);

    // Cap
    ctx.fillStyle = C.capRed;
    ctx.fillRect(7, 2, 9, 4);
    ctx.fillRect(8, 1, 7, 2);
    // Visor extending forward to right
    ctx.fillStyle = C.capDark;
    ctx.fillRect(13, 5, 6, 2);
    ctx.fillStyle = C.capWhite;
    ctx.fillRect(11, 2, 2, 2);
  } else {
    // Back of head (Up or UpDiag)
    ctx.fillStyle = C.hair;
    ctx.fillRect(7, 5, 10, 6);

    // Cap (back)
    ctx.fillStyle = C.capRed;
    ctx.fillRect(7, 2, 10, 4);
    ctx.fillRect(8, 1, 8, 2);
    // Back strap / adjustment hole
    ctx.fillStyle = C.capDark;
    ctx.fillRect(10, 5, 4, 1);
    ctx.fillStyle = C.hair;
    ctx.fillRect(11, 5, 2, 1); // hair poking through back arch
  }
}
