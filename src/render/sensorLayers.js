const CONDITION_THEMES = {
  dusty: {
    roadAlt: '#634022',
    roadMain: '#59391e',
    rutStroke: 'rgba(235, 178, 108, ',
    bermAlt: '#75401e',
    bermMain: '#75401e',
    bench1Alt: '#542d15',
    bench1Main: '#542d15',
    benchFlat: '#472511',
    bench2Alt: '#4d2913',
    bench2Main: '#4d2913',
    strataStroke: 'rgba(215, 148, 86, ',
    markerColor: 'rgba(255, 200, 60, ',
    fogRgb: '48, 28, 12',
    farGlow: 'rgba(230, 145, 65, 0.25)'
  },
  muddy: {
    roadAlt: '#462e17',
    roadMain: '#3e2814',
    rutStroke: 'rgba(178, 132, 74, ',
    bermAlt: '#473d20',
    bermMain: '#473d20',
    bench1Alt: '#332d19',
    bench1Main: '#332d19',
    benchFlat: '#292413',
    bench2Alt: '#2b2715',
    bench2Main: '#2b2715',
    strataStroke: 'rgba(154, 132, 78, ',
    markerColor: 'rgba(250, 205, 65, ',
    fogRgb: '26, 22, 13',
    farGlow: 'rgba(132, 136, 90, 0.24)'
  },
  rainy: {
    roadAlt: '#283c52',
    roadMain: '#233548',
    rutStroke: 'rgba(140, 212, 255, ',
    bermAlt: '#2e4359',
    bermMain: '#2e4359',
    bench1Alt: '#213142',
    bench1Main: '#213142',
    benchFlat: '#1a2736',
    bench2Alt: '#1c2a3a',
    bench2Main: '#1c2a3a',
    strataStroke: 'rgba(128, 184, 230, ',
    markerColor: 'rgba(90, 232, 255, ',
    fogRgb: '14, 24, 38',
    farGlow: 'rgba(100, 152, 198, 0.25)'
  },
  snowy: {
    roadAlt: '#8fb8d4',
    roadMain: '#85aec9',
    rutStroke: 'rgba(54, 98, 142, ',
    bermAlt: '#b8d8ed',
    bermMain: '#b8d8ed',
    bench1Alt: '#648fae',
    bench1Main: '#648fae',
    benchFlat: '#9cc5e0',
    bench2Alt: '#557690',
    bench2Main: '#557690',
    strataStroke: 'rgba(220, 242, 255, ',
    markerColor: 'rgba(255, 110, 64, ',
    fogRgb: '22, 42, 68',
    farGlow: 'rgba(180, 228, 255, 0.28)'
  }
};

export class SensorLayersRenderer {
  constructor() {
    this.scanPhase = 0;
  }

  getTheme(runState) {
    const cond = runState?.level?.condition || 'dusty';
    return CONDITION_THEMES[cond] || CONDITION_THEMES.dusty;
  }

  wrapCoord(val, span) {
    return ((val % span) + span) % span;
  }

  renderAllLayers(ctx, renderer, runState, perceptionSystem) {
    this.scanPhase = (this.scanPhase + 0.04) % 1;
    const env = runState.perceptionEnvelope;

    // Layer 0: Stylized Cartoony-Realistic Condition Sky & Horizon Diorama
    this.renderConditionBackground(ctx, renderer, runState);

    // Layer 1: Excavated Haul Road Pit Geometry (Roadbed, Earthen Safety Berms, Terraced Benches)
    // Only visible where sensors clear the subterranean dark fog!
    this.renderHaulRoadPit(ctx, renderer, runState, env, perceptionSystem);

    // Layer 2: Long-Range LiDAR Sweeping Green Pit Scanlines (Starts ONLY beyond longLidarMinZ!)
    if (env.longLidarRange > env.longLidarMinZ) {
      this.renderLongRangeLidar(ctx, renderer, runState, env);
    }

    // Layer 3: Short-Range LiDAR High-Density Cyan Perimeter Point Cloud (Near-field only!)
    if (env.shortLidarRange > env.shortLidarMinZ) {
      this.renderShortRangeLidar(ctx, renderer, runState, env);
    }

    // Layer 4: World Entities (3D Models with LiDAR Wireframes, Imprecise 4D Radar Boxes, & AI Camera Shading)
    this.renderEntitiesMultiModal(ctx, renderer, runState, env, perceptionSystem);

    // Layer 5: 3D Haul Truck Model (Foreground Chase View with Mounted Sensor Hardpoints)
    renderer.draw3DTruck(ctx, runState);

    // Layer 6: Subterranean Dark Fog Mask (Preserves condition sky, shrouds un-scanned pit)
    this.renderDarkFogOverlay(ctx, renderer, runState, env);

    // Layer 7: Foreground Weather Particles (Sand/Dust, Mud Drizzle, Rain Streaks, Snowflakes)
    this.renderWeatherParticles(ctx, renderer, runState);
  }

