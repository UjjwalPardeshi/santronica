/*
 * Composite scenes: several models shown together in one slot. Model-space millimetres,
 * y up, the camera looks down -z at pose rx = 0 (see ensemble.js for `anchor` / `at`).
 * `rotation` [x, y, z] tilts about x first, then turns about the vertical.
 * The software stays at real size; the board and the FPGA are enlarged (1.7x, 2x) so the
 * hardware reads at hero size next to a 30 cm laptop.
 */
export const COMPOSITES = {
  // Hero: the whole studio at a glance. Hardware at the front left (the field device for
  // industrial / intrinsic safety, the board, the FPGA), software at the back right (the laptop
  // with a web app, a phone with a mobile app).
  suite: [
    { model: 'laptop', anchor: [0.5, 0, 0.5], at: [0, 0, 0] },
    { model: 'phone', rotation: [76, -26, 0], anchor: [0.5, 0, 0.5], at: [212, 0, 55] },
    { model: 'device', rotation: [90, 28, 0], anchor: [0.5, 0, 0.5], at: [-228, 0, 30] },
    { model: 'pcb', rotation: [0, 16, 0], scale: 1.7, anchor: [0.5, 0, 0.5], at: [-72, 0, 195] },
    { model: 'chip', rotation: [0, -22, 0], scale: 2, anchor: [0.5, 0, 0.5], at: [128, 0, 190] },
  ],
  // Software section: the laptop (web apps) with a phone (mobile apps) leaning beside it.
  duo: [
    { model: 'laptop', anchor: [0.5, 0, 0.5], at: [0, 0, 0] },
    { model: 'phone', rotation: [76, -26, 0], anchor: [0.5, 0, 0.5], at: [212, 0, 55] },
  ],
};
