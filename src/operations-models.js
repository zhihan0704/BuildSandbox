import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function material(color, roughness = 0.7, metalness = 0.08) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

const palette = {
  amber: material('#f0ac2b', 0.46),
  orange: material('#d96f34', 0.52),
  cream: material('#e6e1d4', 0.5),
  rubber: material('#222522', 0.96),
  black: material('#343733', 0.74),
  dark: material('#464b46', 0.66, 0.36),
  frame: material('#667168', 0.6, 0.35),
  metal: material('#a4a89a', 0.39, 0.59),
  glass: material('#456264', 0.26, 0.22),
  yellowGlass: material('#b5a26b', 0.39, 0.22),
  red: material('#992f23'),
  wood: material('#9a7952', 0.95),
  skin: material('#b57a5a'),
  khaki: material('#60604c'),
  navy: material('#344955'),
  hiVis: material('#f4ce63'),
  headLamp: new THREE.MeshStandardMaterial({ color: '#f5e5bb', emissive: '#ffba54', emissiveIntensity: 0, roughness: 0.44 }),
  tailLamp: new THREE.MeshStandardMaterial({ color: '#ad3321', emissive: '#ff511c', emissiveIntensity: 0, roughness: 0.5 }),
  snow: material('#edf0e7', 0.87, 0),
};

