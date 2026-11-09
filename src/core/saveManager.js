const STORAGE_KEY = 'VANGUARD_SAVE_LEDGER_V1';

const DEFAULT_SAVE = {
  credits: 1500,
  chassisTierIndex: 0,
  selectedLevelId: 'bench_upper',
  sensorLevels: {
    short_lidar: 1,
    long_lidar: 1,
    radar_4d: 1,
    optical_cam: 1
  },
  rig: {
    front_bumper: 'short_lidar',
    roof_mast: 'long_lidar',
    fender_left: 'optical_cam',
    fender_right: 'radar_4d'
  }
};

export class SaveManager {
  constructor() {
    this.data = this.load();
  }

  sanitizeLoadedData(merged) {
    // Strip legacy gps_slam references if loading an older save
    if (merged.sensorLevels && 'gps_slam' in merged.sensorLevels) {
      delete merged.sensorLevels.gps_slam;
    }
    if (merged.rig) {
      for (const slot of Object.keys(merged.rig)) {
        if (merged.rig[slot] === 'gps_slam') {
          merged.rig[slot] = null;
        }
      }
    }
    return merged;
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_SAVE);
      const parsed = JSON.parse(raw);
      return this.sanitizeLoadedData({
        ...structuredClone(DEFAULT_SAVE),
        ...parsed,
        sensorLevels: { ...DEFAULT_SAVE.sensorLevels, ...(parsed.sensorLevels || {}) },
        rig: { ...DEFAULT_SAVE.rig, ...(parsed.rig || {}) }
      });
    } catch {
      return structuredClone(DEFAULT_SAVE);
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('SaveManager persistence error:', e);
    }
  }

  exportJSON() {
    const blob = new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vanguard-rig-save-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importJSON(onSuccess) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          if (typeof parsed.credits === 'number' && parsed.rig) {
            this.data = this.sanitizeLoadedData({
              ...structuredClone(DEFAULT_SAVE),
              ...parsed
            });
            this.save();
            if (onSuccess) onSuccess();
          }
        } catch (err) {
          alert('Invalid Vanguard save JSON file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
}
