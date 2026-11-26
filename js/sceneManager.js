window.SceneManager = (function () {
  let renderer, scene, camera;
  let keyLight, fillLight, rimLight, hemiLight;
  let pedestalGroup, mannequinContainer;
  let currentRig = null;
  let activeGarmentHandles = [];
  let studioEnvRT = null;

  let animPose = 'idle';
  let autoRotate = false;
  let clock = null;
  let initialized = false;

  const camState = {
    azimuth: 0.24,
    polar: 1.44,
    radius: 2.75,
    targetY: 0.96,
    targetAzimuth: 0.24,
    targetPolar: 1.44,
    targetRadius: 2.75,
    targetLookY: 0.96,
    isDragging: false,
    lastX: 0,
    lastY: 0
  };

  const LIGHTING_PRESETS = {
    daylight: {
      bg: 0xf1eee8,
      fog: 0xeae5dc,
      hemiSky: 0xffffff,
      hemiGround: 0xd8cfc2,
      hemiIntensity: 0.90,
      keyColor: 0xfffdf8,
      keyIntensity: 1.15,
      fillColor: 0xe6effa,
      fillIntensity: 0.55,
      rimColor: 0xfff5e4,
      rimIntensity: 0.62
    },
    boutique: {
      bg: 0xede5da,
      fog: 0xe4d9ca,
      hemiSky: 0xfff4e6,
      hemiGround: 0xc9b49c,
      hemiIntensity: 0.85,
      keyColor: 0xffe4c4,
      keyIntensity: 1.28,
      fillColor: 0xf7dfc7,
      fillIntensity: 0.44,
      rimColor: 0xffd2a1,
      rimIntensity: 0.72
    },
    editorial: {
      bg: 0x242220,
      fog: 0x201e1c,
      hemiSky: 0xd9e4f5,
      hemiGround: 0x2b2520,
      hemiIntensity: 0.58,
      keyColor: 0xffffff,
      keyIntensity: 1.48,
      fillColor: 0x7ba4d9,
      fillIntensity: 0.48,
      rimColor: 0xf2a679,
      rimIntensity: 1.05
    }
  };

  /**
   * Builds a procedural virtual photography softbox studio environment via PMREMGenerator.
   * Gives leather jackets, satin dresses, pantofel shoes, zippers & buttons crisp reflections!
   */
  function createStudioEnvironment(webglRenderer) {
    try {
      const pmrem = new THREE.PMREMGenerator(webglRenderer);
      pmrem.compileEquirectangularShader();

      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0xd8d2c8);

      // Overhead softbox panel
      const topBox = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
      );
      topBox.position.set(0, 4.5, 0);
      topBox.rotation.x = Math.PI * 0.5;
      envScene.add(topBox);

      // Key side strip light
      const rightStrip = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 5.0),
        new THREE.MeshBasicMaterial({ color: 0xfff7ea, side: THREE.DoubleSide })
      );
      rightStrip.position.set(4.2, 1.8, 2.4);
      rightStrip.lookAt(0, 1, 0);
      envScene.add(rightStrip);

      // Cool fill strip light
      const leftStrip = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 4.5),
        new THREE.MeshBasicMaterial({ color: 0xe6f0ff, side: THREE.DoubleSide })
      );
      leftStrip.position.set(-4.2, 1.5, 1.8);
      leftStrip.lookAt(0, 1, 0);
      envScene.add(leftStrip);

      // Warm rim strip behind mannequin
      const backStrip = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 4.2),
        new THREE.MeshBasicMaterial({ color: 0xffebd6, side: THREE.DoubleSide })
      );
      backStrip.position.set(0, 2.2, -4.5);
      backStrip.lookAt(0, 1, 0);
      envScene.add(backStrip);

      const rt = pmrem.fromScene(envScene, 0.04);
      pmrem.dispose();
      return rt;
    } catch (_) {
      return null;
    }
  }

  function disposeGroup(group) {
    if (!group) return;
    group.traverse((obj) => {
      if (obj.isMesh) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      }
    });
  }

  function init(canvasEl) {
    if (typeof THREE === 'undefined') {
      throw new Error('Three.js gagal dimuat. Pastikan koneksi internet aktif untuk memuat CDN Three.js.');
    }

    clock = new THREE.Clock();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(LIGHTING_PRESETS.daylight.bg);
    scene.fog = new THREE.Fog(LIGHTING_PRESETS.daylight.fog, 5.5, 13);

    const rect = canvasEl.parentElement.getBoundingClientRect();
    camera = new THREE.PerspectiveCamera(36, Math.max(1, rect.width) / Math.max(1, rect.height), 0.1, 30);

    renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(rect.width, rect.height, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Bake realistic studio reflections
    studioEnvRT = createStudioEnvironment(renderer);
    if (studioEnvRT) {
      scene.environment = studioEnvRT.texture;
    }

    // Studio 3-Point Lighting
    hemiLight = new THREE.HemisphereLight(0xffffff, 0xd8cfc2, 0.90);
    hemiLight.position.set(0, 4, 0);
    scene.add(hemiLight);

    keyLight = new THREE.DirectionalLight(0xfffdf8, 1.15);
    keyLight.position.set(2.4, 3.8, 2.8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 10;
    keyLight.shadow.camera.left = -1.4;
    keyLight.shadow.camera.right = 1.4;
    keyLight.shadow.camera.top = 2.4;
    keyLight.shadow.camera.bottom = -0.4;
    keyLight.shadow.bias = -0.0004;
    scene.add(keyLight);

    fillLight = new THREE.DirectionalLight(0xe6effa, 0.55);
    fillLight.position.set(-2.6, 2.2, 1.8);
    scene.add(fillLight);

    rimLight = new THREE.DirectionalLight(0xfff5e4, 0.62);
    rimLight.position.set(-0.6, 2.8, -2.6);
    scene.add(rimLight);

    // Studio Turntable Pedestal & Soft Floor
    pedestalGroup = new THREE.Group();
    const pedTex = window.FabricTextures.getPedestalTexture();

    const pedTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.72, 0.055, 64),
      new THREE.MeshStandardMaterial({
        map: pedTex,
        roughness: 0.62,
        metalness: 0.06
      })
    );
    pedTop.position.y = -0.028;
    pedTop.receiveShadow = true;
    pedestalGroup.add(pedTop);

    const pedRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.695, 0.009, 12, 64),
      new THREE.MeshStandardMaterial({
        color: 0xc9a87c,
        roughness: 0.28,
        metalness: 0.78
      })
    );
    pedRim.rotation.x = Math.PI * 0.5;
    pedRim.position.y = -0.002;
    pedestalGroup.add(pedRim);

    const studioFloor = new THREE.Mesh(
      new THREE.CircleGeometry(9, 48),
      new THREE.MeshStandardMaterial({
        color: 0xece8e0,
        roughness: 0.92,
        metalness: 0.0
      })
    );
    studioFloor.rotation.x = -Math.PI * 0.5;
    studioFloor.position.y = -0.056;
    studioFloor.receiveShadow = true;
    pedestalGroup.add(studioFloor);

    scene.add(pedestalGroup);

    mannequinContainer = new THREE.Group();
    scene.add(mannequinContainer);

    bindPointerEvents(canvasEl);
    window.addEventListener('resize', () => handleResize(canvasEl));

    initialized = true;
    animate();
  }

  function handleResize(canvasEl) {
    if (!renderer || !camera) return;
    const rect = canvasEl.parentElement.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function bindPointerEvents(canvasEl) {
    canvasEl.addEventListener('pointerdown', (e) => {
      camState.isDragging = true;
      camState.lastX = e.clientX;
      camState.lastY = e.clientY;
      canvasEl.setPointerCapture(e.pointerId);
    });

    canvasEl.addEventListener('pointermove', (e) => {
      if (!camState.isDragging) return;
      const dx = e.clientX - camState.lastX;
      const dy = e.clientY - camState.lastY;
      camState.lastX = e.clientX;
      camState.lastY = e.clientY;

      camState.targetAzimuth -= dx * 0.0085;
      camState.targetPolar = Math.max(0.55, Math.min(2.15, camState.targetPolar - dy * 0.006));
    });

    const endDrag = () => {
      camState.isDragging = false;
    };
    canvasEl.addEventListener('pointerup', endDrag);
    canvasEl.addEventListener('pointercancel', endDrag);

    canvasEl.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        camState.targetRadius = Math.max(1.15, Math.min(4.2, camState.targetRadius + e.deltaY * 0.0018));
      },
      { passive: false }
    );
  }

  function rebuildMannequinAndGarments(state) {
    if (!initialized) return;

    activeGarmentHandles.forEach((h) => h.dispose());
    activeGarmentHandles = [];

    if (currentRig) {
      mannequinContainer.remove(currentRig.root);
      disposeGroup(currentRig.root);
      currentRig = null;
    }

    const matCfg =
      window.AtelierData.MANNEQUIN_MATERIALS.find((m) => m.id === state.materialId) ||
      window.AtelierData.MANNEQUIN_MATERIALS[0];

    currentRig = window.Mannequin3D.createMannequin(state.body, state.genderBias, matCfg);
    mannequinContainer.add(currentRig.root);

    const slotOrder = ['bottom', 'top', 'dress', 'outer', 'shoes'];
    slotOrder.forEach((slot) => {
      const eq = state.equipped[slot];
      if (!eq) return;
      const product = window.AtelierData.getProductById(eq.productId);
      if (!product) return;

      // Resolve full color object (hex + secondary + accent) for two-tone varsity, batik, denim, shoes
      const fullColorObj =
        product.colors.find((c) => c.hex === eq.colorHex) || {
          hex: eq.colorHex,
          secondary: eq.secondaryHex,
          accent: eq.accentHex
        };

      const fitEval = window.FitEngine.evaluateGarmentFit(product, eq.size, state.body);
      const handle = window.Garments3D.mountGarment(
        currentRig,
        product,
        eq.size,
        fullColorObj,
        fitEval,
        state.heatmapMode,
        state.xrayMode
      );
      activeGarmentHandles.push(handle);
    });

    window.Mannequin3D.applyPose(currentRig, animPose, clock ? clock.getElapsedTime() : 0);
  }

  function setCameraPreset(preset, bodyHeightCm) {
    const H = (bodyHeightCm || 175) / 100;
    if (preset === 'full') {
      camState.targetAzimuth = 0.24;
      camState.targetPolar = 1.46;
      camState.targetRadius = Math.max(2.5, H * 1.62);
      camState.targetLookY = H * 0.53;
    } else if (preset === 'upper') {
      camState.targetAzimuth = 0.16;
      camState.targetPolar = 1.44;
      camState.targetRadius = 1.42;
      camState.targetLookY = H * 0.72;
    } else if (preset === 'side') {
      camState.targetAzimuth = Math.PI * 0.5;
      camState.targetPolar = 1.47;
      camState.targetRadius = Math.max(2.45, H * 1.56);
      camState.targetLookY = H * 0.54;
    } else if (preset === 'back') {
      camState.targetAzimuth = Math.PI;
      camState.targetPolar = 1.47;
      camState.targetRadius = Math.max(2.45, H * 1.56);
      camState.targetLookY = H * 0.54;
    } else if (preset === 'shoes') {
      camState.targetAzimuth = 0.52;
      camState.targetPolar = 1.32;
      camState.targetRadius = 1.05;
      camState.targetLookY = 0.14;
    }
  }

  function setPose(poseName) {
    animPose = poseName;
  }

  function setAutoRotate(flag) {
    autoRotate = !!flag;
  }

  function setLighting(mode) {
    const cfg = LIGHTING_PRESETS[mode] || LIGHTING_PRESETS.daylight;
    if (!scene) return;
    scene.background.setHex(cfg.bg);
    scene.fog.color.setHex(cfg.fog);
    hemiLight.color.setHex(cfg.hemiSky);
    hemiLight.groundColor.setHex(cfg.hemiGround);
    hemiLight.intensity = cfg.hemiIntensity;
    keyLight.color.setHex(cfg.keyColor);
    keyLight.intensity = cfg.keyIntensity;
    fillLight.color.setHex(cfg.fillColor);
    fillLight.intensity = cfg.fillIntensity;
    rimLight.color.setHex(cfg.rimColor);
    rimLight.intensity = cfg.rimIntensity;
  }

  function animate() {
    requestAnimationFrame(animate);
    if (!renderer || !scene || !camera) return;

    const dt = Math.min(0.05, clock.getDelta());
    const elapsed = clock.getElapsedTime();

    if (autoRotate && !camState.isDragging) {
      camState.targetAzimuth += dt * 0.55;
    }

    const damp = 0.11;
    camState.azimuth += (camState.targetAzimuth - camState.azimuth) * damp;
    camState.polar += (camState.targetPolar - camState.polar) * damp;
    camState.radius += (camState.targetRadius - camState.radius) * damp;
    camState.targetY += (camState.targetLookY - camState.targetY) * damp;

    const sinP = Math.sin(camState.polar);
    camera.position.set(
      camState.radius * sinP * Math.sin(camState.azimuth),
      camState.targetY + camState.radius * Math.cos(camState.polar),
      camState.radius * sinP * Math.cos(camState.azimuth)
    );
    camera.lookAt(0, camState.targetY, 0);

    if (currentRig) {
      window.Mannequin3D.applyPose(currentRig, animPose, elapsed);
    }

    renderer.render(scene, camera);
  }

  return {
    init,
    rebuildMannequinAndGarments,
    setCameraPreset,
    setPose,
    setAutoRotate,
    setLighting
  };
})();
