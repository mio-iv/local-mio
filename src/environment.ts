import * as THREE from 'three';

import type { Collider, EnvironmentResult } from './types';

const ROOM_WIDTH = 18;
const ROOM_DEPTH = 14;
const WALL_HEIGHT = 5.4;

const palette = {
  cream: 0xfff7e8,
  warmWhite: 0xfffcf5,
  wood: 0xdcae7b,
  darkWood: 0x9b694d,
  mint: 0x93d7c4,
  deepMint: 0x4f9f91,
  cyan: 0x77d8e8,
  blush: 0xf4b6bd,
  yellow: 0xf7d982,
  lavender: 0xc7b9e8,
  leaf: 0x75ad72,
  darkLeaf: 0x4f855a,
  terracotta: 0xc98265,
  ink: 0x4d5764,
};

const material = (
  color: THREE.ColorRepresentation,
  roughness = 0.78,
  metalness = 0,
): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

const materials = {
  cream: material(palette.cream, 0.92),
  warmWhite: material(palette.warmWhite, 0.88),
  wood: material(palette.wood, 0.72),
  darkWood: material(palette.darkWood, 0.76),
  mint: material(palette.mint, 0.72),
  deepMint: material(palette.deepMint, 0.68),
  cyan: material(palette.cyan, 0.58),
  blush: material(palette.blush, 0.78),
  yellow: material(palette.yellow, 0.72),
  lavender: material(palette.lavender, 0.8),
  leaf: material(palette.leaf, 0.82),
  darkLeaf: material(palette.darkLeaf, 0.84),
  terracotta: material(palette.terracotta, 0.82),
  ink: material(palette.ink, 0.7),
};

function setShadow(mesh: THREE.Mesh, cast = true, receive = true): THREE.Mesh {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function box(
  width: number,
  height: number,
  depth: number,
  meshMaterial: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), meshMaterial);
  mesh.position.set(x, y, z);
  return setShadow(mesh);
}

function cylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  meshMaterial: THREE.Material,
  x: number,
  y: number,
  z: number,
  segments = 20,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    meshMaterial,
  );
  mesh.position.set(x, y, z);
  return setShadow(mesh);
}

function addCollider(
  colliders: Collider[],
  label: string,
  centerX: number,
  centerZ: number,
  width: number,
  depth: number,
  height = WALL_HEIGHT,
): void {
  colliders.push({
    label,
    box: new THREE.Box3(
      new THREE.Vector3(centerX - width / 2, -0.5, centerZ - depth / 2),
      new THREE.Vector3(centerX + width / 2, height, centerZ + depth / 2),
    ),
  });
}

function createRoomShell(room: THREE.Group, colliders: Collider[]): void {
  const floor = box(ROOM_WIDTH, 0.24, ROOM_DEPTH, materials.wood, 0, -0.13, 0);
  floor.receiveShadow = true;
  floor.castShadow = false;
  room.add(floor);

  // Fine floor-board seams add scale without requiring a texture.
  const seamMaterial = material(0xb77d56, 1);
  for (let x = -8; x <= 8; x += 1) {
    const seam = box(0.018, 0.008, ROOM_DEPTH - 0.25, seamMaterial, x, 0.005, 0);
    seam.castShadow = false;
    room.add(seam);
  }

  const backWall = box(ROOM_WIDTH, WALL_HEIGHT, 0.2, materials.cream, 0, WALL_HEIGHT / 2, -7);
  const leftWall = box(0.2, WALL_HEIGHT, ROOM_DEPTH, materials.cream, -9, WALL_HEIGHT / 2, 0);
  const rightWall = box(0.2, WALL_HEIGHT, ROOM_DEPTH, materials.cream, 9, WALL_HEIGHT / 2, 0);
  backWall.castShadow = false;
  leftWall.castShadow = false;
  rightWall.castShadow = false;
  room.add(backWall, leftWall, rightWall);

  room.add(
    box(ROOM_WIDTH, 0.18, 0.14, materials.warmWhite, 0, 0.24, -6.84),
    box(0.14, 0.18, ROOM_DEPTH, materials.warmWhite, -8.84, 0.24, 0),
    box(0.14, 0.18, ROOM_DEPTH, materials.warmWhite, 8.84, 0.24, 0),
  );

  // Thin boundary colliders keep the robot inside while leaving the room visually open.
  addCollider(colliders, 'back wall', 0, -6.85, ROOM_WIDTH, 0.3);
  addCollider(colliders, 'left wall', -8.85, 0, 0.3, ROOM_DEPTH);
  addCollider(colliders, 'right wall', 8.85, 0, 0.3, ROOM_DEPTH);
  addCollider(colliders, 'front edge', 0, 6.85, ROOM_WIDTH, 0.3);
}

