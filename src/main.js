import * as THREE from 'three';
import config from './scene.json';
import { createUI } from './ui.js';
import { createWorld } from './world.js';
import { createOperations } from './operations.js';
import { createClock } from './simulation.js';
import { createEnvironment } from './environment.js';
import { createCameras } from './cameras.js';
import { createSiteAudio } from './audio.js';
import { applyModelOverrides } from './assets.js';

const canvas = document.getElementById('stage');

function start() {
  const clock = createClock();
  const state = clock.state;
  const scene = new THREE.Scene();
  let renderer;
  let world;
  let operations;
  let cameraSystem;
  let audio;
  let selected = null;
  let shot;
  let preCinematic;
  let immediateLight = true;
  const actions = {
    togglePlay() {
      if (!state.playing && state.minutes >= config.lastDay * config.minutesPerDay - 1) clock.seek(config.initialMinute);
      state.playing = !state.playing;
    },
    seek: minute => clock.seek(Number(minute)),
    speed: value => { state.speed = Number(value); },
    weather: value => clock.setWeather(value),
    light: value => { state.lightMode = value; clock.refresh(); },
    daylight: value => clock.seek((state.day - 1) * config.minutesPerDay + (value === 'night' ? 21 * 60 : 630)),
    camera: id => selectCamera(id),
    resetCamera: () => selectCamera('overview'),
    immersive: enabled => setImmersive(enabled),
    mute: async enabled => {
      try {
        await audio?.setMuted(enabled);
        state.muted = enabled;
      } catch (error) {
        console.warn('Audio unavailable:', error);
      }
    },
    debug: enabled => { state.debug = enabled; },
  };
  const ui = createUI(actions, config);

  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const environment = createEnvironment(scene, renderer);
    world = createWorld(scene, config);
    operations = createOperations(scene, config);
    const building = { root: world.building, name: 'A 栋 · 综合楼', type: '建筑', status: '', detail: '' };
    const findEntity = id => id === 'building' ? building : operations.entities.get(id);
    void applyModelOverrides(config.assetOverrides, findEntity);
    cameraSystem = createCameras(canvas, config, findEntity);
    audio = createSiteAudio(cameraSystem.camera, findEntity);

    const outlineBounds = new THREE.Box3();
    const outline = new THREE.Box3Helper(outlineBounds, 0xffda82);
    outline.material.transparent = true;
    outline.material.opacity = 0.82;
    outline.material.depthTest = false;
    outline.material.depthWrite = false;
    outline.renderOrder = 3;
    outline.visible = false;
    scene.add(outline);

    function resize() {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width > 800 ? 1.6 : 1.45));
      renderer.setSize(width, height, false);
      cameraSystem.resize(width, height, state.immersive);
    }

    window.addEventListener('resize', resize);
    resize();
    cameraSystem.select('overview', true);

    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pressed = null;
    canvas.addEventListener('pointerdown', event => {
      pressed = event.button === 0 ? [event.clientX, event.clientY] : null;
    });
    canvas.addEventListener('pointerup', event => {
      if (state.immersive || !pressed || Math.hypot(event.clientX - pressed[0], event.clientY - pressed[1]) > 5) return;
      const rect = canvas.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(pointer, cameraSystem.camera);
      const roots = [world.building, ...Array.from(operations.entities.values(), entity => entity.root)];
      selected = null;
      for (const hit of ray.intersectObjects(roots, true)) {
        let candidate;
        for (let object = hit.object; object; object = object.parent) {
          if (!object.visible && !object.userData.pickProxy) { candidate = null; break; }
          if (object.userData.entityId) candidate = findEntity(object.userData.entityId);
        }
        if (candidate) { selected = candidate; break; }
      }
      pressed = null;
    });
    canvas.addEventListener('pointercancel', () => { pressed = null; });

    function updateWorld(delta) {
      world.update(state);
      operations.update(state);
      environment.update(state, delta, immediateLight, cameraSystem.camera.position.length());
      immediateLight = false;
      building.status = state.finished ? '竣工开放' : state.floors === 12 ? '封顶 / 外立面收尾' : state.floors ? `施工至第 ${state.floors} 层` : '开挖与基础施工';
      building.detail = `已完成 ${state.completedFloors} / ${config.floorWindows.length} 层 · 外墙 ${state.facadeFloors} 层`;
      if (selected && !selected.root.visible) selected = null;
      operations.debug.visible = state.debug;
      outline.visible = Boolean(selected) && !state.immersive;
      if (!outline.visible) return;
      if (selected === building) {
        const { position: [x, , z], width, depth, floorHeight } = config.building;
        outlineBounds.min.set(x - width / 2 - 0.35, 0, z - depth / 2 - 0.35);
        outlineBounds.max.set(x + width / 2 + 0.35, Math.max(0.45, state.floors * floorHeight), z + depth / 2 + 0.35);
      } else {
        outlineBounds.setFromObject(selected.root);
        outlineBounds.expandByScalar(0.12);
      }
    }

    function setData(metrics) {
      Object.assign(canvas.dataset, {
        ready: 'true', day: state.day, minute: state.minutes.toFixed(2),
        floors: state.floors, complete: state.completedFloors, weather: state.weather,
        snow: state.snow.toFixed(3), wet: state.wet.toFixed(3), lights: state.lightsOn,
        cargo: state.cargoPhase ?? '', inventory: state.inventory ?? 0,
        calls: metrics.calls, triangles: metrics.triangles, fps: metrics.fps,
      });
    }

    updateWorld(0);
    const metrics = { fps: 0, calls: 0, triangles: 0, entities: 0 };
    let last = performance.now();
    let uiElapsed = 0.15;
    let frames = 0;
    let fpsElapsed = 0;
    let thumb = 0;
    const cards = Object.keys(config.cameras);

    function renderThumbnail() {
      const id = cards[thumb++];
      const pixelRatio = renderer.getPixelRatio();
      renderer.setPixelRatio(1);
      renderer.setSize(224, 126, false);
      renderer.render(scene, cameraSystem.thumbnailCamera(id, selected));
      ui.setThumbnail(id, canvas.toDataURL('image/jpeg', 0.84));
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    }

    renderer.setAnimationLoop(now => {
      const rawDelta = Math.max(0, (now - last) / 1000);
      const delta = Math.min(0.25, rawDelta);
      last = now;
      clock.advance(delta);
      advanceShot(delta);
      updateWorld(delta);
      cameraSystem.update(delta, state, selected);
      audio.update(state);
      if (thumb < cards.length && !state.immersive) renderThumbnail();
      renderer.render(scene, cameraSystem.camera);

      frames++;
      fpsElapsed += rawDelta;
      if (fpsElapsed >= 0.8) {
        metrics.fps = Math.round(frames / fpsElapsed);
        fpsElapsed = 0;
        frames = 0;
      }
      uiElapsed += delta;
      if (uiElapsed >= 0.09) {
        uiElapsed = 0;
        metrics.calls = renderer.info.render.calls;
        metrics.triangles = renderer.info.render.triangles;
        metrics.entities = 1 + Array.from(operations.entities.values()).filter(entity => entity.root.visible).length;
        ui.render(state, selected, metrics);
        setData(metrics);
      }
    });

    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      canvas.dataset.ready = 'false';
      ui.setError('图形上下文中断。请刷新页面，或用启用了硬件加速的浏览器打开。');
    });
  } catch (error) {
    console.error(error);
    canvas.dataset.ready = 'false';
    ui.setError('三维场景启动失败。请使用支持 WebGL 2 的 Chrome 或 Edge，并检查浏览器的硬件加速设置。');
  }

  function selectCamera(id) {
    if (!Object.hasOwn(config.cameras, id)) return;
    state.camera = id;
    cameraSystem?.select(id, false, selected);
  }

  function startShot(index) {
    const item = config.shots[index];
    shot = { index, remaining: item.seconds };
    clock.seek(item.at);
    clock.setWeather(item.weather ?? 'auto');
    selectCamera(item.camera);
    immediateLight = true;
  }

  function advanceShot(delta) {
    if (!shot) return;
    shot.remaining -= delta;
    if (shot.remaining <= 0) startShot((shot.index + 1) % config.shots.length);
  }

  function setImmersive(enabled) {
    if (state.immersive === enabled) return;
    state.immersive = enabled;
    if (enabled) {
      preCinematic = { minute: state.minutes, playing: state.playing, speed: state.speed, camera: state.camera, weather: clock.saveWeather() };
      state.playing = true;
      state.speed = 1;
      startShot(0);
    } else {
      shot = null;
      if (preCinematic) {
        clock.seek(preCinematic.minute);
        clock.restoreWeather(preCinematic.weather);
        state.playing = preCinematic.playing;
        state.speed = preCinematic.speed;
        selectCamera(preCinematic.camera);
      }
      immediateLight = true;
    }
    window.dispatchEvent(new Event('resize'));
  }
}

start();
