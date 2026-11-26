window.FitEngine = (function () {
  const { BASE_SIZE_CHART, SIZE_ORDER } = window.AtelierData;

  /**
   * Computes actual internal garment measurements (in cm) for a product & size.
   */
  function getGarmentMeasurements(product, size) {
    const base = BASE_SIZE_CHART[size] || BASE_SIZE_CHART.M;
    const bonus = product.easeBonus || 0;
    const stretchExtra = (product.stretch || 0.05) * 100; // e.g., 8% stretch gives gentle forgiveness

    return {
      shoulder: +(base.shoulder + bonus * 0.35).toFixed(1),
      chest: +(base.chest + bonus).toFixed(1),
      waist: +(base.waist + bonus * 0.9).toFixed(1),
      hip: +(base.hip + bonus * 0.85).toFixed(1),
      lengthScale: base.lengthScale,
      stretchBonusCm: +(stretchExtra * 0.45).toFixed(1)
    };
  }

  /**
   * Evaluates one anatomical zone.
   * easeCm = garmentCm - bodyCm
   * Returns { status, score, easeCm, tension, colorHex, label }
   * tension: -1 (very loose) ... 0 (ideal) ... +1 (very tight)
   */
  function evaluateZone(zoneName, bodyCm, garmentCm, fitType, stretchBonusCm) {
    const rawEase = garmentCm - bodyCm;

    // Target comfort ease depends on zone and cut
    let idealMin = 3;
    let idealMax = 10;

    if (zoneName === 'shoulder') {
      idealMin = -0.5;
      idealMax = 3.5;
    } else if (fitType === 'slim') {
      idealMin = 0;
      idealMax = 6;
    } else if (fitType === 'relaxed') {
      idealMin = 7;
      idealMax = 16;
    } else if (fitType === 'oversized') {
      idealMin = 11;
      idealMax = 22;
    }

    // Stretch fabric forgives tightness slightly
    const effectiveEase = rawEase + (rawEase < idealMin ? stretchBonusCm * 0.55 : 0);

    let status = 'ideal';
    let label = 'Pas & Nyaman';
    let colorHex = '#10b981';
    let score = 98;
    let tension = 0; // -1 loose -> 0 ideal -> +1 tight

    if (effectiveEase < idealMin - 4.5) {
      status = 'tight';
      label = 'Terlalu Sempit';
      colorHex = '#ef4444';
      const deficit = idealMin - effectiveEase;
      score = Math.max(32, Math.round(72 - deficit * 4.2));
      tension = Math.min(1, 0.65 + deficit / 14);
    } else if (effectiveEase < idealMin) {
      status = 'snug';
      label = 'Agak Ketat';
      colorHex = '#f59e0b';
      const deficit = idealMin - effectiveEase;
      score = Math.round(86 - deficit * 3.2);
      tension = 0.35 + (deficit / 5) * 0.3;
    } else if (effectiveEase > idealMax + 6) {
      status = 'loose';
      label = 'Sangat Longgar';
      colorHex = '#3b82f6';
      const excess = effectiveEase - idealMax;
      score = Math.max(66, Math.round(90 - excess * 1.3));
      tension = -Math.min(1, 0.55 + excess / 18);
    } else if (effectiveEase > idealMax) {
      status = 'loose';
      label = 'Longgar Santai';
      colorHex = '#3b82f6';
      const excess = effectiveEase - idealMax;
      score = Math.round(94 - excess * 1.1);
      tension = -0.35 - (excess / 8) * 0.25;
    } else {
      // Ideal sweet spot
      const mid = (idealMin + idealMax) / 2;
      const dist = Math.abs(effectiveEase - mid) / Math.max(1, (idealMax - idealMin) / 2);
      score = Math.round(100 - dist * 6);
      tension = (mid - effectiveEase) / Math.max(4, idealMax - idealMin) * 0.3;
    }

    const sign = rawEase >= 0 ? '+' : '';
    const note =
      status === 'tight'
        ? `Selisih ${sign}${rawEase.toFixed(1)} cm — disarankan naik ukuran`
        : status === 'snug'
        ? `Selisih ${sign}${rawEase.toFixed(1)} cm — terasa pas ketat`
        : status === 'loose'
        ? `Ruang gerak ${sign}${rawEase.toFixed(1)} cm — lega & flowy`
        : `Ruang gerak ${sign}${rawEase.toFixed(1)} cm — sangat nyaman`;

    return {
      zone: zoneName,
      bodyCm,
      garmentCm,
      easeCm: +rawEase.toFixed(1),
      status,
      label,
      colorHex,
      score,
      tension,
      note
    };
  }

  /**
   * Evaluates full comfort fit of a product at a specific size on a user's body.
   */
  function evaluateGarmentFit(product, size, body) {
    if (product.category === 'shoes') {
      return {
        score: 96,
        status: 'ideal',
        verdict: 'Nyaman & Empuk',
        zones: {
          foot: {
            zone: 'foot',
            label: 'Pas & Empuk',
            status: 'ideal',
            colorHex: '#10b981',
            score: 96,
            tension: 0,
            note: 'Insole ergonomis sesuai proporsi tubuh'
          }
        },
        recommendedSize: size
      };
    }

    const gm = getGarmentMeasurements(product, size);
    const zones = {};
    let activeKeys = [];

    if (product.category === 'top' || product.category === 'outer') {
      activeKeys = ['shoulder', 'chest', 'waist'];
    } else if (product.category === 'bottom') {
      activeKeys = ['waist', 'hip'];
    } else if (product.category === 'dress') {
      activeKeys = ['shoulder', 'chest', 'waist', 'hip'];
    }

    // Special case: A-line skirt/dress has generous hip ease automatically
    activeKeys.forEach((key) => {
      let effectiveGarmentCm = gm[key];
      if ((product.style === 'skirt' || product.style === 'dress_aline' || product.style === 'dress_batik') && key === 'hip') {
        effectiveGarmentCm += 14;
      }
      if (product.style === 'cargo' && key === 'hip') {
        effectiveGarmentCm += 6;
      }
      zones[key] = evaluateZone(key, body[key], effectiveGarmentCm, product.fitType, gm.stretchBonusCm);
    });

    const zoneList = Object.values(zones);
    const avgScore = Math.round(zoneList.reduce((sum, z) => sum + z.score, 0) / zoneList.length);
    const hasTight = zoneList.some((z) => z.status === 'tight');
    const hasSnug = zoneList.some((z) => z.status === 'snug');
    const allLoose = zoneList.every((z) => z.status === 'loose');

    let status = 'ideal';
    let verdict = 'Sangat Nyaman & Pas';
    if (hasTight) {
      status = 'tight';
      verdict = 'Terlalu Sempit — Naikkan Size';
    } else if (hasSnug) {
      status = 'snug';
      verdict = 'Agak Ketat di Beberapa Area';
    } else if (allLoose) {
      status = 'loose';
      verdict = 'Longgar & Santai';
    }

    const rec = recommendBestSize(product, body);

    return {
      score: hasTight ? Math.min(avgScore, 68) : avgScore,
      status,
      verdict,
      zones,
      garmentMeasurements: gm,
      recommendedSize: rec.size,
      recommendedScore: rec.score
    };
  }

  /**
   * Finds the highest-comfort size available for a product given user's body.
   */
  function recommendBestSize(product, body) {
    if (product.category === 'shoes') {
      const idx = body.height < 162 ? 0 : body.height < 172 ? 1 : body.height < 182 ? 2 : 3;
      const sz = product.sizes[Math.min(idx, product.sizes.length - 1)] || 'M';
      return { size: sz, score: 96 };
    }

    let bestSize = product.sizes[0] || 'M';
    let bestScore = -1;

    product.sizes.forEach((sz) => {
      const gm = getGarmentMeasurements(product, sz);
      let activeKeys = ['shoulder', 'chest', 'waist'];
      if (product.category === 'bottom') activeKeys = ['waist', 'hip'];
      if (product.category === 'dress') activeKeys = ['shoulder', 'chest', 'waist', 'hip'];

      let sum = 0;
      let tightPenalty = 0;
      activeKeys.forEach((key) => {
        let effCm = gm[key];
        if ((product.style === 'skirt' || product.style === 'dress_aline' || product.style === 'dress_batik') && key === 'hip') effCm += 14;
        if (product.style === 'cargo' && key === 'hip') effCm += 6;
        const ev = evaluateZone(key, body[key], effCm, product.fitType, gm.stretchBonusCm);
        sum += ev.score;
        if (ev.status === 'tight') tightPenalty += 18;
      });

      const finalScore = Math.round(sum / activeKeys.length - tightPenalty);
      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestSize = sz;
      }
    });

    return { size: bestSize, score: Math.max(50, Math.min(99, bestScore)) };
  }

  /**
   * Maps a scalar tension (-1 loose .. 0 ideal .. +1 tight) to an RGB THREE.Color.
   */
  function tensionToColor(tension, targetColor) {
    const t = Math.max(-1, Math.min(1, tension));
    const cLoose = new THREE.Color(0x3b82f6); // blue
    const cIdeal = new THREE.Color(0x10b981); // emerald
    const cSnug  = new THREE.Color(0xf59e0b); // amber
    const cTight = new THREE.Color(0xef4444); // red

    const out = targetColor || new THREE.Color();
    if (t < 0) {
      out.copy(cIdeal).lerp(cLoose, Math.min(1, Math.abs(t) * 1.25));
    } else if (t < 0.45) {
      out.copy(cIdeal).lerp(cSnug, t / 0.45);
    } else {
      out.copy(cSnug).lerp(cTight, (t - 0.45) / 0.55);
    }
    return out;
  }

  /**
   * Classifies user's body silhouette and estimates standard size & weight.
   */
  function analyzeBodyProfile(body) {
    const chestHipDiff = body.chest - body.hip;
    const waistRatio = body.waist / Math.max(1, (body.chest + body.hip) / 2);

    let silhouette = 'Proporsional';
    if (waistRatio < 0.78 && Math.abs(chestHipDiff) < 9) {
      silhouette = 'Hourglass';
    } else if (chestHipDiff >= 9 || body.shoulder >= 47) {
      silhouette = 'Atletis / V-Shape';
    } else if (body.hip - body.chest >= 8) {
      silhouette = 'Pear / Curvy';
    } else if (waistRatio >= 0.92) {
      silhouette = 'Comfort / Straight';
    }

    // Standard base size by chest/waist average
    let baseSize = 'M';
    for (let i = 0; i < SIZE_ORDER.length; i++) {
      const sz = SIZE_ORDER[i];
      const spec = BASE_SIZE_CHART[sz];
      if (body.chest <= spec.chest - 2 && body.waist <= spec.waist + 2) {
        baseSize = sz;
        break;
      }
      baseSize = sz;
    }

    // Rough anatomical weight estimate (kg)
    const girthFactor = (body.chest * 0.4 + body.waist * 0.35 + body.hip * 0.25) / 90;
    const heightM = body.height / 100;
    const estWeight = Math.round(21.8 * heightM * heightM * Math.pow(girthFactor, 1.35));

    return {
      silhouette,
      baseSize,
      estWeight
    };
  }

  const ZONE_LABELS = {
    shoulder: 'Bahu',
    chest: 'Dada',
    waist: 'Pinggang',
    hip: 'Pinggul',
    foot: 'Kaki & Sol'
  };

  return {
    getGarmentMeasurements,
    evaluateGarmentFit,
    recommendBestSize,
    tensionToColor,
    analyzeBodyProfile,
    ZONE_LABELS
  };
})();
