export class HudRenderer {
  constructor() {
    this.elDepth = document.getElementById('hud-depth');
    this.elSpeed = document.getElementById('hud-speed');
    this.elPayload = document.getElementById('hud-payload');
    this.elRange = document.getElementById('hud-range');
    this.elBanner = document.getElementById('hud-banner-alert');

    this.barHull = document.getElementById('bar-hull');
    this.barOptics = document.getElementById('bar-optics');
    this.elHardpoints = document.getElementById('hud-hardpoint-readout');

    this.elPurgeStatus = document.getElementById('purge-status');
    this.elWiperBlade = document.getElementById('wiper-blade');
  }

  update(runState) {
    if (!runState) return;

    const currentDepth = Math.round(
      runState.level.depthMeters + runState.distanceTraveled * 0.12
    );
    const remainingDist = Math.max(
      0,
      Math.round(runState.level.targetRunDistance - runState.distanceTraveled)
    );

    const condTag = runState.level.conditionLabel ? ` • ${runState.level.conditionLabel}` : '';
    this.elDepth.textContent = `-${currentDepth}m (${remainingDist}m left)${condTag}`;
    this.elSpeed.textContent = `${Math.round(runState.speed * 3.6)} km/h`;
    this.elPayload.textContent = `${runState.payloadTons}t / ${runState.maxPayloadTons}t`;

    if (this.elRange) {
      const maxHorizon = Math.round(runState.perceptionEnvelope?.maxIlluminatedZ || 0);
      this.elRange.textContent = `${maxHorizon}m`;
      this.elRange.className = `value ${maxHorizon > 45 ? 'cyan' : 'amber'}`;
    }

    // Gauges
    const hullPct = Math.max(0, Math.round((runState.hullIntegrity / runState.maxHullIntegrity) * 100));
    this.barHull.style.width = `${hullPct}%`;
    this.barHull.className = `bar-fill ${hullPct > 40 ? 'green' : 'danger'}`;

    const opticPct = Math.round(runState.opticClarity * 100);
    this.barOptics.style.width = `${opticPct}%`;
    this.barOptics.className = `bar-fill ${opticPct >= 48 ? 'cyan' : 'danger'}`;

    // Purge Readout
    if (runState.purgeCooldown > 0) {
      this.elPurgeStatus.textContent = `RECHARGING (${runState.purgeCooldown.toFixed(1)}s)`;
    } else if (runState.opticClarity < 0.48) {
      this.elPurgeStatus.textContent = 'MUD STATIC [TAP NOW]';
    } else {
      this.elPurgeStatus.textContent = 'READY [TAP]';
    }

    // Banner Alert
    if (runState.alertTimer > 0 && runState.alertBannerText) {
      this.elBanner.textContent = runState.alertBannerText;
      this.elBanner.className = runState.alertTone === 'good' ? 'banner-good' : 'banner-danger';
    } else {
      this.elBanner.className = 'hidden';
    }

    // Mounted Hardpoints Health Readout
    let hpHtml = '';
    for (const [slotId, mount] of Object.entries(runState.mountedSensors)) {
      const hpPct = Math.round(mount.health * 100);
      const shortSlot = slotId.replace('front_', '').replace('fender_', 'F-').toUpperCase();
      hpHtml += `
        <div class="hp-status-line">
          <span>${shortSlot}: ${mount.sensor.shortLabel}</span>
          <span class="${hpPct > 50 ? 'green' : 'amber'}">${hpPct}%</span>
        </div>`;
    }
    this.elHardpoints.innerHTML = hpHtml;
  }

  triggerWiperAnimation() {
    if (!this.elWiperBlade) return;
    this.elWiperBlade.classList.remove('sweeping');
    void this.elWiperBlade.offsetWidth;
    this.elWiperBlade.classList.add('sweeping');
  }
}
