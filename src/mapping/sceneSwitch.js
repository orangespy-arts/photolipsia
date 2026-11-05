// Start (standard button 9) advances one scene per press. Re-arms only after
// Start is released, so a held button, a pause or a scene load never chains
// into several jumps. Pure: the VJ page owns loading and fading.
export const START_BUTTON = 9;

export const sceneSwitchState = (index = 0) => ({ index, armed: false });

export function advanceSceneSwitch(state, pad, count) {
  const index = Number.isInteger(state?.index) ? state.index : 0;
  if (!Number.isInteger(count) || count < 2 || !pad?.standard) return { state: { index, armed: false }, switched: false };
  const start = pad.buttons?.[START_BUTTON]?.pressed === true;
  if (!state.armed || !start) return { state: { index, armed: !start }, switched: false };
  return { state: { index: (index + 1) % count, armed: false }, switched: true };
}
