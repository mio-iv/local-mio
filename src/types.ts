import type * as THREE from 'three';

export interface Collider {
  box: THREE.Box3;
  label: string;
}

export interface EnvironmentResult {
  room: THREE.Group;
  colliders: Collider[];
  spawnPoint: THREE.Vector3;
  stages: StageDefinition[];
}

export interface StageDefinition {
  number: number;
  title: string;
  hint: string;
  collectiblePositions: THREE.Vector3[];
}

export type RobotMood = 'idle' | 'moving' | 'collect' | 'happy';

export interface RobotController {
  group: THREE.Group;
  radius: number;
  update(delta: number, elapsed: number, mood: RobotMood, moving: boolean): void;
  setMood(mood: RobotMood): void;
  dispose(): void;
}

export interface HUDController {
  setCount(current: number, total: number): void;
  setStage(current: number, total: number): void;
  showHint(message: string): void;
  showStageComplete(stage: number, isFinal: boolean): void;
  hideComplete(): void;
  showIntro(): void;
  hideIntro(): void;
  updateDirection(angle: number): void;
}
