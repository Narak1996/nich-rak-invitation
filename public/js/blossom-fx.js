/**
 * ==========================================================================
 * WEDDING INTERACTIVE FX: BLOSSOM BLOOM & FAIRY TRAIL ENGINE
 * Features:
 *  1. Mouse Move: Shimmering fairy stardust & micro petal trail
 *  2. Phone Touch & Scroll: Floating botanical petals & golden breeze trail
 *  3. On Click / Tap: Full radial cherry blossom bloom with floral petals,
 *     glowing golden pollen, and expanding luminous halo
 * High performance: Hardware-accelerated 2D canvas, 60fps, zero-DOM thrashing,
 * auto-pauses when idle for 0% CPU consumption.
 * ==========================================================================
 */

(function initWeddingBlossomFX() {
  'use strict';

  // Check if reduced motion is requested
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Create canvas element
  const canvas = document.createElement('canvas');
  canvas.id = 'wedding-fx-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; pointer-events:none; z-index:99999;';
  
  // Append after DOM is ready
  function attachCanvas() {
    if (!document.body.contains(canvas)) {
      document.body.appendChild(canvas);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachCanvas);
  } else {
    attachCanvas();
  }

  const ctx = canvas.getContext('2d', { alpha: true });
  let width = 0;
  let height = 0;
  let dpr = 1;

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener('resize', resizeCanvas, { passive: true });
  resizeCanvas();

  // Particle storage & loop controller
  const particles = [];
  let isLooping = false;

  function startLoop() {
    if (!isLooping) {
      isLooping = true;
      requestAnimationFrame(renderLoop);
    }
  }

  // Romantic Luxury Blossom Color Palettes
  const BLOSSOM_PALETTES = [
    'rgba(255, 182, 193, ', // Soft Sakura Pink
    'rgba(255, 192, 203, ', // Blush Rose
    'rgba(255, 215, 225, ', // Pastel Rose Petal
    'rgba(250, 240, 230, ', // Linen Ivory Petal
    'rgba(247, 220, 205, ', // Warm Peach Blossom
    'rgba(229, 195, 132, '  // Gilded Antique Gold
  ];

  const GOLD_PALETTES = [
    'rgba(197, 160, 89, ',  // Banteay Srei Gold
    'rgba(229, 195, 132, ', // Gilded Amber
    'rgba(255, 223, 140, ', // Fairy Shimmer
    'rgba(78, 125, 99, '    // Royal Sage Emerald
  ];

  // Helper: Draw organic flower petal with Bezier Curves
  function drawOrganicPetal(ctx, size, colorAlpha, isWhiteVein) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    // Left curve of petal
    ctx.bezierCurveTo(size * 0.5, -size * 0.45, size * 0.9, -size * 0.15, size * 0.85, size * 0.45);
    // Petal heart cleft / apex
    ctx.bezierCurveTo(size * 0.7, size * 0.85, 0, size * 1.05, -size * 0.7, size * 0.85);
    // Right curve back to base
    ctx.bezierCurveTo(-size * 0.9, -size * 0.15, -size * 0.5, -size * 0.45, 0, 0);
    ctx.fill();

    // Subtle central petal vein for delicacy
    if (isWhiteVein) {
      ctx.beginPath();
      ctx.moveTo(0, size * 0.1);
      ctx.quadraticCurveTo(0, size * 0.5, 0, size * 0.8);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Helper: Draw 4-point fairy star
  function drawFairyStar(ctx, radius, colorAlpha) {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.lineTo(Math.cos(i * Math.PI / 2) * radius, Math.sin(i * Math.PI / 2) * radius);
      ctx.lineTo(Math.cos(i * Math.PI / 2 + Math.PI / 4) * (radius * 0.26), Math.sin(i * Math.PI / 2 + Math.PI / 4) * (radius * 0.26));
    }
    ctx.closePath();
    ctx.fill();
  }

  // ================= 1. ON CLICK / TAP: RADIAL BLOSSOM BLOOM EFFECT =================
  window.triggerBlossomEffect = function(originX, originY) {
    const x = originX !== undefined ? originX : width / 2;
    const y = originY !== undefined ? originY : height / 2;

    // 1. Expanding luminous floral halo wave
    particles.push({
      type: 'halo',
      x: x,
      y: y,
      radius: 6,
      maxRadius: Math.min(width * 0.18, 70),
      alpha: 0.85,
      decay: 0.035,
      color: 'rgba(255, 182, 193, '
    });

    // 2. Blooming Flower Petals (10 to 14 petals arranged radially)
    const petalCount = prefersReducedMotion ? 6 : Math.floor(Math.random() * 4 + 10);
    const baseAngleOffset = Math.random() * Math.PI * 2;

    for (let i = 0; i < petalCount; i++) {
      const angle = baseAngleOffset + (i * (Math.PI * 2 / petalCount)) + (Math.random() - 0.5) * 0.3;
      const speed = Math.random() * 2.8 + 2.2;
      const targetSize = Math.random() * 10 + 14;
      const baseColor = BLOSSOM_PALETTES[Math.floor(Math.random() * BLOSSOM_PALETTES.length)];

      particles.push({
        type: 'blossom_petal',
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: targetSize,
        scale: 0.1, // Blossom starts as a bud and blooms outward!
        maxScale: 1.0 + Math.random() * 0.35,
        rotation: angle + Math.PI / 2,
        rotSpeed: (Math.random() - 0.5) * 0.08,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.08 + 0.04,
        alpha: 0.95,
        decay: Math.random() * 0.012 + 0.014,
        gravity: 0.055,
        drag: 0.965,
        color: baseColor,
        isVein: Math.random() > 0.4
      });
    }

    // 3. Golden Stardust Pollen & Fairy Glints radiating from blossom center
    const sparkCount = prefersReducedMotion ? 5 : 12;
    for (let j = 0; j < sparkCount; j++) {
      const sAngle = Math.random() * Math.PI * 2;
      const sSpeed = Math.random() * 4.5 + 2.0;
      const sColor = GOLD_PALETTES[Math.floor(Math.random() * GOLD_PALETTES.length)];

      particles.push({
        type: 'star',
        x: x,
        y: y,
        vx: Math.cos(sAngle) * sSpeed,
        vy: Math.sin(sAngle) * sSpeed,
        radius: Math.random() * 3.5 + 2.5,
        alpha: 1.0,
        decay: Math.random() * 0.025 + 0.02,
        drag: 0.93,
        gravity: 0.02,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        color: sColor
      });
    }

    startLoop();
  };

  // Global listener for Click / Tap blossom trigger
  window.addEventListener('pointerdown', (e) => {
    // Only trigger on primary button (left click or touch tap)
    if (e.button !== undefined && e.button !== 0) return;
    window.triggerBlossomEffect(e.clientX, e.clientY);
  }, { passive: true });


  // ================= 2. MOUSE MOVE FAIRY TRAIL (DESKTOP) =================
  let lastMouseX = -100;
  let lastMouseY = -100;
  let lastMouseMoveTime = 0;

  window.addEventListener('pointermove', (e) => {
    // Only process mouse or pen movements (touch has touchmove handler)
    if (e.pointerType === 'touch') return;

    const now = performance.now();
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Spawn trail if cursor moved at least 14px and at least 30ms passed
    if (dist >= 14 && now - lastMouseMoveTime > 30) {
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      lastMouseMoveTime = now;

      const isPetal = Math.random() > 0.65;
      const color = isPetal 
        ? BLOSSOM_PALETTES[Math.floor(Math.random() * BLOSSOM_PALETTES.length)]
        : GOLD_PALETTES[Math.floor(Math.random() * GOLD_PALETTES.length)];

      if (isPetal) {
        // Micro floating petal trail
        particles.push({
          type: 'trail_petal',
          x: e.clientX + (Math.random() - 0.5) * 12,
          y: e.clientY + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * 0.9,
          vy: Math.random() * 0.8 + 0.3,
          size: Math.random() * 5 + 7,
          scale: 0.2,
          maxScale: 1.0,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.05,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.05,
          alpha: 0.85,
          decay: 0.022,
          color: color
        });
      } else {
        // Shimmering fairy stardust trail
        particles.push({
          type: 'star',
          x: e.clientX + (Math.random() - 0.5) * 8,
          y: e.clientY + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8 - 0.2,
          radius: Math.random() * 2.5 + 2.0,
          alpha: 0.9,
          decay: 0.03,
          drag: 0.95,
          gravity: 0.01,
          rotation: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 0.1,
          color: color
        });
      }

      startLoop();
    }
  }, { passive: true });


  // ================= 3. PHONE TOUCH & SCROLL TRAIL (MOBILE & TOUCH) =================
  // A. Finger drag trail on touch screens
  let lastTouchX = -100;
  let lastTouchY = -100;

  window.addEventListener('touchmove', (e) => {
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    const dx = touch.clientX - lastTouchX;
    const dy = touch.clientY - lastTouchY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 18) {
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;

      const color = BLOSSOM_PALETTES[Math.floor(Math.random() * BLOSSOM_PALETTES.length)];
      particles.push({
        type: 'trail_petal',
        x: touch.clientX + (Math.random() - 0.5) * 16,
        y: touch.clientY + (Math.random() - 0.5) * 16,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        size: Math.random() * 6 + 8,
        scale: 0.2,
        maxScale: 1.0,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.06,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.06,
        alpha: 0.85,
        decay: 0.024,
        color: color
      });

      startLoop();
    }
  }, { passive: true });

  // B. Scroll trail (breeze of floating petals & sparkles as page scrolls)
  let lastScrollY = window.scrollY || window.pageYOffset;
  let lastScrollTime = 0;

  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY || window.pageYOffset;
    const scrollDelta = currentScrollY - lastScrollY;
    lastScrollY = currentScrollY;

    const now = performance.now();
    if (Math.abs(scrollDelta) > 5 && now - lastScrollTime > 65) {
      lastScrollTime = now;

      // Spawn 1-2 floating petals drifting with scroll breeze
      const spawnX = Math.random() * (width * 0.84) + (width * 0.08);
      const spawnY = scrollDelta > 0 ? (height * 0.85 + Math.random() * 30) : (height * 0.15 - Math.random() * 30);
      const color = BLOSSOM_PALETTES[Math.floor(Math.random() * BLOSSOM_PALETTES.length)];

      particles.push({
        type: 'scroll_petal',
        x: spawnX,
        y: spawnY,
        vx: (Math.random() - 0.5) * 1.5,
        vy: scrollDelta > 0 ? -(Math.random() * 1.8 + 1.2) : (Math.random() * 1.8 + 1.2),
        size: Math.random() * 7 + 9,
        scale: 0.3,
        maxScale: 1.0,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.04,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.045,
        alpha: 0.80,
        decay: 0.016,
        color: color
      });

      // Subtle golden fairy spark alongside scroll
      particles.push({
        type: 'star',
        x: spawnX + (Math.random() - 0.5) * 24,
        y: spawnY,
        vx: (Math.random() - 0.5) * 1.0,
        vy: (Math.random() - 0.5) * 1.0,
        radius: Math.random() * 2.0 + 1.8,
        alpha: 0.85,
        decay: 0.025,
        drag: 0.94,
        gravity: 0,
        rotation: Math.random() * Math.PI,
        rotSpeed: 0.05,
        color: GOLD_PALETTES[0]
      });

      startLoop();
    }
  }, { passive: true });


  // ================= MAIN CANVAS RENDER LOOP (60FPS) =================
  function renderLoop() {
    ctx.clearRect(0, 0, width, height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      // Update alpha
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }

      // Draw particle according to type
      if (p.type === 'halo') {
        p.radius += (p.maxRadius - p.radius) * 0.12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.strokeStyle = p.color + p.alpha * 0.8 + ')';
        ctx.lineWidth = 2.0;
        ctx.stroke();
      }

      else if (p.type === 'blossom_petal' || p.type === 'trail_petal' || p.type === 'scroll_petal') {
        // Physics update
        p.x += p.vx;
        p.y += p.vy;
        if (p.drag) {
          p.vx *= p.drag;
          p.vy *= p.drag;
        }
        if (p.gravity) {
          p.vy += p.gravity;
        }

        // Bloom scaling
        if (p.scale < p.maxScale) {
          p.scale += 0.09;
          if (p.scale > p.maxScale) p.scale = p.maxScale;
        }

        // Sway / Flutter
        p.wobble += p.wobbleSpeed;
        p.x += Math.sin(p.wobble) * 0.65;
        p.rotation += p.rotSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.scale(p.scale, p.scale);
        ctx.fillStyle = p.color + p.alpha + ')';

        drawOrganicPetal(ctx, p.size, p.alpha, p.isVein);
        ctx.restore();
      }

      else if (p.type === 'star') {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.vy += p.gravity;
        p.rotation += p.rotSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color + p.alpha + ')';

        drawFairyStar(ctx, p.radius, p.alpha);
        ctx.restore();
      }
    }

    // Continue loop if active particles remain, else sleep to save CPU/battery
    if (particles.length > 0) {
      requestAnimationFrame(renderLoop);
    } else {
      isLooping = false;
    }
  }

})();
