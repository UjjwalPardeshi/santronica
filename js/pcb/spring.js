/*
 * Critically damped spring (Apple "damping 1.0"): never overshoots, always
 * interruptible, continues from its current value and velocity on retarget.
 * `response` is Apple's designer-friendly parameter, in seconds.
 * Uses the exact closed-form step, so it is stable for any frame time.
 */
export class Spring {
  constructor(value = 0, response = 0.42) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.setResponse(response);
  }

  setResponse(response) {
    this.omega = (2 * Math.PI) / response;
  }

  step(dt) {
    const w = this.omega;
    const delta = this.value - this.target;
    const decay = Math.exp(-w * dt);
    const c = this.velocity + w * delta;
    this.value = this.target + (delta + c * dt) * decay;
    this.velocity = (this.velocity - w * c * dt) * decay;
  }

  snap() {
    this.value = this.target;
    this.velocity = 0;
  }

  settled(eps) {
    return Math.abs(this.value - this.target) < eps && Math.abs(this.velocity) < eps * 8;
  }
}
