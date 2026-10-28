// Landing-page 3D: a hand of real-looking cards that fans out in the hero and,
// as you scroll the "spill" section, lays a run down onto the table.
// Geometry is procedural (rounded-rect extrude); faces are canvas textures drawn
// from the same artwork as the in-game cards.
import * as THREE from '/vendor/three/three.module.js';
import { cardCanvas } from './cards.js';

const W = 1;
const H = 1.4;
const R = 0.075;
const D = 0.014;

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

const shape = roundedRect(W, H, R);
const faceGeo = new THREE.ShapeGeometry(shape, 10);
{
  // ShapeGeometry UVs are in shape units; map them onto 0..1 so the texture fills the face.
  const pos = faceGeo.attributes.position;
  const uv = faceGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + W / 2) / W, (pos.getY(i) + H / 2) / H);
}
const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false, curveSegments: 10 });
bodyGeo.translate(0, 0, -D / 2);
const edgeMat = new THREE.MeshStandardMaterial({ color: 0xe4dccb, roughness: 0.85 });

async function texture(card, renderer) {
  const t = new THREE.CanvasTexture(await cardCanvas(card));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

function makeCard(front, back) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo, edgeMat);
  body.castShadow = true;
  const f = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ map: front, roughness: 0.62, metalness: 0 }));
  f.position.z = D / 2 + 0.0006;
  const b = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ map: back, roughness: 0.55 }));
  b.position.z = -D / 2 - 0.0006;
  b.rotation.y = Math.PI;
  g.add(body, f, b);
  return g;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a, b, t) => a + (b - a) * t;

// The demo hand: the table shows Ember 4, the player spills Tide 4-5-6-7.
const HAND = [
  { suit: 'tide', kind: 'num', rank: 4 },
  { suit: 'tide', kind: 'num', rank: 5 },
  { suit: 'tide', kind: 'num', rank: 6 },
  { suit: 'tide', kind: 'num', rank: 7 },
  { suit: 'ember', kind: 'surge' },
  { suit: null, kind: 'prism' },
  { suit: 'moss', kind: 'num', rank: 9 },
];
const RUN = 4;
// Fan order on screen, so the run isn't sitting neatly in a row before it's played.
const FAN_SLOT = [1, 3, 4, 6, 0, 5, 2];

