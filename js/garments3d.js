window.Garments3D = (function () {
  const M3D = window.Mannequin3D;
  const Fit = window.FitEngine;
  const Tex = window.FabricTextures;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeToClearance(easeCm, layerOffsetMeters) {
    const base = layerOffsetMeters || 0.008;
    const radialFromEase = Math.max(-0.002, Math.min(0.032, easeCm / (2 * Math.PI) / 100));
    return Math.max(0.0045, base + radialFromEase);
  }

  /**
   * Creates product-grade PBR cloth material (MeshPhysicalMaterial for leather/satin,
   * MeshStandardMaterial for cotton/denim/wool/linen), with automatic patterned albedo support,
   * Fit Heatmap Mode, and X-Ray clearance mode.
   */
  function createClothMaterial(colorObj, fabricType, patternType, heatmapMode, xrayMode) {
    const hex = typeof colorObj === 'string' ? colorObj : colorObj.hex;
    const accent = typeof colorObj === 'object' ? colorObj.accent : null;

    if (heatmapMode) {
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.54,
        metalness: 0.02,
        side: THREE.DoubleSide,
        transparent: !!xrayMode,
        opacity: xrayMode ? 0.56 : 1.0,
        depthWrite: !xrayMode
      });
    }

    const bumpTex = Tex.getFabricBump(fabricType || 'cotton');
    const albedoTex = Tex.getProductAlbedoTexture(patternType, hex, accent);

    const common = {
      color: albedoTex ? 0xffffff : new THREE.Color(hex),
      map: albedoTex || null,
      bumpMap: bumpTex,
      bumpScale: fabricType === 'ribbed' ? 0.005 : fabricType === 'denim' ? 0.0038 : fabricType === 'leather' ? 0.0024 : 0.002,
      side: THREE.DoubleSide,
      transparent: !!xrayMode,
      opacity: xrayMode ? 0.56 : 1.0,
      depthWrite: !xrayMode
    };

    if (fabricType === 'leather') {
      return new THREE.MeshPhysicalMaterial({
        ...common,
        roughness: 0.34,
        metalness: 0.12,
        clearcoat: 0.40,
        clearcoatRoughness: 0.34
      });
    }

    if (fabricType === 'satin') {
      return new THREE.MeshPhysicalMaterial({
        ...common,
        roughness: 0.28,
        metalness: 0.14,
        clearcoat: 0.48,
        clearcoatRoughness: 0.25
      });
    }

    const roughnessMap = {
      cotton: 0.84,
      linen: 0.88,
      denim: 0.90,
      ribbed: 0.80,
      wool: 0.78
    };

    return new THREE.MeshStandardMaterial({
      ...common,
      roughness: roughnessMap[fabricType] || 0.84,
      metalness: fabricType === 'wool' ? 0.06 : 0.02
    });
  }

  function createAccentMaterial(hex, opts, heatmapMode, fallbackHeatMat) {
    if (heatmapMode && fallbackHeatMat) return fallbackHeatMat;
    const o = opts || {};
    if (o.physical) {
      return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(hex),
        roughness: o.roughness !== undefined ? o.roughness : 0.32,
        metalness: o.metalness !== undefined ? o.metalness : 0.12,
        clearcoat: o.clearcoat !== undefined ? o.clearcoat : 0.45,
        clearcoatRoughness: o.clearcoatRoughness !== undefined ? o.clearcoatRoughness : 0.28,
        bumpMap: o.bumpMap || null,
        bumpScale: o.bumpScale || 0.002,
        map: o.map || null,
        side: o.doubleSide ? THREE.DoubleSide : THREE.FrontSide
      });
    }
    return new THREE.MeshStandardMaterial({
      color: o.map ? 0xffffff : new THREE.Color(hex),
      map: o.map || null,
      roughness: o.roughness !== undefined ? o.roughness : 0.78,
      metalness: o.metalness !== undefined ? o.metalness : 0.04,
      transparent: !!o.transparent,
      opacity: o.opacity !== undefined ? o.opacity : 1.0,
      side: o.doubleSide ? THREE.DoubleSide : THREE.FrontSide
    });
  }

  function sampleTorsoTension(y, m, fitEval) {
    const z = fitEval.zones || {};
    const tShoulder = z.shoulder ? z.shoulder.tension : z.chest ? z.chest.tension : 0;
    const tChest = z.chest ? z.chest.tension : z.waist ? z.waist.tension : 0;
    const tWaist = z.waist ? z.waist.tension : tChest;
    const tHip = z.hip ? z.hip.tension : tWaist;

    if (y >= m.chestY) {
      const f = Math.min(1, (y - m.chestY) / Math.max(0.01, m.shoulderY - m.chestY));
      return lerp(tChest, tShoulder, f);
    } else if (y >= m.waistY) {
      const f = (y - m.waistY) / Math.max(0.01, m.chestY - m.waistY);
      return lerp(tWaist, tChest, f);
    } else {
      const f = Math.max(0, Math.min(1, (y - m.hipY) / Math.max(0.01, m.waistY - m.hipY)));
      return lerp(tHip, tWaist, f);
    }
  }

  function applyHeatmapVertexColors(geom, tensionFn) {
    const pos = geom.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const tmpColor = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const t = tensionFn(pos.getX(i), pos.getY(i), pos.getZ(i));
      Fit.tensionToColor(t, tmpColor);
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  function ensureGroupVertexColors(group, tensionVal) {
    group.traverse((obj) => {
      if (obj.isMesh && obj.geometry && !obj.geometry.attributes.color) {
        applyHeatmapVertexColors(obj.geometry, () => tensionVal);
      }
    });
  }

  /**
   * Builds a smooth ring band (used for waistbands, ribbed hems, obi sashes, striped varsity hems).
   */
  function buildTorsoBand(m, yCenter, height, radialExtra, mat, boxyFactor) {
    const rings = [];
    const segs = 44;
    const steps = 4;
    const yBot = yCenter - height * 0.5;
    const yTop = yCenter + height * 0.5;

    for (let i = 0; i <= steps; i++) {
      const y = lerp(yBot, yTop, i / steps);
      const ring = [];
      let boxy = 0;
      if (boxyFactor && y < m.chestY) {
        boxy = Math.max(0, m.chestRx - m.waistRx) * boxyFactor;
      }
      for (let s = 0; s < segs; s++) {
        const theta = (s / segs) * Math.PI * 2;
        ring.push(
          M3D.sampleTorsoPoint(Math.max(m.crotchY - 0.01, y), theta, m, radialExtra, {
            extraRx: boxy,
            extraRz: boxy * 0.65
          })
        );
      }
      rings.push(ring);
    }
    const geo = M3D.buildLoftGeometry(rings, true, false, false);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /**
   * Builds a parametric lofted torso cloth shell conforming precisely to mannequin body measurements.
   */
  function buildTorsoClothShell(opts) {
    const {
      m,
      yBottom,
      yTop,
      radialSegs = 48,
      ySteps = 30,
      baseLayerOffset = 0.008,
      fitEval,
      openFront = false,
      frontGapAngle = 0.14,
      flareBottom = 0,
      pleats = 0,
      boxyFactor = 0,
      vNeckDepth = 0
    } = opts;

    const z = fitEval.zones || {};
    const chestEase = z.chest ? z.chest.easeCm : 6;
    const waistEase = z.waist ? z.waist.easeCm : 6;
    const hipEase = z.hip ? z.hip.easeCm : 8;

    const rings = [];
    const startAngle = openFront ? Math.PI * 0.5 + frontGapAngle : 0;
    const endAngle = openFront ? Math.PI * 2.5 - frontGapAngle : Math.PI * 2;

    for (let i = 0; i <= ySteps; i++) {
      const v = i / ySteps;
      const yBase = lerp(yBottom, yTop, v);
      const ring = [];

      let localEase = chestEase;
      if (yBase < m.waistY) {
        const t = Math.max(0, Math.min(1, (yBase - m.hipY) / Math.max(0.01, m.waistY - m.hipY)));
        localEase = lerp(hipEase, waistEase, t);
      } else if (yBase < m.chestY) {
        const t = (yBase - m.waistY) / Math.max(0.01, m.chestY - m.waistY);
        localEase = lerp(waistEase, chestEase, t);
      }
      const clearance = easeToClearance(localEase, baseLayerOffset);

      let boxyExtra = 0;
      if (boxyFactor > 0 && yBase < m.chestY) {
        const waistDiff = Math.max(0, m.chestRx - m.waistRx);
        boxyExtra =
          waistDiff *
          boxyFactor *
          (1 - Math.max(0, (yBase - m.waistY) / Math.max(0.01, m.chestY - m.waistY)));
      }

      let flare = 0;
      if (flareBottom > 0 && yBase < m.waistY) {
        const belowT = Math.min(1, (m.waistY - yBase) / Math.max(0.05, m.waistY - yBottom));
        flare = flareBottom * Math.pow(belowT, 1.22);
      }

      for (let s = 0; s < radialSegs; s++) {
        const frac = openFront ? s / (radialSegs - 1) : s / radialSegs;
        const theta = lerp(startAngle, endAngle, frac);

        let y = yBase;
        if (v > 0.80 && vNeckDepth > 0) {
          const frontAlign = Math.max(0, Math.sin(theta));
          const neckFactor = (v - 0.80) / 0.20;
          y -= Math.pow(frontAlign, 3.2) * vNeckDepth * neckFactor;
        }

        let fold = 0;
        if (pleats > 0 && yBase < m.waistY) {
          const belowT = Math.min(1, (m.waistY - yBase) / Math.max(0.05, m.waistY - yBottom));
          fold = Math.sin(theta * pleats) * 0.0095 * belowT;
        } else if (localEase > 8) {
          fold = Math.sin(theta * 7 + v * 3) * 0.0022 * Math.min(1.5, (localEase - 8) / 10);
        }

        const sampleY = Math.max(m.crotchY - 0.01, y);
        const pt = M3D.sampleTorsoPoint(sampleY, theta, m, clearance + flare + fold, {
          extraRx: boxyExtra,
          extraRz: boxyExtra * 0.65
        });
        pt.y = y;

        if (openFront && Math.sin(theta) > 0.55) {
          const edgeSpread = (1 - v) * 0.012;
          pt.x += Math.sign(Math.cos(theta)) * edgeSpread;
        }

        ring.push(pt);
      }
      rings.push(ring);
    }

    const geom = M3D.buildLoftGeometry(rings, !openFront, false, false);
    applyHeatmapVertexColors(geom, (x, y) => sampleTorsoTension(y, m, fitEval));
    return geom;
  }

  /**
   * Builds articulated sleeves mounted inside mannequin arm pivots (supports two-tone varsity sleeves,
   * striped ribbed cuffs, shirt buttoned cuffs, biker sleeve zips, etc.).
   */
  function attachSleeves(rig, product, fitEval, sleeveMat, opts) {
    const m = rig.metrics;
    const {
      lengthRatio = 0.44,
      easeExtra = 0.011,
      hasCuff = false,
      cuffMat = null,
      hasWristZip = false,
      hasCuffButton = false
    } = opts;

    const shoulderTension =
      (fitEval.zones.shoulder && fitEval.zones.shoulder.tension) ||
      (fitEval.zones.chest && fitEval.zones.chest.tension) ||
      0;
    const shoulderEase = (fitEval.zones.shoulder && fitEval.zones.shoulder.easeCm) || 3;
    const sleeveClearance = Math.max(0.006, easeExtra + Math.max(-0.002, shoulderEase * 0.0012));

    const created = [];
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xd0d4da, metalness: 0.85, roughness: 0.25 });

    [rig.leftArm, rig.rightArm].forEach((arm, idx) => {
      const side = idx === 0 ? -1 : 1;

      const capGeo = new THREE.SphereGeometry(
        m.upperArmR + sleeveClearance * 1.14,
        20,
        14,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.65
      );
      applyHeatmapVertexColors(capGeo, () => shoulderTension);
      const capMesh = new THREE.Mesh(capGeo, sleeveMat);
      capMesh.castShadow = true;
      arm.upperSleeveSlot.add(capMesh);
      created.push({ parent: arm.upperSleeveSlot, mesh: capMesh });

      const upperLen = Math.min(m.upperArmLen, m.armLength * lengthRatio);
      const uGeo = M3D.buildTaperedLimbGeometry(
        upperLen,
        m.upperArmR + sleeveClearance * 1.12,
        (m.upperArmR + m.elbowR) * 0.5 + sleeveClearance,
        m.elbowR + sleeveClearance * (lengthRatio < 0.6 ? 1.15 : 0.96),
        22,
        10
      );
      applyHeatmapVertexColors(uGeo, () => shoulderTension * 0.85);
      const uMesh = new THREE.Mesh(uGeo, sleeveMat);
      uMesh.castShadow = true;
      arm.upperSleeveSlot.add(uMesh);
      created.push({ parent: arm.upperSleeveSlot, mesh: uMesh });

      if (lengthRatio > 0.6) {
        const lowerLen = Math.min(m.forearmLen * 0.96, m.armLength * lengthRatio - m.upperArmLen);
        if (lowerLen > 0.03) {
          const elbowCapGeo = new THREE.SphereGeometry(m.elbowR + sleeveClearance * 0.94, 16, 12);
          applyHeatmapVertexColors(elbowCapGeo, () => shoulderTension * 0.6);
          const elbowCap = new THREE.Mesh(elbowCapGeo, sleeveMat);
          arm.lowerSleeveSlot.add(elbowCap);
          created.push({ parent: arm.lowerSleeveSlot, mesh: elbowCap });

          const lGeo = M3D.buildTaperedLimbGeometry(
            lowerLen,
            m.elbowR + sleeveClearance * 0.96,
            (m.elbowR + m.wristR) * 0.5 + sleeveClearance * 0.88,
            m.wristR + (hasCuff ? 0.008 : sleeveClearance * 0.85),
            20,
            10
          );
          applyHeatmapVertexColors(lGeo, () => shoulderTension * 0.5);
          const lMesh = new THREE.Mesh(lGeo, sleeveMat);
          lMesh.castShadow = true;
          arm.lowerSleeveSlot.add(lMesh);
          created.push({ parent: arm.lowerSleeveSlot, mesh: lMesh });

          if (hasCuff) {
            const cMat = cuffMat || sleeveMat;
            const cuffGeo = new THREE.CylinderGeometry(m.wristR + 0.011, m.wristR + 0.008, 0.048, 20);
            applyHeatmapVertexColors(cuffGeo, () => shoulderTension * 0.4);
            const cuffMesh = new THREE.Mesh(cuffGeo, cMat);
            cuffMesh.position.set(0, -lowerLen + 0.02, 0);
            arm.lowerSleeveSlot.add(cuffMesh);
            created.push({ parent: arm.lowerSleeveSlot, mesh: cuffMesh });

            if (hasCuffButton) {
              const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.004, 10), metalMat);
              b.rotation.z = Math.PI * 0.5;
              b.position.set(side * (m.wristR + 0.011), -lowerLen + 0.022, -0.008);
              arm.lowerSleeveSlot.add(b);
              created.push({ parent: arm.lowerSleeveSlot, mesh: b });
            }
          }

          if (hasWristZip) {
            const zMesh = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.075, 0.006), metalMat);
            zMesh.position.set(side * (m.wristR + sleeveClearance * 0.86), -lowerLen + 0.045, -0.006);
            arm.lowerSleeveSlot.add(zMesh);
            created.push({ parent: arm.lowerSleeveSlot, mesh: zMesh });
          }
        }
      }
    });

    return created;
  }

  // ==================== UPPER GARMENTS (VARSITY, LEATHER, DENIM, BATIK, KEMEJA, KAOS, HOODIE, BLAZER) ====================
  function buildUpperGarment(rig, product, size, colorObj, fitEval, heatmapMode, xrayMode) {
    const m = rig.metrics;
    const isOuter = product.category === 'outer';
    const layerOffset = isOuter ? 0.019 : 0.008;
    const hexColor = colorObj.hex;
    const secColor = colorObj.secondary || '#e8e2d8';
    const accColor = colorObj.accent || '#d0a85c';

    const mainMat = createClothMaterial(colorObj, product.fabric, product.pattern, heatmapMode, xrayMode);
    let sleeveMat = mainMat;
    let cuffMat = null;

    const gm = fitEval.garmentMeasurements || { lengthScale: 1.0 };
    const lengthAdjust = (gm.lengthScale - 1.0) * 0.13;

    let yBottom = m.hipY - 0.015 - lengthAdjust;
    let yTop = m.neckBaseY - 0.010;
    let boxyFactor = 0.20;
    let openFront = false;
    let frontGapAngle = 0.13;
    let vNeckDepth = 0.032;
    let sleeveRatio = 0.42;
    let sleeveEase = isOuter ? 0.021 : 0.011;
    let hasCuff = false;
    let hasWristZip = false;
    let hasCuffButton = false;

    if (product.style === 'oversized_tee') {
      yBottom = m.hipY - 0.055 - lengthAdjust;
      boxyFactor = 0.74;
      sleeveRatio = 0.50;
      sleeveEase = 0.022;
    } else if (product.style === 'shirt' || product.style === 'batik_shirt') {
      yBottom = m.hipY - 0.035 - lengthAdjust;
      boxyFactor = 0.28;
      sleeveRatio = 0.96;
      sleeveEase = 0.013;
      hasCuff = true;
      hasCuffButton = true;
      vNeckDepth = 0.020;
    } else if (product.style === 'knit') {
      yBottom = m.hipY + 0.01 - lengthAdjust * 0.5;
      yTop = m.neckBaseY + 0.026;
      boxyFactor = 0.04;
      sleeveRatio = 0.96;
      sleeveEase = 0.008;
      vNeckDepth = 0.0;
    } else if (product.style === 'varsity') {
      yBottom = m.waistY - 0.05 - lengthAdjust * 0.7;
      boxyFactor = 0.68;
      sleeveRatio = 0.97;
      sleeveEase = 0.024;
      hasCuff = true;
      vNeckDepth = 0.030;
      // Authentic contrasting leather sleeves!
      sleeveMat = heatmapMode
        ? mainMat
        : createClothMaterial({ hex: secColor }, 'leather', 'solid', false, xrayMode);
      const ribTex = Tex.getProductAlbedoTexture('varsity_rib', hexColor, secColor);
      cuffMat = createAccentMaterial(hexColor, { map: ribTex, roughness: 0.85 }, heatmapMode, mainMat);
    } else if (product.style === 'leather_jacket') {
      yBottom = m.waistY - 0.055 - lengthAdjust * 0.7;
      boxyFactor = 0.36;
      openFront = true;
      frontGapAngle = 0.08;
      sleeveRatio = 0.97;
      sleeveEase = 0.018;
      hasWristZip = true;
      vNeckDepth = 0.08;
    } else if (product.style === 'denim_jacket') {
      yBottom = m.waistY - 0.052 - lengthAdjust * 0.7;
      boxyFactor = 0.46;
      openFront = true;
      frontGapAngle = 0.09;
      sleeveRatio = 0.97;
      sleeveEase = 0.020;
      hasCuff = true;
      hasCuffButton = true;
      vNeckDepth = 0.028;
    } else if (product.style === 'hoodie') {
      yBottom = m.hipY - 0.042 - lengthAdjust;
      boxyFactor = 0.80;
      sleeveRatio = 0.98;
      sleeveEase = 0.025;
      hasCuff = true;
      vNeckDepth = 0.015;
    } else if (product.style === 'blazer') {
      yBottom = m.crotchY - 0.015 - lengthAdjust;
      boxyFactor = 0.42;
      openFront = true;
      frontGapAngle = 0.14;
      sleeveRatio = 0.96;
      sleeveEase = 0.019;
      vNeckDepth = 0.085;
    }

    const group = new THREE.Group();
    const shellGeo = buildTorsoClothShell({
      m,
      yBottom,
      yTop,
      baseLayerOffset: layerOffset,
      fitEval,
      openFront,
      frontGapAngle,
      boxyFactor,
      vNeckDepth
    });
    const shellMesh = new THREE.Mesh(shellGeo, mainMat);
    shellMesh.castShadow = true;
    shellMesh.receiveShadow = true;
    group.add(shellMesh);

    // Hardware & detail materials
    const darkTrimMat = createAccentMaterial(
      new THREE.Color(hexColor).multiplyScalar(0.82).getStyle(),
      { roughness: 0.82 },
      heatmapMode,
      mainMat
    );
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdce0e6, metalness: 0.88, roughness: 0.22 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xcfa052, metalness: 0.78, roughness: 0.30 });
    const pearlMat = new THREE.MeshStandardMaterial({ color: 0xf6f3eb, metalness: 0.12, roughness: 0.28 });

    // ---------- STYLE-SPECIFIC TAILORING DETAILS ----------
    if (product.style === 'tshirt' || product.style === 'oversized_tee') {
      // Crisp ribbed crewneck collar ring
      const ribCollar = new THREE.Mesh(
        new THREE.TorusGeometry(m.neckRx + 0.014, 0.0085, 10, 32),
        darkTrimMat
      );
      ribCollar.rotation.x = Math.PI * 0.52;
      ribCollar.position.set(0, m.neckBaseY - 0.016, 0.004);
      group.add(ribCollar);

      // Streetwear graphic emblem on oversized tee chest
      if (product.style === 'oversized_tee' && !heatmapMode) {
        const gTex = Tex.getProductAlbedoTexture('street_graphic', hexColor, accColor);
        const pt = M3D.sampleTorsoPoint(m.chestY - 0.015, Math.PI * 0.5, m, layerOffset + 0.015);
        const emblem = new THREE.Mesh(
          new THREE.PlaneGeometry(0.145, 0.095),
          new THREE.MeshBasicMaterial({ map: gTex, transparent: true, depthWrite: false })
        );
        emblem.position.set(0, m.chestY - 0.015, pt.z + 0.008);
        group.add(emblem);
      }
    }

    if (product.style === 'shirt' || product.style === 'batik_shirt') {
      // Structured 2-piece turn-down dress collar
      const collarStand = new THREE.Mesh(
        new THREE.CylinderGeometry(m.neckRx + 0.015, m.neckRx + 0.019, 0.030, 28, 1, true),
        mainMat
      );
      collarStand.position.set(0, m.neckBaseY + 0.004, 0.002);
      group.add(collarStand);

      // Left & right crisp collar points folding down in front
      [-1, 1].forEach((side) => {
        const pt = M3D.sampleTorsoPoint(m.neckBaseY - 0.012, Math.PI * 0.5, m, layerOffset + 0.010);
        const flap = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.044, 0.006), mainMat);
        flap.position.set(side * 0.038, m.neckBaseY - 0.012, pt.z + 0.004);
        flap.rotation.z = side * 0.34;
        flap.rotation.y = side * 0.36;
        flap.rotation.x = 0.22;
        group.add(flap);
      });

      // Vertical front button placket + 6 pearlescent buttons
      const placketLen = yTop - yBottom - 0.03;
      const midY = lerp(yBottom, yTop, 0.48);
      const midPt = M3D.sampleTorsoPoint(midY, Math.PI * 0.5, m, layerOffset + 0.011);
      const placket = new THREE.Mesh(new THREE.BoxGeometry(0.026, placketLen, 0.006), darkTrimMat);
      placket.position.set(0, midY, midPt.z + 0.002);
      group.add(placket);

      const btnMat = product.style === 'batik_shirt' ? darkTrimMat : pearlMat;
      for (let i = 0; i < 6; i++) {
        const by = lerp(m.neckBaseY - 0.042, yBottom + 0.05, i / 5);
        const bPt = M3D.sampleTorsoPoint(by, Math.PI * 0.5, m, layerOffset + 0.013);
        const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0052, 0.004, 12), btnMat);
        btn.rotation.x = Math.PI * 0.5;
        btn.position.set(0, by, bPt.z + 0.004);
        group.add(btn);
      }

      // Left chest dress pocket
      const pktPt = M3D.sampleTorsoPoint(m.chestY - 0.015, Math.PI * 0.5, m, layerOffset + 0.011);
      const chestPkt = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.082, 0.006), mainMat);
      chestPkt.position.set(-m.chestRx * 0.42, m.chestY - 0.015, pktPt.z + 0.001);
      chestPkt.rotation.y = -0.24;
      group.add(chestPkt);
    }

    if (product.style === 'varsity') {
      // Striped athletic ribbed collar + waist hem band!
      const ribTex = Tex.getProductAlbedoTexture('varsity_rib', hexColor, secColor);
      const ribMat = createAccentMaterial(hexColor, { map: ribTex, roughness: 0.85 }, heatmapMode, mainMat);

      const vCollar = new THREE.Mesh(
        new THREE.TorusGeometry(m.neckRx + 0.020, 0.015, 12, 32),
        ribMat
      );
      vCollar.rotation.x = Math.PI * 0.52;
      vCollar.position.set(0, m.neckBaseY - 0.008, 0.002);
      group.add(vCollar);

      const hemBand = buildTorsoBand(m, yBottom + 0.026, 0.056, layerOffset + 0.018, ribMat, 0.68);
      group.add(hemBand);

      // Center snap buttons (contrasting cream/white snaps down the middle)
      const snapMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(secColor), roughness: 0.35, metalness: 0.25 });
      for (let i = 0; i < 6; i++) {
        const by = lerp(m.neckBaseY - 0.055, yBottom + 0.055, i / 5);
        const bPt = M3D.sampleTorsoPoint(by, Math.PI * 0.5, m, layerOffset + 0.020);
        const snap = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.005, 14), snapMat);
        snap.rotation.x = Math.PI * 0.5;
        snap.position.set(0, by, bPt.z + 0.006);
        group.add(snap);
      }

      // Embroidered Chenille "A" Varsity Chest Crest on left chest
      if (!heatmapMode) {
        const patchTex = Tex.getProductAlbedoTexture('varsity_patch', hexColor, accColor);
        const pPt = M3D.sampleTorsoPoint(m.chestY + 0.005, Math.PI * 0.5, m, layerOffset + 0.020);
        const patch = new THREE.Mesh(
          new THREE.CircleGeometry(0.044, 24),
          new THREE.MeshStandardMaterial({ map: patchTex, transparent: true, roughness: 0.9 })
        );
        patch.position.set(-m.chestRx * 0.44, m.chestY + 0.005, pPt.z + 0.008);
        patch.rotation.y = -0.26;
        group.add(patch);
      }

      // Angled cream leather welt hand pockets
      const weltMat = createAccentMaterial(secColor, { physical: true, roughness: 0.38 }, heatmapMode, mainMat);
      [-1, 1].forEach((side) => {
        const pY = lerp(yBottom, m.waistY, 0.58);
        const pt = M3D.sampleTorsoPoint(pY, Math.PI * 0.5 + side * 0.45, m, layerOffset + 0.022, {
          extraRx: Math.max(0, m.chestRx - m.waistRx) * 0.65,
          extraRz: Math.max(0, m.chestRx - m.waistRx) * 0.42
        });
        const welt = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.095, 0.012), weltMat);
        welt.position.set(pt.x, pY, pt.z);
        welt.rotation.z = side * 0.35;
        welt.rotation.y = side * 0.52;
        group.add(welt);
      });
    }

    if (product.style === 'leather_jacket') {
      // Wide sculpted Moto Biker Lapels + Chrome Snap Studs
      [-1, 1].forEach((side) => {
        const pt = M3D.sampleTorsoPoint(m.chestY + 0.025, Math.PI * 0.5, m, layerOffset + 0.016);
        const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.21, 0.011), mainMat);
        lapel.position.set(side * 0.066, m.chestY + 0.022, pt.z + 0.008);
        lapel.rotation.z = side * -0.26;
        lapel.rotation.y = side * 0.26;
        group.add(lapel);

        // Chrome collar & lapel snap studs
        const studTop = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.005, 12), chromeMat);
        studTop.rotation.x = Math.PI * 0.5;
        studTop.position.set(side * 0.088, m.chestY + 0.075, pt.z + 0.015);
        group.add(studTop);

        const studBot = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.005, 12), chromeMat);
        studBot.rotation.x = Math.PI * 0.5;
        studBot.position.set(side * 0.074, m.chestY - 0.025, pt.z + 0.015);
        group.add(studBot);

        // Shoulder Epaulets (structured biker straps)
        const ep = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.012, 0.028), mainMat);
        ep.position.set(side * (m.shoulderJointX * 0.72), m.shoulderY + 0.016, -0.002);
        ep.rotation.z = side * -0.18;
        group.add(ep);

        const epStud = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.005, 10), chromeMat);
        epStud.position.set(side * (m.shoulderJointX * 0.55), m.shoulderY + 0.024, -0.002);
        group.add(epStud);

        // Zippered front pockets
        const pktY = lerp(yBottom, m.waistY, 0.65);
        const pktPt = M3D.sampleTorsoPoint(pktY, Math.PI * 0.5 + side * 0.38, m, layerOffset + 0.018);
        const zip = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.095, 0.008), chromeMat);
        zip.position.set(pktPt.x, pktY, pktPt.z + 0.004);
        zip.rotation.z = side * 0.25;
        zip.rotation.y = side * 0.42;
        group.add(zip);
      });

      // Signature asymmetric diagonal chrome biker zipper
      const zPt = M3D.sampleTorsoPoint(m.waistY + 0.05, Math.PI * 0.5, m, layerOffset + 0.018);
      const diagZip = new THREE.Mesh(new THREE.BoxGeometry(0.010, (m.chestY - yBottom) * 1.05, 0.008), chromeMat);
      diagZip.position.set(0.036, lerp(yBottom, m.chestY, 0.54), zPt.z + 0.007);
      diagZip.rotation.z = -0.10;
      group.add(diagZip);

      // Waist Biker Belt + Metallic Rectangular Buckle
      const beltBand = buildTorsoBand(m, yBottom + 0.022, 0.034, layerOffset + 0.018, mainMat, 0.36);
      group.add(beltBand);
      const bPt = M3D.sampleTorsoPoint(yBottom + 0.022, Math.PI * 0.5, m, layerOffset + 0.022);
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.040, 0.010), chromeMat);
      buckle.position.set(0, yBottom + 0.022, bPt.z + 0.006);
      group.add(buckle);
    }

    if (product.style === 'denim_jacket') {
      // Structured denim trucker collar
      const dCollar = new THREE.Mesh(new THREE.TorusGeometry(m.neckRx + 0.022, 0.015, 10, 28), mainMat);
      dCollar.rotation.x = Math.PI * 0.54;
      dCollar.position.set(0, m.neckBaseY - 0.004, 0.002);
      group.add(dCollar);

      // Twin buttoned chest flap pockets + vertical contrast ochre seams
      const stitchMat = createAccentMaterial(secColor, { roughness: 0.9 }, heatmapMode, mainMat);
      [-1, 1].forEach((side) => {
        const pt = M3D.sampleTorsoPoint(m.chestY - 0.005, Math.PI * 0.5, m, layerOffset + 0.018);
        const pkt = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.082, 0.012), mainMat);
        pkt.position.set(side * (m.chestRx * 0.46), m.chestY - 0.008, pt.z);
        pkt.rotation.y = side * 0.26;
        group.add(pkt);

        // Pocket flap lid + brass rivet button
        const flap = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.024, 0.015), darkTrimMat);
        flap.position.set(side * (m.chestRx * 0.46), m.chestY + 0.022, pt.z + 0.002);
        flap.rotation.y = side * 0.26;
        group.add(flap);

        const pBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.005, 12), brassMat);
        pBtn.rotation.x = Math.PI * 0.5;
        pBtn.position.set(side * (m.chestRx * 0.46), m.chestY + 0.018, pt.z + 0.011);
        group.add(pBtn);

        // Vertical Trucker V-Seam contrast stitching strips
        const seamPt = M3D.sampleTorsoPoint(m.waistY + 0.03, Math.PI * 0.5, m, layerOffset + 0.017);
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.16, 0.004), stitchMat);
        seam.position.set(side * (m.waistRx * 0.42), m.waistY + 0.03, seamPt.z + 0.003);
        seam.rotation.z = side * 0.06;
        group.add(seam);
      });

      // Front brass buttons along jacket placket
      for (let i = 0; i < 5; i++) {
        const by = lerp(m.chestY + 0.04, yBottom + 0.035, i / 4);
        const bPt = M3D.sampleTorsoPoint(by, Math.PI * 0.5, m, layerOffset + 0.018);
        const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.005, 12), brassMat);
        btn.rotation.x = Math.PI * 0.5;
        btn.position.set(0.026, by, bPt.z + 0.006);
        group.add(btn);
      }
    }

    if (product.style === 'hoodie') {
      // Sculpted layered 3D hood behind neck
      const hoodOuter = new THREE.Mesh(
        new THREE.TorusGeometry(m.neckRx + 0.040, 0.036, 14, 28, Math.PI * 1.48),
        mainMat
      );
      hoodOuter.rotation.x = Math.PI * 0.62;
      hoodOuter.rotation.z = Math.PI * 0.76;
      hoodOuter.position.set(0, m.neckBaseY - 0.012, -0.026);
      hoodOuter.castShadow = true;
      group.add(hoodOuter);

      // Ribbed bottom waist hem band
      const ribHem = buildTorsoBand(m, yBottom + 0.026, 0.052, layerOffset + 0.016, darkTrimMat, 0.76);
      group.add(ribHem);

      // Front kangaroo pocket
      const pocketY = lerp(yBottom + 0.05, m.waistY, 0.46);
      const frontPt = M3D.sampleTorsoPoint(pocketY, Math.PI * 0.5, m, layerOffset + 0.022, {
        extraRx: Math.max(0, m.chestRx - m.waistRx) * 0.75,
        extraRz: Math.max(0, m.chestRx - m.waistRx) * 0.45
      });
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(m.waistRx * 1.18, 0.125, 0.022), darkTrimMat);
      pocket.position.set(0, pocketY, frontPt.z);
      group.add(pocket);

      // Drawstrings with chrome metal aglet tips
      const cordMat = createAccentMaterial(accColor, { roughness: 0.9 }, heatmapMode, mainMat);
      [-0.028, 0.028].forEach((ox) => {
        const pt = M3D.sampleTorsoPoint(m.chestY + 0.025, Math.PI * 0.5, m, layerOffset + 0.020);
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.15, 8), cordMat);
        cord.position.set(ox, m.chestY + 0.02, pt.z + 0.006);
        group.add(cord);

        const aglet = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.018, 8), chromeMat);
        aglet.position.set(ox, m.chestY - 0.056, pt.z + 0.006);
        group.add(aglet);
      });
    }

    if (product.style === 'blazer') {
      // Structured notched lapels + chest welt pocket + dark horn buttons
      [-1, 1].forEach((side) => {
        const pt = M3D.sampleTorsoPoint(m.chestY + 0.025, Math.PI * 0.5, m, layerOffset + 0.016);
        const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.25, 0.011), darkTrimMat);
        lapel.position.set(side * 0.058, m.chestY + 0.025, pt.z + 0.007);
        lapel.rotation.z = side * -0.17;
        lapel.rotation.y = side * 0.22;
        group.add(lapel);
      });

      const wPt = M3D.sampleTorsoPoint(m.chestY + 0.005, Math.PI * 0.5, m, layerOffset + 0.018);
      const welt = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.014, 0.008), darkTrimMat);
      welt.position.set(-m.chestRx * 0.48, m.chestY + 0.005, wPt.z + 0.002);
      welt.rotation.y = -0.26;
      group.add(welt);

      const hornMat = new THREE.MeshStandardMaterial({ color: 0x26211c, roughness: 0.35, metalness: 0.12 });
      [m.waistY + 0.02, m.waistY - 0.055].forEach((by) => {
        const bPt = M3D.sampleTorsoPoint(by, Math.PI * 0.5, m, layerOffset + 0.018);
        const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.005, 14), hornMat);
        btn.rotation.x = Math.PI * 0.5;
        btn.position.set(0.036, by, bPt.z + 0.006);
        group.add(btn);
      });
    }

    rig.torsoGarmentSlot.add(group);
    ensureGroupVertexColors(group, sampleTorsoTension(m.chestY, m, fitEval));

    const sleeveHandles = attachSleeves(rig, product, fitEval, sleeveMat, {
      lengthRatio: sleeveRatio,
      easeExtra: sleeveEase,
      hasCuff,
      cuffMat,
      hasWristZip,
      hasCuffButton
    });

    return {
      dispose() {
        rig.torsoGarmentSlot.remove(group);
        sleeveHandles.forEach((h) => h.parent.remove(h.mesh));
      }
    };
  }

  // ==================== BOTTOMS (JEANS, CHINOS, CARGO, PLEATED SKIRT) ====================
  function buildBottomGarment(rig, product, size, colorObj, fitEval, heatmapMode, xrayMode) {
    const m = rig.metrics;
    const hexColor = colorObj.hex;
    const secColor = colorObj.secondary || '#c89242';
    const mat = createClothMaterial(colorObj, product.fabric, product.pattern, heatmapMode, xrayMode);
    const group = new THREE.Group();
    const legHandles = [];

    const waistTension = (fitEval.zones.waist && fitEval.zones.waist.tension) || 0;
    const hipTension = (fitEval.zones.hip && fitEval.zones.hip.tension) || 0;

    if (product.style === 'skirt') {
      const yTop = m.waistY + 0.016;
      const yBottom = m.kneeY - 0.055;
      const skirtGeo = buildTorsoClothShell({
        m,
        yBottom,
        yTop,
        radialSegs: 52,
        ySteps: 28,
        baseLayerOffset: 0.011,
        fitEval,
        flareBottom: 0.15,
        pleats: 22
      });
      const skirtMesh = new THREE.Mesh(skirtGeo, mat);
      skirtMesh.castShadow = true;
      skirtMesh.receiveShadow = true;
      group.add(skirtMesh);

      // Clean high-waist tailored band
      const bandMat = createAccentMaterial(
        new THREE.Color(hexColor).multiplyScalar(0.86).getStyle(),
        { roughness: 0.55 },
        heatmapMode,
        mat
      );
      group.add(buildTorsoBand(m, yTop - 0.016, 0.036, 0.015, bandMat, 0));

      rig.torsoGarmentSlot.add(group);
      ensureGroupVertexColors(group, waistTension);
      return {
        dispose() {
          rig.torsoGarmentSlot.remove(group);
        }
      };
    }

    // Trousers (Jeans, Chinos, Cargo)
    const isJeans = product.style === 'jeans';
    const isCargo = product.style === 'cargo';
    const hipEase = (fitEval.zones.hip && fitEval.zones.hip.easeCm) || 6;

    const pelvisGeo = buildTorsoClothShell({
      m,
      yBottom: m.crotchY - 0.012,
      yTop: m.waistY + 0.010,
      radialSegs: 44,
      ySteps: 16,
      baseLayerOffset: 0.010,
      fitEval,
      boxyFactor: isCargo ? 0.25 : 0.06
    });
    const pelvisMesh = new THREE.Mesh(pelvisGeo, mat);
    pelvisMesh.castShadow = true;
    pelvisMesh.receiveShadow = true;
    group.add(pelvisMesh);

    // Tailored Waistband + Belt Loops + Waist Button
    const trimMat = createAccentMaterial(
      new THREE.Color(hexColor).multiplyScalar(0.84).getStyle(),
      { roughness: 0.85 },
      heatmapMode,
      mat
    );
    group.add(buildTorsoBand(m, m.waistY - 0.008, 0.036, 0.014, trimMat, 0));

    // 5 Belt Loops around waist
    [0.25, 0.82, 1.35, 1.75, 2.30].forEach((mult) => {
      const ang = mult * Math.PI * 0.8;
      const pt = M3D.sampleTorsoPoint(m.waistY - 0.008, ang, m, 0.017);
      const loop = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.042, 0.008), trimMat);
      loop.position.set(pt.x, pt.y, pt.z);
      loop.rotation.y = -ang + Math.PI * 0.5;
      group.add(loop);
    });

    // Front waist button (brass for jeans, dark horn for chinos/cargo)
    const wBtnMat = isJeans
      ? new THREE.MeshStandardMaterial({ color: 0xcfa052, metalness: 0.78, roughness: 0.3 })
      : new THREE.MeshStandardMaterial({ color: 0x262422, roughness: 0.45 });
    const fPt = M3D.sampleTorsoPoint(m.waistY - 0.008, Math.PI * 0.5, m, 0.016);
    const wBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 14), wBtnMat);
    wBtn.rotation.x = Math.PI * 0.5;
    wBtn.position.set(0, fPt.y, fPt.z + 0.004);
    group.add(wBtn);

    // Back patch pockets on jeans
    if (isJeans) {
      [-1, 1].forEach((side) => {
        const bp = M3D.sampleTorsoPoint(m.hipY + 0.005, Math.PI * 1.5 + side * 0.34, m, 0.015);
        const backPkt = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.102, 0.008), trimMat);
        backPkt.position.set(bp.x, bp.y, bp.z);
        backPkt.rotation.y = side * -0.30;
        group.add(backPkt);
      });
    }

    rig.torsoGarmentSlot.add(group);
    ensureGroupVertexColors(group, waistTension);

    // Articulated trouser legs
    const legEase = easeToClearance(hipEase, isCargo ? 0.023 : isJeans ? 0.013 : 0.011);
    const cuffAccentMat = createAccentMaterial(
      isJeans ? secColor : new THREE.Color(hexColor).multiplyScalar(0.84).getStyle(),
      { roughness: 0.88 },
      heatmapMode,
      mat
    );

    [rig.leftLeg, rig.rightLeg].forEach((leg, idx) => {
      const side = idx === 0 ? -1 : 1;
      const thighTop = m.thighTopR + legEase;
      const kneeRad = isCargo ? m.kneeR + legEase * 1.55 : isJeans ? m.kneeR + legEase * 1.12 : m.kneeR + legEase * 0.94;
      const calfRad = isCargo ? m.calfR + legEase * 1.55 : isJeans ? m.calfR + legEase * 1.08 : m.calfR + legEase * 0.84;
      const ankleRad = isCargo ? m.ankleR + legEase * 1.85 : isJeans ? m.ankleR + legEase * 1.18 : m.ankleR + legEase * 0.88;

      const tGeo = M3D.buildTaperedLimbGeometry(leg.thighLen + 0.012, thighTop, (thighTop + kneeRad) * 0.52, kneeRad, 22, 10);
      applyHeatmapVertexColors(tGeo, () => hipTension * 0.88);
      const tMesh = new THREE.Mesh(tGeo, mat);
      tMesh.castShadow = true;
      tMesh.receiveShadow = true;
      leg.thighGarmentSlot.add(tMesh);
      legHandles.push({ parent: leg.thighGarmentSlot, mesh: tMesh });

      if (isCargo) {
        const pktGeo = new THREE.BoxGeometry(0.026, 0.13, 0.098);
        applyHeatmapVertexColors(pktGeo, () => hipTension * 0.88);
        const pkt = new THREE.Mesh(pktGeo, trimMat);
        pkt.position.set(side * (thighTop * 0.94), -leg.thighLen * 0.56, 0.008);
        pkt.castShadow = true;
        leg.thighGarmentSlot.add(pkt);
        legHandles.push({ parent: leg.thighGarmentSlot, mesh: pkt });

        // Cargo pocket flap lid
        const lidGeo = new THREE.BoxGeometry(0.030, 0.032, 0.104);
        applyHeatmapVertexColors(lidGeo, () => hipTension * 0.88);
        const lid = new THREE.Mesh(lidGeo, mat);
        lid.position.set(side * (thighTop * 0.95), -leg.thighLen * 0.56 + 0.056, 0.008);
        leg.thighGarmentSlot.add(lid);
        legHandles.push({ parent: leg.thighGarmentSlot, mesh: lid });
      }

      const kBallGeo = new THREE.SphereGeometry(kneeRad * 0.99, 16, 12);
      applyHeatmapVertexColors(kBallGeo, () => hipTension * 0.55);
      const kBall = new THREE.Mesh(kBallGeo, mat);
      leg.calfGarmentSlot.add(kBall);
      legHandles.push({ parent: leg.calfGarmentSlot, mesh: kBall });

      const cGeo = M3D.buildTaperedLimbGeometry(leg.calfLen * 0.95, kneeRad, calfRad, ankleRad, 22, 10);
      applyHeatmapVertexColors(cGeo, () => lerp(hipTension * 0.4, waistTension * 0.15, 0.5));
      const cMesh = new THREE.Mesh(cGeo, mat);
      cMesh.castShadow = true;
      cMesh.receiveShadow = true;
      leg.calfGarmentSlot.add(cMesh);
      legHandles.push({ parent: leg.calfGarmentSlot, mesh: cMesh });

      // Selvedge turn-up denim cuff at ankle
      if (isJeans) {
        const turnGeo = new THREE.CylinderGeometry(ankleRad + 0.004, ankleRad + 0.005, 0.036, 22);
        applyHeatmapVertexColors(turnGeo, () => hipTension * 0.3);
        const turnMat = createAccentMaterial(
          new THREE.Color(hexColor).lerp(new THREE.Color('#d8d4cc'), 0.35).getStyle(),
          { roughness: 0.9 },
          heatmapMode,
          mat
        );
        const turnMesh = new THREE.Mesh(turnGeo, turnMat);
        turnMesh.position.set(0, -leg.calfLen * 0.92, 0);
        leg.calfGarmentSlot.add(turnMesh);
        legHandles.push({ parent: leg.calfGarmentSlot, mesh: turnMesh });

        // Subtle selvedge ochre hem line
        const stitchGeo = new THREE.TorusGeometry(ankleRad + 0.005, 0.0022, 8, 22);
        applyHeatmapVertexColors(stitchGeo, () => hipTension * 0.3);
        const stitchRing = new THREE.Mesh(stitchGeo, cuffAccentMat);
        stitchRing.rotation.x = Math.PI * 0.5;
        stitchRing.position.set(0, -leg.calfLen * 0.92 + 0.018, 0);
        leg.calfGarmentSlot.add(stitchRing);
        legHandles.push({ parent: leg.calfGarmentSlot, mesh: stitchRing });
      }
    });

    return {
      dispose() {
        rig.torsoGarmentSlot.remove(group);
        legHandles.forEach((h) => h.parent.remove(h.mesh));
      }
    };
  }

  // ==================== DRESSES (BATIK KAWUNG, SATIN WRAP, LINEN A-LINE) ====================
  function buildDressGarment(rig, product, size, colorObj, fitEval, heatmapMode, xrayMode) {
    const m = rig.metrics;
    const mat = createClothMaterial(colorObj, product.fabric, product.pattern, heatmapMode, xrayMode);
    const isWrap = product.style === 'dress_wrap';
    const isBatik = product.style === 'dress_batik';

    const group = new THREE.Group();
    const yTop = m.neckBaseY - 0.015;
    const yBottom = m.kneeY - 0.07;

    const dressGeo = buildTorsoClothShell({
      m,
      yBottom,
      yTop,
      radialSegs: 52,
      ySteps: 38,
      baseLayerOffset: 0.009,
      fitEval,
      flareBottom: isWrap ? 0.10 : 0.165,
      pleats: isWrap ? 10 : 16,
      vNeckDepth: isWrap ? 0.105 : isBatik ? 0.042 : 0.055
    });
    const dressMesh = new THREE.Mesh(dressGeo, mat);
    dressMesh.castShadow = true;
    dressMesh.receiveShadow = true;
    group.add(dressMesh);

    // Sculpted Obi / Satin Waist Sash with front knot accent
    const sashColor = isBatik ? colorObj.secondary || colorObj.hex : new THREE.Color(colorObj.hex).multiplyScalar(0.76).getStyle();
    const sashMat = createAccentMaterial(
      sashColor,
      { physical: isWrap, roughness: isWrap ? 0.28 : 0.72, clearcoat: isWrap ? 0.5 : 0 },
      heatmapMode,
      mat
    );
    const sashHeight = isBatik ? 0.068 : 0.042;
    group.add(buildTorsoBand(m, m.waistY, sashHeight, 0.015, sashMat, 0));

    // Sash knot / ribbon drape on front-side waist
    const kPt = M3D.sampleTorsoPoint(m.waistY, Math.PI * 0.5 - 0.35, m, 0.020);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.020, 14, 12), sashMat);
    knot.scale.set(1.2, 0.9, 0.7);
    knot.position.set(kPt.x, m.waistY, kPt.z);
    group.add(knot);

    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.16, 0.006), sashMat);
    ribbon.position.set(kPt.x + 0.012, m.waistY - 0.085, kPt.z + 0.006);
    ribbon.rotation.z = 0.12;
    group.add(ribbon);

    rig.torsoGarmentSlot.add(group);
    ensureGroupVertexColors(group, sampleTorsoTension(m.waistY, m, fitEval));

    const sleeveHandles = attachSleeves(rig, product, fitEval, mat, {
      lengthRatio: isBatik ? 0.42 : isWrap ? 0.34 : 0.28,
      easeExtra: 0.010
    });

    return {
      dispose() {
        rig.torsoGarmentSlot.remove(group);
        sleeveHandles.forEach((h) => h.parent.remove(h.mesh));
      }
    };
  }

  // ==================== FOOTWEAR (SCULPTED SNEAKERS & POLISHED PANTOFEL OXFORD) ====================
  function buildShoesGarment(rig, product, size, colorObj, fitEval, heatmapMode, xrayMode) {
    const m = rig.metrics;
    const isPantofel = product.style === 'pantofel';
    const hexColor = colorObj.hex;
    const secColor = colorObj.secondary || (isPantofel ? '#241c16' : '#f2efe9');
    const accColor = colorObj.accent || '#2b2b2e';

    const upperMat = heatmapMode
      ? new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.5 })
      : new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(hexColor),
          roughness: isPantofel ? 0.20 : 0.48,
          metalness: isPantofel ? 0.14 : 0.04,
          clearcoat: isPantofel ? 0.75 : 0.18,
          clearcoatRoughness: isPantofel ? 0.16 : 0.42,
          transparent: !!xrayMode,
          opacity: xrayMode ? 0.6 : 1.0
        });

    const soleMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(secColor),
      roughness: isPantofel ? 0.55 : 0.80
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(accColor),
      roughness: 0.55
    });
    const laceMat = new THREE.MeshStandardMaterial({
      color: isPantofel ? 0x161618 : 0xf7f5f0,
      roughness: 0.85
    });

    const handles = [];
    const scaleH = m.H / 1.72;
    const footLen = (isPantofel ? 0.255 : 0.245) * scaleH;
    const footW = m.ankleR * (isPantofel ? 1.98 : 2.18);

    [rig.leftLeg, rig.rightLeg].forEach((leg, idx) => {
      const side = idx === 0 ? -1 : 1;
      const shoeGroup = new THREE.Group();

      if (isPantofel) {
        // --- FORMAL PANTOFEL OXFORD CAP-TOE ---
        // Thin welt forefoot outsole
        const foreSole = new THREE.Mesh(new THREE.BoxGeometry(footW * 1.02, 0.011, footLen * 0.72), soleMat);
        foreSole.position.set(0, -m.ankleY + 0.008, footLen * 0.30);
        foreSole.castShadow = true;
        shoeGroup.add(foreSole);

        // Distinct stacked formal dress heel block
        const heelBlock = new THREE.Mesh(new THREE.BoxGeometry(footW * 0.94, 0.028, footLen * 0.30), soleMat);
        heelBlock.position.set(0, -m.ankleY + 0.014, -footLen * 0.16);
        heelBlock.castShadow = true;
        shoeGroup.add(heelBlock);

        // Sleek sculpted quarter & vamp leather body
        const vamp = new THREE.Mesh(new THREE.BoxGeometry(footW * 0.92, m.ankleY * 0.68, footLen * 0.64), upperMat);
        vamp.position.set(0, -m.ankleY * 0.44, footLen * 0.06);
        vamp.castShadow = true;
        shoeGroup.add(vamp);

        // Elegant tapered almond cap-toe
        const toe = new THREE.Mesh(new THREE.SphereGeometry(footW * 0.45, 20, 14), upperMat);
        toe.scale.set(0.95, 0.56, 1.65);
        toe.position.set(0, -m.ankleY * 0.58, footLen * 0.44);
        toe.castShadow = true;
        shoeGroup.add(toe);

        // Raised cap-toe stitch seam band
        const capSeam = new THREE.Mesh(new THREE.TorusGeometry(footW * 0.42, 0.0028, 8, 18, Math.PI), accentMat);
        capSeam.position.set(0, -m.ankleY * 0.55, footLen * 0.46);
        capSeam.rotation.x = 0.2;
        shoeGroup.add(capSeam);

        // Fine Oxford dress laces (3 delicate bars)
        for (let l = 0; l < 3; l++) {
          const lace = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, footW * 0.48, 8), laceMat);
          lace.rotation.z = Math.PI * 0.5;
          lace.position.set(0, -m.ankleY * 0.14 - l * 0.007, footLen * (0.14 + l * 0.07));
          shoeGroup.add(lace);
        }
      } else {
        // --- SCULPTED LEATHER LOW-TOP SNEAKERS ---
        // Thick modern rubber cupsole
        const cupsole = new THREE.Mesh(new THREE.BoxGeometry(footW * 1.06, 0.028, footLen * 0.92), soleMat);
        cupsole.position.set(0, -m.ankleY + 0.014, footLen * 0.18);
        cupsole.castShadow = true;
        shoeGroup.add(cupsole);

        const soleToe = new THREE.Mesh(new THREE.CylinderGeometry(footW * 0.52, footW * 0.53, 0.028, 20), soleMat);
        soleToe.position.set(0, -m.ankleY + 0.014, footLen * 0.56);
        shoeGroup.add(soleToe);

        // Upper leather body
        const upper = new THREE.Mesh(new THREE.BoxGeometry(footW * 0.96, m.ankleY * 0.72, footLen * 0.74), upperMat);
        upper.position.set(0, -m.ankleY * 0.40, footLen * 0.12);
        upper.castShadow = true;
        shoeGroup.add(upper);

        // Rounded sneaker toe box
        const toeBox = new THREE.Mesh(new THREE.SphereGeometry(footW * 0.47, 18, 14), upperMat);
        toeBox.scale.set(1.0, 0.66, 1.25);
        toeBox.position.set(0, -m.ankleY * 0.50, footLen * 0.50);
        toeBox.castShadow = true;
        shoeGroup.add(toeBox);

        // Contrasting heel tab on back of ankle
        const heelTab = new THREE.Mesh(new THREE.BoxGeometry(footW * 0.72, m.ankleY * 0.46, 0.014), accentMat);
        heelTab.position.set(0, -m.ankleY * 0.18, -footLen * 0.24);
        shoeGroup.add(heelTab);

        // Signature diagonal side stripe on outer quarter panel
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.022, footLen * 0.36), accentMat);
        stripe.position.set(side * (footW * 0.49), -m.ankleY * 0.40, footLen * 0.16);
        stripe.rotation.x = 0.22;
        shoeGroup.add(stripe);

        // 4 crisp 3D shoelace bars across tongue
        for (let l = 0; l < 4; l++) {
          const lace = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, footW * 0.56, 8), laceMat);
          lace.rotation.z = Math.PI * 0.5;
          lace.position.set(0, -m.ankleY * 0.08 - l * 0.009, footLen * (0.14 + l * 0.075));
          shoeGroup.add(lace);
        }
      }

      leg.shoeSlot.add(shoeGroup);
      handles.push({ parent: leg.shoeSlot, mesh: shoeGroup });
    });

    return {
      dispose() {
        handles.forEach((h) => h.parent.remove(h.mesh));
      }
    };
  }

  function mountGarment(rig, product, size, colorObj, fitEval, heatmapMode, xrayMode) {
    const col = typeof colorObj === 'string' ? { hex: colorObj } : colorObj;
    if (product.category === 'top' || product.category === 'outer') {
      return buildUpperGarment(rig, product, size, col, fitEval, heatmapMode, xrayMode);
    }
    if (product.category === 'bottom') {
      return buildBottomGarment(rig, product, size, col, fitEval, heatmapMode, xrayMode);
    }
    if (product.category === 'dress') {
      return buildDressGarment(rig, product, size, col, fitEval, heatmapMode, xrayMode);
    }
    if (product.category === 'shoes') {
      return buildShoesGarment(rig, product, size, col, fitEval, heatmapMode, xrayMode);
    }
    return { dispose() {} };
  }

  return {
    mountGarment
  };
})();
