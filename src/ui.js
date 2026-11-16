import './style.css';

const cameras = [
  { id: 'overview', label: '沙盘全景' },
  { id: 'loading', label: '装卸区' },
  { id: 'crane', label: '塔吊吊装' },
  { id: 'orbit', label: '自动环绕' },
  { id: 'tour', label: '街区巡游' },
  { id: 'follow', label: '跟随对象' },
];

const entityTypes = {
  building: '建筑',
  vehicle: '工程车辆',
  worker: '施工人员',
  crane: '塔吊',
  equipment: '工程机械',
};

const get = (id) => document.getElementById(id);
const twoDigits = (value) => String(value).padStart(2, '0');

function icon(name) {
  return '<svg aria-hidden="true"><use href="#icon-' + name + '"/></svg>';
}

function text(element, value) {
  const next = String(value ?? '');
  if (element.textContent !== next) element.textContent = next;
}

function attribute(element, name, value) {
  const next = String(value);
  if (element.getAttribute(name) !== next) element.setAttribute(name, next);
}

function setIcon(button, name) {
  attribute(button.querySelector('use'), 'href', '#icon-' + name);
}

function addCounterUnit(element, unit) {
  const number = document.createTextNode('');
  const suffix = document.createElement('small');
  suffix.textContent = unit;
  element.replaceChildren(number, suffix);
  return number;
}

function bindSegments(name, action) {
  const buttons = Array.from(document.querySelectorAll('[data-' + name + ']'));
  for (const button of buttons) {
    button.addEventListener('click', () => action(button.dataset[name]));
  }
  return (activeValue) => {
    for (const button of buttons) {
      attribute(button, 'aria-pressed', button.dataset[name] === activeValue);
    }
  };
}

function makeCameras(action) {
  const list = get('camera-list');
  const buttons = new Map();
  for (const { id, label } of cameras) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'camera-card';
    button.dataset.camera = id;
    button.title = id === 'follow' ? '跟随选中的对象' : label;
    button.setAttribute('aria-pressed', String(id === 'overview'));
    button.innerHTML = '<span class="camera-image">' + icon(id) + '</span><span class="camera-caption">' + label + '</span>';
    button.addEventListener('click', () => action(id));
    buttons.set(id, button);
    list.append(button);
  }
  return buttons;
}

function makeMilestones(config, maxMinutes, seek) {
  const container = get('milestones');
  return config.milestones.map(({ day, label, minute }) => {
    const date = 'DAY ' + twoDigits(day);
    const button = document.createElement('button');
    const dateLabel = document.createElement('span');
    const stageLabel = document.createElement('span');
    button.type = 'button';
    button.className = 'milestone';
    button.dataset.day = String(day);
    button.title = date + ' · ' + label;
    button.setAttribute('aria-label', button.title);
    button.style.setProperty('--point', minute / maxMinutes * 100 + '%');
    dateLabel.textContent = date;
    stageLabel.textContent = label;
    button.append(dateLabel, stageLabel);
    button.addEventListener('click', () => seek(minute));
    container.append(button);
    return { day, label, button };
  });
}

function makeMetrics() {
  const metrics = get('metrics');
  const values = {};
  for (const [key, label] of Object.entries({ fps: 'FPS', calls: '调用', triangles: '三角面', entities: '实体' })) {
    const item = document.createElement('span');
    const value = document.createElement('strong');
    item.append(label + ' ', value);
    metrics.append(item);
    values[key] = value;
  }
  return values;
}

