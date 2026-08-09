import * as THREE from 'three';

import type { RobotController, RobotMood } from './types';

const WHITE = 0xf9fbf8;
const MINT = 0x77e0ca;
const DARK_MINT = 0x39bba9;
const FACE_GLOW = '#79f8ef';

function createRoundedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  radius: number,
): THREE.BufferGeometry {
  const segments = 6;
  const geometry = new THREE.BoxGeometry(
    width,
    height,
    depth,
    segments,
    segments,
    segments,
  );
  const position = geometry.attributes.position;
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  const halfDepth = depth * 0.5;
  const coreX = Math.max(0, halfWidth - radius);
  const coreY = Math.max(0, halfHeight - radius);
  const coreZ = Math.max(0, halfDepth - radius);
  const vertex = new THREE.Vector3();
  const nearest = new THREE.Vector3();
  const offset = new THREE.Vector3();

  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position, index);
    nearest.set(
      THREE.MathUtils.clamp(vertex.x, -coreX, coreX),
      THREE.MathUtils.clamp(vertex.y, -coreY, coreY),
      THREE.MathUtils.clamp(vertex.z, -coreZ, coreZ),
    );
    offset.subVectors(vertex, nearest);
    if (offset.lengthSq() > 0) {
      offset.normalize().multiplyScalar(radius);
      vertex.copy(nearest).add(offset);
      position.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

interface FaceDisplay {
  texture: THREE.CanvasTexture;
  draw(mood: RobotMood, blinking: boolean, gesture: IdleGesture): void;
}

type IdleGesture = 'none' | 'yawn' | 'think';

function createFaceDisplay(): FaceDisplay {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The robot face requires a 2D canvas context.');
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const roundedRect = (
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): void => {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
  };

  const draw = (mood: RobotMood, blinking: boolean, gesture: IdleGesture): void => {
    context.clearRect(0, 0, canvas.width, canvas.height);

    const panelGradient = context.createLinearGradient(0, 20, 0, 300);
    panelGradient.addColorStop(0, '#18383b');
    panelGradient.addColorStop(0.28, '#071719');
    panelGradient.addColorStop(1, '#020809');
    roundedRect(8, 8, 496, 304, 88);
    context.fillStyle = panelGradient;
    context.fill();
    context.lineWidth = 7;
    context.strokeStyle = 'rgba(124, 255, 237, 0.20)';
    context.stroke();

    context.save();
    roundedRect(22, 20, 468, 280, 72);
    context.clip();
    const shine = context.createLinearGradient(30, 30, 390, 240);
    shine.addColorStop(0, 'rgba(255,255,255,0.19)');
    shine.addColorStop(0.32, 'rgba(255,255,255,0.035)');
    shine.addColorStop(0.6, 'rgba(255,255,255,0)');
    context.fillStyle = shine;
    context.fillRect(0, 0, 512, 320);
    context.restore();

    context.save();
    context.strokeStyle = FACE_GLOW;
    context.fillStyle = FACE_GLOW;
    context.shadowColor = FACE_GLOW;
    context.shadowBlur = mood === 'happy' || mood === 'collect' ? 25 : 16;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    if (gesture === 'yawn') {
      context.lineWidth = 16;
      context.beginPath();
      context.moveTo(126, 150);
      context.quadraticCurveTo(160, 166, 194, 150);
      context.moveTo(318, 150);
      context.quadraticCurveTo(352, 166, 386, 150);
      context.stroke();
    } else if (gesture === 'think') {
      context.beginPath();
      context.ellipse(173, 137, 25, 33, 0, 0, Math.PI * 2);
      context.ellipse(365, 137, 25, 33, 0, 0, Math.PI * 2);
      context.fill();
      context.font = '700 68px system-ui, sans-serif';
      context.fillText('?', 414, 119);
    } else if (blinking && mood !== 'happy' && mood !== 'collect') {
      context.lineWidth = 16;
      context.beginPath();
      context.moveTo(126, 151);
      context.lineTo(196, 151);
      context.moveTo(316, 151);
      context.lineTo(386, 151);
      context.stroke();
    } else if (mood === 'happy' || mood === 'collect') {
      context.lineWidth = 17;
      context.beginPath();
      context.arc(160, 164, 43, Math.PI * 1.12, Math.PI * 1.88);
      context.arc(352, 164, 43, Math.PI * 1.12, Math.PI * 1.88);
      context.stroke();
    } else {
      const eyeScale = mood === 'moving' ? 1.05 : 1;
      context.beginPath();
      context.ellipse(160, 150, 28 * eyeScale, 37 * eyeScale, 0, 0, Math.PI * 2);
      context.ellipse(352, 150, 28 * eyeScale, 37 * eyeScale, 0, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.fillStyle = 'rgba(255,255,255,0.72)';
      context.beginPath();
      context.arc(151, 139, 8, 0, Math.PI * 2);
      context.arc(343, 139, 8, 0, Math.PI * 2);
      context.fill();
    }

    context.strokeStyle = FACE_GLOW;
    context.shadowColor = FACE_GLOW;
    context.shadowBlur = 18;
    context.lineWidth = 13;
    context.beginPath();
    if (gesture === 'yawn') {
      context.ellipse(256, 214, 37, 52, 0, 0, Math.PI * 2);
    } else if (gesture === 'think') {
      context.moveTo(236, 222);
      context.quadraticCurveTo(255, 212, 276, 220);
    } else if (mood === 'happy') {
      context.arc(256, 178, 60, 0.13 * Math.PI, 0.87 * Math.PI);
    } else if (mood === 'collect') {
      context.arc(256, 188, 36, 0, Math.PI * 2);
    } else {
      context.arc(256, 178, 38, 0.18 * Math.PI, 0.82 * Math.PI);
    }
    context.stroke();
    context.restore();
    texture.needsUpdate = true;
  };

  draw('idle', false, 'none');
  return { texture, draw };
}

function prepareMesh(mesh: THREE.Mesh): THREE.Mesh {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Creates chobo's code-generated model and animation controller. */
export function createRobot(): RobotController {
  const group = new THREE.Group();
  group.name = 'chobo robot';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const whiteMaterial = new THREE.MeshStandardMaterial({
    color: WHITE,
    roughness: 0.38,
    metalness: 0.02,
  });
  const mintMaterial = new THREE.MeshStandardMaterial({
    color: MINT,
    roughness: 0.3,
    metalness: 0.03,
  });
  const darkMintMaterial = new THREE.MeshStandardMaterial({
    color: DARK_MINT,
    roughness: 0.3,
  });
  const jointMaterial = new THREE.MeshStandardMaterial({
    color: 0xc7d9d5,
    roughness: 0.48,
  });

  const bodyRoot = new THREE.Group();
  group.add(bodyRoot);

  const bodyGeometry = new THREE.SphereGeometry(0.56, 28, 20);
  bodyGeometry.scale(1, 1.22, 0.86);
  const body = prepareMesh(new THREE.Mesh(bodyGeometry, whiteMaterial));
  body.position.y = 0.88;
  bodyRoot.add(body);

  const bellyGeometry = new THREE.SphereGeometry(0.42, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.48);
  bellyGeometry.scale(1, 0.58, 0.75);
  const belly = prepareMesh(new THREE.Mesh(bellyGeometry, whiteMaterial));
  belly.rotation.x = Math.PI * 0.5;
  belly.position.set(0, 0.78, 0.415);
  bodyRoot.add(belly);

  const chestBadge = prepareMesh(
    new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), mintMaterial),
  );
  chestBadge.scale.set(1, 1.14, 0.32);
  chestBadge.position.set(0, 1.14, 0.47);
  bodyRoot.add(chestBadge);

  const badgeInset = new THREE.Mesh(
    new THREE.RingGeometry(0.037, 0.066, 3),
    new THREE.MeshBasicMaterial({ color: 0xf5fffc, toneMapped: false }),
  );
  badgeInset.position.set(0, 1.14, 0.518);
  badgeInset.rotation.z = Math.PI;
  bodyRoot.add(badgeInset);

  const headPivot = new THREE.Group();
  headPivot.position.y = 1.58;
  bodyRoot.add(headPivot);

  const head = prepareMesh(
    new THREE.Mesh(createRoundedBoxGeometry(1.28, 1.02, 1.02, 0.34), whiteMaterial),
  );
  headPivot.add(head);

  const faceDisplay = createFaceDisplay();
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 0.66),
    new THREE.MeshBasicMaterial({
      map: faceDisplay.texture,
      transparent: true,
      toneMapped: false,
    }),
  );
  face.position.set(0, -0.01, 0.522);
  headPivot.add(face);

  const topPanel = prepareMesh(
    new THREE.Mesh(createRoundedBoxGeometry(0.46, 0.075, 0.48, 0.035), mintMaterial),
  );
  topPanel.position.set(0, 0.515, -0.03);
  headPivot.add(topPanel);

  const sidePanelGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.065, 24);
  const leftSidePanel = prepareMesh(new THREE.Mesh(sidePanelGeometry, mintMaterial));
  leftSidePanel.rotation.z = Math.PI * 0.5;
  leftSidePanel.position.set(-0.645, 0, -0.02);
  headPivot.add(leftSidePanel);
  const rightSidePanel = leftSidePanel.clone();
  rightSidePanel.position.x = 0.645;
  headPivot.add(rightSidePanel);

  const neck = prepareMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.27, 0.22, 24), jointMaterial),
  );
  neck.position.y = 1.29;
  bodyRoot.add(neck);

  const armGeometry = new THREE.CapsuleGeometry(0.14, 0.39, 6, 14);
  const jointGeometry = new THREE.SphereGeometry(0.17, 18, 14);
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1] as const) {
    const armRoot = new THREE.Group();
    armRoot.position.set(side * 0.55, 1.07, 0);
    bodyRoot.add(armRoot);

    const joint = prepareMesh(new THREE.Mesh(jointGeometry, mintMaterial));
    joint.scale.set(0.82, 1, 0.82);
    armRoot.add(joint);

    const arm = prepareMesh(new THREE.Mesh(armGeometry, whiteMaterial));
    arm.position.set(side * 0.075, -0.25, 0.005);
    arm.rotation.z = side * -0.13;
    armRoot.add(arm);
    arms.push(armRoot);
  }

  const footGeometry = new THREE.SphereGeometry(0.23, 20, 14);
  const feet: THREE.Mesh[] = [];
  for (const side of [-1, 1] as const) {
    const foot = prepareMesh(new THREE.Mesh(footGeometry, darkMintMaterial));
    foot.scale.set(0.72, 0.42, 1.08);
    foot.position.set(side * 0.27, 0.2, 0.055);
    bodyRoot.add(foot);
    feet.push(foot);
  }

  let currentMood: RobotMood = 'idle';
  let renderedMood: RobotMood | null = null;
  let renderedBlink = false;
  let renderedGesture: IdleGesture | null = null;
  let blink = false;
  let blinkTimer = 2.1;
  let moodTime = 0;
  let previousElapsed = 0;
  let stillTime = 0;
  let nextGestureDelay = 3 + Math.random() * 2;
  let idleGesture: IdleGesture = 'none';
  let idleGestureTime = 0;

  const resetIdleGesture = (): void => {
    stillTime = 0;
    nextGestureDelay = 3 + Math.random() * 2;
    idleGesture = 'none';
    idleGestureTime = 0;
  };

  const setMood = (mood: RobotMood): void => {
    currentMood = mood;
    blink = false;
    blinkTimer = 1.7;
    moodTime = 0;
    resetIdleGesture();
  };

  const update = (
    delta: number,
    elapsed: number,
    mood: RobotMood,
    moving: boolean,
  ): void => {
    if (mood !== currentMood) setMood(mood);
    const safeDelta = Math.min(Math.max(delta, 0), 0.1);
    const time = Number.isFinite(elapsed) ? elapsed : previousElapsed + safeDelta;
    previousElapsed = time;
    moodTime += safeDelta;

    if (moving || currentMood !== 'idle') {
      if (stillTime > 0 || idleGesture !== 'none') resetIdleGesture();
    } else if (idleGesture === 'none') {
      stillTime += safeDelta;
      if (stillTime >= nextGestureDelay) {
        idleGesture = Math.random() < 0.5 ? 'yawn' : 'think';
        idleGestureTime = 0;
        blink = false;
      }
    } else {
      idleGestureTime += safeDelta;
      const gestureDuration = idleGesture === 'yawn' ? 2.25 : 2.7;
      if (idleGestureTime >= gestureDuration) resetIdleGesture();
    }

    blinkTimer -= safeDelta;
    if (blinkTimer <= 0 && currentMood !== 'happy' && currentMood !== 'collect') {
      blink = !blink;
      blinkTimer = blink ? 0.12 : 2.2 + Math.random() * 1.8;
    }

    if (
      renderedMood !== currentMood ||
      renderedBlink !== blink ||
      renderedGesture !== idleGesture
    ) {
      faceDisplay.draw(currentMood, blink, idleGesture);
      renderedMood = currentMood;
      renderedBlink = blink;
      renderedGesture = idleGesture;
    }

    const motionScale = reducedMotion ? 0.22 : 1;
    const movementWeight = moving ? 1 : 0;
    const happyWeight = currentMood === 'happy' ? 1 : 0;
    const collectWeight = currentMood === 'collect' ? 1 : 0;
    const gestureDuration = idleGesture === 'yawn' ? 2.25 : 2.7;
    const gestureProgress = idleGesture === 'none'
      ? 0
      : Math.min(1, idleGestureTime / gestureDuration);
    const gestureEnvelope = Math.sin(gestureProgress * Math.PI);
    const yawnWeight = idleGesture === 'yawn' ? gestureEnvelope : 0;
    const thinkWeight = idleGesture === 'think' ? gestureEnvelope : 0;
    const idleBob = Math.sin(time * 2.25) * 0.022 * motionScale;
    const moveBob = Math.abs(Math.sin(time * 8.8)) * 0.065 * movementWeight * motionScale;
    const celebrationBob = Math.abs(Math.sin(time * 6.2)) * 0.15 * happyWeight * motionScale;
    const collectHop =
      Math.sin(Math.min(1, collectWeight * moodTime * 2.6) * Math.PI) * 0.17;
    bodyRoot.position.y = idleBob + moveBob + celebrationBob + collectHop;

    bodyRoot.rotation.z = motionScale * (
      Math.sin(time * 8.8) * 0.055 * movementWeight +
      Math.sin(time * 5.2) * 0.075 * happyWeight);
    bodyRoot.rotation.x = Math.sin(time * 4.4) * 0.018 * (1 - movementWeight) * motionScale;
    headPivot.rotation.y = motionScale * (
      Math.sin(time * 0.85) * 0.05 * (1 - movementWeight) +
      Math.sin(time * 5.2) * 0.13 * happyWeight);
    headPivot.rotation.x = (-yawnWeight * 0.16 + Math.sin(gestureProgress * Math.PI * 2) * yawnWeight * 0.035) * motionScale;
    headPivot.rotation.z = -bodyRoot.rotation.z * 0.34 + thinkWeight * 0.18 * motionScale;

    const armSwing = Math.sin(time * (moving ? 8.8 : 2.1));
    arms[0].rotation.x = (armSwing * (moving ? 0.42 : 0.055) - happyWeight * 1.55) * motionScale;
    arms[1].rotation.x = (
      -armSwing * (moving ? 0.42 : 0.055) -
      happyWeight * 1.55 -
      yawnWeight * 1.18 -
      thinkWeight * 0.96
    ) * motionScale;
    arms[0].rotation.z = -happyWeight * 0.42 - collectWeight * 0.25;
    arms[1].rotation.z =
      happyWeight * 0.42 +
      collectWeight * 0.25 +
      yawnWeight * 0.22 +
      thinkWeight * 0.34;
    feet[0].position.y = 0.2 + Math.max(0, armSwing) * 0.035 * movementWeight * motionScale;
    feet[1].position.y = 0.2 + Math.max(0, -armSwing) * 0.035 * movementWeight * motionScale;
  };

  const dispose = (): void => {
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
    faceDisplay.texture.dispose();
  };

  return {
    group,
    radius: 0.54,
    update,
    setMood,
    dispose,
  };
}