export async function createCardScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0, 7.5);

  scene.add(new THREE.HemisphereLight(0xfff6e6, 0x8a7a62, 1.6));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.3);
  key.position.set(-3, 4, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  key.shadow.radius = 6;
  key.shadow.bias = -0.0004;
  scene.add(key);

  // Invisible plane that only receives shadows, so the cards cast onto the paper page.
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.ShadowMaterial({ opacity: 0.16 }));
  catcher.position.z = -0.6;
  catcher.receiveShadow = true;
  scene.add(catcher);

  // Canvas text only uses fonts that are already loaded, so ask for them explicitly.
  await Promise.all([
    document.fonts.load('900 100px "Big Shoulders Display"'),
    document.fonts.load('800 100px "Big Shoulders Display"'),
    document.fonts.load('700 40px "Geist Mono"'),
  ]).catch(() => {});
  const backTex = await texture(null, renderer);
  const cards = await Promise.all(HAND.map(async (c) => makeCard(await texture(c, renderer), backTex)));
  const table = makeCard(await texture({ suit: 'ember', kind: 'num', rank: 4 }, renderer), backTex);
  const rig = new THREE.Group();
  rig.add(...cards, table);
  scene.add(rig);

  let progress = 0;
  let pointer = { x: 0, y: 0 };
  let smooth = { x: 0, y: 0 };
  let layout = {};
  let running = true;
  let visible = true;
  const clock = new THREE.Clock();

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
    const narrow = camera.aspect < 0.9;
    layout = narrow
      ? { fanX: 0, fanY: -1.35, fanScale: Math.min(0.72, halfW / 2.3), runX: -halfW * 0.6, runY: -1.05, step: halfW * 0.4, scale: Math.min(0.68, halfW / 2.2) }
      : { fanX: Math.min(halfW * 0.56, 2.6), fanY: -0.05, fanScale: Math.min(1, halfW / 3.4), runX: Math.max(halfW * 0.04, 0), runY: 0.05, step: 0.66, scale: 0.92 };
  }

  function fanPose(i, t) {
    const slot = FAN_SLOT[i];
    const a = (slot - 3) * 0.17;
    const r = 2.6 * layout.fanScale;
    return {
      x: layout.fanX + Math.sin(a) * r,
      y: layout.fanY + Math.cos(a) * r - r + Math.sin(t * 0.9 + slot) * 0.035,
      z: slot * 0.03,
      rx: -0.12 + Math.sin(t * 0.6 + slot * 0.5) * 0.03,
      ry: -0.28,
      rz: -a,
      s: layout.fanScale,
    };
  }

  function runPose(i, t, splash) {
    const wave = splash * Math.max(0, Math.sin(t * 5 - i * 0.9)) * 0.22;
    return {
      x: layout.runX + (i + 1) * layout.step * layout.scale * 1.08,
      y: layout.runY + wave + (i % 2 ? 0.04 : -0.03),
      z: 0.05 + i * 0.03,
      rx: -0.05,
      ry: 0,
      rz: [0.04, -0.03, 0.05, -0.02][i] || 0,
      s: layout.scale,
    };
  }

  function apply(obj, p, k) {
    obj.position.x = lerp(obj.position.x, p.x, k);
    obj.position.y = lerp(obj.position.y, p.y, k);
    obj.position.z = lerp(obj.position.z, p.z, k);
    obj.rotation.x = lerp(obj.rotation.x, p.rx, k);
    obj.rotation.y = lerp(obj.rotation.y, p.ry, k);
    obj.rotation.z = lerp(obj.rotation.z, p.rz, k);
    obj.scale.setScalar(lerp(obj.scale.x, p.s, k));
  }

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const k = 1 - Math.exp(-dt * 7);
    smooth.x = lerp(smooth.x, pointer.x, k * 0.6);
    smooth.y = lerp(smooth.y, pointer.y, k * 0.6);
    rig.rotation.y = smooth.x * 0.14;
    rig.rotation.x = -smooth.y * 0.08;

    const p = progress;
    const splash = clamp01((p - 0.66) / 0.12);
    // The table card flips into place first.
    const tIn = ease(clamp01(p / 0.12));
    apply(table, {
      x: layout.runX, y: layout.runY, z: 0, rx: -0.05,
      ry: lerp(Math.PI, 0, tIn), rz: -0.06, s: layout.scale * lerp(0.6, 1, tIn),
    }, k);
    table.visible = p > 0.005;

    cards.forEach((card, i) => {
      const fan = fanPose(i, t);
      if (i < RUN) {
        // Each card in the run leaves the hand in turn, arcing over to the pile.
        const local = easeInOut(clamp01((p - 0.12 - i * 0.12) / 0.2));
        const run = runPose(i, t, splash);
        const arc = Math.sin(local * Math.PI) * 0.7;
        apply(card, {
          x: lerp(fan.x, run.x, local),
          y: lerp(fan.y, run.y, local) + arc,
          z: lerp(fan.z, run.z, local) + arc * 0.6,
          rx: lerp(fan.rx, run.rx, local),
          ry: lerp(fan.ry, run.ry, local) + Math.sin(local * Math.PI) * 0.5,
          rz: lerp(fan.rz, run.rz, local),
          s: lerp(fan.s, run.s, local),
        }, k);
      } else {
        // What's left of the hand slides down and out of the way.
        const away = ease(clamp01((p - 0.2) / 0.5));
        apply(card, { ...fan, y: fan.y - away * 4.2, x: fan.x + away * 0.8, rz: fan.rz - away * 0.4 }, k);
      }
    });
    renderer.render(scene, camera);
  }

  resize();
  addEventListener('resize', resize);
  // Start everything in its resting pose so the first frame doesn't fly in from 0,0.
  cards.forEach((c, i) => {
    const f = fanPose(i, 0);
    c.position.set(f.x, f.y, f.z);
    c.rotation.set(f.rx, f.ry, f.rz);
    c.scale.setScalar(f.s);
  });
  table.position.set(layout.runX, layout.runY, 0);
  table.scale.setScalar(0.001);
  frame();

  return {
    setProgress: (p) => { progress = clamp01(p); },
    setPointer: (x, y) => { pointer = { x, y }; },
    setVisible: (v) => { visible = v; },
    dispose: () => {
      running = false;
      removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}
