import * as THREE from 'three';
import {
  createPartPool, makeCart, makeCrane, makeExcavator, makeForklift, makePallet,
  makeTruck, makeWorker, setVehicleLights,
} from './operations-models.js';

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const modulo = (value, range) => ((value % range) + range) % range;
const between = (value, start, end) => clamp((value - start) / (end - start), 0, 1);
const smooth = value => value * value * (3 - 2 * value);
const ease = (value, start, end) => smooth(between(value, start, end));
const ramp = (value, start, end) => {
  const t = between(value, start, end);
  if (t < 0.15) return t * t / 0.255;
  if (t > 0.85) return 1 - (1 - t) ** 2 / 0.255;
  return (t - 0.075) / 0.85;
};
const angleBetween = (from, to) => modulo(to - from + Math.PI, TAU) - Math.PI;
const blendAngle = (from, to, weight) => from + angleBetween(from, to) * weight;

const route = (nodes, closed = false) => new THREE.CatmullRomCurve3(
  nodes.map(node => new THREE.Vector3(...node)), closed, 'centripetal',
);

function debugRoute(parent, curve, color) {
  const points = curve.getSpacedPoints(80).map(point => { point.y += 0.09; return point; });
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.87 });
  parent.add(new THREE.Line(geometry, material));
}

function heading(vector) {
  return Math.atan2(vector.x, vector.z);
}

function steerVehicle(model, path, fraction, offset = 0, reverse = false, stationary = false) {
  const root = model.root;
  root.position.copy(path.getPointAt(fraction));
  const tangent = path.getTangentAt(fraction);
  root.rotation.y = heading(tangent) + (reverse ? Math.PI : 0);
  const incoming = heading(path.getTangentAt(clamp(fraction - 0.018, 0, 1)));
  const outgoing = heading(path.getTangentAt(clamp(fraction + 0.018, 0, 1)));
  const steering = stationary ? 0 : clamp(angleBetween(incoming, outgoing), -0.55, 0.55);
  const odometer = offset + path.getLength() * fraction * (reverse ? -1 : 1);
  for (const wheel of model.wheels) {
    wheel.steer.rotation.y = wheel.steering ? steering : 0;
    wheel.roll.rotation.x = odometer / wheel.radius;
  }
  return odometer;
}

function workerPose(worker, phase, walking, pushing = false, busy = false) {
  const gait = phase * (pushing ? 6.0 : 6.7);
  const swing = Math.sin(gait) * (pushing ? 0.37 : 0.57);
  worker.pose.position.y = walking ? Math.abs(Math.sin(gait)) * 0.035 : 0;
  worker.trunk.rotation.x = pushing ? 0.13 : busy ? Math.sin(phase * 3) * 0.07 : 0;
  for (let index = 0; index < worker.legs.length; index += 1) {
    const side = index === 0 ? -1 : 1;
    worker.legs[index].rotation.x = walking ? side * swing : 0;
    worker.arms[index].rotation.x = pushing
      ? -1.06
      : walking ? -side * swing * 0.65 : busy ? -0.47 - Math.sin(phase * 4 + index) * 0.30 : -0.02;
  }
}

function snowOn(model, amount) {
  const cap = model.snowCap;
  cap.visible = amount >= 0.04;
  cap.scale.y = 0.032 + amount * 0.092;
}

function roofWorkerRoute(config, index) {
  const [x, , z] = config.building.position;
  const half = config.building.width * 0.5;
  const depth = config.building.depth * 0.5;
  const direction = index % 2 ? -1 : 1;
  return route([
    [x + direction * half * 0.59, 0, z + depth * 0.67],
    [x + direction * half * 0.29, 0, z + depth * 0.63],
    [x + direction * half * 0.34, 0, z + depth * 0.26],
  ]);
}

