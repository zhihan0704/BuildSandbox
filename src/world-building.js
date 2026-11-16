import * as THREE from 'three';
import { Batch, material, shape } from './world-geometry.js';
import { randomSource } from './world-textures.js';

export function createBuilding(spec = {}) {
  const width = spec.width ?? 22;
  const depth = spec.depth ?? 16;
  const height = spec.floorHeight ?? 2.65;
  const count = 12;
  const building = new THREE.Group();
  building.name = 'Building A';
  building.userData.entityId = 'building';
  building.position.set(...(spec.position ?? [-7, 0, -5]));

  const concrete = material(0xd6c8af);
  const fascia = material(0xc2b18e);
  const wall = material(0xa39880);
  const structuralMetal = material(0x5c5750, { roughness: 0.51, metalness: 0.30 });
  const frame = material(0x334047, { roughness: 0.49, metalness: 0.38 });
  const glass = material(0x45646b, { roughness: 0.24, metalness: 0.26 });
  const glassLight = material(0x596f73, { roughness: 0.26, metalness: 0.14, emissive: 0xffbb58, emissiveIntensity: 0 });
  const shade = material(0x403b33);
  const plank = material(0xa97843);
  const scaffold = material(0xc38836, { roughness: 0.43, metalness: 0.24 });
  const roofSurface = material(0x777164);
  const safety = material(0xcf994e);
  const snowMaterial = material(0xecf4fc, { transparent: true, opacity: 0, roughness: 0.92, depthWrite: false });
  const random = randomSource(404);

  const foundationBatch = new Batch();
  foundationBatch.box(shade, 0, 0.012, 0, width + 1.8, 0.035, depth + 1.7);
  foundationBatch.box(wall, 0, 0.14, 0, width + 0.55, 0.28, depth + 0.48, { cast: true });
  foundationBatch.box(concrete, 0, 0.30, 0, width, 0.22, depth, { cast: true });
  const xs = [-0.44, -0.22, 0, 0.22, 0.44].map(v => v * width);
  const zs = [-0.42, 0, 0.42].map(v => v * depth);
  const reinforcementBatch = new Batch();
  for (const x of xs) {
    for (const z of zs) {
      reinforcementBatch.box(fascia, x, 0.53, z, 1.5, 0.24, 1.5);
      for (const a of [-0.28, 0.28]) {
        for (const b of [-0.28, 0.28]) reinforcementBatch.box(structuralMetal, x + a, 1.05, z + b, 0.055, 1.10, 0.055);
      }
      reinforcementBatch.box(structuralMetal, x, 0.88, z, 0.58, 0.036, 0.58);
    }
  }
  const foundation = foundationBatch.build();
  const reinforcement = reinforcementBatch.build();
  building.add(foundation, reinforcement);

  const floors = [];
  for (let level = 0; level < count; level++) {
    const root = new THREE.Group();
    root.position.y = height * level;
    const columns = new Batch();
    for (const x of xs) {
      for (const z of zs) {
        columns.box(concrete, x, height * 0.52, z, 0.57, height - 0.03, 0.57, { cast: true });
        columns.box(wall, x, 0.15, z, 0.79, 0.25, 0.79);
      }
    }
    columns.box(wall, -1.95, height / 2, -1.17, 0.38, height, 3.72, { cast: true });
    columns.box(wall, 1.95, height / 2, -1.17, 0.38, height, 3.72, { cast: true });
    columns.box(wall, 0, height / 2, -2.95, 4.25, height, 0.4, { cast: true });
    columns.box(structuralMetal, 0, 1.2, -1.0, 1.4, 2.05, 0.14);

    const beams = new Batch();
    for (const z of zs) beams.box(fascia, 0, height - 0.38, z, width * 0.92, 0.38, 0.49, { cast: true });
    for (const x of xs) beams.box(fascia, x, height - 0.38, 0, 0.43, 0.38, depth * 0.89, { cast: true });

    const deck = new Batch();
    deck.box(concrete, 0, height - 0.14, 0, width, 0.28, depth, { cast: true });
    deck.box(fascia, 0, height - 0.26, 0, width + 0.18, 0.10, depth + 0.18);

    const envelope = new Batch();
    function bay(x, z, size, yaw, lit, solid) {
      const short = Math.abs(Math.sin(yaw)) > 0.5;
      const offset = Math.sign(short ? Math.sin(yaw) : Math.cos(yaw));
      const directionX = short ? offset : 0;
      const directionZ = short ? 0 : offset;
      const nextX = (v) => x + (short ? 0 : v);
      const nextZ = (v) => z + (short ? v : 0);
      const block = (mat, localX, y, outward, w, h, d) => envelope.box(mat, nextX(localX) + outward * directionX, y, nextZ(localX) + outward * directionZ, w, h, d, { yaw });
      block(fascia, 0, 0.13, 0, size + 0.02, 0.32, 0.31);
      block(concrete, 0, height - 0.15, 0, size + 0.02, 0.35, 0.39);
      block(frame, 0, height * 0.48, -0.015, size - 0.15, height - 0.53, 0.13);
      if (solid) {
        block(wall, 0, height * 0.47, 0.055, size - 0.45, height - 0.65, 0.22);
      } else {
        block(lit ? glassLight : glass, 0, height * 0.48, 0.057, size - 0.40, height - 0.75, 0.10);
        block(frame, 0, height * 0.48, 0.14, 0.085, height - 0.62, 0.08);
        block(frame, 0, 0.78, 0.14, size - 0.23, 0.066, 0.08);
      }
      block(concrete, -size * 0.5 + 0.09, height / 2, 0.11, 0.23, height, 0.34);
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const gap = width / 6;
        bay(-width / 2 + gap * (i + 0.5), side * depth / 2, gap, side > 0 ? 0 : Math.PI, random() > 0.65, i === 0 && side < 0);
      }
      for (let i = 0; i < 4; i++) {
        const gap = depth / 4;
        bay(side * width / 2, -depth / 2 + gap * (i + 0.5), gap, side * Math.PI / 2, random() > 0.63, i === 3);
      }
    }

    const scaffolding = new Batch();
    const face = depth / 2 + 1.15;
    for (let i = 0; i <= 6; i++) {
      const x = -width / 2 + (width / 6) * i;
      for (const offset of [0, -0.88]) scaffolding.box(scaffold, x, height * 0.52, face + offset, 0.105, height + 0.1, 0.105);
      if (i < 6) {
        const next = x + width / 6;
        scaffolding.rod(scaffold, [x, 0.08, face], [next, height * 0.80, face], 0.087);
        scaffolding.rod(scaffold, [x, height * 0.80, face], [next, 0.08, face], 0.077);
        scaffolding.box(plank, (x + next) / 2, 0.21, face - 0.45, width / 6 - 0.07, 0.12, 0.77);
      }
    }
    for (const y of [0.12, 0.88, height * 0.82]) scaffolding.box(scaffold, 0, y, face, width + 0.25, 0.085, 0.085);
    const sideX = width / 2 + 1.04;
    for (const z of [-depth / 2, -depth / 4, 0, depth / 4, depth / 2]) {
      scaffolding.box(scaffold, sideX, height * 0.51, z, 0.105, height + 0.09, 0.105);
      if (z < depth / 2) scaffolding.rod(scaffold, [sideX, 0.10, z], [sideX, height * 0.83, z + depth / 4], 0.076);
    }
    for (const y of [0.16, height * 0.82]) scaffolding.box(scaffold, sideX, y, 0, 0.082, 0.086, depth + 0.35);
    scaffolding.box(plank, sideX - 0.38, 0.19, 0, 0.77, 0.10, depth);

    const safetyBatch = new Batch();
    for (const x of xs) {
      for (const z of [-depth / 2 + 0.10, depth / 2 - 0.10]) {
        safetyBatch.box(safety, x, height + 0.49, z, 0.092, 1.0, 0.092);
      }
    }
    for (const z of [-depth / 2 + 0.10, depth / 2 - 0.10]) {
      for (const y of [height + 0.42, height + 0.94]) safetyBatch.box(safety, 0, y, z, width - 0.5, 0.075, 0.075);
    }
    for (const x of [-width / 2 + 0.1, width / 2 - 0.1]) {
      safetyBatch.box(safety, x, height + 0.46, 0, 0.087, 0.087, depth - 0.35);
      safetyBatch.box(safety, x, height + 0.94, 0, 0.087, 0.087, depth - 0.35);
    }

    const floor = {
      root, columns: columns.build(), beams: beams.build(), deck: deck.build(),
      envelope: envelope.build(), scaffolding: scaffolding.build(), safety: safetyBatch.build(),
    };
    root.add(floor.columns, floor.beams, floor.deck, floor.envelope, floor.scaffolding, floor.safety);
    building.add(root);
    floors.push(floor);
  }

  const roofBatch = new Batch();
  roofBatch.box(roofSurface, 0, 0.075, 0, width - 0.38, 0.14, depth - 0.38);
  for (const z of [-depth / 2, depth / 2]) roofBatch.box(concrete, 0, 0.52, z, width + 0.14, 1.04, 0.35, { cast: true });
  for (const x of [-width / 2, width / 2]) roofBatch.box(concrete, x, 0.52, 0, 0.35, 1.04, depth, { cast: true });
  roofBatch.box(wall, -1.68, 1.1, -2.0, 4.85, 2.25, 4.62, { cast: true });
  roofBatch.box(fascia, -1.68, 2.28, -2.0, 5.0, 0.22, 4.78);
  roofBatch.box(frame, -2.2, 1.03, 0.33, 1.08, 1.84, 0.10);
  for (const z of [-3.0, -0.83, 1.34]) {
    roofBatch.box(wall, 4.9, 0.53, z, 2.6, 0.88, 1.53, { cast: true });
    roofBatch.box(structuralMetal, 4.9, 1.02, z, 1.68, 0.11, 1.15);
    roofBatch.add(shape.cylinder, frame, [4.9, 1.12, z], [0.94, 0.09, 0.94]);
  }
  const roof = roofBatch.build();
  roof.position.y = count * height;
  building.add(roof);

  const snow = new THREE.Mesh(shape.box, snowMaterial);
  snow.scale.set(width - 0.52, 0.038, depth - 0.54);
  snow.receiveShadow = true;
  building.add(snow);

  function update(state) {
    const { completedFloors = 0, floors: visibleFloors = 0, floorProgress = 1, facadeFloors = 0, finished = false } = state;
    reinforcement.visible = visibleFloors < 1;
    const topReady = Math.min(completedFloors, count);
    for (let i = 0; i < floors.length; i++) {
      const floor = floors[i];
      const installed = i < completedFloors;
      const active = i === visibleFloors - 1;
      const progress = installed ? 1 : floorProgress;
      floor.root.visible = i < visibleFloors;
      floor.columns.visible = progress >= 0.0;
      floor.beams.visible = progress >= 0.32;
      floor.deck.visible = progress >= 0.60;
      floor.envelope.visible = i < facadeFloors;
      floor.scaffolding.visible = !finished && state.day >= 5 && i >= visibleFloors - 2 && progress >= 0.33;
      floor.safety.visible = !finished && (active || i === topReady - 1) && progress >= 0.60 && i >= facadeFloors;
    }
    roof.visible = topReady >= count;
    const snowDepth = state.snow ?? 0;
    snow.visible = snowDepth > 0.015;
    snow.position.y = Math.max(0.43, topReady * height + (roof.visible ? 0.165 : 0.018));
    snowMaterial.opacity = Math.min(1, snowDepth * 1.05);
    glassLight.emissiveIntensity = state.lightsOn ? 0.54 : 0;
  }

  return { building, update, snow, windowLight: glassLight };
}
