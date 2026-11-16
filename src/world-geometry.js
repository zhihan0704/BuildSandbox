import * as THREE from 'three';

export const shape = {
  box: new THREE.BoxGeometry(),
  cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cone: new THREE.CylinderGeometry(0.15, 0.5, 1, 12),
  sphere: new THREE.IcosahedronGeometry(0.5, 2),
};

const transform = new THREE.Object3D();
const up = new THREE.Vector3(0, 1, 0);

export function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.74, ...options });
}

export class Batch {
  constructor() {
    this.buckets = new Map();
  }

  add(geometry, mat, position, scale, options = {}) {
    const { cast = false, yaw = 0, pitch = 0, roll = 0, rotation } = options;
    const key = `${geometry.id}/${mat.id}/${cast}`;
    if (!this.buckets.has(key)) this.buckets.set(key, { geometry, mat, cast, matrices: [] });
    transform.position.set(...position);
    transform.scale.set(...scale);
    transform.rotation.set(pitch, yaw, roll);
    if (rotation) transform.quaternion.copy(rotation);
    transform.updateMatrix();
    this.buckets.get(key).matrices.push(transform.matrix.clone());
  }

  box(mat, x, y, z, width, height, depth, options) {
    this.add(shape.box, mat, [x, y, z], [width, height, depth], options);
  }

  rod(mat, start, end, width, cast = false) {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const delta = b.clone().sub(a);
    const midpoint = a.addScaledVector(delta, 0.5);
    const length = delta.length();
    const rotation = new THREE.Quaternion().setFromUnitVectors(up, delta.normalize());
    this.add(shape.box, mat, midpoint.toArray(), [width, length, width], { rotation, cast });
  }

  build(group = new THREE.Group()) {
    for (const { geometry, mat, cast, matrices } of this.buckets.values()) {
      const mesh = new THREE.InstancedMesh(geometry, mat, matrices.length);
      matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
    return group;
  }
}