function createWindow(room: THREE.Group): void {
  const windowGroup = new THREE.Group();
  windowGroup.position.set(2.1, 3.35, -6.84);

  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 2.25),
    new THREE.MeshStandardMaterial({
      color: 0xbce6ef,
      emissive: 0x73b8ca,
      emissiveIntensity: 0.18,
      roughness: 0.5,
    }),
  );
  sky.position.z = 0.018;
  sky.receiveShadow = false;
  windowGroup.add(sky);

  windowGroup.add(
    box(3.72, 0.16, 0.14, materials.warmWhite, 0, 1.2, 0.08),
    box(3.72, 0.16, 0.14, materials.warmWhite, 0, -1.2, 0.08),
    box(0.16, 2.55, 0.14, materials.warmWhite, -1.78, 0, 0.08),
    box(0.16, 2.55, 0.14, materials.warmWhite, 1.78, 0, 0.08),
    box(0.1, 2.35, 0.13, materials.warmWhite, 0, 0, 0.09),
    box(3.5, 0.1, 0.13, materials.warmWhite, 0, 0, 0.09),
  );

  const curtainMaterial = materials.blush;
  const leftCurtain = box(0.52, 2.85, 0.18, curtainMaterial, -2.07, -0.05, 0.13);
  const rightCurtain = box(0.52, 2.85, 0.18, curtainMaterial, 2.07, -0.05, 0.13);
  leftCurtain.rotation.z = -0.04;
  rightCurtain.rotation.z = 0.04;
  windowGroup.add(leftCurtain, rightCurtain);
  room.add(windowGroup);
}

function createDesk(room: THREE.Group, colliders: Collider[]): void {
  const group = new THREE.Group();
  group.position.set(-5.65, 0, -5.15);

  group.add(box(5.05, 0.28, 1.75, materials.wood, 0, 2.05, 0));
  for (const x of [-2.25, 2.25]) {
    for (const z of [-0.65, 0.65]) {
      group.add(box(0.22, 1.96, 0.22, materials.darkWood, x, 0.98, z));
    }
  }

  // A friendly mint drawer unit, lamp, pencil cup, and mug make the desk feel lived-in.
  group.add(box(1.05, 1.72, 1.48, materials.mint, 1.67, 1.03, 0));
  for (const y of [0.52, 1.04, 1.56]) {
    group.add(box(0.92, 0.4, 0.06, materials.warmWhite, 1.67, y, 0.76));
    group.add(cylinder(0.055, 0.055, 0.08, materials.darkWood, 1.67, y, 0.83, 12));
  }

  const lampStem = cylinder(0.07, 0.09, 1.05, materials.deepMint, -1.5, 2.65, 0.05, 14);
  lampStem.rotation.z = -0.17;
  group.add(
    cylinder(0.45, 0.5, 0.1, materials.deepMint, -1.58, 2.23, 0.05, 20),
    lampStem,
    cylinder(0.28, 0.48, 0.42, materials.yellow, -1.4, 3.12, 0.05, 20),
  );

  const mug = cylinder(0.25, 0.23, 0.42, materials.blush, 0.45, 2.39, 0.18, 20);
  const mugHandle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.055, 8, 18), materials.blush);
  mugHandle.position.set(0.7, 2.43, 0.18);
  mugHandle.rotation.y = Math.PI / 2;
  setShadow(mugHandle);
  group.add(mug, mugHandle);

  const cup = cylinder(0.19, 0.16, 0.48, materials.lavender, -0.45, 2.42, -0.05, 16);
  group.add(cup);
  for (let index = 0; index < 3; index += 1) {
    const pencil = cylinder(0.025, 0.025, 0.72, index === 1 ? materials.cyan : materials.yellow, -0.54 + index * 0.09, 2.83, -0.05, 8);
    pencil.rotation.z = (index - 1) * 0.09;
    group.add(pencil);
  }

  room.add(group);
  addCollider(colliders, 'desk', -5.65, -5.15, 5.35, 2.15, 3.1);
}

