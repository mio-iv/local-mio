import * as THREE from 'three';

import {
  CHOBO_TOUCH_CAMERA_EVENT,
  CHOBO_TOUCH_MOVE_EVENT,
  type TouchCameraDetail,
  type TouchMoveDetail,
} from './input-events';
import type {
  Collider,
  EnvironmentResult,
  HUDController,
  RobotController,
  RobotMood,
} from './types';

export interface PlayBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface GameplayOptions {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  domElement: HTMLElement;
  robot: RobotController;
  environment: EnvironmentResult;
  collectiblePositions: readonly THREE.Vector3[];
  hud?: HUDController;
  bounds?: PlayBounds;
  moveSpeed?: number;
  onCollect?: (collected: number, total: number) => void;
  onComplete?: () => void;
}

export interface GameplayController {
  readonly collected: number;
  readonly total: number;
  readonly complete: boolean;
  update(delta: number, elapsed: number): void;
  reset(): void;
  dispose(): void;
}

interface Collectible {
  group: THREE.Group;
  halo: THREE.Mesh;
  sparkles: THREE.Points;
  baseY: number;
  phase: number;
  collected: boolean;
}

interface ParticleBurst {
  points: THREE.Points;
  positions: Float32Array;
  velocities: Float32Array;
  age: number;
  duration: number;
}

const DEFAULT_BOUNDS: PlayBounds = {
  minX: -8.6,
  maxX: 8.6,
  minZ: -6.4,
  maxZ: 6.4,
};
const INITIAL_CAMERA_YAW = Math.PI * 0.08;
const TOUCH_DEADZONE = 0.12;

const movementKeys = new Set([
  'w',
  'a',
  's',
  'd',
  'arrowup',
  'arrowleft',
  'arrowdown',
  'arrowright',
]);
const controlKeys = new Set([...movementKeys, 'q', 'e']);

/** True when a floor-plane circle overlaps a collider's X/Z footprint. */
export function circleIntersectsAABB(
  centerX: number,
  centerZ: number,
  radius: number,
  box: THREE.Box3,
): boolean {
  const closestX = THREE.MathUtils.clamp(centerX, box.min.x, box.max.x);
  const closestZ = THREE.MathUtils.clamp(centerZ, box.min.z, box.max.z);
  const deltaX = centerX - closestX;
  const deltaZ = centerZ - closestZ;
  return deltaX * deltaX + deltaZ * deltaZ < radius * radius;
}

function damp(current: number, target: number, smoothing: number, delta: number): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-smoothing * delta));
}

function dampAngle(current: number, target: number, smoothing: number, delta: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * (1 - Math.exp(-smoothing * delta));
}

function makeCollectible(position: THREE.Vector3, index: number): Collectible {
  const colors = [0x73f3df, 0xffdc76, 0xff91ad, 0x8ecaff];
  const color = colors[index % colors.length];
  const group = new THREE.Group();
  group.name = `Starlight part ${index + 1}`;
  group.position.copy(position);
  group.position.y = Math.max(position.y, 0.82);

  const coreMaterial = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.45,
    roughness: 0.22,
    metalness: 0.08,
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), coreMaterial);
  core.castShadow = true;
  group.add(core);

  const haloMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.025, 8, 28), haloMaterial);
  halo.rotation.x = Math.PI * 0.5;
  group.add(halo);

  const sparklePositions = new Float32Array(12 * 3);
  for (let sparkle = 0; sparkle < 12; sparkle += 1) {
    const angle = (sparkle / 12) * Math.PI * 2;
    const radius = 0.38 + (sparkle % 3) * 0.08;
    sparklePositions[sparkle * 3] = Math.cos(angle) * radius;
    sparklePositions[sparkle * 3 + 1] = ((sparkle % 4) - 1.5) * 0.12;
    sparklePositions[sparkle * 3 + 2] = Math.sin(angle) * radius;
  }
  const sparkleGeometry = new THREE.BufferGeometry();
  sparkleGeometry.setAttribute('position', new THREE.BufferAttribute(sparklePositions, 3));
  const sparkles = new THREE.Points(
    sparkleGeometry,
    new THREE.PointsMaterial({
      color,
      size: 0.085,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  group.add(sparkles);

  const light = new THREE.PointLight(color, 0.65, 2.5, 2);
  group.add(light);

  return {
    group,
    halo,
    sparkles,
    baseY: group.position.y,
    phase: index * 1.73,
    collected: false,
  };
}

function createBurst(position: THREE.Vector3, color: THREE.ColorRepresentation): ParticleBurst {
  const count = 24;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const angle = (index / count) * Math.PI * 2 + (index % 5) * 0.19;
    const horizontalSpeed = 0.85 + (index % 4) * 0.18;
    positions[offset] = position.x;
    positions[offset + 1] = position.y;
    positions[offset + 2] = position.z;
    velocities[offset] = Math.cos(angle) * horizontalSpeed;
    velocities[offset + 1] = 1.15 + (index % 6) * 0.16;
    velocities[offset + 2] = Math.sin(angle) * horizontalSpeed;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size: 0.13,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  return {
    points: new THREE.Points(geometry, material),
    positions,
    velocities,
    age: 0,
    duration: 1.15,
  };
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    }
  });
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
  );
}