function groundWorkerRoutes() {
  return [
    [[-23, 0, 3], [-23, 0, 7], [-20, 0, 11]],
    [[-20, 0, -9], [-21, 0, -4], [-21, 0, 3]],
    [[-17, 0, 8], [-13, 0, 9], [-10, 0, 8]],
    [[-6, 0, 8], [-3, 0, 9], [1, 0, 8]],
    [[-17, 0, 13], [-13, 0, 14], [-10, 0, 12]],
    [[22, 0, -12], [22, 0, -8], [21, 0, -3]],
    [[22, 0, 5], [22, 0, 9], [21, 0, 13]],
    [[7, 0, -11], [7, 0, -7], [7, 0, -3]],
    [[5, 0, 4], [6, 0, 6], [5, 0, 10]],
    [[-2, 0, -15], [-7, 0, -15], [-11, 0, -16]],
    [[-16, 0, 6], [-15, 0, 8], [-12, 0, 7]],
    [[-2, 0, 11], [1, 0, 12], [4, 0, 11]],
  ].map(nodes => route(nodes));
}

function deliveryCount(state, schedule) {
  const { phaseOrigin, cycle, start, end } = schedule;
  const bounded = clamp(state.minutes, start, end);
  return Math.max(0,
    Math.floor((bounded - phaseOrigin) / cycle - 50 / 65)
    - Math.floor((start - phaseOrigin) / cycle - 50 / 65));
}

