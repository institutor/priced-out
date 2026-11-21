// Stick figures, and the boxes their words go in. Like everything in
// sketch.js these are path data and nothing else, and the same seed always
// gives the same drawing.
import * as sketch from "./sketch.js";

const num = (value) => String(Math.round(value * 10) / 10 || 0);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// Where a right arm's elbow and hand are, measured from the shoulder in
// units of the figure's height (across, then down). A left arm is the same
// arm in a mirror.
export const POSES = {
  // Hanging at the side.
  down: { elbow: [0.06, 0.13], hand: [0.09, 0.27] },
  // Hanging close in, as if the hand were in a pocket.
  pocket: { elbow: [0.055, 0.13], hand: [0.025, 0.25] },
  // Straight up: a cheer.
  up: { elbow: [0.1, -0.1], hand: [0.15, -0.31] },
  // Up and out: a wave.
  wave: { elbow: [0.14, -0.03], hand: [0.23, -0.2] },
  // Holding something out to be seen.
  hold: { elbow: [0.12, 0.07], hand: [0.21, -0.07] },
  // A hand cupped beside the mouth, calling out.
  call: { elbow: [0.12, 0.04], hand: [0.085, -0.115] },
  // A hand on the back of the neck.
  neck: { elbow: [0.15, -0.045], hand: [0.03, -0.085] },
};

// One standing figure. `x` is where it stands and `ground` what it stands
// on. `lean` moves the head forward of the feet and `slump` lowers it; `look`
// turns the face left (-1) or right (1) and `down` drops the gaze; `toes`
// of -1 turns the feet in. The strokes come back in the order a hand would
// draw them: head, spine, left arm, right arm, left leg, right leg, eyes,
// mouth, and eyebrows if there are any.
export function figure({
  x = 0,
  ground = 0,
  height = 100,
  left = "down",
  right = "down",
  lean = 0,
  slump = 0,
  stance = 0.085,
  toes = 1,
  look = 0,
  down = 0,
  mouth = "smile",
  brows = "",
  seed = 1,
  rough = 1,
} = {}) {
  const h = height;
  const r = 0.115 * h;
  const wobble = rough * h * 0.008;
  const hip = [x, ground - 0.42 * h];
  const neck = [x + lean * h, ground - (0.77 - slump) * h];
  const head = { x: neck[0] + lean * h * 0.45, y: neck[1] - r, r };
  const shoulder = [neck[0] + (hip[0] - neck[0]) * 0.12, neck[1] + (hip[1] - neck[1]) * 0.12];
  // A back that leans also bows, away from the way it leans.
  const back = [(neck[0] + hip[0]) / 2 - lean * h * 0.3, (neck[1] + hip[1]) / 2];

  const arm = (side, pose, armSeed) => {
    const { elbow, hand } = POSES[pose] ?? POSES.down;
    const bend = [shoulder[0] + side * elbow[0] * h, shoulder[1] + elbow[1] * h];
    const end = [shoulder[0] + side * hand[0] * h, shoulder[1] + hand[1] * h];
    return { end, d: sketch.polyline([shoulder, bend, end], { seed: armSeed, rough: wobble, passes: 1 }) };
  };
  // A leg runs down to the ground and turns along it for a foot.
  const leg = (side, legSeed) => {
    const foot = x + side * stance * h;
    const toe = foot + side * toes * 0.05 * h;
    return `${sketch.line(hip[0], hip[1], foot, ground, { seed: legSeed, rough: wobble, passes: 1 })}L${num(toe)},${num(ground)}`;
  };

  const leftArm = arm(-1, left, seed + 2);
  const rightArm = arm(1, right, seed + 3);

  // The face sits a little toward wherever it is looking.
  const faceX = head.x + look * r * 0.3;
  const eyeY = head.y - r * 0.12 + down * r;
  const mouthY = head.y + r * 0.44 + down * r * 0.5;
  const eye = (side) => {
    const ex = faceX + side * r * 0.34;
    return `M${num(ex)},${num(eyeY - r * 0.1)}L${num(ex + look * r * 0.04)},${num(eyeY + r * 0.1)}`;
  };
  const mouths = {
    smile: () => sketch.polyline([[faceX - r * 0.38, mouthY - r * 0.1], [faceX, mouthY + r * 0.14], [faceX + r * 0.38, mouthY - r * 0.1]], { seed: seed + 6, rough: wobble * 0.3, passes: 1 }),
    frown: () => sketch.polyline([[faceX - r * 0.34, mouthY + r * 0.12], [faceX, mouthY - r * 0.08], [faceX + r * 0.34, mouthY + r * 0.12]], { seed: seed + 6, rough: wobble * 0.3, passes: 1 }),
    flat: () => sketch.line(faceX - r * 0.3, mouthY, faceX + r * 0.3, mouthY, { seed: seed + 6, rough: wobble * 0.3, passes: 1 }),
    open: () => sketch.ellipse(faceX, mouthY, r * 0.2, r * 0.24, { seed: seed + 6, rough: wobble * 0.2, steps: 8, overlap: 0.1 }),
  };
  // Worried eyebrows slope up toward the middle.
  const brow = (side) => {
    const out = faceX + side * r * 0.62;
    const inner = faceX + side * r * 0.2;
    return `M${num(out)},${num(eyeY - r * 0.34)}L${num(inner)},${num(eyeY - r * 0.52)}`;
  };

  const strokes = [
    sketch.ellipse(head.x, head.y, r * 0.95, r, { seed, rough: wobble, steps: 12, overlap: 0.1 }),
    sketch.polyline([neck, back, hip], { seed: seed + 1, rough: wobble * 0.6, passes: 1 }),
    leftArm.d,
    rightArm.d,
    leg(-1, seed + 4),
    leg(1, seed + 5),
    eye(-1),
    eye(1),
    (mouths[mouth] ?? mouths.smile)(),
  ];
  if (brows === "worried") strokes.push(brow(-1), brow(1));

  return { strokes, head, shoulder, hands: { left: leftArm.end, right: rightArm.end } };
}

// A speech bubble: a box, with a tail from its bottom edge down to `tip`,
// which is whoever is speaking. The tail leaves the box a little to the
// box's side of the speaker, so it slants toward them.
export function bubble(x, y, width, height, { tip = null, seed = 1, rough = 1, tail = 14 } = {}) {
  const right = x + width;
  const bottom = y + height;
  if (!tip) return sketch.polygon([[x, y], [right, y], [right, bottom], [x, bottom]], { seed, rough });
  const centre = x + width / 2;
  const toward = Math.sign(centre - tip[0]) * Math.min(Math.abs(centre - tip[0]), tail * 0.8);
  const root = clamp(tip[0] + toward, x + tail, right - tail);
  return sketch.polygon(
    [[x, y], [right, y], [right, bottom], [root + tail / 2, bottom], tip, [root - tail / 2, bottom], [x, bottom]],
    { seed, rough },
  );
}
