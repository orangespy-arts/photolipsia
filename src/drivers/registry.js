/**
 * AudioDriver — the single interface every DSP source adapter implements.
 *
 * Contract (see docs/protocol.md):
 *  - pull model: the render loop calls poll() once per frame
 *  - poll() returns a complete, sanitized AVParams frame for "now"
 *  - smoothing / envelopes / normalization are the driver's job
 */
export const DRIVER_IDS = ['web-audio', 'osc', 'midi', 'mock', 'playback'];

export function createDriverRegistry() {
  const byId = new Map();
  return {
    register(driver) {
      if (!driver || typeof driver.poll !== 'function') {
        throw new TypeError('driver must implement poll()');
      }
      if (!DRIVER_IDS.includes(driver.id)) {
        throw new TypeError(`unknown driver id "${driver.id}"`);
      }
      byId.set(driver.id, driver);
    },
    get(id) {
      return byId.get(id) ?? null;
    },
    ids() {
      return [...byId.keys()];
    },
  };
}
