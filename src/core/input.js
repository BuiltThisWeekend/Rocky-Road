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

  bindEvents() {
    this.canvas.addEventListener('pointerdown', (e) => {
      this.pointerActive = true;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.lastX = e.clientX;
      this.touchStartTime = performance.now();
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.pointerActive) return;
      const dx = e.clientX - this.lastX;
      this.lastX = e.clientX;

      const width = window.innerWidth || 375;

      // Agile horizontal drag controls lateral pit position
      this.targetSteer = Math.max(-1.45, Math.min(1.45, this.targetSteer + (dx / width) * 3.6));
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