export function createOperations(scene, config) {
  const entities = new Map();
  const pool = createPartPool(scene);
  const debug = new THREE.Group();
  debug.name = 'Operations route overlay';
  debug.visible = false;
  scene.add(debug);
  const truck = makeTruck(pool);
  const mixer = makeTruck(pool, true);
  const forklift = makeForklift(pool);
  const crane = makeCrane();
  const excavator = makeExcavator();
  const workers = Array.from({ length: 12 }, (_, index) => makeWorker(pool, index));
  const pallet = makePallet();
  const cart = makeCart();
  pallet.name = 'Tracked material batch';
  cart.name = 'Material hand cart';
  scene.add(pallet, cart);

  function register(id, name, type, model) {
    model.root.userData.entityId = id;
    model.root.name = name;
    scene.add(model.root);
    const entry = { root: model.root, name, type, status: '', detail: '' };
    entities.set(id, entry);
    return entry;
  }

  const haulerEntry = register('truck', '工程卡车', '车辆', truck);
  const mixerEntry = register('mixer', '混凝土搅拌车', '车辆', mixer);
  const forkliftEntry = register('forklift', '物料叉车', '车辆', forklift);
  const craneEntry = register('crane', '塔式起重机', '塔吊', crane);
  const excavationEntry = register('excavator', '履带挖掘机', '机械', excavator);
  const workerEntries = workers.map((worker, index) => register(
    `worker-${index + 1}`, index === 0 ? '物料工 · 01' : `结构班组 · ${String(index + 1).padStart(2, '0')}`,
    '工人', worker,
  ));

  const [unloadX, , unloadZ] = config.roads.unload;
  const [stockX, , stockZ] = config.stockpile;
  const [handoffX, , handoffZ] = config.crane.handoff;
  const [buildingX, , buildingZ] = config.building.position;
  const [west, south, east, north] = [
    Math.min(...config.roads.loop.map(point => point[0])),
    Math.max(...config.roads.loop.map(point => point[2])),
    Math.max(...config.roads.loop.map(point => point[0])),
    Math.min(...config.roads.loop.map(point => point[2])),
  ];
  const points = config.operations.paths ?? {};
  const arrive = route(points.arrive ?? [
    [east + 3.5, 0, south], [east - 4, 0, south], [unloadX + 12.3, 0, south - 0.65],
    [unloadX + 10.3, 0, unloadZ + 1.75], [unloadX + 7.9, 0, unloadZ + 0.16],
    [unloadX + 4, 0, unloadZ], [unloadX, 0, unloadZ],
  ]);
  const depart = route(points.depart ?? [
    [unloadX, 0, unloadZ], [unloadX - 5, 0, unloadZ], [unloadX - 8.6, 0, unloadZ + 0.7],
    [unloadX - 9.9, 0, unloadZ + 3.85], [unloadX - 6.7, 0, south - 0.3],
    [unloadX + 8, 0, south], [east + 3.5, 0, south],
  ]);
  const stockPose = [stockX, 0, stockZ + 1.7];
  const forkAtTruck = [unloadX + 4.28, 0, unloadZ];
  const forkAtTurn = [stockX + 1.6, 0, unloadZ + 1.3];
  const forkApproach = route(points.forkApproach ?? [
    stockPose, [stockX + 1.1, 0, stockZ + 4.8], [stockX + 1.4, 0, unloadZ - 2.8],
    [stockX + 0.72, 0, unloadZ - 0.52], [stockX - 0.36, 0, unloadZ], forkAtTruck,
  ]);
  const forkBack = route([
    forkAtTruck, [unloadX + 5.75, 0, unloadZ], [stockX + 1.14, 0, unloadZ + 0.14],
    [stockX + 1.6, 0, unloadZ + 0.75], forkAtTurn,
  ]);
  const forkDeliver = route(points.forkDeliver ?? [
    forkAtTurn, [stockX + 1.6, 0, unloadZ - 2.6], [stockX + 1.4, 0, stockZ + 5.1],
    [stockX, 0, stockZ + 2.7], stockPose,
  ]);
  const forkParkPose = [stockX + 1.36, 0, stockZ + 4.48];
  const forkPark = route([stockPose, [stockX, 0, stockZ + 2.7], [stockX + 0.24, 0, stockZ + 3.2], forkParkPose]);
  const forkReset = route([
    forkParkPose, [stockX + 0.80, 0, stockZ + 3.82], [stockX + 0.25, 0, stockZ + 2.85],
    [stockX + 0.9, 0, stockZ + 1.3], [stockX + 0.62, 0, stockZ + 0.8],
    [stockX - 0.22, 0, stockZ + 0.8], [stockX - 0.2, 0, stockZ + 1.15], stockPose,
  ]);
  const cartRoute = route(points.handoff ?? [
    [stockX, 0, stockZ], [stockX - 1.8, 0, stockZ - 0.23],
    [handoffX + 2.7, 0, handoffZ + 1.23], [handoffX, 0, handoffZ],
  ]);
  const mixingRoute = route(points.mixer ?? [
    [east, 0, 5], [east, 0, north + 5], [east - 4, 0, north],
    [1, 0, north], [west + 4, 0, north], [west, 0, north + 4],
    [west, 0, south - 5], [west + 4, 0, south],
    [1, 0, south], [east - 4, 0, south], [east, 0, south - 5],
  ], true);
  const peoplePaths = (points.workers ?? []).length ? points.workers.map(nodes => route(nodes)) : groundWorkerRoutes();
  const roofPaths = workers.map((_, index) => roofWorkerRoute(config, index));
  const crewDistance = 1.35;
  const workerStandby = [stockX + 3.9, 0, stockZ - 1.8];
  const staging = cartRoute.getPointAt(0).addScaledVector(cartRoute.getTangentAt(0), -crewDistance);
  const pickup = cartRoute.getPointAt(1).addScaledVector(cartRoute.getTangentAt(1), -crewDistance);
  const workerApproach = route([workerStandby, [stockX + 2.7, 0, stockZ - 0.7], staging.toArray()]);
  const workerReturn = route([pickup.toArray(), [handoffX + 3.6, 0, handoffZ - 0.4], [stockX, 0, stockZ - 1.7], workerStandby]);

  debugRoute(debug, arrive, '#ffd382');
  debugRoute(debug, depart, '#ffd382');
  debugRoute(debug, forkApproach, '#87cbaf');
  debugRoute(debug, forkDeliver, '#87cbaf');
  debugRoute(debug, cartRoute, '#ff936b');
  debugRoute(debug, mixingRoute, '#90c1d6');
  for (const path of peoplePaths) debugRoute(debug, path, '#e7c1a0');

  crane.root.position.set(...config.crane.base);
  excavator.root.position.set(...(config.operations.excavator ?? [7, 0, -2]));
  excavator.root.rotation.y = -0.85;
  const cargo = new THREE.Vector3();
  const cargoReport = [0, 0, 0];
  const base = crane.root.position;
  const target = new THREE.Vector3(buildingX + config.building.width * 0.364, 0, buildingZ);
  const pickYaw = -Math.atan2(handoffZ - base.z, handoffX - base.x);
  const pickRadius = Math.hypot(handoffX - base.x, handoffZ - base.z);
  const targetYaw = -Math.atan2(target.z - base.z, target.x - base.x);
  const targetRadius = Math.hypot(target.x - base.x, target.z - base.z);
  const cartY = 0.248;
  const hookClearance = 0.73;
  const cycle = config.operations.cycleMinutes;
  const schedule = {
    phaseOrigin: config.initialMinute - cycle * 2 / 65,
    cycle,
    start: config.craneDays[0] * config.minutesPerDay,
    end: config.craneDays[1] * config.minutesPerDay,
  };

  function updateTruck(phase) {
    if (phase < 8) {
      steerVehicle(truck, arrive, ramp(phase, 0, 8));
      haulerEntry.status = '进场';
      haulerEntry.detail = '南侧入口 → 卸料区';
    } else if (phase < 51) {
      steerVehicle(truck, arrive, 1, 0, false, true);
      haulerEntry.status = phase < 16 ? '靠站卸料' : '待发';
      haulerEntry.detail = phase < 16 ? '叉车接驳钢材' : '卸料结束，等待放行';
    } else {
      steerVehicle(truck, depart, ramp(phase, 51, 64), arrive.getLength());
      haulerEntry.status = '离场';
      haulerEntry.detail = '南侧出口 → 环路';
    }
    truck.door.rotation.x = -1.48 * (ease(phase, 8, 11) - ease(phase, 16, 20));
  }

  function updateForklift(phase) {
    const approachDistance = forkApproach.getLength();
    const backDistance = forkBack.getLength();
    const pickupHeight = 1.338;
    const carryHeight = 0.62;
    forklift.lift.position.y = 0.15;
    if (phase < 13) {
      steerVehicle(forklift, forkApproach, ramp(phase, 3, 13));
      forkliftEntry.status = phase < 3 ? '等候' : '接驳';
      forkliftEntry.detail = '驶向工程卡车后部';
    } else if (phase < 16) {
      steerVehicle(forklift, forkApproach, 1, 0, false, true);
      forklift.lift.position.y = lerp(0.15, pickupHeight, ease(phase, 13, 16));
      forkliftEntry.status = '接驳';
      forkliftEntry.detail = '升起货叉，接取钢材托盘';
    } else if (phase < 20.4) {
      steerVehicle(forklift, forkBack, ramp(phase, 16, 20.4), approachDistance, true);
      forklift.lift.position.y = lerp(pickupHeight, carryHeight, ease(phase, 16.7, 19));
      forkliftEntry.status = '运输';
      forkliftEntry.detail = '退出卡车尾部';
    } else if (phase < 27) {
      steerVehicle(forklift, forkDeliver, ramp(phase, 20.4, 27), approachDistance - backDistance);
      forklift.lift.position.y = carryHeight;
      forkliftEntry.status = '运输';
      forkliftEntry.detail = '卸料区 → 堆场';
    } else if (phase < 29) {
      steerVehicle(forklift, forkDeliver, 1, approachDistance - backDistance, false, true);
      forklift.lift.position.y = lerp(carryHeight, cartY, ease(phase, 27, 29));
      forkliftEntry.status = '交接';
      forkliftEntry.detail = '将托盘降至物料工推车';
    } else if (phase < 57) {
      const odometer = approachDistance - backDistance + forkDeliver.getLength();
      const progress = ramp(phase, 29, 33);
      steerVehicle(forklift, forkPark, progress, odometer, true, phase >= 33);
      forklift.lift.position.y = lerp(cartY, 0.15, ease(phase, 31, 34));
      forkliftEntry.status = '待命';
      forkliftEntry.detail = '物料已交由现场班组';
    } else {
      const odometer = approachDistance - backDistance + forkDeliver.getLength() - forkPark.getLength();
      steerVehicle(forklift, forkReset, ramp(phase, 57, 65), odometer);
      forkliftEntry.status = '回位';
      forkliftEntry.detail = '返回接驳准备点';
    }
  }

  function updateMixer(state) {
    const duration = config.operations.mixerLapMinutes ?? 72;
    const distance = mixingRoute.getLength();
    const time = (state.minutes - config.initialMinute) / duration + 0.995;
    steerVehicle(mixer, mixingRoute, modulo(time, 1), Math.floor(time) * distance);
    mixer.drum.rotation.z = state.minutes * 0.36;
    mixerEntry.status = '转运';
    mixerEntry.detail = '外侧环路 · 滚筒持续搅拌';
  }

  function updateExcavator(state) {
    const t = state.minutes * 0.51;
    excavator.swivel.rotation.y = Math.sin(t * 0.49) * 0.37;
    excavator.boom.rotation.x = 0.18 + Math.sin(t) * 0.20;
    excavator.arm.rotation.x = -0.27 + Math.sin(t + 1.1) * 0.31;
    excavator.bucket.rotation.x = 0.15 + Math.cos(t - 0.34) * 0.36;
    excavationEntry.status = Math.sin(t) > 0 ? '下挖' : '回收铲斗';
    excavationEntry.detail = '地基土方开挖';
  }

  function updateCrane(state, phase) {
    const mastHeight = Math.max(18.6, (state.floors + 1.85) * config.building.floorHeight);
    crane.tower.scale.y = mastHeight / crane.mastModelHeight;
    crane.jib.position.y = mastHeight;
    const roof = state.completedFloors * config.building.floorHeight + 0.25;
    const travel = Math.min(mastHeight - 2.0, Math.max(roof + 4.2, 9.25));
    const liftWeight = ease(phase, 42, 47) - ease(phase, 54, 62);
    const ready = 1 - ease(phase, 0, 10) + ease(phase, 62, 65);
    crane.jib.rotation.y = blendAngle(pickYaw, targetYaw, liftWeight) + ready * 0.32;
    crane.trolley.position.x = lerp(pickRadius, targetRadius, liftWeight) + ready * 1.3;

    let hookY = travel;
    let status = phase < 10 ? '预定位' : '等待物料';
    if (phase >= 34 && phase < 38) {
      hookY = lerp(travel, cartY + hookClearance, ease(phase, 34, 38));
      status = '落钩';
    } else if (phase >= 38 && phase < 42) {
      hookY = lerp(cartY + hookClearance, travel, ease(phase, 38, 42));
      status = '起吊';
    } else if (phase >= 42 && phase < 47) {
      status = '回转上料';
    } else if (phase >= 47 && phase < 50) {
      hookY = lerp(travel, roof + hookClearance, ease(phase, 47, 50));
      status = '落料';
    } else if (phase >= 50 && phase < 54) {
      hookY = lerp(roof + hookClearance, travel, ease(phase, 50, 54));
      status = '提钩';
    } else if (phase >= 54 && phase < 62) {
      status = '回位';
    }
    crane.hook.position.y = hookY - mastHeight;
    crane.cable.position.y = crane.hook.position.y * 0.5;
    crane.cable.scale.y = Math.max(0.05, -crane.hook.position.y);
    craneEntry.status = status;
    craneEntry.detail = phase < 42 || phase >= 54
      ? '工人交接点 · 东侧堆场'
      : `送往第 ${Math.max(1, state.completedFloors + 1)} 层作业面`;
    return { roof, hookY };
  }

  function updateTrackedMaterial(phase, active, delivery) {
    pallet.visible = active;
    cart.visible = active && phase >= 25 && phase < 44;
    cart.position.copy(cartRoute.getPointAt(ramp(phase, 29, 36)));
    cart.rotation.y = heading(cartRoute.getTangentAt(ramp(phase, 29, 36)));
    let stage = 'offsite';
    if (active && phase < 16) {
      truck.root.updateMatrixWorld(true);
      truck.root.localToWorld(cargo.set(0, 1.338, -2.58));
      pallet.rotation.y = truck.root.rotation.y;
      stage = 'truck';
    } else if (active && phase < 29) {
      forklift.root.updateMatrixWorld(true);
      forklift.root.localToWorld(cargo.set(0, forklift.lift.position.y, 1.70));
      pallet.rotation.y = forklift.root.rotation.y;
      stage = 'forklift';
    } else if (active && phase < 38) {
      cargo.copy(cart.position);
      cargo.y = cartY;
      pallet.rotation.y = cart.rotation.y;
      stage = 'worker';
    } else if (active && phase < 50) {
      const yaw = crane.jib.rotation.y;
      const radius = crane.trolley.position.x;
      cargo.set(base.x + Math.cos(yaw) * radius, delivery.hookY - hookClearance, base.z - Math.sin(yaw) * radius);
      pallet.rotation.y = blendAngle(cart.rotation.y, Math.PI * 0.5, ease(phase, 42, 47));
      stage = 'crane';
    } else if (active) {
      cargo.set(target.x, delivery.roof, target.z);
      pallet.rotation.y = Math.PI * 0.5;
      stage = 'delivered';
    }
    pallet.position.copy(cargo);
    return stage;
  }

  function updateWorker(worker, index, state, phase, active) {
    const entry = workerEntries[index];
    worker.root.visible = index < state.workers;
    if (!worker.root.visible) return;
    if (active && index === 0) {
      if (phase >= 22 && phase < 44) {
        const headingAngle = cart.rotation.y;
        worker.root.position.set(
          cart.position.x - Math.sin(headingAngle) * crewDistance, 0,
          cart.position.z - Math.cos(headingAngle) * crewDistance,
        );
        worker.root.rotation.y = headingAngle;
        const pushing = phase >= 29 && phase < 36;
        workerPose(worker, state.minutes, pushing, pushing, phase >= 36);
        entry.status = pushing ? '推车接力' : phase >= 36 ? '引导挂钩' : '接收物料';
        entry.detail = pushing ? '堆场 → 塔吊挂钩点' : '现场钢材转运';
      } else {
        const returning = phase >= 44;
        const path = returning ? workerReturn : workerApproach;
        const progress = returning ? ramp(phase, 44, 56) : ramp(phase, 12, 22);
        worker.root.position.copy(path.getPointAt(progress));
        worker.root.rotation.y = heading(path.getTangentAt(progress));
        const moving = progress > 0 && progress < 1;
        workerPose(worker, state.minutes, moving, false, false);
        entry.status = moving ? '行走' : '待命';
        entry.detail = returning ? '返回东侧堆场' : '准备接收钢材';
      }
      return;
    }
    const rooftop = index >= 10 && state.completedFloors > 0;
    const path = rooftop ? roofPaths[index] : peoplePaths[index % peoplePaths.length];
    const shift = 18.5 + index % 5 * 2.7;
    const walk = modulo(state.minutes + index * 4.13, shift);
    const outbound = walk < shift * 0.43;
    const inbound = walk >= shift * 0.57;
    const walking = outbound || inbound;
    const fraction = outbound ? ramp(walk, 0, shift * 0.43) : inbound ? 1 - ramp(walk, shift * 0.57, shift) : 1;
    worker.root.position.copy(path.getPointAt(fraction));
    if (rooftop) worker.root.position.y = state.completedFloors * config.building.floorHeight + 0.20;
    worker.root.rotation.y = heading(path.getTangentAt(fraction)) + (inbound ? Math.PI : 0);
    workerPose(worker, state.minutes + index * 0.95, walking, false, index % 3 !== 0);
    entry.status = walking ? '行走' : index % 3 === 0 ? '短暂休息' : '作业';
    entry.detail = rooftop ? '上部结构与楼板' : state.day < 3 ? '地基和土方区' : '结构与现场准备';
  }

  const stageText = {
    offsite: '土方开挖',
    truck: '卡车运输与卸料',
    forklift: '叉车转运钢材',
    worker: '工人接料并推送',
    crane: '塔吊起吊与落料',
    delivered: '钢材送达作业面',
  };

  function update(state) {
    const active = state.crane && !state.finished;
    const phase = 65 * modulo(state.minutes - schedule.phaseOrigin, cycle) / cycle;
    truck.root.visible = active && phase < 64.4;
    forklift.root.visible = active;
    mixer.root.visible = state.day >= 3 && !state.finished;
    crane.root.visible = active;
    excavator.root.visible = state.day < 3;
    if (truck.root.visible) updateTruck(phase);
    if (forklift.root.visible) updateForklift(phase);
    if (mixer.root.visible) updateMixer(state);
    if (excavator.root.visible) updateExcavator(state);
    const delivery = active ? updateCrane(state, phase) : null;
    const stage = updateTrackedMaterial(phase, active, delivery);
    for (let index = 0; index < workers.length; index += 1) updateWorker(workers[index], index, state, phase, active);
    for (const entry of entities.values()) entry.root.updateMatrixWorld(true);
    pool.update();
    for (const model of [truck, mixer, forklift]) snowOn(model, state.snow);
    setVehicleLights(state.lightsOn);
    debug.visible = Boolean(state.debug);
    state.operation = state.finished ? '场地开放' : !active && state.day >= 3 ? '围护收尾与场地整理' : stageText[stage];
    state.inventory = deliveryCount(state, schedule);
    state.cargoPhase = stage;
    state.cargoPosition = active ? cargo.toArray(cargoReport) : null;
  }

  return { entities, update, debug };
}
