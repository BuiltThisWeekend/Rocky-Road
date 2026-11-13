import { SENSORS_CONFIG, getSensorStatsAtLevel } from './config/sensors.config.js';
import { LEVELS_CONFIG } from './config/levels.config.js';
import { HARDPOINTS_CONFIG, CHASSIS_TIERS, validateRigConfiguration } from './config/equipment.config.js';
import { GameLoop } from './core/loop.js';
import { InputController } from './core/input.js';
import { RunState } from './core/state.js';
import { SaveManager } from './core/saveManager.js';
import { PerceptionSystem } from './systems/perceptionSystem.js';
import { SpawnerSystem } from './systems/spawnerSystem.js';
import { CollisionSystem } from './systems/collisionSystem.js';
import { AudioSystem } from './systems/audioSystem.js';
import { CanvasRenderer } from './render/canvasRenderer.js';
import { HudRenderer } from './render/hudRenderer.js';
import { RigPreviewRenderer } from './render/rigPreviewRenderer.js';
import { modelRegistry } from './render/modelRegistry.js';

class VanguardApp {
  constructor() {
    this.saveManager = new SaveManager();
    this.runState = new RunState();
    this.perceptionSystem = new PerceptionSystem();
    this.spawnerSystem = new SpawnerSystem();
    this.collisionSystem = new CollisionSystem();
    this.audioSystem = new AudioSystem();
    this.modelRegistry = modelRegistry;

    this.canvas = document.getElementById('game-canvas');
    this.canvasRenderer = new CanvasRenderer(this.canvas);
    this.hudRenderer = new HudRenderer();

    this.rigPreviewCanvas = document.getElementById('rig-preview-canvas');
    this.rigPreviewRenderer = new RigPreviewRenderer(this.rigPreviewCanvas);

    this.input = new InputController(this.canvas, () => {
      this.perceptionSystem.triggerOpticPurge(this.runState, this.audioSystem, this.hudRenderer);
    });

    this.selectedHardpointId = 'front_bumper';
    this.previewedSensorId = null;

    this.loop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render()
    );