function createChair(room: THREE.Group, colliders: Collider[]): void {
  const group = new THREE.Group();
  group.position.set(-4.45, 0, -2.45);
  group.rotation.y = -0.14;

  group.add(box(1.62, 0.25, 1.42, materials.yellow, 0, 1.12, 0));
  for (const x of [-0.63, 0.63]) {
    for (const z of [-0.52, 0.52]) {
      const leg = box(0.17, 1.04, 0.17, materials.darkWood, x, 0.52, z);
      leg.rotation.z = x * 0.035;
      group.add(leg);
    }
  }
  group.add(
    box(1.62, 1.35, 0.22, materials.yellow, 0, 1.87, -0.57),
    box(1.25, 0.55, 0.16, materials.warmWhite, 0, 1.9, -0.43),
  );
  room.add(group);
  addCollider(colliders, 'chair', -4.45, -2.45, 2.0, 1.85, 2.6);
}

function createShelf(room: THREE.Group, colliders: Collider[]): void {
  const group = new THREE.Group();
  group.position.set(7.15, 0, -4.95);

  group.add(
    box(2.75, 0.25, 1.45, materials.darkWood, 0, 0.16, 0),
    box(0.22, 4.15, 1.38, materials.darkWood, -1.27, 2.15, 0),
    box(0.22, 4.15, 1.38, materials.darkWood, 1.27, 2.15, 0),
    box(2.72, 0.2, 1.4, materials.wood, 0, 1.15, 0),
    box(2.72, 0.2, 1.4, materials.wood, 0, 2.3, 0),
    box(2.72, 0.2, 1.4, materials.wood, 0, 3.45, 0),
    box(2.75, 0.24, 1.45, materials.darkWood, 0, 4.25, 0),
  );

  const bookColors = [materials.blush, materials.mint, materials.yellow, materials.lavender, materials.cyan];
  const shelves = [1.3, 2.45, 3.6];
  shelves.forEach((baseY, shelfIndex) => {
    for (let index = 0; index < 5; index += 1) {
      const height = 0.58 + ((index + shelfIndex) % 3) * 0.09;
      const book = box(
        0.25,
        height,
        0.82,
        bookColors[(index + shelfIndex) % bookColors.length],
        -0.92 + index * 0.34,
        baseY + height / 2,
        -0.08,
      );
      book.rotation.z = index === 4 ? -0.13 : 0;
      group.add(book);
    }
  });

  room.add(group);
  addCollider(colliders, 'book shelf', 7.15, -4.95, 3.05, 1.85, 4.4);
}

function createPlant(room: THREE.Group, colliders: Collider[]): void {
  const group = new THREE.Group();
  group.position.set(7.15, 0, 4.95);
  group.add(
    cylinder(0.64, 0.48, 0.92, materials.terracotta, 0, 0.46, 0, 22),
    cylinder(0.48, 0.48, 0.06, materials.darkWood, 0, 0.94, 0, 22),
    cylinder(0.1, 0.13, 1.45, materials.darkLeaf, 0, 1.53, 0, 12),
  );

  const leafGeometry = new THREE.SphereGeometry(0.58, 14, 10);
  const leafData: Array<[number, number, number, number, number]> = [
    [-0.38, 1.65, 0.05, -0.55, 0.45],
    [0.4, 1.8, 0.03, 0.52, -0.35],
    [-0.18, 2.18, -0.1, -0.28, 0.16],
    [0.22, 2.42, 0.08, 0.2, -0.2],
    [0.03, 2.75, -0.02, 0.05, 0.05],
  ];
  leafData.forEach(([x, y, z, rz, ry], index) => {
    const leaf = new THREE.Mesh(leafGeometry, index % 2 === 0 ? materials.leaf : materials.darkLeaf);
    leaf.position.set(x, y, z);
    leaf.scale.set(0.55, 1, 0.32);
    leaf.rotation.set(0, ry, rz);
    setShadow(leaf);
    group.add(leaf);
  });
  room.add(group);
  addCollider(colliders, 'plant', 7.15, 4.95, 1.65, 1.65, 3.3);
}