  renderConditionBackground(ctx, renderer, runState) {
    const { width, height } = renderer;
    const condition = runState?.level?.condition || 'dusty';
    const horizonY = height * 0.42;
    const parallaxX = -(runState.truckX || 0) * 14;
    const t = performance.now() * 0.001;

    ctx.save();

    if (condition === 'dusty') {
      const sky = ctx.createLinearGradient(0, 0, 0, horizonY + 18);
      sky.addColorStop(0, '#3a2112');
      sky.addColorStop(0.55, '#b86228');
      sky.addColorStop(1, '#f2b35e');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, horizonY + 18);

      // Bold cartoon desert sun with warm rings
      const sunX = width * 0.76 + parallaxX * 0.35;
      const sunY = horizonY * 0.44;
      ctx.fillStyle = 'rgba(255, 224, 130, 0.22)';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 56, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe58f';
      ctx.strokeStyle = '#ff9f43';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 29, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Layered red-rock canyon mesas & pit derrick
      this.drawMesaRange(ctx, width, horizonY, parallaxX * 0.55, '#7c3c1e', '#592812');
      this.drawDerrickSilhouette(ctx, width * 0.18 + parallaxX * 0.85, horizonY - 2, '#3d1c0e');

      // Warm rolling dust clouds along horizon
      ctx.fillStyle = 'rgba(244, 184, 108, 0.25)';
      for (let i = 0; i < 6; i++) {
        const cx = this.wrapCoord(i * 190 + t * 22 + parallaxX, width + 180) - 90;
        ctx.beginPath();
        ctx.arc(cx, horizonY - 4, 24 + (i % 3) * 10, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (condition === 'muddy') {
      const sky = ctx.createLinearGradient(0, 0, 0, horizonY + 18);
      sky.addColorStop(0, '#18211b');
      sky.addColorStop(0.6, '#465440');
      sky.addColorStop(1, '#8c946e');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, horizonY + 18);

      // Puffy overcast bog clouds
      for (let i = 0; i < 5; i++) {
        const cx = this.wrapCoord(i * 210 + t * 14 + parallaxX * 0.4, width + 200) - 100;
        const cy = horizonY * (0.24 + (i % 2) * 0.14);
        this.drawCartoonCloud(ctx, cx, cy, 1.05, '#68755c', '#45513c');
      }

      // Rolling muddy hills & reeds
      ctx.fillStyle = '#363b26';
      ctx.strokeStyle = '#202415';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-20, horizonY + 16);
      for (let x = -20; x <= width + 40; x += 65) {
        const h = Math.sin((x - parallaxX * 0.6) * 0.012) * 20 + 26;
        ctx.lineTo(x, horizonY - h);
      }
      ctx.lineTo(width + 40, horizonY + 16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Bog mist band
      const mist = ctx.createLinearGradient(0, horizonY - 22, 0, horizonY + 16);
      mist.addColorStop(0, 'rgba(170, 178, 130, 0)');
      mist.addColorStop(1, 'rgba(164, 172, 126, 0.38)');
      ctx.fillStyle = mist;
      ctx.fillRect(0, horizonY - 22, width, 38);
    } else if (condition === 'rainy') {
      const flash = Math.sin(t * 2.9) * Math.sin(t * 7.3) > 0.88 ? 0.35 : 0;
      const sky = ctx.createLinearGradient(0, 0, 0, horizonY + 18);
      sky.addColorStop(0, flash > 0 ? '#2b4464' : '#0b1626');
      sky.addColorStop(0.55, '#213a52');
      sky.addColorStop(1, '#4c708a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, horizonY + 18);

      // Storm clouds + occasional cartoon lightning bolt
      for (let i = 0; i < 6; i++) {
        const cx = this.wrapCoord(i * 175 + t * 28 + parallaxX * 0.45, width + 180) - 90;
        const cy = horizonY * (0.2 + (i % 3) * 0.11);
        this.drawCartoonCloud(ctx, cx, cy, 1.15, '#3b536b', '#1c2b3b');
      }

      if (flash > 0) {
        const boltX = width * 0.72 + parallaxX * 0.5;
        ctx.strokeStyle = '#fff59d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(boltX, horizonY * 0.25);
        ctx.lineTo(boltX - 12, horizonY * 0.48);
        ctx.lineTo(boltX + 6, horizonY * 0.52);
        ctx.lineTo(boltX - 8, horizonY * 0.85);
        ctx.stroke();
      }

      // Wet slate peaks
      this.drawJaggedPeaks(ctx, width, horizonY, parallaxX * 0.65, '#1d2d3d', '#0f1a26', false);
    } else {
      // snowy
      const sky = ctx.createLinearGradient(0, 0, 0, horizonY + 18);
      sky.addColorStop(0, '#0a1930');
      sky.addColorStop(0.55, '#25527f');
      sky.addColorStop(1, '#a9def7');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, horizonY + 18);

      // Shimmering aurora ribbon
      const aurora = ctx.createLinearGradient(0, horizonY * 0.12, width, horizonY * 0.42);
      aurora.addColorStop(0, 'rgba(64, 245, 196, 0.04)');
      aurora.addColorStop(0.5, 'rgba(92, 255, 210, 0.26)');
      aurora.addColorStop(1, 'rgba(130, 195, 255, 0.06)');
      ctx.fillStyle = aurora;
      ctx.beginPath();
      ctx.moveTo(0, horizonY * 0.28);
      for (let x = 0; x <= width; x += 48) {
        const wave = Math.sin(x * 0.015 + t * 1.4) * 14;
        ctx.lineTo(x, horizonY * 0.22 + wave);
      }
      ctx.lineTo(width, horizonY * 0.44);
      ctx.lineTo(0, horizonY * 0.46);
      ctx.closePath();
      ctx.fill();

      // Snow-capped alpine peaks + dark cartoon pines
      this.drawJaggedPeaks(ctx, width, horizonY, parallaxX * 0.65, '#4c7399', '#253f59', true);
      this.drawPineTreeLine(ctx, width, horizonY + 4, parallaxX * 0.9, '#193347', '#e6f7ff');
    }

    // Condition-matched ground underlay below horizon prevents void flashes along pit edges
    const theme = this.getTheme(runState);
    const groundGrad = ctx.createLinearGradient(0, horizonY, 0, height);
    groundGrad.addColorStop(0, theme.bench2Main);
    groundGrad.addColorStop(1, theme.roadMain);
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, horizonY + 12, width, height - (horizonY + 12));
    ctx.restore();
  }

