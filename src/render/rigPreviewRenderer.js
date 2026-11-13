import { modelRegistry } from './modelRegistry.js';

export class RigPreviewRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.modelRegistry = modelRegistry;
  }

  render(rigMap, resolvedSensors, selectedHardpointId, previewedSensorId, hardpointsConfig, chassis) {
    if (!this.canvas || !this.ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || 460;
    const height = rect.height || 320;

    if (this.canvas.width !== Math.round(width * dpr) || this.canvas.height !== Math.round(height * dpr)) {
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. Subterranean Pit Blueprint Background & Grid
    ctx.fillStyle = '#040910';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
    ctx.lineWidth = 1;
    const gridStep = 24;
    for (let x = 0; x < width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Left & Right Pit Corridor Safety Berm Walls (Truck faces UP toward top of canvas)
    ctx.fillStyle = 'rgba(90, 62, 38, 0.22)';
    ctx.fillRect(0, 0, 22, height);
    ctx.fillRect(width - 22, 0, 22, height);
    ctx.strokeStyle = 'rgba(255, 170, 0, 0.35)';
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(22, height);
    ctx.moveTo(width - 22, 0);
    ctx.lineTo(width - 22, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Forward Direction Compass Arrow at Top Center
    ctx.fillStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('▲ HAUL CORRIDOR FORWARD (175m HORIZON) ▲', width * 0.5, 14);
    ctx.textAlign = 'left';

    // Truck Center Position (Bottom-center, facing UP toward top of screen)
    const isCompact = height < 250;
    const truckX = width * 0.5;
    const truckY = height - (isCompact ? 50 : 64);
    const maxDrawRangePx = truckY - 18;
    const scaleMetersToPx = maxDrawRangePx / 175; // 175m max scale upward

    // Hardpoint anchor coordinates on the upward-facing truck
    const hardpointCoords = {
      front_bumper: { x: truckX, y: truckY - 38 },
      fender_left: { x: truckX - 24, y: truckY - 24 },
      fender_right: { x: truckX + 24, y: truckY - 24 },
      roof_mast: { x: truckX, y: truckY - 12 }
    };

    // Build effective map (including live hover preview if hovering a sensor card)
    const displayRig = { ...rigMap };
    if (previewedSensorId && selectedHardpointId) {
      displayRig[selectedHardpointId] = previewedSensorId;
    }

    // 2. Draw Active Sensor Frustums (Pointing UPWARD -Math.PI/2, with minRange deadzone & maxRange)
    for (const [slotId, sensorId] of Object.entries(displayRig)) {
      if (!sensorId) continue;
      const sensor = resolvedSensors[sensorId];
      const hp = hardpointsConfig[slotId];
      const anchor = hardpointCoords[slotId];
      if (!sensor || !hp || !anchor) continue;

      const isSelected = slotId === selectedHardpointId;
      this.drawUpwardSensorFrustum(ctx, anchor, sensor, hp, scaleMetersToPx, isSelected);
    }

    // 3. Draw `Truck_Model.png` Sprite (or Upward-Facing Truck Blueprint Fallback)
    this.drawUpwardTruck(ctx, truckX, truckY, isCompact);

    // 4. Draw Hardpoint Mount Nodes on the Truck
    for (const [slotId, anchor] of Object.entries(hardpointCoords)) {
      const mountedId = displayRig[slotId];
      const sensor = mountedId ? resolvedSensors[mountedId] : null;
      const isSelected = slotId === selectedHardpointId;

      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, isSelected ? 7.5 : 5.0, 0, Math.PI * 2);
      ctx.fillStyle = sensor ? sensor.renderColor : '#1a2a3a';
      ctx.fill();
      ctx.lineWidth = isSelected ? 2.5 : 1.4;
      ctx.strokeStyle = isSelected ? '#ffaa00' : '#00f0ff';
      ctx.stroke();
    }

    ctx.restore();
  }

  drawUpwardSensorFrustum(ctx, anchor, sensor, hp, scalePx, isHighlighted) {
    const minRangePx = (sensor.minRange || 1) * scalePx;
    const effRangePx = Math.min(280, sensor.effectiveRange * hp.rangeMultiplier * scalePx);
    if (effRangePx <= minRangePx) return;

    const halfFovRad = ((sensor.fovAngle * 0.5) * Math.PI) / 180;
    const centerAngle = -Math.PI * 0.5 + hp.lateralOffset * 0.18;
    const startAngle = centerAngle - halfFovRad;
    const endAngle = centerAngle + halfFovRad;

    ctx.save();
    ctx.translate(anchor.x, anchor.y);

    // Ring-sector frustum path (starts at minRangePx deadzone out to effRangePx!)
    ctx.beginPath();
    ctx.arc(0, 0, effRangePx, startAngle, endAngle, false);
    ctx.arc(0, 0, minRangePx, endAngle, startAngle, true);
    ctx.closePath();

    const grad = ctx.createRadialGradient(0, 0, minRangePx, 0, 0, effRangePx);
    const baseAlpha = isHighlighted ? 0.36 : 0.16;
    grad.addColorStop(0, this.hexToRgba(sensor.renderColor, baseAlpha));
    grad.addColorStop(0.75, this.hexToRgba(sensor.renderColor, baseAlpha * 0.5));
    grad.addColorStop(1, this.hexToRgba(sensor.renderColor, 0.04));

    ctx.fillStyle = grad;
    ctx.fill();

    // Frustum boundary & deadzone inner arc
    ctx.strokeStyle = this.hexToRgba(sensor.renderColor, isHighlighted ? 0.88 : 0.42);
    ctx.lineWidth = isHighlighted ? 1.7 : 1.0;
    ctx.stroke();

    // If sensor has a large near-field blind deadzone (like Long-Range LiDAR), highlight the blind zone
    if (sensor.minRange >= 25 && isHighlighted) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 51, 68, 0.65)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, minRangePx, startAngle, endAngle);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = '#ff3344';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`BLIND <${sensor.minRange}m`, 0, -minRangePx * 0.45);
      ctx.restore();
    }

    // Sensor-specific internal visualization pattern
    if (sensor.type === 'lidar_short') {
      ctx.fillStyle = sensor.renderColor;
      ctx.globalAlpha = isHighlighted ? 0.8 : 0.4;
      for (let r = minRangePx + 8; r < effRangePx; r += 11) {
        for (let a = startAngle + 0.12; a <= endAngle - 0.12; a += 0.26) {
          ctx.fillRect(Math.cos(a) * r - 1, Math.sin(a) * r - 1, 2.2, 2.2);
        }
      }
    } else if (sensor.type === 'lidar_long') {
      ctx.strokeStyle = sensor.renderColor;
      ctx.globalAlpha = isHighlighted ? 0.72 : 0.35;
      for (let r = minRangePx + 12; r < effRangePx; r += 18) {
        ctx.beginPath();
        ctx.arc(0, 0, r, startAngle, endAngle);
        ctx.stroke();
      }
    } else if (sensor.type === 'radar') {
      const targetDist = (minRangePx + effRangePx) * 0.55;
      const tx = Math.cos(centerAngle) * targetDist;
      const ty = Math.sin(centerAngle) * targetDist;
      ctx.strokeStyle = '#ffaa00';
      ctx.globalAlpha = isHighlighted ? 0.9 : 0.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(tx - 10, ty - 8, 20, 16);
      ctx.setLineDash([]);
    } else if (sensor.type === 'camera') {
      const targetDist = (minRangePx + effRangePx) * 0.6;
      const tx = Math.cos(centerAngle) * targetDist;
      const ty = Math.sin(centerAngle) * targetDist;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = isHighlighted ? 0.9 : 0.45;
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[GATE / ORE ID]', tx, ty);
    }

    ctx.restore();
  }

  drawUpwardTruck(ctx, cx, cy, isCompact) {
    const truckSprite = this.modelRegistry.getSprite('truck');
    ctx.save();
    ctx.translate(cx, cy);

    if (truckSprite) {
      const sprW = isCompact ? 82 : 102;
      const aspect = truckSprite.height / (truckSprite.width || 1);
      const sprH = sprW * aspect;
      ctx.drawImage(truckSprite.image, -sprW * 0.5, -sprH * 0.55, sprW, sprH);
      ctx.restore();
      return;
    }

    // Fallback blueprint if `Truck_Model.png` hasn't finished loading yet
    ctx.fillStyle = '#141d26';
    ctx.strokeStyle = '#4a6278';
    ctx.lineWidth = 1.2;
    const wheels = [
      [-26, -24, 7, 15],
      [19, -24, 7, 15],
      [-27, 8, 8, 17],
      [19, 8, 8, 17]
    ];
    for (const [wx, wy, ww, wh] of wheels) {
      ctx.fillRect(wx, wy, ww, wh);
      ctx.strokeRect(wx, wy, ww, wh);
    }

    ctx.fillStyle = '#1b2c3b';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.rect(-19, -36, 38, 66);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0d1822';
    ctx.fillRect(-15, -34, 30, 20);
    ctx.strokeRect(-15, -34, 30, 20);

    ctx.restore();
  }

  hexToRgba(hex, alpha) {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