function createStorageCorner(room: THREE.Group, colliders: Collider[]): void {
  const group = new THREE.Group();
  group.position.set(-7.15, 0, 4.85);

  group.add(
    box(2.35, 1.12, 1.7, materials.mint, 0, 0.56, 0),
    box(2.42, 0.18, 1.78, materials.deepMint, 0, 1.16, 0),
    box(0.15, 0.08, 0.7, materials.warmWhite, 0, 0.77, 0.86),
    box(1.4, 0.78, 1.22, materials.blush, 0.35, 1.65, -0.05),
    box(1.48, 0.16, 1.3, materials.yellow, 0.35, 2.09, -0.05),
  );

  room.add(group);
  addCollider(colliders, 'storage boxes', -7.15, 4.85, 2.8, 2.15, 2.2);
}

function createSoftCorner(room: THREE.Group, colliders: Collider[]): void {
  const group = new THREE.Group();
  group.position.set(-7.2, 0, 1.25);

  const cushion = cylinder(0.8, 0.88, 0.42, materials.lavender, 0, 0.2, 0, 28);
  cushion.scale.z = 0.72;
  const upper = cylinder(0.6, 0.68, 0.35, materials.blush, 0.22, 0.55, -0.12, 28);
  upper.scale.z = 0.72;
  upper.rotation.z = 0.1;
  group.add(cushion, upper);
  room.add(group);
  addCollider(colliders, 'floor cushions', -7.1, 1.2, 1.8, 1.6, 0.8);
}

function createRugAndToys(room: THREE.Group, colliders: Collider[]): void {
  const rug = cylinder(2.55, 2.55, 0.045, materials.warmWhite, 0.8, 0.035, 1.25, 48);
  rug.scale.set(1.45, 1, 0.82);
  rug.castShadow = false;
  room.add(rug);

  const innerRug = cylinder(2.22, 2.22, 0.052, materials.mint, 0.8, 0.062, 1.25, 48);
  innerRug.scale.set(1.45, 1, 0.82);
  innerRug.castShadow = false;
  room.add(innerRug);

  const toyGroup = new THREE.Group();
  toyGroup.position.set(4.9, 0, 3.85);
  const colors = [materials.yellow, materials.blush, materials.cyan, materials.lavender];
  const blocks: Array<[number, number, number, number]> = [
    [0, 0.25, 0, 0],
    [0.5, 0.2, 0.15, 0.2],
    [-0.45, 0.18, 0.25, -0.18],
    [0.08, 0.66, 0.02, 0.35],
  ];
  blocks.forEach(([x, y, z, rotation], index) => {
    const size = index === 0 ? 0.5 : 0.38;
    const block = box(size, size, size, colors[index], x, y, z);
    block.rotation.y = rotation;
    toyGroup.add(block);
  });

  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.35, 18, 12), materials.yellow);
  ball.position.set(0.9, 0.34, -0.25);
  setShadow(ball);
  toyGroup.add(ball);
  room.add(toyGroup);
  addCollider(colliders, 'toy blocks', 5.25, 3.75, 2.15, 1.35, 1.05);
}

function createWallDecor(room: THREE.Group): void {
  const frame = new THREE.Group();
  frame.position.set(-2.1, 3.65, -6.82);
  frame.add(
    box(1.65, 1.32, 0.12, materials.darkWood, 0, 0, 0),
    box(1.37, 1.04, 0.13, materials.warmWhite, 0, 0, 0.08),
  );

  const sun = new THREE.Mesh(new THREE.CircleGeometry(0.24, 20), materials.yellow);
  sun.position.set(0.33, 0.23, 0.16);
  const hill = new THREE.Mesh(new THREE.CircleGeometry(0.48, 24, 0, Math.PI), materials.mint);
  hill.position.set(-0.2, -0.25, 0.16);
  hill.rotation.z = Math.PI;
  frame.add(sun, hill);
  room.add(frame);

  const bunting = new THREE.Group();
  bunting.position.set(-5.85, 4.35, -6.82);
  const cord = box(4.25, 0.035, 0.025, materials.ink, 0, 0, 0);
  cord.rotation.z = -0.025;
  bunting.add(cord);
  const flagColors = [materials.blush, materials.yellow, materials.mint, materials.cyan, materials.lavender];
  for (let index = 0; index < 5; index += 1) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.22, 0.16);
    shape.lineTo(0.22, 0.16);
    shape.lineTo(0, -0.35);
    shape.closePath();
    const flag = new THREE.Mesh(new THREE.ShapeGeometry(shape), flagColors[index]);
    flag.position.set(-1.65 + index * 0.82, -0.22 - Math.abs(index - 2) * 0.035, 0.03);
    flag.castShadow = true;
    bunting.add(flag);
  }
  room.add(bunting);
}

