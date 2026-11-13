import { SensorLayersRenderer } from './sensorLayers.js';
import { modelRegistry } from './modelRegistry.js';

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sensorLayers = new SensorLayersRenderer();
    this.modelRegistry = modelRegistry;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  project3D(worldX, worldY, worldZ, runState) {
    const z = Math.max(1.0, worldZ);
    const fovScale = this.height * 0.62;
    const horizonY = this.height * 0.42;

    // Subtle camera follow keeps truck motion nearly 1:1 with pointer X on screen
    const camX = runState.truckX * 0.12;
    const camY = 2.25;
    const relX = worldX - camX;
    const screenX = this.width * 0.5 + (relX * fovScale) / z;
    const screenY = horizonY + ((camY - worldY) * fovScale) / z;
    const scale = fovScale / z;

    return { x: screenX, y: screenY, scale, z };
  }

  render(runState, perceptionSystem) {
    const { ctx, width, height } = this;

    // 1. Pitch-Black Subterranean Dark Fog Base
    ctx.fillStyle = '#030508';
    ctx.fillRect(0, 0, width, height);

    if (!runState || !runState.perceptionEnvelope || !perceptionSystem) return;

    ctx.save();

    // 2. Render Haul Road Pit, Sensor Layers, 3D/Sprite Entities, Truck_Model.png, and Dark Fog Shroud
    this.sensorLayers.renderAllLayers(ctx, this, runState, perceptionSystem);

    // 3. Render Mud & Slurry Static Distortion on Camera Optics
    this.drawMudOcclusionOverlay(ctx, width, height, runState);

    ctx.restore();
  }

  /**
   * Renders a world object:
   * - Ore Payloads (`category === 'ore'`): Signified by a glowing green "$" emblem and diamond floor ring.
   * - Static Boulders (`boulder`): Rendered using `boulder.png` + LiDAR/Radar overlays.
   * - Moving Obstacles (`service_truck` / moving hazards): Rendered using `pickup.png` (flipped according to travel direction) + LiDAR/Radar overlays.
   * - Other legacy entities remain supported in memory.
   */
  draw3DEntity(ctx, ent, runState, sensorFlags) {
    const {
      inShortLidar,
      inLongLidar,
      inRadar,
      inCamera,
      radarJitter = 0.45,
      semanticClear,
      visibility
    } = sensorFlags;

    // Resolve model & sprite keys
    let modelKey = 'default_box';
    if (ent.category === 'gate') modelKey = 'gate';
    else if (ent.category === 'ore') modelKey = 'ore';
    else if (ent.type === 'boulder' || ent.type === 'rockslide') modelKey = 'boulder';
    else if (ent.type === 'rogue_loader') modelKey = 'rogue_loader';
    else if (ent.type === 'service_truck') modelKey = 'service_truck';
    else if (ent.type === 'drill_drone') modelKey = 'drill_drone';

    const model = this.modelRegistry.getModel(modelKey);
    // Moving obstacles use `pickup.png` if they don't have a specific sprite override
    const isMovingHazard = ent.category === 'hazard' && (Math.abs(ent.vx) > 0.01 || Math.abs(ent.vz) > 0.01);
    const spriteEntry =
      this.modelRegistry.getSprite(ent.type) ||
      (isMovingHazard ? this.modelRegistry.getSprite('service_truck') : null) ||
      this.modelRegistry.getSprite(modelKey);

    const scaleX = ent.width;
    const scaleY = ent.height;
    const scaleZ = ent.category === 'gate' ? 0.4 : ent.width * 0.9;

    const timeSec = performance.now() * 0.008;
    const renderX = ent.x;
    const renderZ = ent.z;

    const baseProj = this.project3D(renderX, 0, renderZ, runState);
    const topProj = this.project3D(renderX, ent.height, renderZ, runState);
    const boxW = Math.max(18, ent.width * baseProj.scale);
    const boxH = Math.max(18, Math.abs(baseProj.y - topProj.y));
    const boxX = baseProj.x - boxW * 0.5;
    const boxY = topProj.y;

    ctx.save();

    // =========================================================================
    // A. INSTANT-READ GROUND FOOTPRINT & "$" PAYLOAD EMBLEM
    // =========================================================================
    this.drawEntityGroundSignature(
      ctx,
      ent,
      renderX,
      renderZ,
      baseProj,
      topProj,
      boxW,
      boxH,
      runState,
      visibility,
      timeSec
    );

    // For Ore Payloads, the glowing green "$" emblem is the primary visual representation
    if (ent.category === 'ore') {
      if (inCamera) {
        ctx.globalAlpha = Math.min(1.0, visibility * 1.15);
        const tagText = semanticClear ? `[${ent.label}]` : '[PAYLOAD: $]';
        ctx.font = 'bold 11px monospace';
        const textWidth = ctx.measureText(tagText).width;
        ctx.fillStyle = 'rgba(4, 14, 8, 0.88)';
        ctx.fillRect(baseProj.x - textWidth * 0.5 - 4, boxY - 22, textWidth + 8, 14);
        ctx.fillStyle = '#00ff66';
        ctx.fillText(tagText, baseProj.x - textWidth * 0.5, boxY - 11);
      }
      ctx.restore();
      return;
    }

    // =========================================================================
    // B. 2D SPRITE IMAGE PASS (`boulder.png` for boulders, `pickup.png` for moving obstacles)
    // =========================================================================
    if (spriteEntry) {
      ctx.save();
      ctx.globalAlpha = Math.min(1.0, visibility * (inCamera ? 1.0 : 0.88));
      const aspect = (spriteEntry.width || 1) / (spriteEntry.height || 1);
      let sprH = boxH * 1.15 * spriteEntry.scale;
      let sprW = sprH * aspect;

      // Keep pickup truck proportional on screen
      if (isMovingHazard) {
        sprW = Math.max(28, boxW * 1.75 * spriteEntry.scale);
        sprH = sprW / Math.max(1.2, aspect);
      }

      ctx.translate(baseProj.x, baseProj.y + (spriteEntry.offsetY || 0));
      // `pickup.png` faces left by default; flip horizontally when moving right (`vx > 0`)
      if (isMovingHazard && ent.vx > 0) {
        ctx.scale(-1, 1);
      }

      ctx.drawImage(spriteEntry.image, -sprW * 0.5, -sprH, sprW, sprH);
      ctx.restore();
    }

    // Project 3D mesh vertices
    const exactVerts = model.vertices.map(([vx, vy, vz]) =>
      this.project3D(renderX + vx * scaleX, vy * scaleY, renderZ + vz * scaleZ, runState)
    );

    // =========================================================================
    // C. AI CAMERA 3D FACE SHADING (Fallback if no 2D sprite overrides it)
    // =========================================================================
    if (inCamera && model.faces && !spriteEntry) {
      ctx.globalAlpha = visibility * (semanticClear ? 0.68 : 0.28);
      for (const face of model.faces) {
        if (face.indices.length < 3) continue;
        ctx.fillStyle = semanticClear ? (face.color || ent.color) : '#556677';
        ctx.beginPath();
        const p0 = exactVerts[face.indices[0]];
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < face.indices.length; i++) {
          const pi = exactVerts[face.indices[i]];
          ctx.lineTo(pi.x, pi.y);
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    // =========================================================================
    // D. LiDAR SCAN OVERLAY (Subtle wireframe & point cloud over sprite, or full mesh)
    // =========================================================================
    if (inShortLidar || inLongLidar) {
      const lidarStroke = ent.category === 'hazard' ? '#ff4455' : inShortLidar ? '#00f0ff' : '#00ff66';
      ctx.strokeStyle = lidarStroke;
      ctx.lineWidth = inShortLidar ? 1.3 : 1.0;
      ctx.globalAlpha = visibility * (spriteEntry ? 0.42 : 0.85);

      if (!spriteEntry) {
        ctx.beginPath();
        for (const [iA, iB] of model.edges) {
          const pA = exactVerts[iA];
          const pB = exactVerts[iB];
          if (pA && pB) {
            ctx.moveTo(pA.x, pA.y);
            ctx.lineTo(pB.x, pB.y);
          }
        }
        ctx.stroke();
      }

      // Point-cloud laser returns across the obstacle
      ctx.fillStyle = lidarStroke;
      const dotSize = inShortLidar ? 2.6 : 1.9;
      for (const pv of exactVerts) {
        ctx.fillRect(pv.x - dotSize * 0.5, pv.y - dotSize * 0.5, dotSize, dotSize);
      }
    }

    // =========================================================================
    // E. 4D IMAGING RADAR PASS (Steady Bounding Box + Doppler Velocity Vector)
    // =========================================================================
    if (inRadar) {
      ctx.globalAlpha = Math.max(0.5, visibility);
      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = 1.4;

      ctx.setLineDash([5, 4]);
      ctx.strokeRect(boxX - 4, boxY - 4, boxW + 8, boxH + 8);
      ctx.setLineDash([]);

      // Draw Doppler Velocity Vector Arrow for moving pickups
      if (Math.abs(ent.vx) > 0.01 || Math.abs(ent.vz) > 0.01) {
        ctx.beginPath();
        ctx.moveTo(baseProj.x, boxY + boxH * 0.5);
        const arrowEndX = baseProj.x + ent.vx * 44;
        const arrowEndY = boxY + boxH * 0.5 + (ent.vz > 0 ? 18 : 0);
        ctx.lineTo(arrowEndX, arrowEndY);
        ctx.stroke();

        ctx.fillStyle = '#ffaa00';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(
          `DOPPLER v=${Math.hypot(ent.vx, ent.vz).toFixed(1)}m/s`,
          boxX,
          boxY - 12
        );
      }
    }

    // =========================================================================
    // F. AI CAMERA SEMANTIC CLASSIFICATION TAG
    // =========================================================================
    if (inCamera) {
      ctx.globalAlpha = Math.min(1.0, visibility * 1.15);
      const tagText = semanticClear ? `[${ent.label}]` : '[HAZARD: ???]';

      ctx.font = 'bold 11px monospace';
      const textWidth = ctx.measureText(tagText).width;
      ctx.fillStyle = 'rgba(4, 10, 16, 0.88)';
      ctx.fillRect(baseProj.x - textWidth * 0.5 - 4, boxY - 20, textWidth + 8, 14);

      ctx.fillStyle = semanticClear ? ent.color : '#ffaa00';
      ctx.fillText(tagText, baseProj.x - textWidth * 0.5, boxY - 9);
    }

    ctx.restore();
  }

  /**
   * Draws unmistakable ground footprints and overhead icons:
   * - Payloads (`category === 'ore'`): Big glowing green "$" emblem with a green circular/diamond pad.
   * - Obstacles (`category === 'hazard'`): Red hazard pad beneath `boulder.png` or `pickup.png`.
   */
  drawEntityGroundSignature(
    ctx,
    ent,
    renderX,
    renderZ,
    baseProj,
    topProj,
    boxW,
    boxH,
    runState,
    visibility,
    timeSec
  ) {
    const hw = ent.width * 0.68;
    const hd = ent.width * 0.55;

    if (ent.category === 'ore') {
      // 1. Glowing Green Diamond Ring on the Pit Floor
      const pFront = this.project3D(renderX, 0.02, renderZ - hd, runState);
      const pRight = this.project3D(renderX + hw, 0.02, renderZ, runState);
      const pBack = this.project3D(renderX, 0.02, renderZ + hd, runState);
      const pLeft = this.project3D(renderX - hw, 0.02, renderZ, runState);

      ctx.save();
      ctx.globalAlpha = Math.min(1.0, visibility * 0.95);
      ctx.fillStyle = 'rgba(0, 255, 102, 0.18)';
      ctx.strokeStyle = '#00ff66';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(pFront.x, pFront.y);
      ctx.lineTo(pRight.x, pRight.y);
      ctx.lineTo(pBack.x, pBack.y);
      ctx.lineTo(pLeft.x, pLeft.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 2. Large Glowing Green "$" Emblem Floating Above the Pad
      const bobOffset = Math.sin(timeSec * 3.5 + ent.id) * 4;
      const centerY = baseProj.y - boxH * 0.55 + bobOffset;
      const fontSize = Math.max(20, Math.min(64, Math.round(boxH * 0.95)));

      // Soft green glow behind the "$"
      const glowRadius = Math.max(14, fontSize * 0.65);
      const grad = ctx.createRadialGradient(
        baseProj.x,
        centerY,
        2,
        baseProj.x,
        centerY,
        glowRadius
      );
      grad.addColorStop(0, 'rgba(0, 255, 102, 0.45)');
      grad.addColorStop(1, 'rgba(0, 255, 102, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(baseProj.x, centerY, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Draw crisp green "$" sign
      ctx.font = `900 ${fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, fontSize * 0.1);
      ctx.strokeStyle = '#031a0b';
      ctx.strokeText('$', baseProj.x, centerY);
      ctx.fillStyle = '#00ff66';
      ctx.fillText('$', baseProj.x, centerY);

      ctx.restore();
    } else if (ent.category === 'hazard') {
      // Subtle Crimson Ground Pad beneath `boulder.png` and `pickup.png`
      const pFL = this.project3D(renderX - hw, 0.02, renderZ - hd, runState);
      const pFR = this.project3D(renderX + hw, 0.02, renderZ - hd, runState);
      const pBR = this.project3D(renderX + hw, 0.02, renderZ + hd, runState);
      const pBL = this.project3D(renderX - hw, 0.02, renderZ + hd, runState);

      ctx.save();
      ctx.globalAlpha = visibility * 0.75;
      ctx.fillStyle = 'rgba(255, 40, 60, 0.16)';
      ctx.strokeStyle = '#ff3344';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(pFL.x, pFL.y);
      ctx.lineTo(pFR.x, pFR.y);
      ctx.lineTo(pBR.x, pBR.y);
      ctx.lineTo(pBL.x, pBL.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Renders the Haul Truck at the bottom-center of the viewport (`z = 3.1m`).
   * Uses `Truck_Model.png` sprite with dynamic steering tilt, shadow, and glowing mounted sensor hardpoints.
   */
  draw3DTruck(ctx, runState) {
    const truckModel = this.modelRegistry.getModel('truck');
    const truckSprite = this.modelRegistry.getSprite('truck');
    if (!truckModel) return;

    const truckZ = 3.1;
    const truckX = runState.truckX;
    const yawAngle = Math.max(-0.28, Math.min(0.28, runState.lateralVelocity * 0.048));
    const cosY = Math.cos(yawAngle);
    const sinY = Math.sin(yawAngle);

    const transformVertex = ([vx, vy, vz]) => {
      const rx = vx * cosY + vz * sinY;
      const rz = -vx * sinY + vz * cosY;
      return this.project3D(truckX + rx, vy, truckZ + rz, runState);
    };

    ctx.save();

    if (truckSprite) {
      const centerBase = this.project3D(truckX, 0.0, truckZ, runState);
      const spriteWidth = Math.max(88, Math.min(185, centerBase.scale * 1.18));
      const aspect = truckSprite.height / (truckSprite.width || 1);
      const spriteHeight = spriteWidth * aspect;

      ctx.save();
      ctx.translate(centerBase.x, centerBase.y);
      ctx.rotate(yawAngle * 0.38);

      // Soft ground contact shadow beneath the tires
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.beginPath();
      ctx.ellipse(0, -spriteHeight * 0.06, spriteWidth * 0.34, spriteHeight * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tire spray / kick-up matched to driving condition
      this.drawTireConditionSpray(ctx, spriteWidth, spriteHeight, runState);

      // Draw `Truck_Model.png`
      ctx.drawImage(
        truckSprite.image,
        -spriteWidth * 0.5,
        -spriteHeight * 0.88,
        spriteWidth,
        spriteHeight
      );

      // Draw Glowing Mounted Sensor Nodes mapped directly onto `Truck_Model.png`
      const spriteHardpointOffsets = {
        front_bumper: [0, -spriteHeight * 0.78],
        fender_left: [-spriteWidth * 0.24, -spriteHeight * 0.67],
        fender_right: [spriteWidth * 0.24, -spriteHeight * 0.67],
        roof_mast: [0, -spriteHeight * 0.66]
      };

      if (runState.mountedSensors) {
        for (const [slotId, [ox, oy]] of Object.entries(spriteHardpointOffsets)) {
          const mount = runState.mountedSensors[slotId];
          if (!mount) continue;
          ctx.fillStyle = mount.sensor.renderColor;
          ctx.shadowColor = mount.sensor.renderColor;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(ox, oy, 4.0, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#04080e';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      ctx.restore();
      ctx.restore();
      return;
    }

    // Fallback: 3D Procedural Mesh if `Truck_Model.png` is still loading
    const projVerts = truckModel.vertices.map(transformVertex);

    if (truckModel.faces) {
      for (const face of truckModel.faces) {
        if (face.indices.length < 3) continue;
        ctx.fillStyle = face.color || '#1f2d3a';
        ctx.beginPath();
        const p0 = projVerts[face.indices[0]];
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < face.indices.length; i++) {
          const pi = projVerts[face.indices[i]];
          ctx.lineTo(pi.x, pi.y);
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.65)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (const [iA, iB] of truckModel.edges) {
      const pA = projVerts[iA];
      const pB = projVerts[iB];
      if (pA && pB) {
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
      }
    }
    ctx.stroke();

    ctx.restore();
  }

  drawTireConditionSpray(ctx, spriteWidth, spriteHeight, runState) {
    const condition = runState?.level?.condition || 'dusty';
    const speedFactor = Math.min(1.4, (runState.speed || 15) / 22);
    const phase = performance.now() * 0.012;
    const kickOffsets = [-spriteWidth * 0.34, spriteWidth * 0.34];

    const colors = {
      dusty: 'rgba(224, 158, 86, 0.45)',
      muddy: 'rgba(92, 62, 34, 0.72)',
      rainy: 'rgba(175, 226, 255, 0.55)',
      snowy: 'rgba(236, 249, 255, 0.72)'
    };

    ctx.save();
    ctx.fillStyle = colors[condition] || colors.dusty;
    for (const kx of kickOffsets) {
      for (let i = 0; i < 4; i++) {
        const wave = Math.sin(phase + i * 1.7 + kx);
        const px = kx + (kx < 0 ? -1 : 1) * (5 + i * 5) + wave * 3;
        const py = -spriteHeight * 0.08 - (i * 5.5 + Math.abs(wave) * 4) * speedFactor;
        const rad = (condition === 'muddy' ? 3.5 : 5.2) + (i % 2) * 2.2;
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawMudOcclusionOverlay(ctx, width, height, runState) {
    const mudAmount = 1 - runState.opticClarity;
    if (mudAmount <= 0.15) return;

    const condition = runState?.level?.condition || 'muddy';
    ctx.save();

    if (condition === 'rainy') {
      ctx.fillStyle = `rgba(145, 208, 255, ${mudAmount * 0.32})`;
      ctx.strokeStyle = `rgba(220, 245, 255, ${mudAmount * 0.48})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 20; i++) {
        const rx = ((i * 89) % 100) * 0.01 * width;
        const ry = ((i * 61) % 100) * 0.01 * height;
        const r = (9 + (i % 4) * 7) * mudAmount;
        ctx.beginPath();
        ctx.arc(rx, ry, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (condition === 'snowy') {
      const frost = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.24,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.62
      );
      frost.addColorStop(0, 'rgba(225, 245, 255, 0)');
      frost.addColorStop(1, `rgba(218, 242, 255, ${mudAmount * 0.56})`);
      ctx.fillStyle = frost;
      ctx.fillRect(0, 0, width, height);
    } else if (condition === 'dusty') {
      ctx.fillStyle = `rgba(176, 114, 52, ${mudAmount * 0.35})`;
      for (let i = 0; i < 22; i++) {
        const rx = ((i * 97) % 100) * 0.01 * width;
        const ry = ((i * 53) % 100) * 0.01 * height;
        const rRadius = (14 + (i % 5) * 12) * mudAmount;
        ctx.beginPath();
        ctx.arc(rx, ry, rRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = `rgba(58, 44, 28, ${mudAmount * 0.45})`;
      for (let i = 0; i < 18; i++) {
        const rx = ((i * 97) % 100) * 0.01 * width;
        const ry = ((i * 53) % 100) * 0.01 * height;
        const rRadius = (18 + (i % 5) * 14) * mudAmount;
        ctx.beginPath();
        ctx.arc(rx, ry, rRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
