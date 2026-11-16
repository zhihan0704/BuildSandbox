import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Replacement geometry uses the same animated parent as the procedural parts.
export async function applyModelOverrides(overrides, findEntity) {
  if (!overrides?.length) return;
  const loader = new GLTFLoader();
  const models = new Map();
  const results = await Promise.allSettled(overrides.map(async entry => {
    const root = findEntity(entry.entity)?.root;
    const anchor = entry.anchor ? root?.getObjectByName(entry.anchor) : root;
    if (!anchor) throw new Error(`Unknown model anchor: ${entry.entity}/${entry.anchor ?? ''}`);
    const toHide = (entry.hide ?? []).map(name => anchor.getObjectByName(name));
    if (toHide.some(mesh => !mesh?.isMesh)) throw new Error(`Unknown model mesh: ${entry.entity}/${entry.hide?.join(',')}`);
    if (!models.has(entry.url)) models.set(entry.url, loader.loadAsync(entry.url));
    const asset = (await models.get(entry.url)).scene.clone(true);
    if (entry.position) asset.position.fromArray(entry.position);
    if (entry.rotation) asset.rotation.fromArray(entry.rotation);
    if (entry.scale) asset.scale.fromArray(entry.scale);
    asset.traverse(node => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
    });
    for (const mesh of toHide) mesh.visible = false;
    anchor.add(asset);
  }));
  for (const result of results) {
    if (result.status === 'rejected') console.warn('GLB replacement skipped:', result.reason);
  }
}
