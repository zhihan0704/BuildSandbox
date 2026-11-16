import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Batch, material, shape } from './world-geometry.js';
import { blueprintTexture, randomSource, terrainTexture, walnutTexture } from './world-textures.js';
import { createBuilding } from './world-building.js';

const tableHeight = -3.15;

function box(parent, mat, position, size, bevel = 0, cast = false) {
  const geometry = bevel > 0 ? new RoundedBoxGeometry(...size, 2, bevel) : shape.box;
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(...position);
  if (bevel === 0) mesh.scale.set(...size);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function flat(parent, mat, x, y, z, width, depth) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function buildTable(parent) {
  const wood = walnutTexture();
  const walnut = material(0xffffff, { map: wood, roughness: 0.58 });
  const woodEdge = material(0x573722, { roughness: 0.61 });
  const mapleEdge = material(0x977048, { roughness: 0.62 });
  const graphite = material(0x333733);
  const paper = material(0xe3d5b8);
  const darkPaper = material(0x264960);
  const creamDrawing = material(0xffffff, { map: blueprintTexture(false) });
  const blueDrawing = material(0xffffff, { map: blueprintTexture(true) });
  const rulerWood = material(0xb88c50);
  const blackInk = material(0x393424);
  const brass = material(0xb8a478, { metalness: 0.44, roughness: 0.42 });
  const red = material(0x8f4936);

  box(parent, walnut, [0, tableHeight - 1.85, 0], [126, 3.7, 95], 0.58);
  box(parent, woodEdge, [0, tableHeight - 4.1, 0], [123.8, 1.18, 92.8], 0.25);
  box(parent, graphite, [0, -2.55, 0], [81.6, 1.12, 61.6], 0.25, true);
  box(parent, mapleEdge, [0, -1.84, 0], [81.0, 0.36, 61.0], 0.13);
  box(parent, graphite, [0, -0.99, 0], [80.55, 1.76, 60.55], 0.22);

  const desk = new THREE.Group();
  desk.position.y = tableHeight;
  parent.add(desk);
  function sheet(x, y, z, width, depth, yaw, drawing, baseMat) {
    const group = new THREE.Group();
    group.rotation.y = yaw;
    group.position.set(x, y, z);
    box(group, baseMat, [0, 0.07, 0], [width, 0.14, depth], 0, true);
    flat(group, drawing, 0, 0.146, 0, width, depth);
    desk.add(group);
  }
  sheet(-42.8, 0.01, 35.3, 22.3, 12.8, -0.22, blueDrawing, darkPaper);
  sheet(-28.1, 0.14, 37.9, 24.0, 13.9, -0.07, creamDrawing, paper);
  sheet(-48.8, 0.01, 8.4, 19.7, 12.9, Math.PI / 2 + 0.10, creamDrawing, paper);
  sheet(48.6, 0.01, -7.4, 20.7, 11.6, -Math.PI / 2 + 0.18, blueDrawing, darkPaper);
  sheet(44.1, 0.01, 36.1, 17.6, 9.0, 0.13, blueDrawing, darkPaper);

  const props = new Batch();
  const leftRoll = -47.4;
  props.add(shape.cylinder, paper, [leftRoll, 0.78, -11.9], [1.5, 13.4, 1.5], { roll: Math.PI / 2, yaw: -0.16, cast: true });
  props.add(shape.cylinder, darkPaper, [leftRoll + 6.75, 0.78, -10.8], [1.04, 0.16, 1.04], { roll: Math.PI / 2, yaw: -0.16 });
  props.add(shape.cylinder, paper, [leftRoll + 6.85, 0.78, -10.8], [0.69, 0.18, 0.69], { roll: Math.PI / 2, yaw: -0.16 });
  props.add(shape.cylinder, paper, [-44.9, 0.63, 23], [1.22, 10.0, 1.22], { pitch: Math.PI / 2, yaw: 0.28, cast: true });
  props.add(shape.cylinder, darkPaper, [-43.52, 0.63, 27.82], [0.82, 0.12, 0.82], { pitch: Math.PI / 2, yaw: 0.28 });
  props.build(desk);

  const tools = new THREE.Group();
  tools.position.set(7.5, 0.05, 36.5);
  tools.rotation.y = -0.21;
  const ruler = new Batch();
  ruler.box(rulerWood, 0, 0.16, 0, 20.6, 0.27, 1.8, { cast: true });
  ruler.box(brass, 10.12, 0.16, 0, 0.39, 0.30, 1.84);
  for (let i = 0; i <= 100; i++) {
    const length = i % 10 === 0 ? 0.68 : i % 5 === 0 ? 0.43 : 0.27;
    ruler.box(blackInk, -9.75 + i * 0.19, 0.302, -0.88 + length / 2, 0.036, 0.018, length);
  }
  ruler.box(red, 0.5, 0.22, 2.72, 9.4, 0.42, 0.40, { cast: true, yaw: -0.11 });
  ruler.box(paper, -4.32, 0.22, 2.20, 0.73, 0.39, 0.36, { yaw: -0.11 });
  ruler.box(blackInk, -4.73, 0.20, 2.15, 0.16, 0.24, 0.20);
  ruler.box(brass, 5.11, 0.22, 3.22, 0.48, 0.43, 0.42, { yaw: -0.11 });
  ruler.build(tools);
  desk.add(tools);
}

export function createWorld(scene, config = {}) {
  const root = new THREE.Group();
  root.name = 'Desktop construction diorama';
  scene.add(root);
  buildTable(root);

  const ground = material(0xffffff, { map: terrainTexture([111, 110, 101], 24, 13, [8, 6]) });
  const asphalt = material(0xffffff, { map: terrainTexture([71, 78, 78], 22, 14, [9, 4]), roughness: 0.88 });
  const gravel = material(0xffffff, { map: terrainTexture([164, 145, 115], 44, 18, [8, 6]), roughness: 0.96 });
  const paver = material(0xffffff, { map: terrainTexture([157, 151, 138], 22, 66, [7, 5]), roughness: 0.90 });
  const curb = material(0xbab7a7);
  const joint = material(0x7c7e72);
  const paint = material(0xe2d9c2, { roughness: 0.84 });
  const hazard = material(0xd5a94e);
  const lineYellow = material(0xc7a358);
  const siteMetal = material(0x635f52, { roughness: 0.49, metalness: 0.25 });
  const guard = material(0xb3aea0, { roughness: 0.54, metalness: 0.24 });
  const grate = material(0x424840, { roughness: 0.62, metalness: 0.35 });
  const shrub = [material(0x53634d), material(0x697758), material(0x778064), material(0x4e6049)];
  const turf = material(0x70785d, { roughness: 0.98 });
  const trunk = material(0x645341);
  const orange = material(0xd77432);
  const paperSack = material(0xbfa77e);
  const pallet = material(0xa37c4d);
  const concreteStack = material(0xa8a093);
  const brick = material(0x9d6052);
  const trailerBlue = material(0x54757a);
  const trailerMuted = material(0x848372);
  const trailerRoof = material(0xc1bbaa);
  const glass = material(0x394e54, { roughness: 0.23, metalness: 0.14 });
  const floodBody = material(0x474f45, { roughness: 0.46, metalness: 0.3 });
  const floodGlow = material(0xe8c078, { emissive: 0xffaf46, emissiveIntensity: 0, roughness: 0.33 });
  const lampGlow = material(0xe5debb, { emissive: 0xffcc7c, emissiveIntensity: 0, roughness: 0.36 });
  const wetSurface = material(0x3a3e3b, { roughness: 0.16, metalness: 0.23, transparent: true, opacity: 0, depthWrite: false });
  const snowMaterial = material(0xeaf0ee, { roughness: 0.95, transparent: true, opacity: 0, depthWrite: false });
  const random = randomSource(92);

  flat(root, ground, 0, -0.075, 0, 80, 60);
  flat(root, paver, 0, -0.038, 0, 59.0, 39.0);
  flat(root, gravel, 0, 0.002, -0.9, 53.2, 36.7);
  for (const z of [-23, 23]) flat(root, asphalt, 0, 0, z, 73.6, 7.2);
  for (const x of [-33, 33]) flat(root, asphalt, x, 0, 0, 7.3, 38.8);
  for (const z of [-28.5, 28.5]) flat(root, paver, 0, 0.004, z, 77.8, 3.0);
  for (const x of [-38.2, 38.2]) flat(root, paver, x, 0.004, 0, 3.0, 54.0);

  const permanent = new Batch();
  const construction = new Batch();
  const finalized = new Batch();
  const snow = new Batch();
  const lateSnow = new Batch();
  const constructionSnow = new Batch();

  for (const z of [-26.75, -19.4, 19.45, 26.75]) {
    for (let i = -17; i <= 17; i++) {
      const x = i * 2.0;
      if (z === 19.45 && (Math.abs(x - 20) < 3.6 || Math.abs(x) < 3.6)) continue;
      permanent.box(curb, x, 0.055, z, 1.96, 0.12, 0.27);
      if (i % 2 === 0) snow.box(snowMaterial, x, 0.123, z - 0.13, 1.64, 0.022, 0.29);
    }
  }
  for (const x of [-36.75, -29.23, 29.23, 36.75]) {
    for (let i = -9; i <= 9; i++) {
      const z = i * 2.0;
      permanent.box(curb, x, 0.056, z, 0.27, 0.12, 1.96);
      if (i % 2 === 0) snow.box(snowMaterial, x + 0.13, 0.126, z, 0.29, 0.025, 1.72);
    }
  }
  for (const z of [-23, 23]) {
    for (let x = -29; x < 30; x += 4.8) {
      if (z === 23 && (Math.abs(x - 20) < 4.8 || Math.abs(x) < 4.8)) continue;
      permanent.box(paint, x, 0.021, z, 2.45, 0.020, 0.10);
    }
    for (const edge of [-3.25, 3.25]) {
      if (z === 23 && edge === -3.25) {
        for (const [start, end] of [[-30, -4], [4, 16], [24, 30]]) permanent.box(paint, (start + end) / 2, 0.021, z + edge, end - start, 0.022, 0.105);
      } else {
        permanent.box(paint, 0, 0.021, z + edge, 60, 0.022, 0.105);
      }
    }
  }
  for (const x of [-33, 33]) {
    for (let z = -15; z <= 15; z += 4.5) permanent.box(paint, x, 0.022, z, 0.10, 0.021, 2.33);
    for (const edge of [-3.22, 3.22]) permanent.box(paint, x + edge, 0.021, 0, 0.115, 0.021, 34.6);
  }
  for (const z of [-17.8, 17.8]) {
    for (const x of [-33, 33]) {
      for (let k = -3; k <= 3; k++) permanent.box(paint, x + k * 0.88, 0.025, z, 0.51, 0.022, 1.65);
    }
  }
  for (let i = -12; i <= 12; i++) {
    for (const z of [-28.5, 28.5]) permanent.box(joint, i * 2.9, 0.018, z, 0.025, 0.016, 2.92);
  }
  for (let i = -8; i <= 8; i++) {
    for (const x of [-38.2, 38.2]) permanent.box(joint, x, 0.018, i * 3.1, 2.92, 0.016, 0.025);
  }
  for (const [x, z] of [[-16, 24.25], [5, 24.75], [22.6, -21], [-34.7, 9], [34.7, -5]]) {
    permanent.add(shape.cylinder, grate, [x, 0.033, z], [0.76, 0.032, 0.76]);
    for (const dz of [-0.16, 0, 0.16]) permanent.box(joint, x, 0.052, z + dz, 0.49, 0.013, 0.035);
  }

  function fence(x, z, yaw, panel) {
    const horizontal = Math.abs(yaw) < 0.1;
    construction.box(panel ? trailerBlue : guard, x, 0.93, z, 2.20, panel ? 1.56 : 1.20, 0.095, { yaw });
    construction.box(guard, x, 1.72, z, 2.28, 0.12, 0.12, { yaw });
    construction.box(guard, x, 0.21, z, 2.23, 0.10, 0.105, { yaw });
    const px = x + (horizontal ? -1.10 : 0);
    const pz = z + (horizontal ? 0 : -1.10);
    construction.box(siteMetal, px, 0.88, pz, 0.12, 1.76, 0.12);
    construction.box(concreteStack, px, 0.085, pz, 0.56, 0.16, 0.43, { yaw });
    if (panel) {
      for (const offset of [-0.7, -0.23, 0.23, 0.7]) construction.box(guard, x + (horizontal ? offset : 0), 0.96, z + (horizontal ? 0 : offset), 0.035, 1.34, 0.11, { yaw });
    }
  }
  for (let i = -11; i <= 11; i++) {
    const x = i * 2.25;
    fence(x, -17.95, 0, i % 4 !== 0);
    if (Math.abs(x - 20) > 4.0 && Math.abs(x) > 4.0) fence(x, 18.65, 0, i % 3 === 0);
  }
  for (let i = -7; i <= 7; i++) {
    fence(-25.65, i * 2.25, Math.PI / 2, i % 2 !== 0);
    fence(26.05, i * 2.25, Math.PI / 2, i % 3 !== 0);
  }

  function cone(x, z) {
    construction.box(grate, x, 0.058, z, 0.56, 0.11, 0.56);
    construction.add(shape.cone, orange, [x, 0.47, z], [0.41, 0.74, 0.41]);
    construction.add(shape.cylinder, paint, [x, 0.49, z], [0.29, 0.12, 0.29]);
  }
  for (const [x, z] of [[-4.3, 18.7], [-3.75, 20], [4.1, 18.8], [4.5, 20.3], [15.5, 18.4], [15.1, 20.2], [24.6, 18.4], [24.7, 20], [8.6, 14.6], [13.9, 14.7], [23.6, 5], [23.6, 1.3], [-18.6, 6.3]]) cone(x, z);
  for (const [x, z] of [[-4.7, 18.1], [4.8, 18.1], [15.1, 18.1], [24.9, 18.1]]) {
    construction.box(concreteStack, x, 0.27, z, 1.14, 0.53, 0.61, { cast: true });
    construction.box(hazard, x, 0.48, z, 1.05, 0.17, 0.63);
    for (const dx of [-0.33, 0.02, 0.37]) construction.box(grate, x + dx, 0.48, z + 0.32, 0.12, 0.16, 0.024, { roll: -0.4 });
  }

  function container(x, z, width, depth, body, office = false) {
    construction.box(siteMetal, x, 0.10, z, width + 0.15, 0.18, depth + 0.16);
    construction.box(body, x, 1.48, z, width, 2.72, depth, { cast: true });
    construction.box(trailerRoof, x, 2.89, z, width + 0.12, 0.13, depth + 0.12, { cast: true });
    constructionSnow.box(snowMaterial, x, 2.971, z, width - 0.07, 0.04, depth - 0.04);
    for (const side of [-1, 1]) {
      for (let dx = -width / 2 + 0.19; dx < width / 2; dx += 0.33) {
        construction.box(body, x + dx, 1.43, z + side * (depth / 2 + 0.025), 0.08, 2.38, 0.10);
      }
      for (const end of [-1, 1]) construction.box(siteMetal, x + end * width * 0.48, 1.46, z + side * depth / 2, 0.15, 2.72, 0.12);
    }
    if (office) {
      for (const dx of [-width * 0.29, width * 0.29]) {
        construction.box(paint, x + dx, 1.68, z + depth / 2 + 0.11, 1.49, 1.14, 0.13);
        construction.box(glass, x + dx, 1.68, z + depth / 2 + 0.185, 1.31, 0.96, 0.09);
        construction.box(guard, x + dx, 1.68, z + depth / 2 + 0.24, 0.064, 1.02, 0.035);
      }
      construction.box(trailerRoof, x, 1.2, z + depth / 2 + 0.1, 0.92, 2.13, 0.18);
      construction.box(siteMetal, x + 0.31, 1.17, z + depth / 2 + 0.225, 0.13, 0.06, 0.09);
      construction.box(curb, x, 0.115, z + depth / 2 + 0.49, 1.30, 0.20, 0.88);
    } else {
      construction.box(siteMetal, x, 1.50, z + depth / 2 + 0.07, 0.052, 2.34, 0.09);
      for (const dx of [-0.44, 0.44]) construction.box(guard, x + dx, 1.49, z + depth / 2 + 0.1, 0.045, 2.20, 0.045);
    }
  }
  container(-21.9, -13.7, 6.15, 2.9, trailerMuted, true);
  container(-13.9, -15.1, 5.92, 2.70, trailerBlue);
  container(20.3, -13.6, 6.2, 2.75, brick);

  function materials(x, z, style, yaw = 0) {
    const options = { yaw };
    for (const dx of [-0.74, 0, 0.74]) construction.box(pallet, x + dx, 0.13, z, 0.16, 0.20, 1.34, options);
    for (let dz = -0.54; dz <= 0.6; dz += 0.25) construction.box(pallet, x, 0.27, z + dz, 1.70, 0.11, 0.18, options);
    if (style === 'pipe') {
      for (let l = 0; l < 2; l++) {
        for (let i = 0; i < 4 - l; i++) construction.add(shape.cylinder, siteMetal, [x + (i - 1.5 + l * 0.5) * 0.33, 0.51 + l * 0.27, z], [0.31, 2.05, 0.31], { pitch: Math.PI / 2 });
      }
    } else {
      const fill = style === 'cement' ? paperSack : style === 'blocks' ? concreteStack : brick;
      for (let l = 0; l < 3; l++) {
        for (const dx of [-0.48, 0.48]) {
          for (const dz of [-0.29, 0.29]) construction.box(fill, x + dx, 0.40 + l * 0.21, z + dz, 0.87, 0.19, 0.52, options);
        }
      }
    }
  }
  for (const [x, z, style] of [[20.4, 3.2, 'pipe'], [23.7, 3.25, 'cement'], [20.6, 5.6, 'blocks'], [24.1, 7.9, 'brick'], [19.9, -1.8, 'blocks'], [24.0, -4.3, 'pipe'], [24.1, 10.2, 'cement'], [-24.0, 0.2, 'cement'], [-21.7, 6.7, 'pipe'], [-18.6, 9.1, 'blocks'], [-12.2, 11.4, 'brick']]) materials(x, z, style);
  for (const [x, z] of [[15.2, 14.2], [14.8, 13.4], [-21.5, -4.5], [12.6, -13.1], [14.1, -13.5]]) {
    construction.add(shape.cylinder, trailerBlue, [x, 0.49, z], [0.62, 0.94, 0.62]);
    for (const y of [0.15, 0.51, 0.83]) construction.add(shape.cylinder, siteMetal, [x, y, z], [0.65, 0.059, 0.65]);
  }
  for (const [x, z] of [[9.1, 15.0], [14.2, 15.0], [17.4, 0.7], [17.4, 5.3], [24.5, 0.7], [24.5, 5.3]]) {
    construction.box(hazard, x, 0.038, z, 1.06, 0.018, 0.095);
    construction.box(hazard, x, 0.038, z + 0.23, 0.10, 0.018, 0.46);
  }
  for (let i = 0; i < 62; i++) {
    const x = (random() - 0.5) * 49;
    const z = (random() - 0.5) * 32;
    if (x > -19 && x < 5 && z > -14 && z < 4) continue;
    if (x > -1 && x < 22 && z > -2) continue;
    construction.box(random() > 0.5 ? pallet : concreteStack, x, 0.037, z, 0.14 + random() * 0.24, 0.07, 0.1 + random() * 0.18, { yaw: random() * 5 });
  }

  function tree(batch, x, z, size) {
    batch.add(shape.cylinder, trunk, [x, size * 0.31, z], [size * 0.07, size * 0.63, size * 0.07]);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3 + random() * 0.6;
      const distance = size * (i === 0 ? 0 : 0.17);
      const radius = size * (0.36 + random() * 0.10);
      batch.add(shape.sphere, shrub[i % shrub.length], [x + Math.cos(angle) * distance, size * (i === 0 ? 0.92 : 0.73 + random() * 0.10), z + Math.sin(angle) * distance], [radius * 1.63, radius * 1.85, radius * 1.58], { yaw: angle, cast: true });
    }
  }
  for (const [x, z, size] of [[-38.1, -27.9, 3.7], [-23.5, -28.4, 4.0], [-9.8, -28.5, 3.55], [7, -28.5, 3.86], [22.5, -28.5, 3.58], [38.1, -27.6, 4.4], [-38.1, -13.3, 3.9], [-38.1, 3.0, 4.0], [-38.1, 17.6, 3.8], [38.1, -12.1, 3.7], [38.1, 4.0, 3.8], [38.1, 15.2, 3.9], [-25, 28.5, 3.7], [32.9, 28.5, 3.55]]) {
    permanent.box(curb, x, 0.10, z, 2.08, 0.20, 2.08);
    permanent.box(turf, x, 0.23, z, 1.86, 0.16, 1.86);
    tree(permanent, x, z, size);
  }

  finalized.box(paver, 0, 0.055, -0.6, 53.20, 0.07, 36.8);
  finalized.box(turf, -21.0, 0.15, -1.6, 6.65, 0.16, 27.7);
  finalized.box(turf, 18.2, 0.15, -9.2, 11.3, 0.16, 12.55);
  finalized.box(turf, -8.2, 0.15, 13.0, 24.0, 0.16, 4.85);
  for (const [x, z, size] of [[-21.1, -12.4, 4.5], [-22.7, -6.1, 4.4], [-21.1, 2.3, 4.2], [-22.6, 9.4, 4.8], [14.2, -12.9, 4.7], [19.5, -7.0, 4.65], [20.2, -12.6, 4.05], [-17.1, 12.2, 3.7], [-5.0, 12.4, 3.84]]) tree(finalized, x, z, size);
  for (let i = 0; i < 18; i++) {
    const x = -18.6 + i * 1.18;
    finalized.add(shape.sphere, shrub[i % 3], [x, 0.51 + random() * 0.14, 14.35], [1.32, 0.95, 1.26]);
  }
  for (let x = -17; x <= 2; x += 1.3) {
    for (let z = 3.7; z < 10.4; z += 1.3) {
      finalized.box(curb, x, 0.121, z, 1.26, 0.076, 1.26);
    }
  }
  finalized.box(curb, -7, 0.25, 3.78, 10.6, 0.25, 1.06);
  finalized.box(curb, -7, 0.15, 4.50, 10.6, 0.18, 0.79);
  for (const x of [6.8, 12.5, 18.2, 23.9]) finalized.box(paint, x, 0.109, 13.5, 0.11, 0.025, 5.3);
  finalized.box(asphalt, 15.35, 0.100, 13.5, 17.3, 0.025, 5.7);
  finalized.box(paint, 15.35, 0.123, 10.78, 17.3, 0.022, 0.11);
  for (const [x, z] of [[-16.5, 11.2], [-8.2, 11.2], [10.8, -10.2]]) {
    finalized.box(pallet, x, 0.68, z, 2.6, 0.15, 0.67);
    for (const dx of [-1, 1]) finalized.box(siteMetal, x + dx, 0.33, z, 0.21, 0.62, 0.52);
  }
  lateSnow.box(snowMaterial, -21.0, 0.243, -1.6, 6.55, 0.033, 27.45);
  lateSnow.box(snowMaterial, 18.2, 0.243, -9.2, 11.1, 0.033, 12.3);

  const streetLights = [];
  const lampFixtures = new Batch();
  const openingFixtures = new Batch();
  const finalFixtures = new Batch();
  function fixture(batch, x, z, facing, small = false) {
    const h = small ? 3.6 : 4.8;
    const dx = Math.cos(facing);
    const dz = Math.sin(facing);
    batch.add(shape.cylinder, floodBody, [x, h / 2, z], [0.12, h, 0.12]);
    batch.add(shape.cylinder, curb, [x, 0.14, z], [0.44, 0.25, 0.44]);
    batch.rod(floodBody, [x, h - 0.12, z], [x + dx * 0.95, h, z + dz * 0.95], 0.095);
    batch.box(floodBody, x + dx * 0.95, h - 0.035, z + dz * 0.95, 0.82, 0.14, 0.34, { yaw: -facing });
    batch.box(lampGlow, x + dx * 1.04, h - 0.111, z + dz * 1.04, 0.57, 0.034, 0.25, { yaw: -facing });
  }
  for (const [x, z, yaw] of [[-37.6, 8.9, 0], [-37.6, -21.3, 0], [37.6, 7.5, Math.PI], [37.6, -19.2, Math.PI], [-14, 27.5, -Math.PI / 2], [17.3, 27.5, -Math.PI / 2], [9.0, -27.55, Math.PI / 2], [-20.0, -27.55, Math.PI / 2]]) fixture(lampFixtures, x, z, yaw);
  for (const [x, z, yaw] of [[-16.5, 9.7, 0], [2.0, 9.7, Math.PI], [16.2, -5.4, 0]]) fixture(finalFixtures, x, z, yaw, true);

  const floodSpots = [];
  for (const [x, z, tx, tz] of [[-23.6, 13.6, -13.0, 0], [23.8, 13.0, 10.0, 4.0], [23.2, -10.6, 10.0, -2.0]]) {
    const y = 6.35;
    const angle = Math.atan2(tx - x, tz - z);
    openingFixtures.add(shape.cylinder, floodBody, [x, y * 0.49, z], [0.18, y * 0.99, 0.18]);
    openingFixtures.box(concreteStack, x, 0.11, z, 0.90, 0.22, 0.90);
    openingFixtures.box(floodBody, x, y - 0.21, z, 1.32, 0.11, 0.15, { yaw: angle });
    for (const offset of [-0.43, 0.43]) {
      const dx = Math.cos(angle) * offset;
      const dz = -Math.sin(angle) * offset;
      openingFixtures.box(floodBody, x + dx, y, z + dz, 0.69, 0.47, 0.30, { yaw: angle, pitch: -0.45 });
      openingFixtures.box(floodGlow, x + dx + Math.sin(angle) * 0.15, y - 0.04, z + dz + Math.cos(angle) * 0.15, 0.52, 0.36, 0.044, { yaw: angle, pitch: -0.45 });
    }
    const light = new THREE.SpotLight(0xffb967, 0, 39, Math.PI / 4.0, 0.59, 1.35);
    light.position.set(x, y - 0.12, z);
    light.target.position.set(tx, 0.25, tz);
    root.add(light, light.target);
    floodSpots.push(light);
    streetLights.push(light);
  }
  for (const [x, z, finishedOnly] of [[-14, 27.3, false], [37.25, 7.5, false], [-16.5, 9.7, true], [2.0, 9.7, true]]) {
    const light = new THREE.PointLight(0xffd091, 0, 10, 1.65);
    light.position.set(x, finishedOnly ? 3.47 : 4.57, z);
    root.add(light);
    streetLights.push(light);
    light.userData.finishedOnly = finishedOnly;
  }

  const wetBatch = new Batch();
  for (const [x, z, w, d, yaw] of [[4.1, 20.7, 4.7, 1.18, -0.12], [-10.0, 24.6, 5.25, 1.20, 0.08], [20.2, 19.2, 3.5, 1.1, 0.24], [33.5, 4, 1.55, 4.7, -0.14], [5.5, 7.3, 3.5, 1.8, -0.26], [12.8, 2.5, 3.0, 1.45, 0.43], [-22.2, 3.8, 1.2, 3.5, -0.36], [-24.2, -22.2, 4.3, 1.18, -0.22]]) {
    wetBatch.add(shape.cylinder, wetSurface, [x, 0.024, z], [w, 0.013, d], { yaw });
  }
  const puddles = wetBatch.build();
  const workProps = construction.build();
  const finishedProps = finalized.build();
  const baseSnow = snow.build();
  const workSnow = constructionSnow.build();
  const finishedSnow = lateSnow.build();
  const workLights = openingFixtures.build();
  const finalLights = finalFixtures.build();
  root.add(permanent.build(), workProps, finishedProps, baseSnow, workSnow, finishedSnow, puddles, lampFixtures.build(), workLights, finalLights);
  const structure = createBuilding(config.building);
  root.add(structure.building);

  function update(state) {
    structure.update(state);
    const { wet = 0, snow: snowDepth = 0, finished = false, lightsOn = false } = state;
    workProps.visible = !finished;
    finishedProps.visible = finished;
    workLights.visible = !finished;
    finalLights.visible = finished;
    puddles.visible = wet > 0.025;
    baseSnow.visible = snowDepth > 0.022;
    workSnow.visible = snowDepth > 0.04 && !finished;
    finishedSnow.visible = snowDepth > 0.07 && finished;
    snowMaterial.opacity = Math.min(0.96, snowDepth * 1.08);
    wetSurface.opacity = 0.62 * wet;
    asphalt.color.setRGB(1 - wet * 0.30, 1 - wet * 0.24, 1 - wet * 0.18);
    asphalt.roughness = 0.89 - wet * 0.54;
    gravel.color.setRGB(1 - wet * 0.27, 1 - wet * 0.23, 1 - wet * 0.20);
    gravel.roughness = 0.96 - wet * 0.36;
    paver.color.setRGB(1 - wet * 0.19, 1 - wet * 0.16, 1 - wet * 0.13);
    paver.roughness = 0.89 - wet * 0.37;
    floodGlow.emissiveIntensity = lightsOn && !finished ? 2.35 : 0;
    lampGlow.emissiveIntensity = lightsOn ? 1.85 : 0;
    for (const light of streetLights) {
      const intensity = floodSpots.includes(light) ? (!finished ? 88 : 0) : (!light.userData.finishedOnly || finished ? 16 : 0);
      light.intensity = lightsOn ? intensity : 0;
    }
  }

  return {
    building: structure.building,
    update,
    wetMaterials: [asphalt, gravel, paver],
    snowMeshes: [structure.snow, ...baseSnow.children, ...workSnow.children, ...finishedSnow.children],
    bulbs: [floodGlow, lampGlow, structure.windowLight],
    streetLights,
  };
}