const shapes = {
  box: new THREE.BoxGeometry(1, 1, 1),
  soft: new RoundedBoxGeometry(1, 1, 1, 2, 0.10),
  cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  drum: new THREE.CylinderGeometry(0.5, 0.35, 1, 16),
  ball: new THREE.SphereGeometry(0.5, 10, 6),
  helmet: new THREE.SphereGeometry(0.5, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
};

const spinZ = [Math.PI / 2, 0, 0];
const axleOrientation = [0, 0, Math.PI / 2];
const yAxis = new THREE.Vector3(0, 1, 0);
const orientation = new THREE.Euler();
const quaternion = new THREE.Quaternion();
const vector = new THREE.Vector3();
const point = new THREE.Vector3();
const scaleVector = new THREE.Vector3();

function transform(size, location, rotation = [0, 0, 0]) {
  quaternion.setFromEuler(orientation.set(...rotation));
  return new THREE.Matrix4().compose(point.set(...location), quaternion, scaleVector.set(...size));
}

function item(parent, name, position = [0, 0, 0]) {
  const node = new THREE.Group();
  node.name = name;
  node.position.set(...position);
  parent.add(node);
  return node;
}

class Parts {
  constructor(parent) {
    this.parent = parent;
    this.groups = new Map();
  }

  add(size, location, finish, shape = 'box', rotation) {
    this.addMatrix(shape, finish, transform(size, location, rotation));
  }

  addMatrix(shape, finish, matrix) {
    const coating = palette[finish];
    if (!this.groups.has(coating)) this.groups.set(coating, []);
    const geometry = shapes[shape];
    const prepared = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    this.groups.get(coating).push(prepared.applyMatrix4(matrix));
  }

  beam(start, end, width, finish, depth = width) {
    const direction = new THREE.Vector3(...end).sub(vector.set(...start));
    const length = direction.length();
    quaternion.setFromUnitVectors(yAxis, direction.normalize());
    point.set(...start).lerp(vector.set(...end), 0.5);
    const matrix = new THREE.Matrix4().compose(point, quaternion, scaleVector.set(width, length, depth));
    this.addMatrix('box', finish, matrix);
  }

  build(castShadow = true) {
    for (const [coating, geometries] of this.groups) {
      const geometry = mergeGeometries(geometries);
      for (const input of geometries) input.dispose();
      const mesh = new THREE.Mesh(geometry, coating);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      this.parent.add(mesh);
    }
  }
}

function single(parent, name, size, position, finish, shape = 'box') {
  const mesh = new THREE.Mesh(shapes[shape], palette[finish]);
  mesh.name = name;
  mesh.scale.set(...size);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// The instances take transforms from rig joints. Small actors stay individually
// inspectable while using only a few material and geometry batches.
export function createPartPool(scene) {
  const batches = new Map();
  const frame = new THREE.Matrix4();

  function add(root, joint, size, location, finish, shape = 'box', rotation) {
    const id = `${shape}:${finish}`;
    if (!batches.has(id)) {
      const mesh = new THREE.InstancedMesh(shapes[shape], palette[finish], 360);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.castShadow = finish !== 'metal' && finish !== 'skin';
      mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.name = `Actors / ${id}`;
      scene.add(mesh);
      batches.set(id, { mesh, parts: [] });
    }
    batches.get(id).parts.push({ root, joint, local: transform(size, location, rotation) });
  }

  function update() {
    for (const { mesh, parts } of batches.values()) {
      let count = 0;
      for (const part of parts) {
        if (!part.root.visible) continue;
        mesh.setMatrixAt(count, frame.multiplyMatrices(part.joint.matrixWorld, part.local));
        count += 1;
      }
      mesh.count = count;
      mesh.visible = count > 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  return { add, update };
}

function wheel(root, pool, x, z, radius, steering, width = 0.34) {
  const steer = item(root, 'Steering kingpin', [x, radius, z]);
  const roll = item(steer, 'Wheel axle');
  pool.add(root, roll, [radius * 2, width, radius * 2], [0, 0, 0], 'rubber', 'cylinder', axleOrientation);
  pool.add(root, roll, [radius * 1.20, width + 0.022, radius * 1.20], [0, 0, 0], 'metal', 'cylinder', axleOrientation);
  pool.add(root, roll, [radius * 0.37, width + 0.09, radius * 0.37], [0, 0, 0], 'dark', 'cylinder', axleOrientation);
  return { steer, roll, steering, radius };
}

function cabin(parts, finish) {
  parts.add([2.35, 1.34, 1.65], [0, 1.54, 2.04], finish, 'soft');
  parts.add([2.24, 0.96, 1.53], [0, 2.53, 2.05], finish, 'soft');
  parts.add([1.95, 0.64, 0.034], [0, 2.58, 2.822], 'glass', 'soft', [-0.10, 0, 0]);
  parts.add([0.045, 0.68, 0.05], [0, 2.60, 2.84], finish);
  parts.add([1.78, 0.33, 0.045], [0, 1.52, 2.89], 'dark', 'soft');
  parts.add([2.40, 0.20, 0.30], [0, 0.87, 2.89], 'black', 'soft');
  for (let level = 0; level < 3; level += 1) {
    parts.add([1.65, 0.025, 0.02], [0, 1.42 + level * 0.10, 2.921], 'metal');
  }
  for (const side of [-1, 1]) {
    parts.add([0.030, 0.63, 0.90], [side * 1.13, 2.58, 2.20], 'glass', 'soft');
    parts.add([0.055, 0.040, 0.34], [side * 1.18, 1.90, 1.81], 'dark');
    parts.add([0.043, 0.09, 0.35], [side * 1.18, 1.13, 1.61], 'metal');
    parts.add([0.28, 0.19, 0.049], [side * 0.91, 1.22, 2.90], 'headLamp', 'soft');
    parts.add([0.26, 0.14, 0.045], [side * 0.88, 0.83, -3.10], 'tailLamp', 'soft');
    parts.beam([side * 1.07, 2.34, 2.42], [side * 1.44, 2.41, 2.62], 0.07, 'black');
    parts.add([0.16, 0.34, 0.19], [side * 1.44, 2.48, 2.61], 'dark', 'soft');
  }
  parts.add([0.24, 0.17, 0.24], [0, 3.08, 1.72], 'headLamp', 'cylinder');
}

export function makeTruck(pool, mixer = false) {
  const root = new THREE.Group();
  const body = new Parts(root);
  body.add([2.03, 0.35, 6.1], [0, 0.77, -0.12], 'black', 'soft');
  body.add([1.74, 0.51, 1.16], [0, 0.81, -0.06], 'metal', 'soft');
  cabin(body, mixer ? 'cream' : 'orange');
  const wheels = [];
  for (const side of [-1, 1]) {
    for (const z of [1.85, -1.36, -2.40]) {
      wheels.push(wheel(root, pool, side * 1.03, z, 0.56, z > 0));
    }
  }

  const door = item(root, 'Cargo gate', [0, 1.23, -3.08]);
  const drum = item(root, 'Mixer drum spindle', [0, 2.25, -1.25]);
  let snowCap;
  if (mixer) {
    const drumParts = new Parts(drum);
    drumParts.add([1.98, 2.68, 1.98], [0, 0, 0], 'cream', 'drum', spinZ);
    for (let step = 0; step < 12; step += 1) {
      const angle = step / 12 * Math.PI * 2;
      drumParts.add([0.45, 0.19, 0.54], [Math.cos(angle) * 0.91, Math.sin(angle) * 0.91, 0.52], 'orange', 'soft', [0, 0, angle - Math.PI / 2]);
    }
    drumParts.build();
    body.add([1.43, 0.78, 0.46], [0, 1.50, -2.78], 'frame', 'soft');
    body.add([0.96, 0.65, 0.43], [0, 2.90, -2.77], 'metal', 'soft');
    body.beam([0, 1.94, -2.75], [0, 1.17, -3.55], 0.31, 'metal', 0.34);
    snowCap = single(root, 'Cab snow cover', [1.96, 0.082, 1.20], [0, 3.01, 2.02], 'snow', 'soft');
  } else {
    body.add([2.27, 0.19, 4.19], [0, 1.16, -0.96], 'dark', 'soft');
    body.add([1.95, 0.07, 3.77], [0, 1.29, -0.93], 'wood');
    body.add([1.90, 0.71, 0.09], [0, 1.57, 1.10], 'frame', 'soft');
    for (const side of [-1, 1]) {
      body.add([0.086, 0.44, 4.15], [side * 1.12, 1.45, -0.99], 'frame', 'soft');
      body.add([0.11, 0.067, 4.17], [side * 1.13, 1.67, -0.99], 'metal');
      for (const z of [-2.65, -1.60, -0.55, 0.48]) {
        body.add([0.108, 0.44, 0.067], [side * 1.13, 1.45, z], 'metal');
      }
    }
    single(door, 'Tailgate panel', [2.14, 0.44, 0.087], [0, 0.22, 0], 'frame', 'soft');
    snowCap = single(root, 'Cab snow cover', [1.96, 0.082, 1.20], [0, 3.01, 2.02], 'snow', 'soft');
  }
  body.build();
  return { root, wheels, door, drum, snowCap };
}

export function makeForklift(pool) {
  const root = new THREE.Group();
  const body = new Parts(root);
  body.add([1.44, 0.62, 2.11], [0, 0.62, -0.20], 'amber', 'soft');
  body.add([1.43, 0.74, 1.02], [0, 0.90, -0.76], 'amber', 'soft');
  body.add([1.49, 0.18, 0.63], [0, 0.61, -1.21], 'black', 'soft');
  body.add([0.50, 0.43, 0.47], [0, 1.18, -0.28], 'black', 'soft');
  body.add([0.92, 0.11, 1.15], [0, 2.50, -0.09], 'dark', 'soft');
  body.add([0.22, 0.14, 0.22], [0.31, 2.62, -0.28], 'headLamp', 'cylinder');
  const wheels = [];
  for (const side of [-1, 1]) {
    body.beam([side * 0.42, 0.96, -0.67], [side * 0.42, 2.46, -0.63], 0.10, 'dark');
    body.beam([side * 0.42, 0.92, 0.57], [side * 0.42, 2.46, 0.47], 0.10, 'dark');
    body.add([0.15, 2.32, 0.16], [side * 0.40, 1.29, 0.93], 'dark');
    body.add([0.050, 2.14, 0.07], [side * 0.37, 1.26, 1.025], 'metal');
    wheels.push(wheel(root, pool, side * 0.67, 0.61, 0.40, false, 0.31));
    wheels.push(wheel(root, pool, side * 0.59, -0.85, 0.28, true, 0.25));
  }
  body.add([0.74, 0.11, 0.14], [0, 2.25, 0.94], 'dark');
  body.add([0.36, 0.49, 0.35], [0, 1.56, -0.27], 'navy', 'soft');
  body.add([0.29, 0.29, 0.29], [0, 1.95, -0.24], 'skin', 'ball');
  body.add([0.33, 0.33, 0.33], [0, 2.02, -0.24], 'hiVis', 'helmet');
  body.build();
  const lift = item(root, 'Lift carriage', [0, 0.14, 0.99]);
  const carriage = new Parts(lift);
  carriage.add([0.99, 0.44, 0.13], [0, 0.22, 0], 'dark', 'soft');
  for (const side of [-1, 1]) {
    carriage.add([0.14, 0.075, 1.12], [side * 0.32, 0.02, 0.56], 'metal', 'soft');
  }
  carriage.build();
  const snowCap = single(root, 'Overhead cover snow', [0.79, 0.07, 0.98], [0, 2.58, -0.09], 'snow', 'soft');
  return { root, wheels, lift, snowCap };
}

export function makeCrane() {
  const root = new THREE.Group();
  const base = new Parts(root);
  base.add([3.84, 0.34, 3.62], [0, 0.17, 0], 'frame', 'soft');
  base.add([2.4, 0.33, 2.4], [0, 0.48, 0], 'dark');
  base.build();
  const tower = item(root, 'Lattice mast');
  const towerParts = new Parts(tower);
  const sectionHeight = 1.6;
  const mastModelHeight = sectionHeight * 13;
  for (const x of [-0.81, 0.81]) {
    for (const z of [-0.81, 0.81]) {
      towerParts.add([0.14, mastModelHeight, 0.14], [x, mastModelHeight / 2, z], 'amber');
    }
  }
  for (let i = 0; i < 13; i += 1) {
    const y = i * sectionHeight;
    const nextY = (i + 1) * sectionHeight;
    for (const side of [-1, 1]) {
      towerParts.beam([-0.81, y, side * 0.81], [0.81, y, side * 0.81], 0.077, 'amber');
      towerParts.beam([side * 0.81, y, -0.81], [side * 0.81, y, 0.81], 0.077, 'amber');
      towerParts.beam([i % 2 ? 0.81 : -0.81, y, side * 0.81], [i % 2 ? -0.81 : 0.81, nextY, side * 0.81], 0.066, 'amber');
      towerParts.beam([side * 0.81, y, i % 2 ? 0.81 : -0.81], [side * 0.81, nextY, i % 2 ? -0.81 : 0.81], 0.066, 'amber');
    }
  }
  towerParts.build();

  const jib = item(root, 'Slewing ring');
  const upper = new Parts(jib);
  upper.add([2.45, 0.46, 2.25], [0, 0, 0], 'dark', 'cylinder');
  upper.add([1.45, 1.28, 1.19], [0.54, 0.62, 1.04], 'cream', 'soft');
  upper.add([0.028, 0.89, 1.04], [1.279, 0.67, 1.05], 'glass');
  upper.add([1.22, 0.91, 0.025], [0.54, 0.68, 1.648], 'glass');
  upper.add([1.53, 0.15, 1.27], [0.54, 1.28, 1.04], 'amber', 'soft');
  upper.add([1.13, 0.38, 0.84], [-1.32, 0.32, 0], 'metal');
  upper.beam([0, 1.2, 0], [0, 4.4, 0], 0.16, 'amber');
  upper.beam([0, 4.25, 0], [21.75, 1.17, 0], 0.045, 'dark');
  upper.beam([0, 4.25, 0], [-7.10, 1.03, 0], 0.050, 'dark');
  for (const z of [-0.38, 0.38]) {
    upper.beam([-7.6, 0.24, z], [23.8, 0.24, z], 0.115, 'amber');
    upper.beam([-7.6, 1.05, z], [23.8, 1.05, z], 0.10, 'amber');
    for (let x = -7.5; x < 23.6; x += 1.73) {
      upper.beam([x, 0.24, z], [Math.min(x + 1.55, 23.75), 1.05, z], 0.067, 'amber');
      upper.beam([x, 0.24, z], [x, 1.05, z], 0.063, 'amber');
    }
  }
  for (let i = 0; i < 4; i += 1) upper.add([0.48, 1.23, 1.11], [-7.15 + i * 0.51, 0.42, 0], 'frame', 'soft');
  upper.add([0.30, 0.29, 0.30], [23.57, 1.27, 0], 'tailLamp', 'ball');
  upper.add([0.35, 0.27, 0.35], [0, 4.47, 0], 'headLamp', 'ball');
  upper.build();

  const trolley = item(jib, 'Trolley carriage');
  single(trolley, 'Travel carriage', [0.81, 0.35, 0.92], [0, 0.04, 0], 'dark', 'soft');
  const cable = single(trolley, 'Wire rope', [0.048, 1, 0.048], [0, -0.5, 0], 'dark', 'cylinder');
  cable.castShadow = false;
  const hook = item(trolley, 'Hook block');
  single(hook, 'Hook block casing', [0.39, 0.24, 0.28], [0, 0, 0], 'amber', 'soft');
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.035, 5, 12, Math.PI * 1.7), palette.dark);
  eye.position.y = -0.20;
  eye.rotation.z = Math.PI / 4;
  hook.add(eye);
  return { root, tower, mastModelHeight, jib, trolley, cable, hook };
}

export function makeExcavator() {
  const root = new THREE.Group();
  const base = new Parts(root);
  for (const side of [-1, 1]) {
    base.add([0.59, 0.83, 3.77], [side * 1.08, 0.44, 0], 'rubber', 'soft');
    for (let z = -1.68; z < 1.75; z += 0.23) {
      base.add([0.62, 0.055, 0.09], [side * 1.08, 0.86, z], 'metal');
    }
  }
  base.add([1.85, 0.63, 2.48], [0, 0.57, -0.07], 'dark', 'soft');
  base.add([1.72, 0.31, 1.72], [0, 1.06, 0.01], 'frame', 'cylinder');
  base.build();
  const swivel = item(root, 'Excavator slew');
  const platform = new Parts(swivel);
  platform.add([2.54, 0.61, 2.8], [0, 1.32, -0.40], 'amber', 'soft');
  platform.add([2.44, 1.03, 1.42], [0, 1.85, -1.03], 'amber', 'soft');
  platform.add([0.98, 1.48, 1.36], [-0.61, 2.11, 0.47], 'amber', 'soft');
  platform.add([0.82, 0.95, 0.028], [-0.61, 2.26, 1.153], 'glass', 'soft');
  platform.add([0.028, 0.96, 1.04], [-1.11, 2.26, 0.52], 'glass', 'soft');
  platform.add([0.32, 0.18, 0.32], [-0.56, 2.94, 0.33], 'headLamp', 'cylinder');
  platform.build();
  const boom = item(swivel, 'Excavator boom pivot', [0.54, 1.66, 0.49]);
  const boomParts = new Parts(boom);
  boomParts.beam([0, 0, 0], [0, 1.34, 1.28], 0.35, 'amber', 0.40);
  boomParts.beam([0, 1.34, 1.28], [0, 1.48, 2.64], 0.28, 'amber', 0.34);
  boomParts.beam([0.20, 0.10, 0.22], [0.20, 1.37, 1.72], 0.09, 'metal');
  boomParts.build();
  const arm = item(boom, 'Excavator arm pivot', [0, 1.48, 2.64]);
  const armParts = new Parts(arm);
  armParts.beam([0, 0, 0], [0, -1.48, 1.25], 0.25, 'amber', 0.32);
  armParts.beam([0.18, 0.08, 0.04], [0.18, -1.35, 1.15], 0.073, 'metal');
  armParts.build();
  const bucket = item(arm, 'Excavator bucket pivot', [0, -1.48, 1.25]);
  const bucketParts = new Parts(bucket);
  bucketParts.add([0.95, 0.38, 0.73], [0, -0.10, 0.24], 'dark', 'soft');
  bucketParts.add([0.86, 0.12, 0.45], [0, -0.24, 0.63], 'metal');
  for (const x of [-0.33, -0.11, 0.11, 0.33]) bucketParts.add([0.095, 0.11, 0.20], [x, -0.25, 0.90], 'metal');
  bucketParts.build();
  return { root, swivel, boom, arm, bucket };
}

export function makeWorker(pool, index) {
  const root = new THREE.Group();
  const pose = item(root, 'Worker rig');
  const trunk = item(pose, 'Torso joint', [0, 0.95, 0]);
  const coat = index % 3 === 0 ? 'hiVis' : 'orange';
  const pants = index % 2 === 0 ? 'navy' : 'khaki';
  const head = index % 4 === 0 ? 'cream' : 'amber';
  pool.add(root, trunk, [0.49, 0.56, 0.28], [0, 0.24, 0], coat);
  pool.add(root, trunk, [0.505, 0.071, 0.29], [0, 0.10, 0], 'hiVis');
  pool.add(root, trunk, [0.258, 0.27, 0.23], [0, 0.64, 0], 'skin', 'ball');
  pool.add(root, trunk, [0.325, 0.29, 0.33], [0, 0.70, 0], head, 'helmet');
  pool.add(root, trunk, [0.36, 0.045, 0.36], [0, 0.70, 0.035], head, 'cylinder');
  const legs = [];
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = item(trunk, 'Shoulder', [side * 0.31, 0.44, 0]);
    pool.add(root, arm, [0.14, 0.48, 0.145], [0, -0.20, 0], coat);
    pool.add(root, arm, [0.14, 0.13, 0.14], [0, -0.46, 0], 'skin', 'ball');
    const leg = item(pose, 'Hip', [side * 0.13, 0.95, 0]);
    pool.add(root, leg, [0.20, 0.78, 0.21], [0, -0.39, 0], pants);
    pool.add(root, leg, [0.22, 0.18, 0.31], [0, -0.84, 0.075], 'rubber');
    legs.push(leg);
    arms.push(arm);
  }
  const hit = new THREE.Mesh(shapes.box, new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.9;
  hit.scale.set(0.67, 1.80, 0.55);
  hit.name = 'Worker inspection area';
  root.add(hit);
  return { root, pose, trunk, arms, legs };
}

export function makePallet() {
  const root = new THREE.Group();
  const parts = new Parts(root);
  for (const x of [-0.45, 0, 0.45]) parts.add([0.17, 0.10, 0.95], [x, 0.05, 0], 'wood');
  for (const z of [-0.38, -0.13, 0.13, 0.38]) parts.add([1.10, 0.07, 0.19], [0, 0.135, z], 'wood');
  for (const x of [-0.33, -0.11, 0.11, 0.33]) {
    for (const y of [0.245, 0.37, 0.495]) {
      parts.add([0.18, 0.10, 1.33], [x, y, 0], 'frame', 'soft');
    }
  }
  for (const z of [-0.45, 0.45]) {
    parts.add([0.93, 0.036, 0.062], [0, 0.562, z], 'amber');
    for (const x of [-0.47, 0.47]) parts.add([0.036, 0.42, 0.062], [x, 0.356, z], 'amber');
  }
  parts.build();
  return root;
}

export function makeCart() {
  const root = new THREE.Group();
  const parts = new Parts(root);
  parts.add([0.86, 0.075, 1.13], [0, 0.205, 0], 'dark', 'soft');
  for (const side of [-1, 1]) {
    parts.add([0.30, 0.14, 0.30], [side * 0.42, 0.15, -0.19], 'rubber', 'cylinder', axleOrientation);
    parts.beam([side * 0.39, 0.23, -0.52], [side * 0.39, 0.98, -0.85], 0.07, 'orange');
  }
  parts.beam([-0.42, 0.98, -0.85], [0.42, 0.98, -0.85], 0.082, 'orange');
  parts.build();
  return root;
}

export function setVehicleLights(lit) {
  palette.headLamp.emissiveIntensity = lit ? 2.3 : 0.07;
  palette.tailLamp.emissiveIntensity = lit ? 1.24 : 0.06;
}
