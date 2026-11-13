export class InputController {
  constructor(canvasElement, onPurgeCallback) {
    this.canvas = canvasElement;
    this.onPurgeCallback = onPurgeCallback;

    this.targetSteer = 0; // -1.48 (Left) to +1.48 (Right)
    this.pointerActive = false;
    this.startX = 0;
    this.startY = 0;
    this.lastX = 0;
    this.touchStartTime = 0;

    this.keys = new Set();
    this.bindEvents();
  }

  clientXToSteer(clientX) {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || window.innerWidth || 375;
    const height = rect.height || window.innerHeight || 667;
    const localX = clientX - rect.left;
    // Exact inverse of project3D screenX at z = 3.1 with camX = truckX * 0.12:
    // screenX = width * 0.5 + truckX * (0.176 * height)
    const pxPerMeter = Math.max(40, height * 0.176);
    const steer = (localX - width * 0.5) / pxPerMeter;
    return Math.max(-1.48, Math.min(1.48, steer));
  }

  bindEvents() {
    this.canvas.addEventListener('pointerdown', (e) => {
      this.pointerActive = true;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.lastX = e.clientX;
      this.touchStartTime = performance.now();
      this.targetSteer = this.clientXToSteer(e.clientX);
    });

    window.addEventListener('pointermove', (e) => {
      const isHoverMouse = e.pointerType === 'mouse' && e.target === this.canvas;
      if (!this.pointerActive && !isHoverMouse) return;
      this.lastX = e.clientX;
      this.targetSteer = this.clientXToSteer(e.clientX);
    });

    window.addEventListener('pointerup', (e) => {
      if (!this.pointerActive) return;
      this.pointerActive = false;
      const elapsed = performance.now() - this.touchStartTime;
      const moveDist = Math.hypot(e.clientX - this.startX, e.clientY - this.startY);

      // Quick tap on viewport triggers Optic Purge if mud is present
      if (elapsed < 210 && moveDist < 14 && this.onPurgeCallback) {
        this.onPurgeCallback();
      }
    });

    // Desktop keyboard fallback for testing
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space' && this.onPurgeCallback) {
        this.onPurgeCallback();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  update(dt) {
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) {
      this.targetSteer = Math.max(-1.45, this.targetSteer - 2.6 * dt);
    }
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) {
      this.targetSteer = Math.min(1.45, this.targetSteer + 2.6 * dt);
    }
  }
}
