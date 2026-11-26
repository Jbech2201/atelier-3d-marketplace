window.FabricTextures = (function () {
  const bumpCache = {};
  const albedoCache = {};

  function createCanvasTexture(size, drawFn, repeatX, repeatY, isColor) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    drawFn(ctx, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX || 4, repeatY || 4);
    if (isColor) {
      tex.encoding = THREE.sRGBEncoding;
    }
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }

  function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function shadeHex(hex, factor) {
    const { r, g, b } = hexToRgb(hex);
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return `rgb(${clamp(r * factor)}, ${clamp(g * factor)}, ${clamp(b * factor)})`;
  }

  // ==================== BUMP / SURFACE MICRO-TEXTURES ====================
  function getFabricBump(type) {
    if (bumpCache[type]) return bumpCache[type];

    let tex;
    if (type === 'denim') {
      tex = createCanvasTexture(
        256,
        (ctx, s) => {
          ctx.fillStyle = '#7c7c7c';
          ctx.fillRect(0, 0, s, s);
          // Crisp 3x1 diagonal twill weave
          for (let i = -s; i < s * 2; i += 6) {
            ctx.strokeStyle = '#b4b4b4';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + s, s);
            ctx.stroke();

            ctx.strokeStyle = '#565656';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(i + 2.5, 0);
            ctx.lineTo(i + s + 2.5, s);
            ctx.stroke();
          }
          // Subtle slub grain
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          for (let y = 0; y < s; y += 8) {
            ctx.fillRect(0, y, s, 1);
          }
        },
        10,
        10,
        false
      );
    } else if (type === 'leather') {
      tex = createCanvasTexture(
        256,
        (ctx, s) => {
          ctx.fillStyle = '#808080';
          ctx.fillRect(0, 0, s, s);
          // Fine pebbled full-grain leather cells
          let seed = 42;
          const rand = () => {
            seed = (seed * 16807) % 2147483647;
            return (seed - 1) / 2147483646;
          };
          for (let i = 0; i < 1400; i++) {
            const x = rand() * s;
            const y = rand() * s;
            const r = 1.8 + rand() * 2.8;
            const g = ctx.createRadialGradient(x, y, 0.2, x, y, r);
            g.addColorStop(0, '#a8a8a8');
            g.addColorStop(0.75, '#7c7c7c');
            g.addColorStop(1, '#585858');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
          }
        },
        8,
        8,
        false
      );
    } else if (type === 'ribbed') {
      tex = createCanvasTexture(
        128,
        (ctx, s) => {
          for (let x = 0; x < s; x += 6) {
            const g = ctx.createLinearGradient(x, 0, x + 6, 0);
            g.addColorStop(0, '#4f4f4f');
            g.addColorStop(0.5, '#d0d0d0');
            g.addColorStop(1, '#4f4f4f');
            ctx.fillStyle = g;
            ctx.fillRect(x, 0, 6, s);
          }
        },
        14,
        4,
        false
      );
    } else if (type === 'linen') {
      tex = createCanvasTexture(
        128,
        (ctx, s) => {
          ctx.fillStyle = '#808080';
          ctx.fillRect(0, 0, s, s);
          for (let y = 0; y < s; y += 3) {
            ctx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)';
            ctx.fillRect(0, y, s, 1);
          }
          for (let x = 0; x < s; x += 3) {
            ctx.fillStyle = x % 6 === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
            ctx.fillRect(x, 0, 1, s);
          }
        },
        10,
        10,
        false
      );
    } else if (type === 'wool') {
      tex = createCanvasTexture(
        128,
        (ctx, s) => {
          ctx.fillStyle = '#808080';
          ctx.fillRect(0, 0, s, s);
          // Subtle herringbone wool weave
          for (let y = 0; y < s; y += 4) {
            for (let x = 0; x < s; x += 4) {
              const diag = ((x + y) % 8 === 0) ? 152 : 108;
              ctx.fillStyle = `rgb(${diag},${diag},${diag})`;
              ctx.fillRect(x, y, 3, 3);
            }
          }
        },
        12,
        12,
        false
      );
    } else if (type === 'satin') {
      tex = createCanvasTexture(
        128,
        (ctx, s) => {
          ctx.fillStyle = '#808080';
          ctx.fillRect(0, 0, s, s);
          for (let y = 0; y < s; y += 2) {
            ctx.fillStyle = y % 4 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
            ctx.fillRect(0, y, s, 1);
          }
        },
        8,
        8,
        false
      );
    } else if (type === 'tailor-linen') {
      tex = createCanvasTexture(
        256,
        (ctx, s) => {
          ctx.fillStyle = '#d9ccb8';
          ctx.fillRect(0, 0, s, s);
          ctx.strokeStyle = 'rgba(110, 86, 62, 0.14)';
          ctx.lineWidth = 1;
          for (let i = 0; i < s; i += 4) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(s, i);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, s);
            ctx.stroke();
          }
          // Tailor princess seam stitch lines
          ctx.strokeStyle = 'rgba(80, 60, 42, 0.34)';
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(s * 0.5, 0);
          ctx.lineTo(s * 0.5, s);
          ctx.stroke();
        },
        5,
        5,
        true
      );
    } else {
      // Cotton jersey micro-knit
      tex = createCanvasTexture(
        128,
        (ctx, s) => {
          ctx.fillStyle = '#808080';
          ctx.fillRect(0, 0, s, s);
          for (let y = 0; y < s; y += 2) {
            for (let x = 0; x < s; x += 2) {
              const n = 118 + ((x * 13 + y * 7) % 20);
              ctx.fillStyle = `rgb(${n},${n},${n})`;
              ctx.fillRect(x, y, 2, 2);
            }
          }
        },
        14,
        14,
        false
      );
    }

    bumpCache[type] = tex;
    return tex;
  }

  // ==================== RICH PRODUCT ALBEDO TEXTURES ====================
  /**
   * Generates authentic procedural product color maps (Batik Parang, Batik Kawung,
   * Batik Mega Mendung, Selvedge Denim, Dress Shirt Stripes, Striped Ribbing, etc.).
   */
  function getProductAlbedoTexture(patternType, baseHex, accentHex) {
    if (!patternType || patternType === 'solid') return null;
    const key = `${patternType}_${baseHex}_${accentHex || ''}`;
    if (albedoCache[key]) return albedoCache[key];

    const accent = accentHex || '#d4a96a';
    const lightAccent = shadeHex(accent, 1.22);
    const darkBase = shadeHex(baseHex, 0.68);
    let tex = null;

    if (patternType === 'batik_parang') {
      // Authentic Javanese Batik Parang diagonal wave motif
      tex = createCanvasTexture(
        512,
        (ctx, s) => {
          ctx.fillStyle = baseHex;
          ctx.fillRect(0, 0, s, s);

          ctx.save();
          ctx.translate(s * 0.5, s * 0.5);
          ctx.rotate(-Math.PI / 4);
          ctx.translate(-s, -s);

          const bandW = 64;
          for (let x = -s; x < s * 3; x += bandW) {
            // Alternating dark sogan band & cream/gold parang blade band
            ctx.fillStyle = darkBase;
            ctx.fillRect(x, -s, 14, s * 4);

            // Mlinjon diamond dots along dividing line
            ctx.fillStyle = lightAccent;
            for (let y = -s; y < s * 3; y += 36) {
              ctx.beginPath();
              ctx.moveTo(x + 7, y - 6);
              ctx.lineTo(x + 12, y);
              ctx.lineTo(x + 7, y + 6);
              ctx.lineTo(x + 2, y);
              ctx.closePath();
              ctx.fill();
            }

            // Parang S-scroll waves
            for (let y = -s; y < s * 3; y += 44) {
              ctx.strokeStyle = accent;
              ctx.lineWidth = 9;
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.moveTo(x + 22, y);
              ctx.bezierCurveTo(x + 52, y + 8, x + 52, y + 26, x + 26, y + 34);
              ctx.stroke();

              // Inner fine canting highlight stroke
              ctx.strokeStyle = lightAccent;
              ctx.lineWidth = 2.5;
              ctx.beginPath();
              ctx.moveTo(x + 24, y + 4);
              ctx.bezierCurveTo(x + 46, y + 10, x + 46, y + 24, x + 28, y + 30);
              ctx.stroke();

              // Fine cecek dots
              ctx.fillStyle = lightAccent;
              ctx.beginPath();
              ctx.arc(x + 54, y + 16, 2.2, 0, Math.PI * 2);
              ctx.arc(x + 54, y + 24, 2.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
        },
        3.2,
        2.6,
        true
      );
    } else if (patternType === 'batik_kawung') {
      // Classic Batik Kawung four-petal geometric rosette motif
      tex = createCanvasTexture(
        512,
        (ctx, s) => {
          ctx.fillStyle = baseHex;
          ctx.fillRect(0, 0, s, s);

          const step = 64;
          for (let row = 0; row <= s / step; row++) {
            for (let col = 0; col <= s / step; col++) {
              const cx = col * step;
              const cy = row * step;

              // Four intersecting kawung petals
              for (let k = 0; k < 4; k++) {
                const ang = (k * Math.PI) / 2 + Math.PI / 4;
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(ang);

                ctx.fillStyle = accent;
                ctx.beginPath();
                ctx.ellipse(20, 0, 18, 9, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = darkBase;
                ctx.lineWidth = 2;
                ctx.stroke();

                // Inner twin dots (isen-isen)
                ctx.fillStyle = darkBase;
                ctx.beginPath();
                ctx.arc(16, 0, 2.2, 0, Math.PI * 2);
                ctx.arc(24, 0, 2.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
              }

              // Center diamond rosette
              ctx.fillStyle = lightAccent;
              ctx.beginPath();
              ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = darkBase;
              ctx.beginPath();
              ctx.arc(cx, cy, 2.4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        },
        3.5,
        3.0,
        true
      );
    } else if (patternType === 'batik_megamendung') {
      // Stylized Cirebon Mega Mendung layered cloud motif
      tex = createCanvasTexture(
        512,
        (ctx, s) => {
          ctx.fillStyle = baseHex;
          ctx.fillRect(0, 0, s, s);

          const drawCloud = (cx, cy, scale) => {
            const layers = [
              { s: 1.0, col: shadeHex(accent, 0.65) },
              { s: 0.78, col: accent },
              { s: 0.56, col: lightAccent },
              { s: 0.34, col: shadeHex(baseHex, 1.35) }
            ];
            layers.forEach((l) => {
              ctx.save();
              ctx.translate(cx, cy);
              ctx.scale(scale * l.s, scale * l.s);
              ctx.fillStyle = l.col;
              ctx.beginPath();
              ctx.moveTo(-70, 18);
              ctx.bezierCurveTo(-78, -8, -48, -28, -22, -16);
              ctx.bezierCurveTo(-12, -40, 24, -40, 34, -14);
              ctx.bezierCurveTo(60, -24, 82, -2, 68, 18);
              ctx.bezierCurveTo(38, 28, -36, 28, -70, 18);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            });
          };

          for (let y = 32; y < s + 64; y += 128) {
            for (let x = 0; x <= s + 128; x += 170) {
              const offsetX = (Math.floor(y / 128) % 2) * 85;
              drawCloud(x + offsetX, y, 0.92);
            }
          }
        },
        2.5,
        2.2,
        true
      );
    } else if (patternType === 'denim_weave') {
      // Authentic indigo selvedge denim texture with subtle vertical slub & fade
      tex = createCanvasTexture(
        256,
        (ctx, s) => {
          ctx.fillStyle = baseHex;
          ctx.fillRect(0, 0, s, s);
          const lighter = shadeHex(baseHex, 1.22);
          const darker = shadeHex(baseHex, 0.80);

          for (let i = -s; i < s * 2; i += 4) {
            ctx.strokeStyle = lighter;
            ctx.globalAlpha = 0.25;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + s, s);
            ctx.stroke();
          }
          // Vertical warp threads
          for (let x = 0; x < s; x += 3) {
            ctx.fillStyle = x % 6 === 0 ? darker : lighter;
            ctx.globalAlpha = 0.14;
            ctx.fillRect(x, 0, 1, s);
          }
          ctx.globalAlpha = 1;
        },
        7,
        7,
        true
      );
    } else if (patternType === 'pinstripe_shirt') {
      // Crisp tailored dress shirt fine stripes
      tex = createCanvasTexture(
        256,
        (ctx, s) => {
          ctx.fillStyle = baseHex;
          ctx.fillRect(0, 0, s, s);
          ctx.fillStyle = accent;
          for (let x = 0; x < s; x += 16) {
            ctx.fillRect(x, 0, 2.5, s);
          }
        },
        8,
        2,
        true
      );
    } else if (patternType === 'varsity_rib') {
      // 3-band athletic striped ribbing for varsity collar, hem & cuffs
      tex = createCanvasTexture(
        256,
        (ctx, s) => {
          ctx.fillStyle = baseHex;
          ctx.fillRect(0, 0, s, s);
          // Crisp double white/cream athletic stripes horizontally
          ctx.fillStyle = accent;
          ctx.fillRect(0, s * 0.24, s, s * 0.14);
          ctx.fillRect(0, s * 0.60, s, s * 0.14);
          // Vertical rib knit shadows
          for (let x = 0; x < s; x += 6) {
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            ctx.fillRect(x, 0, 2, s);
          }
        },
        6,
        1,
        true
      );
    } else if (patternType === 'varsity_patch') {
      // Embroidered chenille "A" Atelier varsity crest
      tex = createCanvasTexture(
        256,
        (ctx, s) => {
          ctx.clearRect(0, 0, s, s);
          // Outer cream felt border
          ctx.fillStyle = '#f4efe4';
          ctx.beginPath();
          ctx.arc(s / 2, s / 2, 108, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 10;
          ctx.strokeStyle = baseHex;
          ctx.stroke();

          // Bold varsity letter "A"
          ctx.fillStyle = accent;
          ctx.font = 'bold 148px Georgia, serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('A', s / 2, s / 2 + 8);
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#1c1917';
          ctx.strokeText('A', s / 2, s / 2 + 8);
        },
        1,
        1,
        true
      );
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
    } else if (patternType === 'street_graphic') {
      // Minimalist streetwear chest emblem texture
      tex = createCanvasTexture(
        256,
        (ctx, s) => {
          ctx.clearRect(0, 0, s, s);
          ctx.strokeStyle = accent;
          ctx.lineWidth = 7;
          ctx.strokeRect(24, 52, s - 48, s - 104);
          ctx.fillStyle = accent;
          ctx.font = '700 42px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('ATELIER', s / 2, s / 2 - 14);
          ctx.font = '600 22px sans-serif';
          ctx.fillText('TOKYO • 026', s / 2, s / 2 + 28);
        },
        1,
        1,
        true
      );
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
    }

    if (tex) albedoCache[key] = tex;
    return tex;
  }

  function getPedestalTexture() {
    if (albedoCache.pedestal) return albedoCache.pedestal;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 250);
    grad.addColorStop(0, '#f7f4ee');
    grad.addColorStop(0.76, '#eae4d9');
    grad.addColorStop(1, '#dad2c5');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Precision studio turntable markings
    ctx.strokeStyle = 'rgba(92, 80, 66, 0.16)';
    ctx.lineWidth = 1.5;
    [125, 188, 236].forEach((r) => {
      ctx.beginPath();
      ctx.arc(256, 256, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      const inner = deg % 45 === 0 ? 212 : 224;
      ctx.beginPath();
      ctx.moveTo(256 + Math.cos(rad) * inner, 256 + Math.sin(rad) * inner);
      ctx.lineTo(256 + Math.cos(rad) * 236, 256 + Math.sin(rad) * 236);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    albedoCache.pedestal = tex;
    return tex;
  }

  return {
    getFabricBump,
    getProductAlbedoTexture,
    getPedestalTexture
  };
})();