export function createUI(actions, config) {
  const hud = get('hud');
  const timeline = get('timeline');
  const maxMinutes = config.lastDay * config.minutesPerDay - 1;
  timeline.max = String(maxMinutes);
  timeline.value = String(config.initialMinute);
  const dateLabel = get('date-label');
  const timeLabel = get('time-label');
  const playback = get('playback');
  const speed = get('speed');
  const fullscreen = get('fullscreen');
  const restoreUI = get('restore-ui');
  const audio = get('audio');
  const debug = get('debug');
  const metrics = get('metrics');
  const runStatus = get('run-status');
  const runLabel = runStatus.lastElementChild;
  const phase = get('phase');
  const operation = get('operation');
  const inventory = get('inventory');
  const progress = get('construction-progress');
  const selected = get('selection');
  const entityName = get('entity-name');
  const entityType = get('entity-type');
  const entityStatus = get('entity-status');
  const entityDetail = get('entity-detail');
  const floors = addCounterUnit(get('floors'), ' / 12');
  const workers = addCounterUnit(get('workers'), ' 人');
  const cameraButtons = makeCameras(actions.camera);
  const milestones = makeMilestones(config, maxMinutes, actions.seek);
  const metricValues = makeMetrics();
  const updateDaylight = bindSegments('daylight', actions.daylight);
  const updateWeather = bindSegments('weather', actions.weather);
  const updateLights = bindSegments('light', actions.light);
  const error = get('scene-error');
  const errorMessage = error.querySelector('p');
  const formatter = new Intl.NumberFormat('zh-CN');
  let currentState = { muted: true, immersive: false, debug: false };

  playback.addEventListener('click', () => actions.togglePlay());
  timeline.addEventListener('input', () => actions.seek(Number(timeline.value)));
  speed.addEventListener('change', () => actions.speed(Number(speed.value)));
  get('camera-reset').addEventListener('click', () => actions.resetCamera());
  get('immersive').addEventListener('click', () => actions.immersive(true));
  restoreUI.addEventListener('click', () => actions.immersive(false));
  audio.addEventListener('click', () => actions.mute(!currentState.muted));
  debug.addEventListener('click', () => actions.debug(!currentState.debug));

  fullscreen.hidden = !document.fullscreenEnabled;
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      fullscreen.title = '当前浏览器不允许全屏';
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    attribute(fullscreen, 'aria-pressed', active);
    fullscreen.title = active ? '退出全屏' : '全屏';
    setIcon(fullscreen, active ? 'shrink' : 'fullscreen');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && currentState.immersive) actions.immersive(false);
    if (event.key === 'F2') {
      event.preventDefault();
      actions.debug(!currentState.debug);
    }
  });

  function render(state, entity, diagnostics = {}) {
    currentState = state;
    hud.hidden = Boolean(state.immersive);
    restoreUI.hidden = !state.immersive;
    const minute = Math.floor(state.minutes);
    const dayMinute = minute % config.minutesPerDay;
    const time = twoDigits(Math.floor(dayMinute / 60)) + ':' + twoDigits(dayMinute % 60);
    const date = 'DAY ' + twoDigits(state.day);
    text(dateLabel, date);
    text(timeLabel, time);
    attribute(timeLabel, 'datetime', time);
    attribute(timeline, 'aria-valuetext', date + ' ' + time);
    if (timeline.valueAsNumber !== minute) timeline.valueAsNumber = minute;
    const elapsed = (minute / maxMinutes * 100).toFixed(2) + '%';
    if (timeline.style.getPropertyValue('--elapsed') !== elapsed) timeline.style.setProperty('--elapsed', elapsed);
    if (speed.value !== String(state.speed)) speed.value = String(state.speed);
    const playLabel = state.playing ? '暂停' : '播放';
    attribute(playback, 'aria-label', playLabel);
    attribute(playback, 'title', playLabel);
    setIcon(playback, state.playing ? 'pause' : 'play');
    runStatus.classList.toggle('paused', !state.playing);
    text(runLabel, state.playing ? '运行' : '暂停');

    const currentMilestone = milestones.findLast((milestone) => milestone.day <= state.day);
    for (const milestone of milestones) {
      if (milestone === currentMilestone) attribute(milestone.button, 'aria-current', 'step');
      else if (milestone.button.hasAttribute('aria-current')) milestone.button.removeAttribute('aria-current');
    }
    let phaseLabel = state.phase || currentMilestone?.label || '地基施工';
    if (!state.finished && state.floors > state.completedFloors && state.floors > 0) {
      phaseLabel = '第 ' + state.floors + ' 层施工';
    }
    text(phase, phaseLabel);
    text(floors, state.completedFloors);
    text(workers, state.workers);
    text(operation, state.operation ?? '—');
    text(inventory, state.inventory ?? '—');
    const progressValue = Math.min(12, state.completedFloors + (state.floors > state.completedFloors ? state.floorProgress : 0));
    const fill = (progressValue / 12 * 100).toFixed(1) + '%';
    if (progress.style.getPropertyValue('--progress') !== fill) progress.style.setProperty('--progress', fill);
    attribute(progress, 'aria-valuenow', state.completedFloors);

    selected.hidden = !entity;
    if (entity) {
      text(entityName, entity.name);
      text(entityType, entityTypes[entity.type] || entity.type);
      text(entityStatus, entity.status);
      text(entityDetail, entity.detail);
    }

    updateDaylight(state.hour >= 6 && state.hour < 19 ? 'day' : 'night');
    updateWeather(state.weather);
    updateLights(state.lightMode);
    for (const [id, button] of cameraButtons) attribute(button, 'aria-pressed', state.camera === id);
    attribute(audio, 'aria-pressed', !state.muted);
    attribute(audio, 'title', state.muted ? '开启环境声' : '关闭环境声');
    setIcon(audio, state.muted ? 'mute' : 'volume');
    attribute(debug, 'aria-pressed', state.debug);
    metrics.hidden = !state.debug;
    if (state.debug) {
      for (const [key, element] of Object.entries(metricValues)) {
        const value = diagnostics[key];
        text(element, Number.isFinite(value) ? formatter.format(Math.round(value)) : '—');
      }
    }
  }

  function setThumbnail(id, url) {
    const frame = cameraButtons.get(id)?.querySelector('.camera-image');
    if (!frame || !url) return;
    const image = new Image();
    image.alt = '';
    image.draggable = false;
    image.addEventListener('load', () => frame.replaceChildren(image), { once: true });
    image.src = url;
  }

  function setError(message) {
    error.hidden = !message;
    text(errorMessage, message);
  }

  return { render, setThumbnail, setError };
}