  drawMesaRange(ctx, width, horizonY, offsetX, fillColor, strokeColor) {
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    const mesas = [
      { x: 0.08, w: 0.22, h: 46 },
      { x: 0.36, w: 0.18, h: 32 },
      { x: 0.62, w: 0.26, h: 52 },
      { x: 0.88, w: 0.20, h: 38 }
    ];
    for (const m of mesas) {
      const mx = width * m.x + offsetX;
      const mw = width * m.w;
      ctx.beginPath();
      ctx.moveTo(mx - mw * 0.65, horizonY + 12);
      ctx.lineTo(mx - mw * 0.38, horizonY - m.h);
      ctx.lineTo(mx + mw * 0.38, horizonY - m.h);
      ctx.lineTo(mx + mw * 0.65, horizonY + 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  drawDerrickSilhouette(ctx, x, baseY, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 16, baseY);
    ctx.lineTo(x - 4, baseY - 38);
    ctx.lineTo(x + 4, baseY - 38);
    ctx.lineTo(x + 16, baseY);
    ctx.moveTo(x + 2, baseY - 34);
    ctx.lineTo(x + 28, baseY - 52);
    ctx.stroke();
    ctx.fillRect(x - 18, baseY - 10, 36, 10);
  }

  drawCartoonCloud(ctx, cx, cy, scale, fillColor, outlineColor) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(-20, 4, 15, 0, Math.PI * 2);
    ctx.arc(0, -4, 21, 0, Math.PI * 2);
    ctx.arc(22, 4, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawJaggedPeaks(ctx, width, horizonY, offsetX, fillColor, outlineColor, withSnowCaps) {
    const peaks = [
      { x: 0.04, w: 120, h: 58 },
      { x: 0.24, w: 150, h: 74 },
      { x: 0.48, w: 140, h: 64 },
      { x: 0.72, w: 160, h: 78 },
      { x: 0.94, w: 130, h: 56 }
    ];
    for (const p of peaks) {
      const px = width * p.x + offsetX;
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(px - p.w * 0.5, horizonY + 12);
      ctx.lineTo(px, horizonY - p.h);
      ctx.lineTo(px + p.w * 0.5, horizonY + 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (withSnowCaps) {
        ctx.fillStyle = '#eff9ff';
        ctx.beginPath();
        ctx.moveTo(px, horizonY - p.h);
        ctx.lineTo(px - p.w * 0.17, horizonY - p.h * 0.52);
        ctx.lineTo(px - p.w * 0.05, horizonY - p.h * 0.62);
        ctx.lineTo(px + p.w * 0.06, horizonY - p.h * 0.48);
        ctx.lineTo(px + p.w * 0.18, horizonY - p.h * 0.54);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  drawPineTreeLine(ctx, width, baseY, offsetX, treeColor, snowColor) {
    for (let i = 0; i < 12; i++) {
      const tx = this.wrapCoord(i * 78 + offsetX, width + 90) - 20;
      const h = 16 + (i % 3) * 6;
      ctx.fillStyle = treeColor;
      ctx.beginPath();
      ctx.moveTo(tx, baseY - h);
      ctx.lineTo(tx - 9, baseY + 4);
      ctx.lineTo(tx + 9, baseY + 4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = snowColor;
      ctx.beginPath();
      ctx.moveTo(tx, baseY - h);
      ctx.lineTo(tx - 4, baseY - h * 0.45);
      ctx.lineTo(tx + 4, baseY - h * 0.45);
      ctx.closePath();
      ctx.fill();
    }
  }

  renderHaulRoadPit(ctx, renderer, runState, env, perceptionSystem) {
    const maxZ = Math.min(175, Math.max(12, env.maxIlluminatedZ * 1.08));
    const stepZ = 4.5;
    const scrollOffset = runState.distanceTraveled % stepZ;
    const condition = runState?.level?.condition || 'dusty';
    const theme = this.getTheme(runState);

    ctx.save();

    // Render pit slices from far to near so closer slices overlap cleanly without near-plane pop-out
    for (let baseZ = Math.floor(maxZ / stepZ) * stepZ; baseZ >= 1.5; baseZ -= stepZ) {
      const zNear = baseZ - scrollOffset;
      const zFar = zNear + stepZ;
      if (zFar <= 1.15) continue;

      const zNearClamped = Math.max(1.05, zNear);
      const visCenter = perceptionSystem.getPointVisibility(runState.truckX, zNearClamped, runState);
      const visLeft = perceptionSystem.getPointVisibility(-1.6, zNearClamped, runState);
      const visRight = perceptionSystem.getPointVisibility(1.6, zNearClamped, runState);
      const rawVis = Math.max(visCenter, visLeft, visRight);

      if (rawVis <= 0.02) continue;

      const nearFade = Math.min(1, (zFar - 1.15) / 3.5);
      const farFade = Math.min(1, Math.max(0.15, (maxZ - zNearClamped) / 14));
      const sliceVis = rawVis * nearFade * farFade;

      const rdNearL = renderer.project3D(-1.55, 0, zNearClamped, runState);
      const rdNearR = renderer.project3D(1.55, 0, zNearClamped, runState);
      const rdFarL = renderer.project3D(-1.55, 0, zFar, runState);
      const rdFarR = renderer.project3D(1.55, 0, zFar, runState);

      const bermTopNearL = renderer.project3D(-1.88, 0.58, zNearClamped, runState);
      const bermTopFarL = renderer.project3D(-1.88, 0.58, zFar, runState);
      const bermTopNearR = renderer.project3D(1.88, 0.58, zNearClamped, runState);
      const bermTopFarR = renderer.project3D(1.88, 0.58, zFar, runState);

      const bench1NearL = renderer.project3D(-3.1, 1.28, zNearClamped, runState);
      const bench1FarL = renderer.project3D(-3.1, 1.28, zFar, runState);
      const bench1NearR = renderer.project3D(3.1, 1.28, zNearClamped, runState);
      const bench1FarR = renderer.project3D(3.1, 1.28, zFar, runState);

      const benchFlatNearL = renderer.project3D(-3.9, 1.28, zNearClamped, runState);
      const benchFlatFarL = renderer.project3D(-3.9, 1.28, zFar, runState);
      const benchFlatNearR = renderer.project3D(3.9, 1.28, zNearClamped, runState);
      const benchFlatFarR = renderer.project3D(3.9, 1.28, zFar, runState);

      const bench2NearL = renderer.project3D(-5.2, 1.95, zNearClamped, runState);
      const bench2FarL = renderer.project3D(-5.2, 1.95, zFar, runState);
      const bench2NearR = renderer.project3D(5.2, 1.95, zNearClamped, runState);
      const bench2FarR = renderer.project3D(5.2, 1.95, zFar, runState);

      // Alternating road strata for speed cue while outer walls stay steady (no side flashing)
      const bandIndex = Math.floor((baseZ + runState.distanceTraveled - scrollOffset) / stepZ);
      const isAlt = bandIndex % 2 === 0;

      // 1. Haul Roadbed matching condition
      ctx.globalAlpha = sliceVis * 0.96;
      ctx.fillStyle = isAlt ? theme.roadAlt : theme.roadMain;
      this.fillQuad(ctx, rdNearL, rdNearR, rdFarR, rdFarL);

      // Heavy Haul Tire Ruts / Tracks in the Pit Floor
      ctx.strokeStyle = `${theme.rutStroke}${sliceVis * 0.52})`;
      ctx.lineWidth = Math.max(1.2, 2.6 * (1 - zNearClamped / 120));
      for (const trackX of [-0.85, -0.35, 0.35, 0.85]) {
        const tNear = renderer.project3D(trackX, 0, zNearClamped, runState);
        const tFar = renderer.project3D(trackX, 0, zFar, runState);
        ctx.beginPath();
        ctx.moveTo(tNear.x, tNear.y);
        ctx.lineTo(tFar.x, tFar.y);
        ctx.stroke();
      }

      // Condition-specific road surface features centered on roadbed
      this.drawConditionRoadPatch(ctx, renderer, runState, condition, bandIndex, zNearClamped, sliceVis);

      // 2. Steady Continuous Safety Berms & Terraced Pit Walls (unified alpha, non-alternating sides)
      ctx.globalAlpha = sliceVis * 0.96;

      // Left Berm & Walls
      ctx.fillStyle = theme.bermMain;
      this.fillQuad(ctx, rdNearL, bermTopNearL, bermTopFarL, rdFarL);
      if (bandIndex % 6 === 0) {
        ctx.fillStyle = `${theme.markerColor}${sliceVis * 0.65})`;
        ctx.fillRect(bermTopNearL.x - 2, bermTopNearL.y - 5, 4, 5);
      }
      ctx.fillStyle = condition === 'snowy' ? '#cfe8f8' : theme.bench1Main;
      this.fillQuad(ctx, bermTopNearL, bench1NearL, bench1FarL, bermTopFarL);
      ctx.fillStyle = theme.benchFlat;
      this.fillQuad(ctx, bench1NearL, benchFlatNearL, benchFlatFarL, bench1FarL);
      ctx.fillStyle = theme.bench2Main;
      this.fillQuad(ctx, benchFlatNearL, bench2NearL, bench2FarL, benchFlatFarL);
      ctx.strokeStyle = `${theme.strataStroke}${sliceVis * 0.35})`;
      ctx.lineWidth = 1;
      this.strokeLine(ctx, bermTopNearL, bermTopFarL);
      this.strokeLine(ctx, bench1NearL, bench1FarL);

      // Right Berm & Walls
      ctx.fillStyle = theme.bermMain;
      this.fillQuad(ctx, rdNearR, bermTopNearR, bermTopFarR, rdFarR);
      if (bandIndex % 6 === 0) {
        ctx.fillStyle = `${theme.markerColor}${sliceVis * 0.65})`;
        ctx.fillRect(bermTopNearR.x - 2, bermTopNearR.y - 5, 4, 5);
      }
      ctx.fillStyle = condition === 'snowy' ? '#cfe8f8' : theme.bench1Main;
      this.fillQuad(ctx, bermTopNearR, bench1NearR, bench1FarR, bermTopFarR);
      ctx.fillStyle = theme.benchFlat;
      this.fillQuad(ctx, bench1NearR, benchFlatNearR, benchFlatFarR, bench1FarR);
      ctx.fillStyle = theme.bench2Main;
      this.fillQuad(ctx, benchFlatNearR, bench2NearR, bench2FarR, benchFlatFarR);
      ctx.strokeStyle = `${theme.strataStroke}${sliceVis * 0.35})`;
      ctx.lineWidth = 1;
      this.strokeLine(ctx, bermTopNearR, bermTopFarR);
      this.strokeLine(ctx, bench1NearR, bench1FarR);
    }

    ctx.restore();
  }

  drawConditionRoadPatch(ctx, renderer, runState, condition, bandIndex, zNear, sliceVis) {
    if (bandIndex % 3 !== 0 || zNear > 70 || zNear < 2.2) return;
    const distFade = Math.min(1, (zNear - 2.2) / 3.0) * Math.min(1, (70 - zNear) / 14);
    const alpha = sliceVis * distFade;
    if (alpha <= 0.04) return;

    const laneX = (((bandIndex * 37) % 13) * 0.12) - 0.72;
    const p = renderer.project3D(laneX, 0.01, zNear + 2.0, runState);
    const rx = Math.max(9, p.scale * 0.50);
    const ry = Math.max(3.5, rx * 0.34);

    if (condition === 'muddy') {
      ctx.fillStyle = `rgba(43, 26, 11, ${alpha * 0.85})`;
      ctx.strokeStyle = `rgba(140, 98, 57, ${alpha * 0.65})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = `rgba(196, 148, 92, ${alpha * 0.55})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(p.x - rx * 0.2, p.y - ry * 0.25, rx * 0.45, ry * 0.32, 0, Math.PI, Math.PI * 1.85);
      ctx.stroke();
    } else if (condition === 'rainy') {
      ctx.fillStyle = `rgba(78, 165, 235, ${alpha * 0.62})`;
      ctx.strokeStyle = `rgba(220, 248, 255, ${alpha * 0.78})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx * 1.1, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const ripple = 0.35 + ((performance.now() * 0.004 + bandIndex * 0.37) % 0.55);
      ctx.strokeStyle = `rgba(240, 252, 255, ${alpha * (1 - ripple) * 0.82})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx * 0.65 * ripple, ry * 0.65 * ripple, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (condition === 'snowy') {
      ctx.fillStyle = `rgba(240, 250, 255, ${alpha * 0.82})`;
      ctx.strokeStyle = `rgba(138, 188, 224, ${alpha * 0.62})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx * 0.9, ry * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(227, 162, 86, ${alpha * 0.62})`;
      ctx.strokeStyle = `rgba(181, 116, 44, ${alpha * 0.52})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx * 0.88, ry * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  renderLongRangeLidar(ctx, renderer, runState, env) {
    const minZ = Math.max(18, env.longLidarMinZ);
    const maxZ = Math.min(185, env.longLidarRange);
    if (maxZ <= minZ) return;

    const stepZ = Math.max(4.0, 9 / Math.max(0.6, env.longLidarDensity));
    const scrollZ = (runState.distanceTraveled * 1.5) % stepZ;

    ctx.save();
    for (let z = minZ + scrollZ; z <= maxZ; z += stepZ) {
      const alpha = Math.max(0.08, (1 - (z - minZ) / (maxZ - minZ)) * 0.65);
      ctx.strokeStyle = `rgba(0, 255, 102, ${alpha})`;
      ctx.lineWidth = 1.1;

      const bias = env.longLidarBiasX * 0.4;
      const pBenchL = renderer.project3D(-2.6 + bias, 1.8, z, runState);
      const pBermL = renderer.project3D(-1.88 + bias, 0.68, z, runState);
      const pFloorL = renderer.project3D(-1.55 + bias, 0, z, runState);
      const pFloorR = renderer.project3D(1.55 + bias, 0, z, runState);
      const pBermR = renderer.project3D(1.88 + bias, 0.68, z, runState);
      const pBenchR = renderer.project3D(2.6 + bias, 1.8, z, runState);

      // Stepped Haul Pit Topographic Contour Scanline
      ctx.beginPath();
      ctx.moveTo(pBenchL.x, pBenchL.y);
      ctx.lineTo(pBermL.x, pBermL.y);
      ctx.lineTo(pFloorL.x, pFloorL.y);
      ctx.lineTo(pFloorR.x, pFloorR.y);
      ctx.lineTo(pBermR.x, pBermR.y);
      ctx.lineTo(pBenchR.x, pBenchR.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderShortRangeLidar(ctx, renderer, runState, env) {
    const minZ = Math.max(2.2, env.shortLidarMinZ);
    const maxZ = Math.min(42, env.shortLidarRange);
    if (maxZ <= minZ) return;

    const density = Math.min(2.5, env.shortLidarDensity);
    const scrollZ = (runState.distanceTraveled * 2) % 2.2;

    ctx.save();
    ctx.fillStyle = '#00f0ff';

    for (let z = minZ + scrollZ; z <= maxZ; z += 2.2 / density) {
      const alpha = Math.max(0.15, 1 - (z - minZ) / (maxZ - minZ));
      ctx.globalAlpha = alpha;

      for (let x = -2.1; x <= 2.1; x += 0.3 / density) {
        const biasedX = x + env.shortLidarBiasX * 0.4;
        const absX = Math.abs(biasedX);
        const yElev = absX > 1.55 ? Math.min(0.9, (absX - 1.55) * 1.8) : 0;
        const p = renderer.project3D(biasedX, yElev, z, runState);
        ctx.fillRect(p.x, p.y, 2.3, 2.3);
      }
    }
    ctx.restore();
  }

  renderEntitiesMultiModal(ctx, renderer, runState, env, perceptionSystem) {
    // Sort back-to-front (painter's algorithm)
    const sorted = [...runState.worldEntities].sort((a, b) => b.z - a.z);

    for (const ent of sorted) {
      if (ent.z < 1.4) continue;

      // Enforce both minimum deadzone and maximum range for every sensor modality!
      const inShortLidar =
        env.shortLidarRange > 0 &&
        ent.z >= env.shortLidarMinZ &&
        ent.z <= env.shortLidarRange;

      const inLongLidar =
        env.longLidarRange > 0 &&
        ent.z >= env.longLidarMinZ &&
        ent.z <= env.longLidarRange;

      const inRadar =
        env.radarActive &&
        ent.z >= env.radarMinZ &&
        ent.z <= env.radarRange;

      const inCamera =
        env.cameraRange > 0 &&
        ent.z >= env.cameraMinZ &&
        ent.z <= env.cameraRange;

      const pointVis = perceptionSystem.getPointVisibility(ent.x, ent.z, runState);
      if ((!inShortLidar && !inLongLidar && !inRadar && !inCamera) || pointVis <= 0.04) {
        continue; // Completely hidden in the dark Fog of War (including inside LR-LiDAR's close-range blind spot!)
      }

      // Render 3D Mesh / Wireframe / Sensor Overlays for this entity
      renderer.draw3DEntity(ctx, ent, runState, {
        inShortLidar,
        inLongLidar,
        inRadar,
        inCamera,
        radarJitter: env.radarJitter,
        semanticClear: env.cameraSemanticClear,
        visibility: pointVis
      });
    }
  }

  renderDarkFogOverlay(ctx, renderer, runState, env) {
    const { width, height } = renderer;
    const horizonY = height * 0.42;
    const fogStartY = Math.max(0, horizonY - 18);
    const theme = this.getTheme(runState);
    ctx.save();

    // Keep the condition sky above horizon visible; shroud un-scanned pit floor below horizon
    ctx.beginPath();
    ctx.rect(0, fogStartY, width, height - fogStartY);
    ctx.clip();

    if (env.maxIlluminatedZ <= 4) {
      const blindGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.85,
        24,
        width * 0.5,
        height * 0.65,
        height * 0.42
      );
      blindGrad.addColorStop(0, `rgba(${theme.fogRgb}, 0.25)`);
      blindGrad.addColorStop(0.5, `rgba(${theme.fogRgb}, 0.90)`);
      blindGrad.addColorStop(1, `rgba(${theme.fogRgb}, 0.97)`);
      ctx.fillStyle = blindGrad;
      ctx.fillRect(0, fogStartY, width, height - fogStartY);
      ctx.restore();
      return;
    }

    const netBiasX =
      (env.longLidarBiasX + env.shortLidarBiasX + env.radarBiasX + env.cameraBiasX) * 0.2;
    const farPoint = renderer.project3D(
      runState.truckX + netBiasX,
      0.5,
      Math.max(12, env.maxIlluminatedZ),
      runState
    );

    const fogRadius = Math.max(width, height) * Math.min(0.92, 0.34 + (env.maxIlluminatedZ / 150) * 0.58);
    const truckAnchor = renderer.project3D(runState.truckX, 0.2, 6.5, runState);

    const fogGrad = ctx.createRadialGradient(
      (farPoint.x + truckAnchor.x) * 0.5,
      Math.max(horizonY + 24, truckAnchor.y * 0.72 + farPoint.y * 0.28),
      fogRadius * 0.38,
      width * 0.5,
      height * 0.62,
      fogRadius * 1.25
    );

    const dustDarkness = 0.68 + runState.activeDustDensity * 0.22;
    fogGrad.addColorStop(0, `rgba(${theme.fogRgb}, 0.0)`);
    fogGrad.addColorStop(0.58, `rgba(${theme.fogRgb}, 0.06)`);
    fogGrad.addColorStop(0.84, `rgba(${theme.fogRgb}, ${0.36 + runState.activeDustDensity * 0.2})`);
    fogGrad.addColorStop(1, `rgba(${theme.fogRgb}, ${Math.min(0.92, dustDarkness)})`);

    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, fogStartY, width, height - fogStartY);

    // Near-field blind spot shadow when only Long-Range LiDAR covers the road ahead
    const minCoveredZ = Math.min(
      env.shortLidarRange > 0 ? env.shortLidarMinZ : 999,
      env.cameraRange > 0 ? env.cameraMinZ : 999,
      env.radarActive ? env.radarMinZ : 999,
      env.longLidarRange > 0 ? env.longLidarMinZ : 999
    );

    if (minCoveredZ > 12) {
      const nearBlindGrad = ctx.createLinearGradient(0, height * 0.58, 0, height * 0.92);
      nearBlindGrad.addColorStop(0, `rgba(${theme.fogRgb}, 0.0)`);
      nearBlindGrad.addColorStop(0.45, `rgba(${theme.fogRgb}, 0.84)`);
      nearBlindGrad.addColorStop(1, `rgba(${theme.fogRgb}, 0.94)`);
      ctx.fillStyle = nearBlindGrad;
      ctx.fillRect(0, height * 0.58, width, height * 0.35);
    }

    ctx.restore();
  }

  renderWeatherParticles(ctx, renderer, runState) {
    const { width, height } = renderer;
    const condition = runState?.level?.condition || 'dusty';
    const t = performance.now() * 0.001;
    const windShift = -(runState.lateralVelocity || 0) * 8;

    ctx.save();

    if (condition === 'rainy') {
      ctx.strokeStyle = 'rgba(205, 240, 255, 0.72)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      for (let i = 0; i < 52; i++) {
        const px = this.wrapCoord(i * 73 + t * (210 + (i % 4) * 30) + windShift * 3, width + 60) - 30;
        const py = this.wrapCoord(i * 97 + t * (660 + (i % 5) * 70), height + 40) - 20;
        ctx.moveTo(px, py);
        ctx.lineTo(px - 8, py + 24);
      }
      ctx.stroke();

      // Roadbed rain splash arcs
      ctx.strokeStyle = 'rgba(225, 248, 255, 0.65)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 10; i++) {
        const sx = this.wrapCoord(i * 139 + t * 50, Math.max(40, width - 40)) + 20;
        const sy = height * (0.56 + ((i * 19) % 34) * 0.01);
        const r = ((t * 32 + i * 7) % 12) + 3;
        ctx.beginPath();
        ctx.ellipse(sx, sy, r * 1.5, r * 0.5, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
      }
    } else if (condition === 'snowy') {
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 48; i++) {
        const px = this.wrapCoord(i * 89 + Math.sin(t * 1.6 + i) * 32 + t * 42 + windShift, width + 40) - 20;
        const py = this.wrapCoord(i * 67 + t * (125 + (i % 4) * 24), height + 30) - 15;
        const rad = 3.2 + (i % 3) * 2.1;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.96)' : 'rgba(220, 244, 255, 0.9)';
        ctx.strokeStyle = 'rgba(55, 95, 138, 0.55)';
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (condition === 'muddy') {
      ctx.strokeStyle = 'rgba(176, 152, 98, 0.62)';
      ctx.lineWidth = 1.8;
      for (let i = 0; i < 30; i++) {
        const px = this.wrapCoord(i * 101 + t * 95 + windShift, width + 40) - 20;
        const py = this.wrapCoord(i * 83 + t * 360, height + 30) - 15;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - 4, py + 14);
        ctx.stroke();
      }
      // Flying mud flecks
      ctx.fillStyle = 'rgba(72, 46, 20, 0.72)';
      for (let i = 0; i < 14; i++) {
        const fx = this.wrapCoord(i * 127 + t * 68 + windShift * 2, width + 40) - 20;
        const fy = height * 0.55 + this.wrapCoord(i * 71 + t * 140, height * 0.42);
        ctx.beginPath();
        ctx.arc(fx, fy, 2.5 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // dusty
      for (let i = 0; i < 32; i++) {
        const px = this.wrapCoord(i * 113 + t * (165 + (i % 4) * 35) + windShift, width + 60) - 30;
        const py = height * 0.22 + this.wrapCoord(i * 59 + Math.sin(t * 2 + i) * 18, height * 0.72);
        const rad = 3.2 + (i % 4) * 2.5;
        ctx.fillStyle = `rgba(248, 194, 120, ${0.32 + (i % 3) * 0.12})`;
        ctx.beginPath();
        ctx.ellipse(px, py, rad * 2.1, rad * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  fillQuad(ctx, p1, p2, p3, p4) {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fill();
  }

  strokeLine(ctx, p1, p2) {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
}