function createLighting(room: THREE.Group): void {
  const hemisphere = new THREE.HemisphereLight(0xfff5dc, 0x617077, 1.9);
  room.add(hemisphere);

  const keyLight = new THREE.DirectionalLight(0xffe2b8, 3.2);
  keyLight.position.set(-3.5, 8.5, 4.8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -10;
  keyLight.shadow.camera.right = 10;
  keyLight.shadow.camera.top = 9;
  keyLight.shadow.camera.bottom = -9;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 22;
  keyLight.shadow.bias = -0.00035;
  keyLight.shadow.normalBias = 0.035;
  room.add(keyLight, keyLight.target);

  const windowGlow = new THREE.PointLight(0xbceeff, 6, 9, 2);
  windowGlow.position.set(2.1, 3.2, -5.8);
  windowGlow.castShadow = false;
  room.add(windowGlow);

  const ceilingShade = cylinder(0.7, 0.36, 0.45, materials.yellow, 0, 5.1, 0.3, 28);
  const ceilingBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0xfff4cf,
      emissive: 0xffd88a,
      emissiveIntensity: 1.4,
      roughness: 0.35,
    }),
  );
  ceilingBulb.position.set(0, 4.86, 0.3);
  room.add(ceilingShade, ceilingBulb);
}

export function createEnvironment(scene: THREE.Scene): EnvironmentResult {
  const room = new THREE.Group();
  room.name = 'Cozy room';
  const colliders: Collider[] = [];

  scene.background = new THREE.Color(0xf7ead8);
  scene.fog = new THREE.Fog(0xf7ead8, 16, 28);

  createRoomShell(room, colliders);
  createWindow(room);
  createDesk(room, colliders);
  createChair(room, colliders);
  createShelf(room, colliders);
  createPlant(room, colliders);
  createStorageCorner(room, colliders);
  createSoftCorner(room, colliders);
  createRugAndToys(room, colliders);
  createWallDecor(room);
  createLighting(room);

  scene.add(room);

  return {
    room,
    colliders,
    spawnPoint: new THREE.Vector3(0, 0, 3.25),
    stages: [
      {
        number: 1,
        title: 'はじめのひかり',
        hint: 'ラグのまわりを歩いて、近くのひかりを集めよう。',
        collectiblePositions: [
          new THREE.Vector3(-1.4, 0.68, 2.2),
          new THREE.Vector3(1.15, 0.68, 0.35),
          new THREE.Vector3(3.05, 0.68, 2.35),
        ],
      },
      {
        number: 2,
        title: 'おへやをひとめぐり',
        hint: 'カメラを回しながら、おへやのすみまで探してみよう。',
        collectiblePositions: [
          new THREE.Vector3(-1.45, 0.68, -4.75),
          new THREE.Vector3(4.75, 0.68, -1.25),
          new THREE.Vector3(3.15, 0.68, 4.75),
          new THREE.Vector3(-4.35, 0.68, 3.9),
        ],
      },
      {
        number: 3,
        title: 'かくれたひかり',
        hint: '家具のそばにもひかりがあるよ。ゆっくり回り込んでみよう。',
        collectiblePositions: [
          new THREE.Vector3(-2.05, 0.68, -4.85),
          new THREE.Vector3(4.85, 0.68, -4.75),
          new THREE.Vector3(-6.05, 0.68, -2.65),
          new THREE.Vector3(-5, 0.68, 3.05),
          new THREE.Vector3(5.45, 0.68, 5.2),
        ],
      },
    ],
  };
}
