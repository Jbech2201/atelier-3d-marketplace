(function () {
  const Data = window.AtelierData;
  const Fit = window.FitEngine;
  const Scene = window.SceneManager;

  const STORAGE_PROFILES_KEY = 'atelier3d_body_profiles_v1';
  const STORAGE_OUTFITS_KEY = 'atelier3d_saved_outfits_v1';

  // ==================== APPLICATION STATE ====================
  const state = {
    presetId: 'male-standard',
    genderBias: 0.0,
    materialId: 'clay',
    lighting: 'daylight',
    body: { ...Data.MANNEQUIN_PRESETS[0].body },
    equipped: {
      top: { productId: 'tee-heavyweight', size: 'L', colorHex: '#f2eee6', colorName: 'Warm Off-White' },
      outer: { productId: 'varsity-heritage', size: 'L', colorHex: '#1e4234', colorName: 'Forest Green & Cream' },
      bottom: { productId: 'pants-jeans-selvedge', size: 'L', colorHex: '#283e5c', colorName: 'Deep Indigo Raw' },
      shoes: { productId: 'shoes-minimal-sneaker', size: 'L', colorHex: '#eae2d3', colorName: 'Cream & Forest Stripe' }
    },
    cardSelectedColor: {}, // productId -> colorIdx
    heatmapMode: false,
    xrayMode: false,
    fitBreakdownOpen: false,
    activeCategory: 'all',
    searchQuery: '',
    sortBy: 'fit',
    pose: 'idle',
    autoRotate: false,
    cart: [],
    promoApplied: false,
    savedProfiles: loadFromStorage(STORAGE_PROFILES_KEY, []),
    savedOutfits: loadFromStorage(STORAGE_OUTFITS_KEY, [])
  };

  let rebuildScheduled = false;

  function loadFromStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function saveToStorage(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {}
  }

  function showToast(msg) {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      el.style.transition = 'all 0.25s ease';
      setTimeout(() => el.remove(), 260);
    }, 2400);
  }

  // ==================== SCHEDULED 3D REBUILD ====================
  function requestSceneRebuild() {
    if (rebuildScheduled) return;
    rebuildScheduled = true;
    requestAnimationFrame(() => {
      rebuildScheduled = false;
      Scene.rebuildMannequinAndGarments(state);
      renderComfortHUD();
      renderEquippedHUD();
    });
  }

  // ==================== LEFT PANEL: PRESETS, MATERIALS, SLIDERS ====================
  function renderPresets() {
    const grid = document.getElementById('presetGrid');
    grid.innerHTML = Data.MANNEQUIN_PRESETS.map((p) => {
      const active = state.presetId === p.id ? 'active' : '';
      return `
        <button class="preset-card ${active}" data-preset="${p.id}">
          <span class="preset-name">${p.name}</span>
          <span class="preset-meta">${p.subtitle}</span>
        </button>
      `;
    }).join('');

    grid.querySelectorAll('.preset-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = Data.MANNEQUIN_PRESETS.find((x) => x.id === btn.dataset.preset);
        if (!preset) return;
        state.presetId = preset.id;
        state.genderBias = preset.genderBias;
        state.body = { ...preset.body };
        autoAdjustEquippedSizes();
        renderPresets();
        syncSlidersFromState();
        updateBodySummaryUI();
        renderCatalog();
        requestSceneRebuild();
        Scene.setCameraPreset('full', state.body.height);
        showToast(`Manekin diubah ke ${preset.name}`);
      });
    });
  }

  function renderMaterials() {
    const row = document.getElementById('materialRow');
    row.innerHTML = Data.MANNEQUIN_MATERIALS.map((m) => {
      const active = state.materialId === m.id ? 'active' : '';
      return `
        <button class="material-swatch ${active}" data-mat="${m.id}">
          <span class="swatch-dot" style="background:${m.swatch}"></span>
          <span>${m.name}</span>
        </button>
      `;
    }).join('');

    row.querySelectorAll('.material-swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.materialId = btn.dataset.mat;
        renderMaterials();
        requestSceneRebuild();
      });
    });
  }

  function renderSliders() {
    const container = document.getElementById('measurementSliders');
    container.innerHTML = Data.MEASUREMENT_CONFIG.map((cfg) => {
      const val = state.body[cfg.key];
      return `
        <div class="slider-item">
          <div class="slider-label-row">
            <label for="slider-${cfg.key}">${cfg.label}</label>
            <span class="slider-val" id="val-${cfg.key}">${val} ${cfg.unit}</span>
          </div>
          <input type="range" id="slider-${cfg.key}" data-key="${cfg.key}"
                 min="${cfg.min}" max="${cfg.max}" step="1" value="${val}" />
        </div>
      `;
    }).join('');

    container.querySelectorAll('input[type="range"]').forEach((input) => {
      input.addEventListener('input', (e) => {
        const key = e.target.dataset.key;
        const num = Number(e.target.value);
        state.body[key] = num;
        document.getElementById(`val-${key}`).textContent = `${num} cm`;
        updateBodySummaryUI();
        requestSceneRebuild();
      });
      input.addEventListener('change', () => {
        renderCatalog(); // Recompute fit match badges across catalog after slider release
      });
    });
  }

  function syncSlidersFromState() {
    Data.MEASUREMENT_CONFIG.forEach((cfg) => {
      const el = document.getElementById(`slider-${cfg.key}`);
      const valEl = document.getElementById(`val-${cfg.key}`);
      if (el) el.value = state.body[cfg.key];
      if (valEl) valEl.textContent = `${state.body[cfg.key]} ${cfg.unit}`;
    });
  }

  function updateBodySummaryUI() {
    const info = Fit.analyzeBodyProfile(state.body);
    document.getElementById('estimatedBaseSize').textContent = `Size ${info.baseSize}`;
    document.getElementById('estimatedSilhouette').textContent = info.silhouette;
    document.getElementById('estimatedWeight').textContent = `± ${info.estWeight} kg`;
    document.getElementById('profileSummaryText').textContent =
      `${state.body.height} cm • Dada ${state.body.chest} • Pinggang ${state.body.waist}`;
    document.getElementById('bodyShapeBadge').textContent = info.silhouette;
  }

  function autoAdjustEquippedSizes() {
    Object.keys(state.equipped).forEach((slot) => {
      const eq = state.equipped[slot];
      if (!eq) return;
      const product = Data.getProductById(eq.productId);
      if (!product) return;
      const rec = Fit.recommendBestSize(product, state.body);
      eq.size = rec.size;
    });
  }

  // ==================== CENTER STAGE HUD: COMFORT TELEMETRY & EQUIPPED ====================
  function renderComfortHUD() {
    const activeEntries = Object.entries(state.equipped)
      .filter(([, v]) => !!v)
      .map(([slot, eq]) => {
        const product = Data.getProductById(eq.productId);
        const evalRes = Fit.evaluateGarmentFit(product, eq.size, state.body);
        return { slot, eq, product, evalRes };
      });

    const scoreEl = document.getElementById('overallComfortScore');
    const ringEl = document.getElementById('comfortRing');
    const verdictEl = document.getElementById('overallComfortVerdict');

    if (activeEntries.length === 0) {
      scoreEl.textContent = '--';
      ringEl.style.borderColor = '#d4cdc2';
      verdictEl.textContent = 'Pilih pakaian di katalog untuk mulai uji coba 3D';
      document.getElementById('breakdownZones').innerHTML =
        '<div style="grid-column:1/-1;font-size:12px;color:#6c665f;">Belum ada pakaian yang dipakai di manekin.</div>';
      return;
    }

    // Prioritize clothing items (non-shoes) for comfort score
    const clothingEntries = activeEntries.filter((e) => e.product.category !== 'shoes');
    const list = clothingEntries.length > 0 ? clothingEntries : activeEntries;

    const avgScore = Math.round(list.reduce((s, x) => s + x.evalRes.score, 0) / list.length);
    const worstItem = list.reduce((a, b) => (a.evalRes.score < b.evalRes.score ? a : b));

    scoreEl.textContent = `${avgScore}%`;
    if (worstItem.evalRes.status === 'tight') {
      ringEl.style.borderColor = '#ef4444';
      verdictEl.textContent = `${worstItem.product.name} (${worstItem.eq.size}) sempit — coba Size ${worstItem.evalRes.recommendedSize}`;
    } else if (worstItem.evalRes.status === 'snug') {
      ringEl.style.borderColor = '#f59e0b';
      verdictEl.textContent = `Agak ketat di ${worstItem.product.name} • Rekomendasi: ${worstItem.evalRes.recommendedSize}`;
    } else if (avgScore >= 90) {
      ringEl.style.borderColor = '#10b981';
      verdictEl.textContent = `Sangat Nyaman! Proporsi kain ideal di tubuh manekinmu`;
    } else {
      ringEl.style.borderColor = '#3b82f6';
      verdictEl.textContent = `Gaya Longgar / Relaxed Fit • Ruang gerak lega`;
    }

    // Breakdown popover for primary clothing item (worst-scoring or top/dress/outer)
    document.getElementById('breakdownGarmentTitle').textContent =
      `${worstItem.product.name} (Size ${worstItem.eq.size})`;
    document.getElementById('breakdownRecSize').textContent =
      `Rekomendasi: Size ${worstItem.evalRes.recommendedSize}`;

    const zonesHtml = Object.values(worstItem.evalRes.zones)
      .map((z) => {
        const label = Fit.ZONE_LABELS[z.zone] || z.zone;
        return `
          <div class="zone-card">
            <div class="zone-top">
              <span>${label}</span>
              <span style="color:${z.colorHex}">${z.label}</span>
            </div>
            <div class="zone-bar-track">
              <div class="zone-bar-fill" style="width:${z.score}%;background:${z.colorHex}"></div>
            </div>
            <div class="zone-note">${z.note}</div>
          </div>
        `;
      })
      .join('');
    document.getElementById('breakdownZones').innerHTML = zonesHtml;
  }

  function renderEquippedHUD() {
    const listEl = document.getElementById('equippedList');
    const slots = ['outer', 'top', 'dress', 'bottom', 'shoes'];
    const items = slots.filter((s) => state.equipped[s]).map((s) => ({ slot: s, ...state.equipped[s] }));

    if (items.length === 0) {
      listEl.innerHTML = '<div class="equipped-empty">Manekin belum memakai pakaian.<br/>Klik "Coba di Manekin" di katalog →</div>';
      return;
    }

    listEl.innerHTML = items
      .map((item) => {
        const p = Data.getProductById(item.productId);
        if (!p) return '';
        const rec = Fit.recommendBestSize(p, state.body);
        const sizeButtons = p.sizes
          .map((sz) => {
            const cls = [
              'size-mini-btn',
              sz === item.size ? 'active' : '',
              sz === rec.size ? 'recommended' : ''
            ].join(' ');
            return `<button class="${cls}" data-slot="${item.slot}" data-size="${sz}" title="${sz === rec.size ? 'Ukuran direkomendasikan' : ''}">${sz}</button>`;
          })
          .join('');

        const colorDots = p.colors
          .map((c) => {
            const act = c.hex === item.colorHex ? 'active' : '';
            return `<button class="color-mini-dot ${act}" style="background:${c.hex}" title="${c.name}" data-slot="${item.slot}" data-color="${c.hex}" data-cname="${c.name}"></button>`;
          })
          .join('');

        return `
          <div class="equipped-item">
            <div class="equipped-item-top">
              <span class="equipped-item-name" title="${p.name}">${p.name}</span>
              <button class="equipped-remove" data-remove-slot="${item.slot}" title="Lepas item">✕</button>
            </div>
            <div class="equipped-controls">
              <div class="size-mini-group">${sizeButtons}</div>
              <div class="color-mini-group">${colorDots}</div>
            </div>
          </div>
        `;
      })
      .join('');

    listEl.querySelectorAll('[data-size]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = btn.dataset.slot;
        if (state.equipped[slot]) {
          state.equipped[slot].size = btn.dataset.size;
          requestSceneRebuild();
        }
      });
    });

    listEl.querySelectorAll('[data-color]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = btn.dataset.slot;
        if (state.equipped[slot]) {
          state.equipped[slot].colorHex = btn.dataset.color;
          state.equipped[slot].colorName = btn.dataset.cname;
          requestSceneRebuild();
        }
      });
    });

    listEl.querySelectorAll('[data-remove-slot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        delete state.equipped[btn.dataset.removeSlot];
        renderCatalog();
        requestSceneRebuild();
      });
    });
  }

  // ==================== RIGHT PANEL: CURATED LOOKS & MARKETPLACE CATALOG ====================
  function renderCuratedLooks() {
    const row = document.getElementById('curatedLooksRow');
    if (!row || !Data.CURATED_LOOKS) return;

    row.innerHTML = Data.CURATED_LOOKS.map(
      (look) => `<button class="look-chip" data-look-id="${look.id}">✦ ${look.name}</button>`
    ).join('');

    row.querySelectorAll('[data-look-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const look = Data.CURATED_LOOKS.find((l) => l.id === btn.dataset.lookId);
        if (!look) return;

        if (look.presetId) {
          const preset = Data.MANNEQUIN_PRESETS.find((p) => p.id === look.presetId);
          if (preset) {
            state.presetId = preset.id;
            state.genderBias = preset.genderBias;
            state.body = { ...preset.body };
            renderPresets();
            syncSlidersFromState();
            updateBodySummaryUI();
          }
        }

        state.equipped = {};
        Object.entries(look.items).forEach(([slot, cfg]) => {
          const prod = Data.getProductById(cfg.productId);
          if (!prod) return;
          const col = prod.colors[cfg.colorIdx || 0] || prod.colors[0];
          const rec = Fit.recommendBestSize(prod, state.body);
          state.cardSelectedColor[prod.id] = cfg.colorIdx || 0;
          state.equipped[slot] = {
            productId: prod.id,
            size: rec.size,
            colorHex: col.hex,
            colorName: col.name
          };
        });

        renderCatalog();
        requestSceneRebuild();
        Scene.setCameraPreset('full', state.body.height);
        showToast(`Look "${look.name}" dipasang lengkap ke manekin 3D`);
      });
    });
  }

  function getGarmentIconSVG(product, colorObj) {
    const hex = colorObj.hex;
    const sec = colorObj.secondary || '#e8e2d8';
    const acc = colorObj.accent || '#d4a96a';
    const s = product.style;

    if (s === 'varsity') {
      return `<svg viewBox="0 0 64 64">
        <path d="M18 14l-10 9 6 12 6-5V14z" fill="${sec}" stroke="#1c1917" stroke-width="1.8"/>
        <path d="M46 14l10 9-6 12-6-5V14z" fill="${sec}" stroke="#1c1917" stroke-width="1.8"/>
        <path d="M19 13c5 4 21 4 26 0l1 40H18l1-40z" fill="${hex}" stroke="#1c1917" stroke-width="1.8"/>
        <rect x="18" y="48" width="28" height="5" fill="${hex}" stroke="#1c1917" stroke-width="1.4"/>
        <line x1="19" y1="50.5" x2="45" y2="50.5" stroke="${sec}" stroke-width="1.8"/>
        <line x1="32" y1="16" x2="32" y2="52" stroke="${sec}" stroke-width="1.6" stroke-dasharray="2 3"/>
        <circle cx="25" cy="27" r="4.2" fill="${sec}" stroke="${acc}" stroke-width="1.2"/>
        <text x="25" y="29" text-anchor="middle" font-size="6" font-weight="800" fill="${hex}">A</text>
      </svg>`;
    }

    if (s === 'leather_jacket') {
      return `<svg viewBox="0 0 64 64">
        <path d="M19 12l13 8 13-8 11 10-6 13-5-4v22H19V31l-5 4-6-13 11-10z" fill="${hex}" stroke="#111" stroke-width="1.8"/>
        <path d="M21 13l11 9-5 9-7-8z" fill="#2d2d30" stroke="#c8cdd4" stroke-width="1"/>
        <path d="M43 13l-11 9 5 9 7-8z" fill="#2d2d30" stroke="#c8cdd4" stroke-width="1"/>
        <line x1="35" y1="20" x2="31" y2="50" stroke="#dce0e6" stroke-width="2"/>
        <rect x="19" y="47" width="26" height="5" fill="#151517" stroke="#c8cdd4" stroke-width="1"/>
        <rect x="29" y="46" width="6" height="7" fill="none" stroke="#dce0e6" stroke-width="1.5"/>
      </svg>`;
    }

    if (s === 'denim_jacket') {
      return `<svg viewBox="0 0 64 64">
        <path d="M19 12l13 6 13-6 11 10-6 13-5-4v22H19V31l-5 4-6-13 11-10z" fill="${hex}" stroke="#1c1917" stroke-width="1.8"/>
        <line x1="32" y1="18" x2="32" y2="53" stroke="${sec}" stroke-width="1.5"/>
        <rect x="22" y="24" width="7" height="7" fill="${hex}" stroke="${sec}" stroke-width="1.2"/>
        <rect x="35" y="24" width="7" height="7" fill="${hex}" stroke="${sec}" stroke-width="1.2"/>
        <circle cx="32" cy="24" r="1.3" fill="${acc}"/><circle cx="32" cy="34" r="1.3" fill="${acc}"/><circle cx="32" cy="44" r="1.3" fill="${acc}"/>
      </svg>`;
    }

    if (s === 'hoodie') {
      return `<svg viewBox="0 0 64 64">
        <path d="M22 14c0-7 20-7 20 0" fill="${sec}" stroke="#1c1917" stroke-width="1.8"/>
        <path d="M19 14h26l11 11-6 12-5-4v21H19V33l-5 4-6-12 11-11z" fill="${hex}" stroke="#1c1917" stroke-width="1.8"/>
        <line x1="29" y1="16" x2="29" y2="30" stroke="${acc}" stroke-width="1.6"/>
        <line x1="35" y1="16" x2="35" y2="30" stroke="${acc}" stroke-width="1.6"/>
        <path d="M23 39h18l2 10H21l2-10z" fill="${sec}" stroke="#1c1917" stroke-width="1.2"/>
      </svg>`;
    }

    if (s === 'batik_shirt' || s === 'shirt') {
      const patternLines =
        s === 'batik_shirt'
          ? `<path d="M20 22l24 14M20 32l24 14M20 42l18 11" stroke="${acc}" stroke-width="2.2" opacity="0.85"/>
             <circle cx="26" cy="26" r="1.5" fill="${acc}"/><circle cx="38" cy="34" r="1.5" fill="${acc}"/><circle cx="28" cy="44" r="1.5" fill="${acc}"/>`
          : `<line x1="25" y1="18" x2="25" y2="52" stroke="${acc}" stroke-width="1" opacity="0.6"/>
             <line x1="39" y1="18" x2="39" y2="52" stroke="${acc}" stroke-width="1" opacity="0.6"/>`;
      return `<svg viewBox="0 0 64 64">
        <path d="M20 12l12 6 12-6 11 10-6 13-5-4v23H20V31l-5 4-6-13 11-10z" fill="${hex}" stroke="#1c1917" stroke-width="1.8"/>
        ${patternLines}
        <path d="M24 12l8 8 8-8" fill="none" stroke="#1c1917" stroke-width="1.8"/>
        <line x1="32" y1="20" x2="32" y2="53" stroke="#1c1917" stroke-width="1.3"/>
      </svg>`;
    }

    if (s === 'jeans' || s === 'chinos' || s === 'cargo') {
      const extra =
        s === 'cargo'
          ? `<rect x="13" y="29" width="5" height="9" fill="${sec}" stroke="#1c1917" stroke-width="1.2"/>
             <rect x="46" y="29" width="5" height="9" fill="${sec}" stroke="#1c1917" stroke-width="1.2"/>`
          : s === 'jeans'
          ? `<line x1="18" y1="15" x2="46" y2="15" stroke="${sec}" stroke-width="1.5"/>
             <rect x="14" y="49" width="12" height="4" fill="${sec}" opacity="0.7"/>
             <rect x="38" y="49" width="12" height="4" fill="${sec}" opacity="0.7"/>`
          : '';
      return `<svg viewBox="0 0 64 64">
        <path d="M18 10h28l4 44H38l-6-26-6 26H14l4-44z" fill="${hex}" stroke="#1c1917" stroke-width="1.8"/>
        <line x1="32" y1="10" x2="32" y2="23" stroke="#1c1917" stroke-width="1.4"/>
        ${extra}
      </svg>`;
    }

    if (s === 'skirt') {
      return `<svg viewBox="0 0 64 64">
        <path d="M21 12h22l10 42H11L21 12z" fill="${hex}" stroke="#1c1917" stroke-width="1.8"/>
        <line x1="27" y1="16" x2="23" y2="53" stroke="${sec}" stroke-width="1.4"/>
        <line x1="32" y1="16" x2="32" y2="53" stroke="${sec}" stroke-width="1.4"/>
        <line x1="37" y1="16" x2="41" y2="53" stroke="${sec}" stroke-width="1.4"/>
      </svg>`;
    }

    if (product.category === 'dress') {
      const batikDots =
        s === 'dress_batik'
          ? `<circle cx="32" cy="39" r="3" fill="${acc}"/><circle cx="24" cy="45" r="2.6" fill="${acc}"/><circle cx="40" cy="45" r="2.6" fill="${acc}"/><circle cx="32" cy="49" r="2.6" fill="${acc}"/>`
          : '';
      return `<svg viewBox="0 0 64 64">
        <path d="M22 10l4 7h12l4-7 6 8-6 10 10 26H12l10-26-6-10 6-8z" fill="${hex}" stroke="#1c1917" stroke-width="1.8"/>
        <rect x="21" y="27" width="22" height="4.5" fill="${sec}" stroke="#1c1917" stroke-width="1.1"/>
        ${batikDots}
      </svg>`;
    }

    if (s === 'pantofel') {
      return `<svg viewBox="0 0 64 64">
        <path d="M10 37l8-13 13 9c10 2 20 3 23 10v3H10v-9z" fill="${hex}" stroke="#111" stroke-width="1.8"/>
        <rect x="10" y="45" width="13" height="6" fill="${sec}" stroke="#111" stroke-width="1.4"/>
        <rect x="23" y="45" width="31" height="3.2" fill="${sec}" stroke="#111" stroke-width="1.2"/>
        <path d="M42 35c2 3 2 7 1 10" stroke="#555" stroke-width="1.4" fill="none"/>
      </svg>`;
    }

    if (s === 'sneakers') {
      return `<svg viewBox="0 0 64 64">
        <path d="M10 38l9-14 14 9c8 2 16 4 19 10v4H10v-9z" fill="${hex}" stroke="#1c1917" stroke-width="1.8"/>
        <rect x="10" y="43" width="42" height="6" rx="2" fill="${sec}" stroke="#1c1917" stroke-width="1.5"/>
        <path d="M22 39l13-4" stroke="${acc}" stroke-width="3" stroke-linecap="round"/>
        <line x1="25" y1="29" x2="31" y2="33" stroke="#fff" stroke-width="1.6"/>
      </svg>`;
    }

    if (product.category === 'outer') {
      return `<svg viewBox="0 0 64 64"><path d="M20 12l12 6 12-6 10 10-6 12-4-4v24H20V30l-4 4-6-12 10-10z" fill="${hex}" stroke="#1c1917" stroke-width="1.8"/><line x1="32" y1="18" x2="32" y2="54" stroke="#1c1917" stroke-width="1.8"/></svg>`;
    }

    // Heavyweight / Oversized Tee / Knit
    const graphic =
      s === 'oversized_tee'
        ? `<rect x="26" y="25" width="12" height="8" fill="none" stroke="${acc}" stroke-width="1.4"/>`
        : '';
    return `<svg viewBox="0 0 64 64">
      <path d="M20 12c4 5 20 5 24 0l10 10-7 10-5-4v26H22V28l-5 4-7-10 10-10z" fill="${hex}" stroke="#1c1917" stroke-width="1.8"/>
      ${graphic}
    </svg>`;
  }

  function isProductWorn(product) {
    const eq = state.equipped[product.slot];
    return eq && eq.productId === product.id;
  }

  function equipProduct(product, customSize, customColorHex, customColorName) {
    const colorIdx = state.cardSelectedColor[product.id] || 0;
    const chosenColor = product.colors[colorIdx] || product.colors[0];
    const rec = Fit.recommendBestSize(product, state.body);

    // Handle dress <-> top/bottom mutual exclusivity cleanly
    if (product.slot === 'dress') {
      delete state.equipped.top;
      delete state.equipped.bottom;
    } else if (product.slot === 'top' || product.slot === 'bottom') {
      delete state.equipped.dress;
    }

    state.equipped[product.slot] = {
      productId: product.id,
      size: customSize || rec.size,
      colorHex: customColorHex || chosenColor.hex,
      colorName: customColorName || chosenColor.name
    };

    renderCatalog();
    requestSceneRebuild();
    showToast(`Dipasang: ${product.name} (Size ${state.equipped[product.slot].size})`);
  }

  function renderCatalog() {
    const grid = document.getElementById('catalogGrid');
    const q = state.searchQuery.trim().toLowerCase();

    let items = Data.CATALOG.filter((p) => {
      if (state.activeCategory !== 'all' && p.category !== state.activeCategory) return false;
      if (q && !(p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.fabricLabel.toLowerCase().includes(q))) {
        return false;
      }
      return true;
    }).map((p) => ({
      product: p,
      rec: Fit.recommendBestSize(p, state.body)
    }));

    if (state.sortBy === 'fit') {
      items.sort((a, b) => b.rec.score - a.rec.score);
    } else if (state.sortBy === 'popular') {
      items.sort((a, b) => b.product.sold - a.product.sold);
    } else if (state.sortBy === 'price-asc') {
      items.sort((a, b) => a.product.price - b.product.price);
    } else if (state.sortBy === 'price-desc') {
      items.sort((a, b) => b.product.price - a.product.price);
    }

    if (items.length === 0) {
      grid.innerHTML = '<div style="text-align:center;padding:30px 10px;color:#6c665f;font-size:13px;">Tidak ada produk yang cocok dengan pencarianmu.</div>';
      return;
    }

    grid.innerHTML = items
      .map(({ product: p, rec }) => {
        const worn = isProductWorn(p);
        const colorIdx = state.cardSelectedColor[p.id] || 0;
        const activeColor = p.colors[colorIdx] || p.colors[0];
        const matchCls = rec.score >= 90 ? 'high' : 'mid';

        const swatches = p.colors
          .map(
            (c, i) =>
              `<button class="card-swatch ${i === colorIdx ? 'active' : ''}" style="background:${c.hex}" title="${c.name}" data-swatch-prod="${p.id}" data-swatch-idx="${i}"></button>`
          )
          .join('');

        return `
          <article class="product-card ${worn ? 'wearing' : ''}">
            <div class="product-top">
              <div class="product-thumb" style="background:linear-gradient(145deg,#f6f3ee,#e8e2d8)">
                ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
                ${getGarmentIconSVG(p, activeColor)}
                ${worn ? '<span class="wearing-tag">Dipakai</span>' : ''}
              </div>
              <div class="product-info">
                <div class="product-brand-row">
                  <span>${p.brand} • ★ ${p.rating}</span>
                  <span class="fit-match-pill ${matchCls}">${rec.score}% Fit • ${rec.size}</span>
                </div>
                <div class="product-name">${p.name}</div>
                <div class="product-fabric">${p.fabricLabel}</div>
                <div class="product-price-row">
                  <span class="product-price">${Data.formatRupiah(p.price)}</span>
                  <div class="product-swatches">${swatches}</div>
                </div>
              </div>
            </div>
            <div class="product-actions">
              <button class="btn-try ${worn ? 'active' : ''}" data-try="${p.id}">
                ${worn ? '✓ Sedang Dicoba (Lepas)' : 'Coba di Manekin 3D'}
              </button>
              <button class="btn-detail-mini" data-detail="${p.id}">Size</button>
              <button class="btn-cart-mini" data-add-cart="${p.id}">+ Cart</button>
            </div>
          </article>
        `;
      })
      .join('');

    // Swatch clicks
    grid.querySelectorAll('[data-swatch-prod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.swatchProd;
        const idx = Number(btn.dataset.swatchIdx);
        state.cardSelectedColor[pid] = idx;
        const p = Data.getProductById(pid);
        if (p && isProductWorn(p)) {
          state.equipped[p.slot].colorHex = p.colors[idx].hex;
          state.equipped[p.slot].colorName = p.colors[idx].name;
          requestSceneRebuild();
        }
        renderCatalog();
      });
    });

    // Try on clicks
    grid.querySelectorAll('[data-try]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = Data.getProductById(btn.dataset.try);
        if (!p) return;
        if (isProductWorn(p)) {
          delete state.equipped[p.slot];
          renderCatalog();
          requestSceneRebuild();
          showToast(`${p.name} dilepas dari manekin`);
        } else {
          equipProduct(p);
        }
      });
    });

    // Detail modal clicks
    grid.querySelectorAll('[data-detail]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = Data.getProductById(btn.dataset.detail);
        if (p) openProductDetailModal(p);
      });
    });

    // Quick Add to Cart
    grid.querySelectorAll('[data-add-cart]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = Data.getProductById(btn.dataset.addCart);
        if (!p) return;
        const eq = isProductWorn(p) ? state.equipped[p.slot] : null;
        const rec = Fit.recommendBestSize(p, state.body);
        const colorIdx = state.cardSelectedColor[p.id] || 0;
        const chosenColor = eq
          ? { hex: eq.colorHex, name: eq.colorName }
          : (p.colors[colorIdx] || p.colors[0]);

        addToCart(p, eq ? eq.size : rec.size, chosenColor.hex, chosenColor.name, !!eq);
      });
    });
  }

  // ==================== PRODUCT DETAIL & SIZE COMPARISON MODAL ====================
  function openProductDetailModal(product) {
    const rec = Fit.recommendBestSize(product, state.body);
    const rows = product.sizes
      .map((sz) => {
        const ev = Fit.evaluateGarmentFit(product, sz, state.body);
        const gm = Fit.getGarmentMeasurements(product, sz);
        const isRec = sz === rec.size;
        return `
          <tr class="${isRec ? 'rec-row' : ''}">
            <td>${sz} ${isRec ? '★' : ''}</td>
            <td>${gm.shoulder} cm</td>
            <td>${gm.chest} cm</td>
            <td>${gm.waist} cm</td>
            <td>${gm.hip} cm</td>
            <td style="color:${ev.status === 'tight' ? '#dc2626' : ev.status === 'snug' ? '#d97706' : '#059669'}">
              ${ev.score}% (${ev.verdict.split('—')[0].trim()})
            </td>
          </tr>
        `;
      })
      .join('');

    const content = document.getElementById('productModalContent');
    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-right:34px;">
        <div>
          <div style="font-size:11px;font-weight:700;color:#b5653b;letter-spacing:0.6px;">${product.brand}</div>
          <h3 style="font-size:20px;margin:3px 0 4px;">${product.name}</h3>
          <div style="font-size:13px;color:#6c665f;">${product.fabricLabel} • ★ ${product.rating} (${product.sold} terjual)</div>
        </div>
        <div style="font-size:18px;font-weight:800;white-space:nowrap;">${Data.formatRupiah(product.price)}</div>
      </div>

      <p style="font-size:13px;line-height:1.55;color:#44403c;margin:12px 0;">${product.description}</p>

      <div style="background:#f5f2ec;border:1px solid #e5e0d8;border-radius:12px;padding:11px 13px;font-size:12.5px;display:flex;justify-content:space-between;align-items:center;">
        <span><strong>Ukuran Tubuh Manekinmu:</strong> Bahu ${state.body.shoulder} • Dada ${state.body.chest} • Pinggang ${state.body.waist} • Pinggul ${state.body.hip} cm</span>
        <span class="rec-pill">Terbaik: Size ${rec.size}</span>
      </div>

      <table class="size-compare-table">
        <thead>
          <tr>
            <th>Size</th>
            <th>Bahu</th>
            <th>Dada</th>
            <th>Pinggang</th>
            <th>Pinggul</th>
            <th>Skor Nyaman</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="display:flex;gap:10px;margin-top:18px;">
        <button class="btn-primary" style="flex:1" id="modalTryBest">Coba Size ${rec.size} di Manekin 3D</button>
        <button class="btn-secondary" style="flex:1" id="modalCartBest">+ Masukkan Keranjang (Size ${rec.size})</button>
      </div>
    `;

    document.getElementById('modalTryBest').addEventListener('click', () => {
      equipProduct(product, rec.size);
      closeModal('productModalBackdrop');
    });

    document.getElementById('modalCartBest').addEventListener('click', () => {
      const cIdx = state.cardSelectedColor[product.id] || 0;
      const col = product.colors[cIdx] || product.colors[0];
      addToCart(product, rec.size, col.hex, col.name, isProductWorn(product));
      closeModal('productModalBackdrop');
    });

    openModal('productModalBackdrop');
  }

  // ==================== BODY PROFILES & SAVED OUTFITS ====================
  function renderSavedProfilesModal() {
    const list = document.getElementById('savedProfilesList');
    if (state.savedProfiles.length === 0) {
      list.innerHTML = '<div style="font-size:12.5px;color:#6c665f;text-align:center;padding:14px;">Belum ada profil tersimpan. Masukkan nama di atas untuk menyimpan ukuran tubuh saat ini.</div>';
      return;
    }

    list.innerHTML = state.savedProfiles
      .map(
        (prof, idx) => `
          <div class="saved-row">
            <div class="saved-row-info">
              <strong>${prof.name}</strong>
              <span>${prof.body.height} cm • Bahu ${prof.body.shoulder} • Dada ${prof.body.chest} • Pinggang ${prof.body.waist} • Pinggul ${prof.body.hip}</span>
            </div>
            <div class="saved-row-actions">
              <button class="btn-secondary" data-load-prof="${idx}">Pakai</button>
              <button class="btn-mini-ghost" data-del-prof="${idx}">Hapus</button>
            </div>
          </div>
        `
      )
      .join('');

    list.querySelectorAll('[data-load-prof]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const prof = state.savedProfiles[Number(btn.dataset.loadProf)];
        if (!prof) return;
        state.body = { ...prof.body };
        state.genderBias = prof.genderBias || 0.3;
        state.presetId = '';
        autoAdjustEquippedSizes();
        renderPresets();
        syncSlidersFromState();
        updateBodySummaryUI();
        renderCatalog();
        requestSceneRebuild();
        closeModal('profilesModalBackdrop');
        showToast(`Profil "${prof.name}" diterapkan ke manekin`);
      });
    });

    list.querySelectorAll('[data-del-prof]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.savedProfiles.splice(Number(btn.dataset.delProf), 1);
        saveToStorage(STORAGE_PROFILES_KEY, state.savedProfiles);
        renderSavedProfilesModal();
      });
    });
  }

  function renderSavedOutfitsModal() {
    document.getElementById('savedOutfitCount').textContent = state.savedOutfits.length;
    const list = document.getElementById('savedOutfitsList');
    if (state.savedOutfits.length === 0) {
      list.innerHTML = '<div style="font-size:12.5px;color:#6c665f;text-align:center;padding:16px;">Belum ada kombinasi outfit tersimpan.<br/>Klik tombol <strong>Simpan</strong> di panel "Sedang Dipakai di Manekin".</div>';
      return;
    }

    list.innerHTML = state.savedOutfits
      .map((of, idx) => {
        const names = Object.values(of.equipped)
          .map((e) => {
            const p = Data.getProductById(e.productId);
            return p ? `${p.name} (${e.size})` : '';
          })
          .filter(Boolean)
          .join(' + ');
        return `
          <div class="saved-row">
            <div class="saved-row-info">
              <strong>${of.name}</strong>
              <span>${names}</span>
            </div>
            <div class="saved-row-actions">
              <button class="btn-secondary" data-load-outfit="${idx}">Pasang</button>
              <button class="btn-mini-ghost" data-del-outfit="${idx}">Hapus</button>
            </div>
          </div>
        `;
      })
      .join('');

    list.querySelectorAll('[data-load-outfit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const of = state.savedOutfits[Number(btn.dataset.loadOutfit)];
        if (!of) return;
        state.equipped = JSON.parse(JSON.stringify(of.equipped));
        renderCatalog();
        requestSceneRebuild();
        closeModal('outfitsModalBackdrop');
        showToast(`Outfit "${of.name}" dipasang ke manekin`);
      });
    });

    list.querySelectorAll('[data-del-outfit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.savedOutfits.splice(Number(btn.dataset.delOutfit), 1);
        saveToStorage(STORAGE_OUTFITS_KEY, state.savedOutfits);
        renderSavedOutfitsModal();
      });
    });
  }

  // ==================== CART & FIT-VERIFIED CHECKOUT ====================
  function addToCart(product, size, colorHex, colorName, triedOn3D) {
    const existing = state.cart.find(
      (item) => item.productId === product.id && item.size === size && item.colorHex === colorHex
    );
    if (existing) {
      existing.qty += 1;
      existing.triedOn3D = existing.triedOn3D || triedOn3D;
    } else {
      state.cart.push({
        productId: product.id,
        size,
        colorHex,
        colorName,
        qty: 1,
        triedOn3D: !!triedOn3D
      });
    }
    updateCartUI();
    showToast(`Ditambahkan ke keranjang: ${product.name} (${size})`);
  }

  function updateCartUI() {
    const totalQty = state.cart.reduce((s, i) => s + i.qty, 0);
    document.getElementById('cartCount').textContent = totalQty;

    const container = document.getElementById('cartItemsContainer');
    if (state.cart.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:42px 16px;color:#6c665f;font-size:13px;">Keranjang masih kosong.<br/>Coba pakaian di manekin 3D lalu klik <strong>+ Cart</strong>!</div>';
    } else {
      container.innerHTML = state.cart
        .map((item, idx) => {
          const p = Data.getProductById(item.productId);
          if (!p) return '';
          const fit = Fit.evaluateGarmentFit(p, item.size, state.body);
          const isWarn = fit.status === 'tight';
          const fitBanner = isWarn
            ? `<div class="cart-fit-alert warn">
                 <span>⚠ Size ${item.size} sempit untuk manekinmu</span>
                 <button class="mini-action" style="background:#fff;border:1px solid #fca5a5" data-fix-size="${idx}" data-new-size="${fit.recommendedSize}">Ganti ke ${fit.recommendedSize}</button>
               </div>`
            : `<div class="cart-fit-alert ok">
                 <span>✓ ${item.triedOn3D ? 'Terverifikasi di Manekin 3D' : 'Cocok dengan Manekinmu'} • ${fit.score}% Nyaman</span>
               </div>`;

          return `
            <div class="cart-item">
              <div class="cart-item-top">
                <div>
                  <div class="cart-item-title">${p.name}</div>
                  <div class="cart-item-meta">${item.colorName} • Size <strong>${item.size}</strong></div>
                </div>
                <button class="equipped-remove" data-cart-del="${idx}" title="Hapus">✕</button>
              </div>
              ${fitBanner}
              <div class="cart-item-bottom">
                <div class="qty-control">
                  <button data-cart-dec="${idx}">−</button>
                  <span style="font-size:12.5px;font-weight:700">${item.qty}</span>
                  <button data-cart-inc="${idx}">+</button>
                </div>
                <strong>${Data.formatRupiah(p.price * item.qty)}</strong>
              </div>
            </div>
          `;
        })
        .join('');

      container.querySelectorAll('[data-cart-inc]').forEach((b) =>
        b.addEventListener('click', () => {
          state.cart[Number(b.dataset.cartInc)].qty += 1;
          updateCartUI();
        })
      );
      container.querySelectorAll('[data-cart-dec]').forEach((b) =>
        b.addEventListener('click', () => {
          const i = Number(b.dataset.cartDec);
          if (state.cart[i].qty > 1) state.cart[i].qty -= 1;
          else state.cart.splice(i, 1);
          updateCartUI();
        })
      );
      container.querySelectorAll('[data-cart-del]').forEach((b) =>
        b.addEventListener('click', () => {
          state.cart.splice(Number(b.dataset.cartDel), 1);
          updateCartUI();
        })
      );
      container.querySelectorAll('[data-fix-size]').forEach((b) =>
        b.addEventListener('click', () => {
          const i = Number(b.dataset.fixSize);
          state.cart[i].size = b.dataset.newSize;
          updateCartUI();
          showToast(`Ukuran diperbarui ke Size ${b.dataset.newSize} untuk kenyamanan maksimal`);
        })
      );
    }

    const subtotal = state.cart.reduce((s, item) => {
      const p = Data.getProductById(item.productId);
      return s + (p ? p.price * item.qty : 0);
    }, 0);
    const discount = state.promoApplied ? Math.round(subtotal * 0.15) : 0;
    const total = Math.max(0, subtotal - discount);

    document.getElementById('cartSubtotal').textContent = Data.formatRupiah(subtotal);
    document.getElementById('cartDiscount').textContent = `-${Data.formatRupiah(discount)}`;
    document.getElementById('cartDiscountRow').classList.toggle('hidden', !state.promoApplied || discount === 0);
    document.getElementById('cartTotal').textContent = Data.formatRupiah(total);
  }

  // ==================== MODAL HELPERS & EVENTS ====================
  function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
  }
  function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
  }

  function bindGlobalEvents() {
    // Reset mannequin
    document.getElementById('btnResetBody').addEventListener('click', () => {
      const def = Data.MANNEQUIN_PRESETS[0];
      state.presetId = def.id;
      state.genderBias = def.genderBias;
      state.body = { ...def.body };
      autoAdjustEquippedSizes();
      renderPresets();
      syncSlidersFromState();
      updateBodySummaryUI();
      renderCatalog();
      requestSceneRebuild();
      showToast('Ukuran manekin direset ke default');
    });

    // Studio Lighting
    document.querySelectorAll('[data-light]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-light]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.lighting = btn.dataset.light;
        Scene.setLighting(state.lighting);
      });
    });

    // Heatmap & X-Ray & Breakdown toggles
    document.getElementById('btnToggleHeatmap').addEventListener('click', (e) => {
      state.heatmapMode = !state.heatmapMode;
      e.currentTarget.classList.toggle('active', state.heatmapMode);
      if (state.heatmapMode) {
        state.fitBreakdownOpen = true;
        document.getElementById('fitBreakdownPopover').classList.remove('hidden');
        showToast('Heatmap Kenyamanan Aktif — Hijau: Pas, Biru: Longgar, Merah: Sempit');
      }
      requestSceneRebuild();
    });

    document.getElementById('btnToggleXray').addEventListener('click', (e) => {
      state.xrayMode = !state.xrayMode;
      e.currentTarget.classList.toggle('active', state.xrayMode);
      requestSceneRebuild();
    });

    document.getElementById('btnToggleFitBreakdown').addEventListener('click', () => {
      state.fitBreakdownOpen = !state.fitBreakdownOpen;
      document.getElementById('fitBreakdownPopover').classList.toggle('hidden', !state.fitBreakdownOpen);
    });

    // Camera Presets
    document.querySelectorAll('[data-cam]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-cam]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        Scene.setCameraPreset(btn.dataset.cam, state.body.height);
      });
    });

    // Pose Controls
    document.querySelectorAll('[data-pose]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-pose]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.pose = btn.dataset.pose;
        Scene.setPose(state.pose);
      });
    });

    // Auto Rotate
    document.getElementById('btnAutoRotate').addEventListener('click', (e) => {
      state.autoRotate = !state.autoRotate;
      e.currentTarget.classList.toggle('active', state.autoRotate);
      Scene.setAutoRotate(state.autoRotate);
    });

    // Clear & Save Outfit
    document.getElementById('btnClearOutfit').addEventListener('click', () => {
      state.equipped = {};
      renderCatalog();
      requestSceneRebuild();
      showToast('Semua pakaian dilepas dari manekin');
    });

    document.getElementById('btnSaveCurrentOutfit').addEventListener('click', () => {
      if (Object.keys(state.equipped).length === 0) {
        showToast('Pasangkan pakaian terlebih dahulu sebelum menyimpan outfit');
        return;
      }
      const num = state.savedOutfits.length + 1;
      state.savedOutfits.unshift({
        name: `Look #${num} (${state.body.height}cm)`,
        equipped: JSON.parse(JSON.stringify(state.equipped))
      });
      saveToStorage(STORAGE_OUTFITS_KEY, state.savedOutfits);
      renderSavedOutfitsModal();
      showToast(`Outfit disimpan ke koleksi Look #${num}`);
    });

    // Category Tabs, Search, Sort
    document.querySelectorAll('.cat-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.cat-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        state.activeCategory = tab.dataset.cat;
        renderCatalog();
      });
    });

    document.getElementById('catalogSearch').addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderCatalog();
    });

    document.getElementById('catalogSort').addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      renderCatalog();
    });

    // Modals & Drawers
    document.getElementById('closeProductModal').addEventListener('click', () => closeModal('productModalBackdrop'));
    document.getElementById('productModalBackdrop').addEventListener('click', (e) => {
      if (e.target.id === 'productModalBackdrop') closeModal('productModalBackdrop');
    });

    const openProfiles = () => {
      renderSavedProfilesModal();
      openModal('profilesModalBackdrop');
    };
    document.getElementById('btnProfiles').addEventListener('click', openProfiles);
    document.getElementById('activeProfilePill').addEventListener('click', openProfiles);
    document.getElementById('btnQuickSaveProfile').addEventListener('click', openProfiles);
    document.getElementById('closeProfilesModal').addEventListener('click', () => closeModal('profilesModalBackdrop'));

    document.getElementById('btnConfirmSaveProfile').addEventListener('click', () => {
      const inp = document.getElementById('newProfileName');
      const name = inp.value.trim() || `Profil Tubuh ${state.savedProfiles.length + 1}`;
      state.savedProfiles.unshift({
        name,
        genderBias: state.genderBias,
        body: { ...state.body }
      });
      saveToStorage(STORAGE_PROFILES_KEY, state.savedProfiles);
      inp.value = '';
      renderSavedProfilesModal();
      showToast(`Profil "${name}" tersimpan!`);
    });

    document.getElementById('btnSavedOutfits').addEventListener('click', () => {
      renderSavedOutfitsModal();
      openModal('outfitsModalBackdrop');
    });
    document.getElementById('closeOutfitsModal').addEventListener('click', () => closeModal('outfitsModalBackdrop'));

    // Cart Drawer
    document.getElementById('btnOpenCart').addEventListener('click', () => {
      updateCartUI();
      openModal('cartDrawerBackdrop');
    });
    document.getElementById('closeCartDrawer').addEventListener('click', () => closeModal('cartDrawerBackdrop'));
    document.getElementById('cartDrawerBackdrop').addEventListener('click', (e) => {
      if (e.target.id === 'cartDrawerBackdrop') closeModal('cartDrawerBackdrop');
    });

    document.getElementById('btnApplyPromo').addEventListener('click', () => {
      const code = document.getElementById('promoInput').value.trim().toUpperCase();
      const status = document.getElementById('promoStatus');
      if (code === 'FIT3D') {
        state.promoApplied = true;
        status.style.color = '#059669';
        status.textContent = '✓ Kode FIT3D aktif! Hemat 15% untuk pesananmu.';
        updateCartUI();
      } else {
        state.promoApplied = false;
        status.style.color = '#dc2626';
        status.textContent = 'Kode promo tidak dikenali. Coba gunakan: FIT3D';
        updateCartUI();
      }
    });

    document.getElementById('btnCheckout').addEventListener('click', () => {
      if (state.cart.length === 0) {
        showToast('Keranjang masih kosong');
        return;
      }
      const orderId = 'AT3D-' + Math.floor(100000 + Math.random() * 900000);
      const totalText = document.getElementById('cartTotal').textContent;
      state.cart = [];
      state.promoApplied = false;
      updateCartUI();
      closeModal('cartDrawerBackdrop');
      showToast(`Pesanan ${orderId} (${totalText}) berhasil dibuat!`);
    });
  }

  // ==================== BOOTSTRAP ====================
  function initApp() {
    renderPresets();
    renderMaterials();
    renderSliders();
    updateBodySummaryUI();
    renderCuratedLooks();
    renderCatalog();
    renderSavedOutfitsModal();
    updateCartUI();
    bindGlobalEvents();

    const canvas = document.getElementById('threeCanvas');
    const loader = document.getElementById('stageLoader');
    try {
      Scene.init(canvas);
      Scene.setCameraPreset('full', state.body.height);
      Scene.rebuildMannequinAndGarments(state);
      renderComfortHUD();
      renderEquippedHUD();
      setTimeout(() => loader.classList.add('hidden'), 220);
    } catch (err) {
      document.getElementById('loaderMessage').textContent = err.message || 'Gagal menginisialisasi WebGL 3D.';
    }
  }

  window.addEventListener('DOMContentLoaded', initApp);
})();