    this.initGarageDOM();
    this.renderGarageUI();
    // Re-render the Rigging Bay preview once Truck_Model.png finishes loading
    const truckSpr = this.modelRegistry.sprites.get('truck');
    if (truckSpr && truckSpr.image) {
      truckSpr.image.addEventListener('load', () => {
        if (!this.runState.active) this.updateRigVisualizer();
      });
    }
    this.registerServiceWorker();
    this.loop.start();
  }

  initGarageDOM() {
    document.getElementById('btn-optic-purge').addEventListener('click', (e) => {
      e.stopPropagation();
      this.perceptionSystem.triggerOpticPurge(this.runState, this.audioSystem, this.hudRenderer);
    });

    // Mid-Run Top-Right Exit Button
    document.getElementById('btn-exit-level').addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.runState.active) {
        this.exitHaulRunEarly();
      }
    });

    document.getElementById('btn-upgrade-chassis').addEventListener('click', () => {
      const currIdx = this.saveManager.data.chassisTierIndex;
      const currTier = CHASSIS_TIERS[currIdx];
      if (currTier && currTier.upgradeCost && this.saveManager.data.credits >= currTier.upgradeCost) {
        this.saveManager.data.credits -= currTier.upgradeCost;
        this.saveManager.data.chassisTierIndex += 1;
        this.saveManager.save();
        this.renderGarageUI();
      }
    });

    const levelSelect = document.getElementById('select-level');
    levelSelect.innerHTML = LEVELS_CONFIG.map(
      (lvl) => `<option value="${lvl.id}">${lvl.name}</option>`
    ).join('');
    levelSelect.value = this.saveManager.data.selectedLevelId;
    levelSelect.addEventListener('change', (e) => {
      this.saveManager.data.selectedLevelId = e.target.value;
      this.saveManager.save();
    });

    document.getElementById('btn-export-save').addEventListener('click', () => {
      this.saveManager.exportJSON();
    });

    document.getElementById('btn-import-save').addEventListener('click', () => {
      this.saveManager.importJSON(() => this.renderGarageUI());
    });

    document.getElementById('btn-start-haul').addEventListener('click', () => {
      this.startHaulRun();
    });

    document.getElementById('btn-return-garage').addEventListener('click', () => {
      document.getElementById('screen-summary').classList.remove('active');
      document.getElementById('screen-garage').classList.add('active');
      this.renderGarageUI();
    });

    window.addEventListener('resize', () => {
      if (!this.runState.active) {
        this.updateRigVisualizer();
      }
    });
  }

  getResolvedSensorStatsMap() {
    const map = {};
    for (const id of Object.keys(SENSORS_CONFIG)) {
      const lvl = this.saveManager.data.sensorLevels[id] || 1;
      map[id] = getSensorStatsAtLevel(id, lvl);
    }
    return map;
  }

  updateRigVisualizer() {
    const { chassisTierIndex, rig } = this.saveManager.data;
    const chassis = CHASSIS_TIERS[chassisTierIndex] || CHASSIS_TIERS[0];
    const resolvedSensors = this.getResolvedSensorStatsMap();
    this.rigPreviewRenderer.render(
      rig,
      resolvedSensors,
      this.selectedHardpointId,
      this.previewedSensorId,
      HARDPOINTS_CONFIG,
      chassis
    );
  }

  renderGarageUI() {
    const { credits, chassisTierIndex, rig, sensorLevels } = this.saveManager.data;
    const chassis = CHASSIS_TIERS[chassisTierIndex] || CHASSIS_TIERS[0];
    const resolvedSensors = this.getResolvedSensorStatsMap();
    const validation = validateRigConfiguration(rig, resolvedSensors, chassisTierIndex);

    document.getElementById('garage-credits').textContent = `$${credits.toLocaleString()}`;
    document.getElementById('rig-chassis-name').textContent = chassis.name;

    const btnChassis = document.getElementById('btn-upgrade-chassis');
    if (chassis.upgradeCost) {
      btnChassis.textContent = `UPGRADE ($${chassis.upgradeCost})`;
      btnChassis.disabled = credits < chassis.upgradeCost;
    } else {
      btnChassis.textContent = 'MAX TIER';
      btnChassis.disabled = true;
    }

    // Power & Weight Bars
    const pwrPct = Math.min(100, Math.round((validation.totalPower / validation.maxPower) * 100));
    const wgtPct = Math.min(100, Math.round((validation.totalWeight / validation.maxWeight) * 100));
    document.getElementById('rig-power-text').textContent = `${validation.totalPower}/${validation.maxPower}kW`;
    document.getElementById('rig-weight-text').textContent = `${validation.totalWeight}/${validation.maxWeight}kg`;

    const pwrBar = document.getElementById('rig-power-bar');
    pwrBar.style.width = `${pwrPct}%`;
    pwrBar.className = `bar-fill ${validation.totalPower > validation.maxPower ? 'danger' : 'cyan'}`;

    const wgtBar = document.getElementById('rig-weight-bar');
    wgtBar.style.width = `${wgtPct}%`;
    wgtBar.className = `bar-fill ${validation.totalWeight > validation.maxWeight ? 'danger' : 'amber'}`;

    // 1. Render Compact Spatially Positioned Hardpoint Pills around the Upward-Facing Truck
    const hpContainer = document.getElementById('hardpoint-list');
    hpContainer.innerHTML = '';
    const shortSlotNames = {
      front_bumper: '▲ BUMPER',
      fender_left: '◄ LEFT',
      fender_right: 'RIGHT ►',
      roof_mast: '● ROOF'
    };

    for (const hp of Object.values(HARDPOINTS_CONFIG)) {
      const mountedId = rig[hp.id];
      const mountedSensor = mountedId ? resolvedSensors[mountedId] : null;
      const isSelected = this.selectedHardpointId === hp.id;

      const node = document.createElement('div');
      node.className = `spatial-slot-node pos-${hp.id} ${isSelected ? 'selected' : ''}`;
      node.innerHTML = `
        <div class="spatial-node-title">${shortSlotNames[hp.id] || hp.name}</div>
        <div class="spatial-node-sensor" style="color:${mountedSensor ? mountedSensor.renderColor : '#6c8a9c'}">
          ${mountedSensor ? mountedSensor.shortLabel + ' L' + mountedSensor.level : '[EMPTY]'}
        </div>
      `;
      node.addEventListener('click', () => {
        this.selectedHardpointId = hp.id;
        this.renderGarageUI();
      });
      hpContainer.appendChild(node);
    }

    // 2. Render Compact Active Location Banner on the Right Column
    const activeHp = HARDPOINTS_CONFIG[this.selectedHardpointId];
    const activeMountedId = rig[this.selectedHardpointId];
    const activeMountedSensor = activeMountedId ? resolvedSensors[activeMountedId] : null;
    const bannerEl = document.getElementById('selected-slot-banner');
    if (bannerEl && activeHp) {
      bannerEl.innerHTML = `
        <div class="slot-banner-top">
          <span>SLOT: ${activeHp.name.toUpperCase()} <span class="role-badge">${activeHp.visualRoleBadge}</span></span>
          ${
            activeMountedSensor
              ? `<button class="small-btn btn-unmount-active" type="button">UNMOUNT</button>`
              : `<span class="cyan">[EMPTY]</span>`
          }
        </div>
        <div class="slot-banner-desc">${activeHp.description}</div>
      `;
      const unmountBtn = bannerEl.querySelector('.btn-unmount-active');
      if (unmountBtn) {
        unmountBtn.addEventListener('click', () => {
          rig[this.selectedHardpointId] = null;
          this.saveManager.save();
          this.renderGarageUI();
        });
      }
    }

    // 3. Render Concise Sensor Suite Selector for the Active Hardpoint
    const catalogContainer = document.getElementById('sensor-catalog');
    catalogContainer.innerHTML = '';
    for (const sensor of Object.values(resolvedSensors)) {
      const isMountedHere = rig[this.selectedHardpointId] === sensor.id;
      const card = document.createElement('div');
      card.className = `sensor-card ${isMountedHere ? 'mounted-here' : ''}`;
      card.innerHTML = `
        <div class="card-top">
          <span style="color:${sensor.renderColor}">${sensor.shortLabel} Lv.${sensor.level}</span>
          <span class="role-badge" style="color:${sensor.renderColor}; border-color:${sensor.renderColor}55">${sensor.visualRoleBadge}</span>
        </div>
        <div class="card-desc">${sensor.description}</div>
        <div class="card-stats">
          <span>${sensor.minRange}–${sensor.effectiveRange}m | ${sensor.fovAngle}° | ${sensor.powerDrawKw}kW/${sensor.weightKg}kg</span>
          <div>
            <button class="small-btn btn-mount" data-id="${sensor.id}" type="button">
              ${isMountedHere ? 'MOUNTED ✓' : 'MOUNT'}
            </button>
            <button class="small-btn btn-upgrade" data-id="${sensor.id}" ${credits < sensor.nextUpgradeCost ? 'disabled' : ''} type="button">
              +$${sensor.nextUpgradeCost}
            </button>
          </div>
        </div>
      `;

      card.addEventListener('pointerenter', () => {
        this.previewedSensorId = sensor.id;
        this.updateRigVisualizer();
      });
      card.addEventListener('pointerleave', () => {
        this.previewedSensorId = null;
        this.updateRigVisualizer();
      });

      card.querySelector('.btn-mount').addEventListener('click', () => {
        rig[this.selectedHardpointId] = sensor.id;
        this.saveManager.save();
        this.renderGarageUI();
      });

      card.querySelector('.btn-upgrade').addEventListener('click', () => {
        if (this.saveManager.data.credits >= sensor.nextUpgradeCost) {
          this.saveManager.data.credits -= sensor.nextUpgradeCost;
          sensorLevels[sensor.id] = (sensorLevels[sensor.id] || 1) + 1;
          this.saveManager.save();
          this.renderGarageUI();
        }
      });

      catalogContainer.appendChild(card);
    }

    const startBtn = document.getElementById('btn-start-haul');
    startBtn.disabled = !validation.valid;
    startBtn.textContent = validation.valid
      ? 'ENGAGE HAUL'
      : 'OVERLIMIT RIG';

    // Update Interactive Upward-Facing Schematic Visualizer Canvas
    this.updateRigVisualizer();
  }

  startHaulRun() {
    const { selectedLevelId, rig, sensorLevels, chassisTierIndex } = this.saveManager.data;
    const resolvedSensors = this.getResolvedSensorStatsMap();
    const validation = validateRigConfiguration(rig, resolvedSensors, chassisTierIndex);
    if (!validation.valid) return;

    this.audioSystem.init();
    this.spawnerSystem.reset();
    this.input.targetSteer = 0;

    this.runState.reset(selectedLevelId, rig, sensorLevels, chassisTierIndex);
    this.runState.active = true;

    document.getElementById('screen-garage').classList.remove('active');
    document.getElementById('screen-summary').classList.remove('active');
  }

  exitHaulRunEarly() {
    this.runState.active = false;
    // Bank any ore credits extracted prior to aborting the run
    if (this.runState.earnedCredits > 0) {
      this.saveManager.data.credits += this.runState.earnedCredits;
      this.saveManager.save();
    }
    document.getElementById('screen-summary').classList.remove('active');
    document.getElementById('screen-garage').classList.add('active');
    this.renderGarageUI();
  }

  finishHaulRun(survived) {
    this.runState.active = false;
    const contractBonus = survived ? this.runState.level.contractBonus : 0;
    const totalPayout = this.runState.earnedCredits + contractBonus;
    this.saveManager.data.credits += totalPayout;
    this.saveManager.save();

    document.getElementById('summary-title').textContent = survived
      ? 'HAUL CONTRACT FULFILLED'
      : 'CHASSIS CRITICAL FAILURE — EMERGENCY EJECT';
    document.getElementById('summary-title').className = survived ? 'green' : 'danger';

    document.getElementById('summary-metrics').innerHTML = `
      <div class="summary-stat">
        <div class="label">DISTANCE HAULED</div>
        <div class="value cyan">${Math.round(this.runState.distanceTraveled)}m / ${this.runState.level.targetRunDistance}m</div>
      </div>
      <div class="summary-stat">
        <div class="label">EXTRACTED PAYLOAD</div>
        <div class="value amber">${this.runState.payloadTons}t</div>
      </div>
      <div class="summary-stat">
        <div class="label">ORE REFINERY VALUE</div>
        <div class="value green">$${this.runState.earnedCredits}</div>
      </div>
      <div class="summary-stat">
        <div class="label">CONTRACT COMPLETION BONUS</div>
        <div class="value cyan">$${contractBonus}</div>
      </div>
    `;

    document.getElementById('screen-summary').classList.add('active');
  }

  update(dt) {
    this.audioSystem.update(dt, this.runState);
    if (!this.runState.active) {
      this.perceptionSystem.update(dt, this.runState);
      return;
    }

    this.input.update(dt);
    this.perceptionSystem.update(dt, this.runState);
    this.spawnerSystem.update(dt, this.runState);
    this.collisionSystem.update(dt, this.runState, this.input, this.audioSystem);
    this.hudRenderer.update(this.runState);

    if (this.runState.hullIntegrity <= 0) {
      this.finishHaulRun(false);
    } else if (this.runState.distanceTraveled >= this.runState.level.targetRunDistance) {
      this.finishHaulRun(true);
    }
  }

  render() {
    this.canvasRenderer.render(this.runState, this.perceptionSystem);
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('./sw.js')
          .then((reg) => reg.update())
          .catch(() => {});
      });
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.vanguardApp = new VanguardApp();
});
