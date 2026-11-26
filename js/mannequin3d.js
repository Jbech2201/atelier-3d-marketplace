window.Mannequin3D = (function () {
  /**
   * Computes ellipse semi-axes (rx, rz) from circumference in cm and depth/width ratio k = rz/rx.
   */
  function circumferenceToAxes(cm, k) {
    const cMeters = cm / 100;
    const factor = Math.PI * (3 * (1 + k) - Math.sqrt((3 + k) * (1 + 3 * k)));
    const rx = cMeters / factor;
    return { rx, rz: rx * k };
  }

  function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Computes exact anatomical landmarks (in meters, y=0 is floor) from user body measurements.
   */
  function getMetrics(body, genderBias) {
    const H = body.height / 100;
    const g = genderBias !== undefined ? genderBias : 0.3;

    const chestAxes = circumferenceToAxes(body.chest, lerp(0.71, 0.78, g));
    const waistAxes = circumferenceToAxes(body.waist, lerp(0.76, 0.72, g));
    const hipAxes = circumferenceToAxes(body.hip, lerp(0.72, 0.76, g));
    const shoulderHalf = (body.shoulder / 100) * 0.5;

    // Neck & head proportional scaling
    const neckRx = lerp(0.056, 0.048, g) * (0.75 + (body.chest / 96) * 0.25);
    const neckRz = neckRx * 0.96;

    const landmarks = {
      H,
      g,
      footY: 0.0,
      ankleY: 0.048 * H,
      calfY: 0.165 * H,
      kneeY: 0.278 * H,
      midThighY: 0.375 * H,
      crotchY: 0.468 * H,
      hipY: 0.525 * H,
      waistY: 0.618 * H,
      ribY: 0.675 * H,
      chestY: 0.726 * H,
      upperChestY: 0.785 * H,
      shoulderY: 0.816 * H,
      neckBaseY: 0.842 * H,
      neckTopY: 0.880 * H,
      headCenterY: 0.938 * H,
      headRx: 0.074 * (H / 1.72),
      headRy: 0.104 * (H / 1.72),
      headRz: 0.088 * (H / 1.72),

      chestRx: chestAxes.rx,
      chestRz: chestAxes.rz,
      waistRx: waistAxes.rx,
      waistRz: waistAxes.rz,
      hipRx: hipAxes.rx,
      hipRz: hipAxes.rz,
      shoulderHalf,
      neckRx,
      neckRz,

      // Arm dimensions
      armLength: (body.armLength / 100),
      upperArmLen: (body.armLength / 100) * 0.48,
      forearmLen: (body.armLength / 100) * 0.44,
      upperArmR: Math.max(0.036, Math.min(0.068, (body.chest / 96) * lerp(0.048, 0.042, g))),
      elbowR: Math.max(0.030, Math.min(0.054, (body.chest / 96) * lerp(0.039, 0.034, g))),
      wristR: Math.max(0.022, Math.min(0.038, (body.chest / 96) * lerp(0.029, 0.025, g))),

      // Leg dimensions
      hipJointX: Math.max(0.078, hipAxes.rx * 0.51),
      thighTopR: Math.max(0.064, hipAxes.rx * 0.475),
      kneeR: Math.max(0.044, hipAxes.rx * 0.305),
      calfR: Math.max(0.046, hipAxes.rx * 0.32),
      ankleR: Math.max(0.030, hipAxes.rx * 0.215),

      shoulderJointX: Math.max(chestAxes.rx * 0.88, shoulderHalf - 0.028)
    };

    return landmarks;
  }

  /**
   * Interpolates piecewise torso cross-section profile (rx, rz, zOffset) at height y.
   */
  function sampleTorsoSlice(y, m) {
    const stations = [
      { y: m.crotchY - 0.015, rx: m.hipRx * 0.72, rz: m.hipRz * 0.74, zOff: -0.005 },
      { y: m.crotchY + 0.02,  rx: m.hipRx * 0.94, rz: m.hipRz * 0.95, zOff: -0.008 },
      { y: m.hipY,            rx: m.hipRx,        rz: m.hipRz,        zOff: -0.010 },
      { y: lerp(m.hipY, m.waistY, 0.48), rx: lerp(m.hipRx, m.waistRx, 0.58), rz: lerp(m.hipRz, m.waistRz, 0.52), zOff: 0.000 },
      { y: m.waistY,          rx: m.waistRx,      rz: m.waistRz,      zOff: 0.006 },
      { y: m.ribY,            rx: lerp(m.waistRx, m.chestRx, 0.72), rz: lerp(m.waistRz, m.chestRz, 0.70), zOff: 0.005 },
      { y: m.chestY,          rx: m.chestRx,      rz: m.chestRz,      zOff: 0.008 },
      { y: m.upperChestY,     rx: Math.max(m.chestRx * 0.96, m.shoulderHalf * 0.86), rz: m.chestRz * 0.79, zOff: 0.001 },
      { y: m.shoulderY,       rx: Math.max(m.chestRx * 0.80, m.shoulderHalf * 0.78), rz: m.chestRz * 0.58, zOff: -0.004 },
      { y: m.neckBaseY,       rx: m.neckRx * 1.24, rz: m.neckRz * 1.15, zOff: -0.004 },
      { y: m.neckTopY,        rx: m.neckRx,        rz: m.neckRz,        zOff: 0.002 }
    ];

    if (y <= stations[0].y) return { rx: stations[0].rx, rz: stations[0].rz, zOff: stations[0].zOff };
    const last = stations[stations.length - 1];
    if (y >= last.y) return { rx: last.rx, rz: last.rz, zOff: last.zOff };

    for (let i = 0; i < stations.length - 1; i++) {
      const a = stations[i];
      const b = stations[i + 1];
      if (y >= a.y && y <= b.y) {
        const rawT = (y - a.y) / (b.y - a.y);
        // Smoothstep easing for silky silhouette transitions
        const t = rawT * rawT * (3 - 2 * rawT);
        return {
          rx: lerp(a.rx, b.rx, t),
          rz: lerp(a.rz, b.rz, t),
          zOff: lerp(a.zOff, b.zOff, t)
        };
      }
    }
    return { rx: m.waistRx, rz: m.waistRz, zOff: 0 };
  }

  /**
   * Samples an anatomical surface point (x, y, z) on the torso at height y and angle theta.
   * theta = 0 -> +X (right), PI/2 -> +Z (front), PI -> -X (left), 3PI/2 -> -Z (back).
   * Shared by both Mannequin3D and Garments3D so garments conform precisely without clipping!
   */
  function sampleTorsoPoint(y, theta, m, radialOffset, styleMod) {
    const s = sampleTorsoSlice(y, m);
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    let rx = s.rx + (radialOffset || 0);
    let rz = s.rz + (radialOffset || 0);
    let zOff = s.zOff;

    if (styleMod) {
      if (styleMod.extraRx) rx += styleMod.extraRx;
      if (styleMod.extraRz) rz += styleMod.extraRz;
      if (styleMod.zOff) zOff += styleMod.zOff;
    }

    // Subtle anatomical sculpting (bust/pectoral front, glutes back, spine groove)
    const isCloth = (radialOffset || 0) > 0.001;
    const sculptScale = isCloth ? 0.55 : 1.0;

    // Front bust / chest sculpting near chestY
    const chestBand = Math.exp(-Math.pow((y - (m.chestY - 0.008)) / (0.068 * (m.H / 1.72)), 2));
    let frontSculpt = 0;
    if (sinT > 0.05) {
      // Twin mound profile peaking around cos(theta) = +-0.42
      const twinPeak = Math.exp(-Math.pow((Math.abs(cosT) - 0.42) / 0.34, 2));
      const bustDepth = lerp(0.008, 0.028, m.g) * (m.chestRx / 0.17) * sculptScale;
      frontSculpt = chestBand * Math.pow(sinT, 1.3) * twinPeak * bustDepth;
    }

    // Back glute sculpting near hipY
    const gluteBand = Math.exp(-Math.pow((y - (m.hipY - 0.015)) / (0.075 * (m.H / 1.72)), 2));
    let backSculpt = 0;
    if (sinT < -0.05) {
      const gluteMound = Math.exp(-Math.pow((Math.abs(cosT) - 0.40) / 0.42, 2));
      const gluteDepth = lerp(0.012, 0.026, m.g) * (m.hipRx / 0.17) * sculptScale;
      backSculpt = gluteBand * Math.pow(-sinT, 1.3) * gluteMound * gluteDepth;
    }

    // Gentle midline sternum & spine indentation (gives authentic sculpted mannequin look)
    const centerLine = Math.exp(-Math.pow(cosT / 0.18, 2));
    const backGroove = sinT < -0.5 ? -0.005 * centerLine * sculptScale * smoothstep(m.hipY, m.shoulderY, y) : 0;

    const x = cosT * rx;
    const z = sinT * rz + zOff + frontSculpt - backSculpt - backGroove;
    return { x, y, z };
  }

  /**
   * Builds a smooth lofted BufferGeometry from an array of rings of {x, y, z} vertices.
   */
  function buildLoftGeometry(rings, closedLoop, capBottom, capTop) {
    const ringCount = rings.length;
    const segs = rings[0].length;
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let r = 0; r < ringCount; r++) {
      const v = r / Math.max(1, ringCount - 1);
      for (let s = 0; s <= segs; s++) {
        const idx = closedLoop ? s % segs : Math.min(s, segs - 1);
        const p = rings[r][idx];
        positions.push(p.x, p.y, p.z);
        uvs.push(s / segs, v);
      }
    }

    const stride = segs + 1;
    for (let r = 0; r < ringCount - 1; r++) {
      for (let s = 0; s < segs; s++) {
        const a = r * stride + s;
        const b = (r + 1) * stride + s;
        const c = (r + 1) * stride + (s + 1);
        const d = r * stride + (s + 1);
        indices.push(a, d, b);
        indices.push(b, d, c);
      }
    }

    if (capBottom && closedLoop) {
      const centerIdx = positions.length / 3;
      let cx = 0, cy = 0, cz = 0;
      for (let s = 0; s < segs; s++) {
        cx += rings[0][s].x;
        cy += rings[0][s].y;
        cz += rings[0][s].z;
      }
      positions.push(cx / segs, cy / segs, cz / segs);
      uvs.push(0.5, 0);
      for (let s = 0; s < segs; s++) {
        indices.push(centerIdx, s, s + 1);
      }
    }

    if (capTop && closedLoop) {
      const centerIdx = positions.length / 3;
      const lastRing = rings[ringCount - 1];
      let cx = 0, cy = 0, cz = 0;
      for (let s = 0; s < segs; s++) {
        cx += lastRing[s].x;
        cy += lastRing[s].y;
        cz += lastRing[s].z;
      }
      positions.push(cx / segs, cy / segs, cz / segs);
      uvs.push(0.5, 1);
      const base = (ringCount - 1) * stride;
      for (let s = 0; s < segs; s++) {
        indices.push(centerIdx, base + s + 1, base + s);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  /**
   * Builds a tapered vertical tube (used for limbs) going downwards from y=0 to y=-length.
   */
  function buildTaperedLimbGeometry(length, rTop, rMid, rBot, radialSegs, heightSegs) {
    const rings = [];
    const rSegs = radialSegs || 20;
    const hSegs = heightSegs || 10;

    for (let i = 0; i <= hSegs; i++) {
      const t = i / hSegs;
      const y = -t * length;
      // Quadratic bezier interpolation of radius
      const oneMinus = 1 - t;
      const r = oneMinus * oneMinus * rTop + 2 * oneMinus * t * rMid + t * t * rBot;
      const ring = [];
      for (let s = 0; s < rSegs; s++) {
        const theta = (s / rSegs) * Math.PI * 2;
        ring.push({
          x: Math.cos(theta) * r,
          y,
          z: Math.sin(theta) * r * 1.04
        });
      }
      rings.push(ring);
    }
    return buildLoftGeometry(rings, true, true, true);
  }

  /**
   * Builds the complete parametric articulated 3D Mannequin rig.
   */
  function createMannequin(body, genderBias, materialConfig) {
    const m = getMetrics(body, genderBias);
    const root = new THREE.Group();
    root.name = 'MannequinRoot';

    // Materials
    const bodyMatParams = {
      color: materialConfig.color,
      roughness: materialConfig.roughness,
      metalness: materialConfig.metalness
    };
    if (materialConfig.useLinenMap) {
      const linenTex = window.FabricTextures.getFabricBump('tailor-linen');
      bodyMatParams.map = linenTex;
      bodyMatParams.bumpMap = window.FabricTextures.getFabricBump('linen');
      bodyMatParams.bumpScale = 0.0025;
    }

    const bodyMat = new THREE.MeshStandardMaterial(bodyMatParams);
    const jointMat = new THREE.MeshStandardMaterial({
      color: materialConfig.jointColor,
      roughness: Math.min(0.85, materialConfig.roughness + 0.06),
      metalness: materialConfig.metalness
    });

    // 1. Torso & Neck (Lofted smooth parametric mesh)
    const torsoRings = [];
    const ySteps = 34;
    const radialSegs = 40;
    const yStart = m.crotchY - 0.014;
    const yEnd = m.neckTopY;

    for (let i = 0; i <= ySteps; i++) {
      const y = lerp(yStart, yEnd, i / ySteps);
      const ring = [];
      for (let s = 0; s < radialSegs; s++) {
        const theta = (s / radialSegs) * Math.PI * 2;
        ring.push(sampleTorsoPoint(y, theta, m, 0));
      }
      torsoRings.push(ring);
    }

    const torsoGeo = buildLoftGeometry(torsoRings, true, true, true);
    const torsoMesh = new THREE.Mesh(torsoGeo, bodyMat);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    root.add(torsoMesh);

    // Subtle collarbone / tailor neckline ring for artisan look
    if (materialConfig.id === 'tailor') {
      const collarCap = new THREE.Mesh(
        new THREE.CylinderGeometry(m.neckRx * 1.05, m.neckRx * 1.08, 0.018, 24),
        jointMat
      );
      collarCap.position.set(0, m.neckTopY, 0.002);
      root.add(collarCap);
    }

    // 2. Sculpted Fashion Mannequin Head
    const headGroup = new THREE.Group();
    headGroup.position.set(0, m.headCenterY, 0.006);
    const headGeo = new THREE.SphereGeometry(1, 28, 24);
    const hPos = headGeo.attributes.position;
    for (let i = 0; i < hPos.count; i++) {
      let x = hPos.getX(i);
      let y = hPos.getY(i);
      let z = hPos.getZ(i);
      // Taper lower jaw gracefully like an editorial sculpture head
      if (y < 0) {
        const jawT = Math.min(1, -y);
        x *= 1 - jawT * 0.28;
        z *= 1 - jawT * 0.18;
        if (z > 0) z += jawT * 0.08; // gentle chin contour
      }
      hPos.setXYZ(i, x * m.headRx, y * m.headRy, z * m.headRz);
    }
    headGeo.computeVertexNormals();
    const headMesh = new THREE.Mesh(headGeo, bodyMat);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    headGroup.add(headMesh);
    root.add(headGroup);

    // 3. Articulated Arms (Left & Right)
    function createArm(side) {
      // side = +1 (right), -1 (left)
      const shoulderPivot = new THREE.Group();
      shoulderPivot.position.set(side * m.shoulderJointX, m.shoulderY - 0.018, -0.004);

      // Shoulder deltoid cap
      const shoulderBall = new THREE.Mesh(
        new THREE.SphereGeometry(m.upperArmR * 1.12, 20, 16),
        jointMat
      );
      shoulderBall.scale.set(1.05, 1.0, 0.96);
      shoulderBall.castShadow = true;
      shoulderPivot.add(shoulderBall);

      // Upper arm mesh
      const upperArmGeo = buildTaperedLimbGeometry(
        m.upperArmLen,
        m.upperArmR,
        (m.upperArmR + m.elbowR) * 0.51,
        m.elbowR,
        20,
        10
      );
      const upperArmMesh = new THREE.Mesh(upperArmGeo, bodyMat);
      upperArmMesh.castShadow = true;
      upperArmMesh.receiveShadow = true;
      shoulderPivot.add(upperArmMesh);

      // Container for upper sleeve garments
      const upperSleeveSlot = new THREE.Group();
      shoulderPivot.add(upperSleeveSlot);

      // Elbow pivot
      const elbowPivot = new THREE.Group();
      elbowPivot.position.set(0, -m.upperArmLen, 0);
      shoulderPivot.add(elbowPivot);

      const elbowBall = new THREE.Mesh(
        new THREE.SphereGeometry(m.elbowR * 0.98, 16, 14),
        jointMat
      );
      elbowBall.castShadow = true;
      elbowPivot.add(elbowBall);

      const forearmGeo = buildTaperedLimbGeometry(
        m.forearmLen,
        m.elbowR * 0.96,
        (m.elbowR + m.wristR) * 0.52,
        m.wristR,
        18,
        10
      );
      const forearmMesh = new THREE.Mesh(forearmGeo, bodyMat);
      forearmMesh.castShadow = true;
      forearmMesh.receiveShadow = true;
      elbowPivot.add(forearmMesh);

      // Container for lower sleeve garments
      const lowerSleeveSlot = new THREE.Group();
      elbowPivot.add(lowerSleeveSlot);

      // Stylized sculpted hand
      const hand = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 14), jointMat);
      hand.scale.set(m.wristR * 0.82, 0.072 * (m.H / 1.72), m.wristR * 1.15);
      hand.position.set(0, -m.forearmLen - 0.055 * (m.H / 1.72), 0.005);
      hand.castShadow = true;
      elbowPivot.add(hand);

      return { shoulderPivot, elbowPivot, upperSleeveSlot, lowerSleeveSlot };
    }

    const leftArm = createArm(-1);
    const rightArm = createArm(1);
    root.add(leftArm.shoulderPivot);
    root.add(rightArm.shoulderPivot);

    // 4. Articulated Legs (Left & Right)
    function createLeg(side) {
      const hipPivot = new THREE.Group();
      const thighLen = m.hipY - 0.025 - m.kneeY;
      const calfLen = m.kneeY - m.ankleY;

      hipPivot.position.set(side * m.hipJointX, m.hipY - 0.025, -0.006);

      // Hip blend sphere
      const hipCap = new THREE.Mesh(
        new THREE.SphereGeometry(m.thighTopR * 0.96, 18, 14),
        bodyMat
      );
      hipCap.castShadow = true;
      hipPivot.add(hipCap);

      // Thigh mesh
      const thighGeo = buildTaperedLimbGeometry(
        thighLen,
        m.thighTopR,
        (m.thighTopR + m.kneeR) * 0.52,
        m.kneeR,
        22,
        12
      );
      const thighMesh = new THREE.Mesh(thighGeo, bodyMat);
      thighMesh.castShadow = true;
      thighMesh.receiveShadow = true;
      hipPivot.add(thighMesh);

      const thighGarmentSlot = new THREE.Group();
      hipPivot.add(thighGarmentSlot);

      // Knee pivot
      const kneePivot = new THREE.Group();
      kneePivot.position.set(0, -thighLen, 0);
      hipPivot.add(kneePivot);

      const kneeBall = new THREE.Mesh(
        new THREE.SphereGeometry(m.kneeR * 0.98, 16, 14),
        jointMat
      );
      kneeBall.castShadow = true;
      kneePivot.add(kneeBall);

      // Calf mesh
      const calfGeo = buildTaperedLimbGeometry(
        calfLen,
        m.kneeR * 0.96,
        m.calfR,
        m.ankleR,
        20,
        12
      );
      const calfMesh = new THREE.Mesh(calfGeo, bodyMat);
      calfMesh.castShadow = true;
      calfMesh.receiveShadow = true;
      kneePivot.add(calfMesh);

      const calfGarmentSlot = new THREE.Group();
      kneePivot.add(calfGarmentSlot);

      // Foot pivot
      const footPivot = new THREE.Group();
      footPivot.position.set(0, -calfLen, 0);
      kneePivot.add(footPivot);

      const footLen = 0.21 * (m.H / 1.72);
      const footWidth = m.ankleR * 1.18;
      const footGeo = new THREE.BoxGeometry(footWidth * 1.65, m.ankleY * 0.92, footLen);
      const footMesh = new THREE.Mesh(footGeo, jointMat);
      footMesh.position.set(0, -m.ankleY * 0.52, footLen * 0.22);
      footMesh.castShadow = true;
      footMesh.receiveShadow = true;
      footPivot.add(footMesh);

      const shoeSlot = new THREE.Group();
      footPivot.add(shoeSlot);

      return {
        hipPivot,
        kneePivot,
        footPivot,
        thighGarmentSlot,
        calfGarmentSlot,
        shoeSlot,
        thighLen,
        calfLen
      };
    }

    const leftLeg = createLeg(-1);
    const rightLeg = createLeg(1);
    root.add(leftLeg.hipPivot);
    root.add(rightLeg.hipPivot);

    // Torso garment container
    const torsoGarmentSlot = new THREE.Group();
    root.add(torsoGarmentSlot);

    return {
      root,
      metrics: m,
      bodyMat,
      jointMat,
      headGroup,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      torsoGarmentSlot
    };
  }

  /**
   * Animates mannequin rig smoothly according to selected pose ('idle', 'raiseArms', 'walk').
   */
  function applyPose(rig, pose, timeSec) {
    if (!rig) return;
    const t = timeSec;

    // Default natural A-pose targets
    let lArmZ = -0.14;
    let rArmZ = 0.14;
    let lArmX = 0.03;
    let rArmX = 0.03;
    let lElbowX = -0.10;
    let rElbowX = -0.10;

    let lHipX = 0;
    let rHipX = 0;
    let lKneeX = 0;
    let rKneeX = 0;
    let rootY = 0;
    let rootRotY = 0;

    if (pose === 'idle') {
      const breath = Math.sin(t * 1.8) * 0.012;
      lArmZ = -0.13 - breath;
      rArmZ = 0.13 + breath;
      lElbowX = -0.10;
      rElbowX = -0.10;
    } else if (pose === 'raiseArms') {
      // Comfort motion test: smoothly raises arms outward/upward to inspect shoulder & armhole fit
      const lift = 0.55 + 0.45 * Math.sin(t * 1.6);
      lArmZ = -0.18 - lift * 0.95;
      rArmZ = 0.18 + lift * 0.95;
      lArmX = -0.15 * lift;
      rArmX = -0.15 * lift;
      lElbowX = -0.15 - lift * 0.32;
      rElbowX = -0.15 - lift * 0.32;
    } else if (pose === 'walk') {
      // Gentle catwalk cycle
      const stride = Math.sin(t * 3.4);
      const strideCos = Math.cos(t * 3.4);
      lHipX = stride * 0.26;
      rHipX = -stride * 0.26;
      lKneeX = Math.max(0, -strideCos * 0.32);
      rKneeX = Math.max(0, strideCos * 0.32);

      lArmX = -stride * 0.24;
      rArmX = stride * 0.24;
      lArmZ = -0.14;
      rArmZ = 0.14;
      lElbowX = -0.16 - Math.max(0, stride) * 0.12;
      rElbowX = -0.16 - Math.max(0, -stride) * 0.12;
      rootY = Math.abs(Math.sin(t * 3.4)) * 0.012;
      rootRotY = stride * 0.04;
    }

    // Smoothly interpolate toward target angles
    const smooth = 0.14;
    rig.leftArm.shoulderPivot.rotation.z = lerp(rig.leftArm.shoulderPivot.rotation.z, lArmZ, smooth);
    rig.rightArm.shoulderPivot.rotation.z = lerp(rig.rightArm.shoulderPivot.rotation.z, rArmZ, smooth);
    rig.leftArm.shoulderPivot.rotation.x = lerp(rig.leftArm.shoulderPivot.rotation.x, lArmX, smooth);
    rig.rightArm.shoulderPivot.rotation.x = lerp(rig.rightArm.shoulderPivot.rotation.x, rArmX, smooth);
    rig.leftArm.elbowPivot.rotation.x = lerp(rig.leftArm.elbowPivot.rotation.x, lElbowX, smooth);
    rig.rightArm.elbowPivot.rotation.x = lerp(rig.rightArm.elbowPivot.rotation.x, rElbowX, smooth);

    rig.leftLeg.hipPivot.rotation.x = lerp(rig.leftLeg.hipPivot.rotation.x, lHipX, smooth);
    rig.rightLeg.hipPivot.rotation.x = lerp(rig.rightLeg.hipPivot.rotation.x, rHipX, smooth);
    rig.leftLeg.kneePivot.rotation.x = lerp(rig.leftLeg.kneePivot.rotation.x, lKneeX, smooth);
    rig.rightLeg.kneePivot.rotation.x = lerp(rig.rightLeg.kneePivot.rotation.x, rKneeX, smooth);

    rig.root.position.y = lerp(rig.root.position.y, rootY, smooth);
    rig.root.rotation.y = lerp(rig.root.rotation.y, rootRotY, smooth);
  }

  return {
    getMetrics,
    sampleTorsoSlice,
    sampleTorsoPoint,
    buildLoftGeometry,
    buildTaperedLimbGeometry,
    createMannequin,
    applyPose
  };
})();
