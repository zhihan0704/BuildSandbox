export function createSiteAudio(camera, findEntity) {
  let context;
  let master;
  let wind;
  let motor;
  let engine;

  function start() {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

    const length = context.sampleRate * 2;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const wave = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < length; i++) {
      previous = (previous + (Math.random() * 2 - 1) * 0.045) / 1.045;
      wave[i] = previous * 4;
    }
    const windSource = context.createBufferSource();
    windSource.buffer = buffer;
    windSource.loop = true;
    wind = context.createGain();
    wind.gain.value = 0.12;
    windSource.connect(wind).connect(master);
    windSource.start();

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 135;
    engine = context.createGain();
    motor = context.createOscillator();
    motor.type = 'sawtooth';
    motor.frequency.value = 41;
    motor.connect(filter).connect(engine).connect(master);
    motor.start();
  }

  async function setMuted(muted) {
    if (muted && !context) return;
    if (!context) start();
    if (!muted && context.state !== 'running') await context.resume();
    master.gain.setTargetAtTime(muted ? 0 : 0.45, context.currentTime, 0.15);
  }

  function update(state) {
    if (!context || state.muted) return;
    const truck = findEntity('truck')?.root;
    const distance = truck?.visible ? camera.position.distanceTo(truck.position) : 200;
    const working = state.playing && !state.finished;
    engine.gain.setTargetAtTime(working ? 0.18 / (1 + (distance / 22) ** 1.6) : 0, context.currentTime, 0.15);
    motor.frequency.setTargetAtTime(37 + 3 * Math.sin(state.minutes * 0.14), context.currentTime, 0.13);
    wind.gain.setTargetAtTime(state.weather === 'rain' ? 0.35 : 0.085, context.currentTime, 0.28);
  }

  return { setMuted, update };
}
