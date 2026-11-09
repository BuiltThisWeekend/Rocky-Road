export class GameLoop {
  constructor(updateFn, renderFn) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
    this.fixedDelta = 1 / 60;
    this.accumulator = 0;
    this.lastTime = 0;
    this.running = false;
    this.rafId = null;
    this.tick = this.tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  tick(now) {
    if (!this.running) return;
    let frameTime = (now - this.lastTime) / 1000;
    if (frameTime > 0.25) frameTime = 0.25;
    this.lastTime = now;
    this.accumulator += frameTime;

    while (this.accumulator >= this.fixedDelta) {
      this.updateFn(this.fixedDelta);
      this.accumulator -= this.fixedDelta;
    }

    const alpha = this.accumulator / this.fixedDelta;
    this.renderFn(alpha);
    this.rafId = requestAnimationFrame(this.tick);
  }
}