/**
 * Wires input, movement, camera follow, collectibles, particles, HUD feedback and reset.
 * Add `robot.group` and `environment.room` to the scene before constructing this controller.
 */
export function createGameplay(options: GameplayOptions): GameplayController {
  const {
    scene,
    camera,
    domElement,
    robot,
    environment,
    collectiblePositions,
    hud,
    onCollect,
    onComplete,
  } = options;
  const bounds = options.bounds ?? DEFAULT_BOUNDS;
  const moveSpeed = options.moveSpeed ?? 3.15;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const keys = new Set<string>();
  const velocity = new THREE.Vector2();
  const desiredVelocity = new THREE.Vector2();
  const cameraTarget = new THREE.Vector3();
  const desiredCameraPosition = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();
  const ray = new THREE.Ray();
  const hit = new THREE.Vector3();
  const collectibles = collectiblePositions.map(makeCollectible);
  const bursts: ParticleBurst[] = [];
  let collected = 0;
  let complete = false;
  let cameraYaw = INITIAL_CAMERA_YAW;
  let pointerId: number | null = null;
  let pointerX = 0;
  let touchMoveX = 0;
  let touchMoveY = 0;
  let touchCameraDirection: -1 | 0 | 1 = 0;
  let collectMoodTimer = 0;
  let robotHeading = robot.group.rotation.y;

  for (const collectible of collectibles) scene.add(collectible.group);

  const celebrationGeometry = new THREE.BufferGeometry();
  const celebrationPositions = new Float32Array(48 * 3);
  celebrationGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(celebrationPositions, 3),
  );
  const celebration = new THREE.Points(
    celebrationGeometry,
    new THREE.PointsMaterial({
      color: 0xffe68b,
      size: 0.13,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  celebration.visible = false;
  celebration.frustumCulled = false;
  scene.add(celebration);

  const redrawCelebration = (elapsed: number): void => {
    for (let index = 0; index < 48; index += 1) {
      const offset = index * 3;
      const lane = index % 8;
      const cycle = (elapsed * (0.34 + lane * 0.014) + index * 0.137) % 1;
      const angle = index * 2.399 + elapsed * (0.65 + (index % 3) * 0.12);
      const radius = 0.65 + lane * 0.1 + Math.sin(elapsed * 2 + index) * 0.08;
      celebrationPositions[offset] = robot.group.position.x + Math.cos(angle) * radius;
      celebrationPositions[offset + 1] = robot.group.position.y + 0.35 + cycle * 2.5;
      celebrationPositions[offset + 2] = robot.group.position.z + Math.sin(angle) * radius;
    }
    celebrationGeometry.attributes.position.needsUpdate = true;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (!controlKeys.has(key) || isEditableTarget(event.target)) return;
    event.preventDefault();
    keys.add(key);
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    keys.delete(event.key.toLowerCase());
  };

  const clearTouchInput = (): void => {
    touchMoveX = 0;
    touchMoveY = 0;
    touchCameraDirection = 0;
  };

  const releasePointerCapture = (): void => {
    if (pointerId === null) return;
    if (domElement.hasPointerCapture?.(pointerId)) domElement.releasePointerCapture(pointerId);
    pointerId = null;
  };

  const onBlur = (): void => {
    keys.clear();
    clearTouchInput();
    releasePointerCapture();
  };

  const onTouchMove = (event: Event): void => {
    const detail = (event as CustomEvent<Partial<TouchMoveDetail>>).detail;
    const rawX = Number.isFinite(detail?.x)
      ? THREE.MathUtils.clamp(detail.x ?? 0, -1, 1)
      : 0;
    const rawY = Number.isFinite(detail?.y)
      ? THREE.MathUtils.clamp(detail.y ?? 0, -1, 1)
      : 0;
    const magnitude = Math.hypot(rawX, rawY);
    if (magnitude <= TOUCH_DEADZONE) {
      touchMoveX = 0;
      touchMoveY = 0;
      return;
    }

    const scaledMagnitude = Math.min(
      1,
      (magnitude - TOUCH_DEADZONE) / (1 - TOUCH_DEADZONE),
    );
    touchMoveX = (rawX / magnitude) * scaledMagnitude;
    touchMoveY = (rawY / magnitude) * scaledMagnitude;
  };

  const onTouchCamera = (event: Event): void => {
    const detail = (event as CustomEvent<Partial<TouchCameraDetail>>).detail;
    touchCameraDirection = detail?.direction === -1 || detail?.direction === 1
      ? detail.direction
      : 0;
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || pointerId !== null) return;
    pointerId = event.pointerId;
    pointerX = event.clientX;
    domElement.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    const deltaX = event.clientX - pointerX;
    pointerX = event.clientX;
    cameraYaw -= deltaX * 0.0065;
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    releasePointerCapture();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener(CHOBO_TOUCH_MOVE_EVENT, onTouchMove);
  window.addEventListener(CHOBO_TOUCH_CAMERA_EVENT, onTouchCamera);
  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerup', onPointerUp);
  domElement.addEventListener('pointercancel', onPointerUp);

  const isBlocked = (x: number, z: number): boolean => {
    if (
      x - robot.radius < bounds.minX ||
      x + robot.radius > bounds.maxX ||
      z - robot.radius < bounds.minZ ||
      z + robot.radius > bounds.maxZ
    ) {
      return true;
    }
    return environment.colliders.some((collider: Collider) =>
      circleIntersectsAABB(x, z, robot.radius, collider.box),
    );
  };

  const updateMovement = (delta: number): boolean => {
    if (complete) {
      velocity.set(0, 0);
      return false;
    }

    const horizontal =
      (keys.has('d') || keys.has('arrowright') ? 1 : 0) -
      (keys.has('a') || keys.has('arrowleft') ? 1 : 0) +
      touchMoveX;
    const vertical =
      (keys.has('w') || keys.has('arrowup') ? 1 : 0) -
      (keys.has('s') || keys.has('arrowdown') ? 1 : 0) +
      touchMoveY;
    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const rightX = -forwardZ;
    const rightZ = forwardX;
    desiredVelocity.set(
      forwardX * vertical + rightX * horizontal,
      forwardZ * vertical + rightZ * horizontal,
    );
    if (desiredVelocity.lengthSq() > 1) desiredVelocity.normalize();
    desiredVelocity.multiplyScalar(moveSpeed);

    velocity.x = damp(velocity.x, desiredVelocity.x, desiredVelocity.lengthSq() > 0 ? 13 : 18, delta);
    velocity.y = damp(velocity.y, desiredVelocity.y, desiredVelocity.lengthSq() > 0 ? 13 : 18, delta);
    if (velocity.lengthSq() < 0.0025) velocity.set(0, 0);

    const position = robot.group.position;
    const nextX = position.x + velocity.x * delta;
    if (!isBlocked(nextX, position.z)) {
      position.x = nextX;
    } else {
      velocity.x = 0;
    }
    const nextZ = position.z + velocity.y * delta;
    if (!isBlocked(position.x, nextZ)) {
      position.z = nextZ;
    } else {
      velocity.y = 0;
    }

    const physicallyMoving = velocity.lengthSq() > 0.04;
    const movementInputActive = desiredVelocity.lengthSq() > 0.0025;
    const moving = physicallyMoving || movementInputActive;
    if (moving) {
      const headingVelocity = physicallyMoving ? velocity : desiredVelocity;
      const desiredHeading = Math.atan2(headingVelocity.x, headingVelocity.y);
      robotHeading = dampAngle(robotHeading, desiredHeading, 14, delta);
      robot.group.rotation.y = robotHeading;
    }
    return moving;
  };

  const updateCamera = (delta: number): void => {
    const orbitDirection = THREE.MathUtils.clamp(
      (keys.has('e') ? 1 : 0) -
      (keys.has('q') ? 1 : 0) +
      touchCameraDirection,
      -1,
      1,
    );
    cameraYaw += orbitDirection * delta * 1.35;

    cameraTarget.set(
      robot.group.position.x,
      robot.group.position.y + 1.08,
      robot.group.position.z,
    );
    desiredCameraPosition.set(
      cameraTarget.x + Math.sin(cameraYaw) * 5.45,
      cameraTarget.y + 3.65,
      cameraTarget.z + Math.cos(cameraYaw) * 5.45,
    );
    desiredCameraPosition.x = THREE.MathUtils.clamp(
      desiredCameraPosition.x,
      bounds.minX + 0.35,
      bounds.maxX - 0.35,
    );
    desiredCameraPosition.z = THREE.MathUtils.clamp(
      desiredCameraPosition.z,
      bounds.minZ + 0.35,
      bounds.maxZ - 0.35,
    );

    cameraDirection.subVectors(desiredCameraPosition, cameraTarget);
    const desiredDistance = cameraDirection.length();
    cameraDirection.normalize();
    ray.set(cameraTarget, cameraDirection);
    let cameraDistance = desiredDistance;
    for (const collider of environment.colliders) {
      const intersection = ray.intersectBox(collider.box, hit);
      if (!intersection) continue;
      const distance = intersection.distanceTo(cameraTarget);
      if (distance > 0.75 && distance < cameraDistance) cameraDistance = Math.max(1.2, distance - 0.3);
    }
    desiredCameraPosition.copy(cameraTarget).addScaledVector(cameraDirection, cameraDistance);
    const follow = 1 - Math.exp(-7.5 * delta);
    camera.position.lerp(desiredCameraPosition, follow);
    camera.lookAt(cameraTarget);
  };

  const collect = (collectible: Collectible, index: number): void => {
    collectible.collected = true;
    collectible.group.visible = false;
    collected += 1;
    collectMoodTimer = 0.9;
    const color = [0x73f3df, 0xffdc76, 0xff91ad, 0x8ecaff][index % 4];
    const burst = createBurst(collectible.group.position, color);
    bursts.push(burst);
    scene.add(burst.points);
    hud?.setCount(collected, collectibles.length);
    onCollect?.(collected, collectibles.length);

    if (collected === collectibles.length) {
      complete = true;
      celebration.visible = !reducedMotion;
      robot.setMood('happy');
      onComplete?.();
    } else {
      robot.setMood('collect');
      hud?.showHint(`ほしあかり ${collected}/${collectibles.length} — あと ${collectibles.length - collected}つ！`);
    }
  };

  const updateCollectibles = (delta: number, elapsed: number): void => {
    const robotPosition = robot.group.position;
    for (let index = 0; index < collectibles.length; index += 1) {
      const collectible = collectibles[index];
      if (collectible.collected) continue;
      const time = elapsed + collectible.phase;
      const motionScale = reducedMotion ? 0.22 : 1;
      collectible.group.position.y = collectible.baseY + Math.sin(time * 2.1) * 0.12 * motionScale;
      collectible.group.rotation.y += delta * 1.25 * motionScale;
      collectible.halo.rotation.z -= delta * 0.8 * motionScale;
      collectible.sparkles.rotation.y -= delta * 0.45 * motionScale;
      const pulse = 0.92 + Math.sin(time * 3.1) * 0.11 * motionScale;
      collectible.halo.scale.setScalar(pulse);

      const deltaX = collectible.group.position.x - robotPosition.x;
      const deltaZ = collectible.group.position.z - robotPosition.z;
      const distanceSq = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSq < 1.02 * 1.02) collect(collectible, index);
    }
  };

  const updateBursts = (delta: number): void => {
    for (let burstIndex = bursts.length - 1; burstIndex >= 0; burstIndex -= 1) {
      const burst = bursts[burstIndex];
      burst.age += delta;
      for (let index = 0; index < burst.positions.length; index += 3) {
        burst.velocities[index + 1] -= 2.5 * delta;
        burst.positions[index] += burst.velocities[index] * delta;
        burst.positions[index + 1] += burst.velocities[index + 1] * delta;
        burst.positions[index + 2] += burst.velocities[index + 2] * delta;
      }
      burst.points.geometry.attributes.position.needsUpdate = true;
      const material = burst.points.material as THREE.PointsMaterial;
      material.opacity = Math.max(0, 1 - burst.age / burst.duration);
      material.size = 0.13 + burst.age * 0.08;
      if (burst.age < burst.duration) continue;
      scene.remove(burst.points);
      disposeObject(burst.points);
      bursts.splice(burstIndex, 1);
    }
  };

  const reset = (): void => {
    keys.clear();
    clearTouchInput();
    releasePointerCapture();
    collected = 0;
    complete = false;
    collectMoodTimer = 0;
    celebration.visible = false;
    velocity.set(0, 0);
    robot.group.position.copy(environment.spawnPoint);
    robot.group.rotation.y = 0;
    robotHeading = 0;
    cameraYaw = INITIAL_CAMERA_YAW;
    robot.setMood('idle');
    for (const collectible of collectibles) {
      collectible.collected = false;
      collectible.group.visible = true;
      collectible.group.position.y = collectible.baseY;
      collectible.group.rotation.set(0, 0, 0);
      collectible.halo.rotation.set(Math.PI * 0.5, 0, 0);
      collectible.halo.scale.setScalar(1);
      collectible.sparkles.rotation.set(0, 0, 0);
    }
    for (const burst of bursts) {
      scene.remove(burst.points);
      disposeObject(burst.points);
    }
    bursts.length = 0;
    hud?.setCount(0, collectibles.length);
  };

  const update = (delta: number, elapsed: number): void => {
    const safeDelta = Math.min(Math.max(delta, 0), 0.05);
    const moving = updateMovement(safeDelta);
    hud?.updateDirection(robotHeading);
    updateCamera(safeDelta);
    updateCollectibles(safeDelta, elapsed);
    updateBursts(safeDelta);
    collectMoodTimer = Math.max(0, collectMoodTimer - safeDelta);
    const mood: RobotMood = complete
      ? 'happy'
      : collectMoodTimer > 0
        ? 'collect'
        : moving
          ? 'moving'
          : 'idle';
    robot.update(safeDelta, elapsed, mood, moving);
    if (complete) redrawCelebration(elapsed);
  };

  const dispose = (): void => {
    keys.clear();
    clearTouchInput();
    releasePointerCapture();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener(CHOBO_TOUCH_MOVE_EVENT, onTouchMove);
    window.removeEventListener(CHOBO_TOUCH_CAMERA_EVENT, onTouchCamera);
    domElement.removeEventListener('pointerdown', onPointerDown);
    domElement.removeEventListener('pointermove', onPointerMove);
    domElement.removeEventListener('pointerup', onPointerUp);
    domElement.removeEventListener('pointercancel', onPointerUp);
    for (const collectible of collectibles) {
      scene.remove(collectible.group);
      disposeObject(collectible.group);
    }
    for (const burst of bursts) {
      scene.remove(burst.points);
      disposeObject(burst.points);
    }
    scene.remove(celebration);
    disposeObject(celebration);
  };

  const controller: GameplayController = {
    get collected() {
      return collected;
    },
    get total() {
      return collectibles.length;
    },
    get complete() {
      return complete;
    },
    update,
    reset,
    dispose,
  };

  hud?.setCount(0, collectibles.length);
  reset();
  cameraTarget.set(
    robot.group.position.x,
    robot.group.position.y + 1.08,
    robot.group.position.z,
  );
  camera.position.set(
    cameraTarget.x + Math.sin(cameraYaw) * 5.45,
    cameraTarget.y + 3.65,
    cameraTarget.z + Math.cos(cameraYaw) * 5.45,
  );
  camera.lookAt(cameraTarget);
  return controller;
}
