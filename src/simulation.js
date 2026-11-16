import config from './scene.json';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const weatherRates = { clear: [-0.018, -0.007], rain: [0.18, -0.016], snow: [-0.023, 0.031] };

function accumulate(weather, elapsed, wet, snow) {
  const [wetRate, snowRate] = weatherRates[weather];
  return {
    wet: clamp(wet + wetRate * elapsed, 0, 1),
    snow: clamp(snow + snowRate * elapsed, 0, 1),
  };
}

function scheduledWeather(minute) {
  let weather = 'clear';
  let since = 0;
  let surface = { wet: 0, snow: 0 };
  for (const event of config.weatherEvents) {
    if (event.at > minute) break;
    surface = accumulate(weather, event.at - since, surface.wet, surface.snow);
    weather = event.weather;
    since = event.at;
  }
  return { weather, ...accumulate(weather, minute - since, surface.wet, surface.snow) };
}

export function createClock() {
  const maxMinute = config.lastDay * config.minutesPerDay - 1;
  const state = {
    minutes: config.initialMinute, playing: true, speed: 1, camera: 'overview',
    muted: true, immersive: false, debug: false, lightMode: 'auto',
  };
  let override;

  function applyWeather() {
    if (!override) return scheduledWeather(state.minutes);
    const elapsed = Math.max(0, state.minutes - override.since);
    return { weather: override.weather, ...accumulate(override.weather, elapsed, override.wet, override.snow) };
  }

  function refresh() {
    const { minutesPerDay, floorWindows, facadeDays, staffing, craneDays } = config;
    const dayFraction = state.minutes / minutesPerDay;
    state.day = Math.floor(dayFraction) + 1;
    state.hour = state.minutes % minutesPerDay / 60;
    state.completedFloors = floorWindows.filter(([, end]) => dayFraction >= end).length;
    const active = floorWindows[state.completedFloors];
    state.floorProgress = active ? clamp((dayFraction - active[0]) / (active[1] - active[0]), 0, 1) : 0;
    state.floors = state.completedFloors + Number(Boolean(active && dayFraction >= active[0]));
    state.facadeFloors = facadeDays.filter(at => dayFraction >= at).length;
    state.workers = staffing.findLast(([day]) => day <= state.day)[1];
    state.finished = state.day >= config.finishDay;
    state.crane = dayFraction >= craneDays[0] && dayFraction < craneDays[1];
    state.lightsOn = state.lightMode === 'on' || (state.lightMode === 'auto' && (state.hour < 6.25 || state.hour >= 18.25));
    state.milestone = config.milestones.findLast(milestone => milestone.day <= state.day);
    Object.assign(state, applyWeather());
    return state;
  }

  function seek(minute) {
    if (Number.isFinite(minute)) state.minutes = clamp(minute, 0, maxMinute);
    return refresh();
  }

  function setWeather(weather) {
    if (weather === 'auto') override = undefined;
    else if (weather in weatherRates) {
      const surface = applyWeather();
      override = { weather, since: state.minutes, wet: weather === 'rain' ? Math.max(0.5, surface.wet) : surface.wet, snow: surface.snow };
    }
    refresh();
  }

  function advance(delta) {
    if (state.playing && state.minutes < maxMinute) seek(state.minutes + delta * state.speed);
    if (state.minutes >= maxMinute) state.playing = false;
    return state;
  }

  return {
    state: refresh(), refresh, seek, setWeather, advance,
    saveWeather: () => override && { ...override },
    restoreWeather: saved => { override = saved; refresh(); },
  };
}
