import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createCameras(canvas, config, findEntity) {
  const presets = config.cameras;
  const camera = new THREE.PerspectiveCamera(33.5, 1, 0.5, 520);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.zoomSpeed = 0.75;
  controls.panSpeed = 0.65;
  controls.rotateSpeed = 0.55;
  controls.minPolarAngle = 0.20;
  controls.maxPolarAngle = 1.35;
  controls.minDistance = 25;
  controls.maxDistance = 245;
  const tour = new THREE.CatmullRomCurve3(presets.tour.path.map(point => new THREE.Vector3(...point)), true, 'centripetal');
  const position = new THREE.Vector3();
  const focus = new THREE.Vector3();
  const subjectPosition = new THREE.Vector3();
  const followOffset = new THREE.Vector3(...presets.follow.offset);
  let mode = 'overview';
  let elapsed = 0;
  let transition = 0;
  let wideScale = 1;
  let closeScale = 1;

  function frame(id, seconds, entity, point, look, thumbnail = false) {
    const shot = presets[id];
    if (id === 'follow') {
      const followed = entity?.root?.visible ? entity : findEntity(shot.entity);
      if (followed?.root?.visible) {
        followed.root.getWorldPosition(subjectPosition);
        look.copy(subjectPosition).add(new THREE.Vector3(0, followed.type === '建筑' ? 5 : 1.1, 0));
        point.copy(look).add(followOffset);
      } else {
        point.fromArray(presets.loading.position);
        look.fromArray(presets.loading.target);
      }
    } else if (id === 'tour') {
      tour.getPointAt((seconds / shot.seconds) % 1, point);
      look.fromArray(shot.target);
      look.x += point.x * 0.12;
      look.z += point.z * 0.11;
    } else {
      point.fromArray(shot.position);
      look.fromArray(shot.target);
      if (id === 'orbit') {
        point.sub(look).applyAxisAngle(THREE.Object3D.DEFAULT_UP, seconds * shot.rate).add(look);
      }
    }
    if (!thumbnail) {
      const scale = id === 'overview' || id === 'orbit' ? wideScale : closeScale;
      point.sub(look).multiplyScalar(scale).add(look);
    }
  }

  function select(id, instant = false, entity = null) {
    if (!Object.hasOwn(presets, id)) return;
    mode = id;
    elapsed = 0;
    transition = instant ? 0 : 0.85;
    controls.minDistance = mode === 'overview' ? 36 : 24;
    if (instant) {
      frame(mode, elapsed, entity, position, focus);
      camera.position.copy(position);
      controls.target.copy(focus);
      camera.lookAt(focus);
      controls.update();
    }
  }

  function update(delta, state, entity) {
    elapsed += delta;
    const automatic = ['orbit', 'tour', 'follow'].includes(mode);
    controls.enabled = !automatic && transition <= 0 && !state.immersive;
    if (automatic || transition > 0) {
      transition -= delta;
      frame(mode, elapsed, entity, position, focus);
      const blend = 1 - Math.exp(-delta * (mode === 'follow' && transition <= 0 ? 5 : 7.5));
      camera.position.lerp(position, blend);
      controls.target.lerp(focus, blend);
      camera.lookAt(controls.target);
    } else {
      controls.update();
      controls.target.x = THREE.MathUtils.clamp(controls.target.x, -36, 36);
      controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0, 32);
      controls.target.z = THREE.MathUtils.clamp(controls.target.z, -26, 28);
    }
    camera.position.y = Math.max(camera.position.y, 6.4);
    const [x, , z] = config.building.position;
    const insideBuilding = Math.abs(camera.position.x - x) < config.building.width / 2 + 1.2 && Math.abs(camera.position.z - z) < config.building.depth / 2 + 1.2;
    if (insideBuilding) camera.position.y = Math.max(camera.position.y, state.floors * config.building.floorHeight + 3);
    camera.lookAt(controls.target);
  }

  function resize(width, height, immersive) {
    camera.aspect = width / height;
    const previousScale = wideScale;
    wideScale = width < 720 ? Math.max(1.28, 0.96 / camera.aspect) : Math.max(0.98, 1.25 / camera.aspect);
    closeScale = width < 720 ? Math.sqrt(wideScale) : 1;
    if (mode === 'overview' && previousScale !== wideScale) {
      camera.position.sub(controls.target).multiplyScalar(wideScale / previousScale).add(controls.target);
    }
    if (width >= 1000 && !immersive) camera.setViewOffset(width, height, width * 0.058, height * 0.035, width, height);
    else if (width < 720 && !immersive) camera.setViewOffset(width, height, 0, height * 0.035, width, height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  function thumbnailCamera(id, entity) {
    const snapshot = new THREE.PerspectiveCamera(34, 16 / 9, 0.3, 520);
    frame(id, id === 'orbit' ? 5.6 : id === 'tour' ? 8.2 : 0, entity, position, focus, true);
    snapshot.position.copy(position);
    snapshot.lookAt(focus);
    return snapshot;
  }

  return { camera, controls, select, update, resize, thumbnailCamera };
}
