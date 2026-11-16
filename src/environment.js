import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

function particleField(scene, count, snow) {
  const offsets = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    offsets[i * 4] = ((i * 0.6180339887) % 1) * 112 - 56;
    offsets[i * 4 + 1] = ((i * 0.754877666) % 1) * 48;
    offsets[i * 4 + 2] = ((i * 0.569840291) % 1) * 88 - 44;
    offsets[i * 4 + 3] = 0.55 + ((i * 0.438579) % 1) * 0.72;
  }
  const stride = snow ? 3 : 6;
  const positions = new Float32Array(count * stride);
  const geometry = new THREE.BufferGeometry();
  const attribute = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attribute);
  let field;
  if (snow) {
    const source = document.createElement('canvas');
    source.width = source.height = 32;
    const context = source.getContext('2d');
    const falloff = context.createRadialGradient(16, 16, 3, 16, 16, 15);
    falloff.addColorStop(0, '#fff');
    falloff.addColorStop(1, '#ffffff00');
    context.fillStyle = falloff;
    context.fillRect(0, 0, 32, 32);
    field = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xf4f9ff, map: new THREE.CanvasTexture(source), size: 0.23, transparent: true, opacity: 0.9, depthWrite: false }));
  } else {
    field = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xc2dcef, transparent: true, opacity: 0.47, depthWrite: false }));
  }
  field.frustumCulled = false;
  field.visible = false;
  scene.add(field);

  return (visible, time) => {
    field.visible = visible;
    if (!visible) return;
    for (let i = 0; i < count; i++) {
      const seed = i * 4;
      const index = i * stride;
      const rate = offsets[seed + 3];
      const y = THREE.MathUtils.euclideanModulo(offsets[seed + 1] - time * rate * (snow ? 0.64 : 13.6), 48);
      const x = offsets[seed] + (48 - y) * (snow ? 0.12 : 0.19) + (snow ? Math.sin(time * rate + i) * 0.9 : 0);
      const z = offsets[seed + 2] + (snow ? Math.cos(time * 0.44 + i) : 0);
      positions[index] = x;
      positions[index + 1] = y;
      positions[index + 2] = z;
      if (!snow) {
        positions[index + 3] = x - 0.17 * rate;
        positions[index + 4] = y + 0.9 * rate;
        positions[index + 5] = z;
      }
    }
    attribute.needsUpdate = true;
  };
}

export function createEnvironment(scene, renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.027).texture;
  room.dispose();
  pmrem.dispose();

  const light = new THREE.DirectionalLight(0xffefcc, 3.25);
  light.castShadow = true;
  light.shadow.mapSize.set(1536, 1536);
  light.shadow.camera.left = light.shadow.camera.bottom = -55;
  light.shadow.camera.right = light.shadow.camera.top = 55;
  light.shadow.camera.near = 1;
  light.shadow.camera.far = 185;
  light.shadow.bias = -0.00015;
  light.shadow.normalBias = 0.08;
  light.shadow.radius = 2;
  const fill = new THREE.HemisphereLight(0xe8f1fb, 0x584132, 2.05);
  scene.add(light, light.target, fill);
  scene.background = new THREE.Color(0x363a35);
  scene.fog = new THREE.Fog(scene.background, 142, 335);

  const rain = particleField(scene, 820, false);
  const snow = particleField(scene, 590, true);
  const dayBackground = new THREE.Color(0x404641);
  const nightBackground = new THREE.Color(0x101823);
  const fogBackground = new THREE.Color(0x666e73);
  const warm = new THREE.Color(0xffbb81);
  const noon = new THREE.Color(0xfff0d5);
  const moon = new THREE.Color(0x9fbcf2);
  const targetLight = new THREE.Color();
  const targetSky = new THREE.Color();
  const sunPosition = new THREE.Vector3();
  let atmosphere = 0;

  function update(state, delta, instant = false, cameraDistance = 0) {
    const fade = instant ? 1 : 1 - Math.exp(-delta * 2.8);
    const sunHeight = Math.sin((state.hour - 6) / 12 * Math.PI);
    const daylight = THREE.MathUtils.smoothstep(sunHeight, -0.16, 0.41);
    const overcast = state.weather === 'clear' ? 0 : state.weather === 'rain' ? 0.47 : 0.32;
    atmosphere = THREE.MathUtils.lerp(atmosphere, overcast, fade);
    targetSky.copy(nightBackground).lerp(dayBackground, daylight).lerp(fogBackground, atmosphere * (0.26 + daylight * 0.44));
    scene.background.lerp(targetSky, fade);
    scene.fog.color.copy(scene.background);
    const fogOffset = Math.max(0, cameraDistance - 136);
    scene.fog.near = 136 + fogOffset - atmosphere * 59;
    scene.fog.far = 331 + fogOffset - atmosphere * 145;
    scene.environmentIntensity = THREE.MathUtils.lerp(0.24, 0.58, daylight) * (1 - atmosphere * 0.22);
    const angle = (state.hour - 7.6) / 13 * Math.PI;
    sunPosition.set(-Math.cos(angle) * 72, 24 + Math.max(0, sunHeight) * 70, 28 + Math.sin(angle) * 35);
    light.position.lerp(sunPosition, fade);
    light.intensity = THREE.MathUtils.lerp(light.intensity, (0.46 + daylight * 2.48) * (1 - atmosphere * 0.79), fade);
    targetLight.copy(moon).lerp(warm, daylight).lerp(noon, Math.max(0, sunHeight));
    light.color.lerp(targetLight, fade);
    fill.intensity = THREE.MathUtils.lerp(fill.intensity, 0.59 + daylight * 1.00, fade);
    rain(state.weather === 'rain', state.minutes);
    snow(state.weather === 'snow', state.minutes);
  }

  return { update };
}
