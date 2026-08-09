import * as THREE from 'three';

import './style.css';
import { createMusic } from './audio';
import { createEnvironment } from './environment';
import { createGameplay, type GameplayController } from './gameplay';
import { createRobot } from './robot';
import {
  createHUD,
  HUD_STAGE_ADVANCE_EVENT,
  HUD_START_EVENT,
  type HUDStageAdvanceDetail,
} from './ui';

const mount = document.querySelector<HTMLDivElement>('#app');

if (!mount) {
  throw new Error('Game mount element was not found.');
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.08, 45);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute('aria-label', 'ちょぼが探検する、あたたかな3Dの部屋');
renderer.domElement.setAttribute('role', 'img');
renderer.domElement.tabIndex = 0;
mount.append(renderer.domElement);

const environment = createEnvironment(scene);
const robot = createRobot();
robot.group.position.copy(environment.spawnPoint);
scene.add(robot.group);

const music = createMusic();
let stageIndex = 0;
let started = false;
const hud = createHUD(environment.stages[0].collectiblePositions.length);

const createStageGameplay = (): GameplayController => {
  const stage = environment.stages[stageIndex];
  hud.setStage(stage.number, environment.stages.length);
  hud.setCount(0, stage.collectiblePositions.length);
  music.setStage(stage.number);
  return createGameplay({
    scene,
    camera,
    domElement: renderer.domElement,
    robot,
    environment,
    collectiblePositions: stage.collectiblePositions,
    hud,
    onComplete() {
      hud.showStageComplete(stage.number, stageIndex === environment.stages.length - 1);
    },
  });
};

let gameplay = createStageGameplay();
hud.showIntro();

window.addEventListener(HUD_START_EVENT, () => {
  started = true;
  const stage = environment.stages[stageIndex];
  music.setStage(stage.number);
  void music.start().catch(() => {
    hud.showHint('BGMを再生できませんでした。ゲームはそのまま遊べます。');
  });
  hud.showHint(stage.hint);
});

window.addEventListener(HUD_STAGE_ADVANCE_EVENT, (event) => {
  const detail = (event as CustomEvent<HUDStageAdvanceDetail>).detail;
  gameplay.dispose();

  if (detail.isFinal) {
    music.stop();
    stageIndex = 0;
    started = false;
    gameplay = createStageGameplay();
    hud.showIntro();
    return;
  }

  stageIndex = Math.min(stageIndex + 1, environment.stages.length - 1);
  hud.hideComplete();
  gameplay = createStageGameplay();
  const stage = environment.stages[stageIndex];
  hud.showHint(`${stage.title} — ${stage.hint}`);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  if (started) {
    gameplay.update(delta, elapsed);
  } else {
    robot.update(delta, elapsed, 'idle', false);
  }
  renderer.render(scene, camera);
});

const resize = (): void => {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(width, height, false);
};

window.addEventListener('resize', resize, { passive: true });

window.addEventListener('beforeunload', () => {
  renderer.setAnimationLoop(null);
  music.stop();
  gameplay.dispose();
  robot.dispose();
  renderer.dispose();
}, { once: true });
