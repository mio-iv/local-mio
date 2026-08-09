import {
  CHOBO_TOUCH_CAMERA_EVENT,
  CHOBO_TOUCH_MOVE_EVENT,
  type TouchCameraDetail,
  type TouchMoveDetail,
} from './input-events';
import type { HUDController } from './types';

export const HUD_START_EVENT = 'chobo-game-start';
export const HUD_STAGE_ADVANCE_EVENT = 'chobo-stage-advance';

export interface HUDStageAdvanceDetail {
  source: ActivationSource;
  stage: number;
  isFinal: boolean;
}

let teardownCurrentHUD: (() => void) | undefined;

type ActivationSource = 'keyboard' | 'pointer';

const JOYSTICK_DEADZONE = 7;
const JOYSTICK_MAX_RADIUS = 42;

function emitStart(source: ActivationSource): void {
  window.dispatchEvent(new CustomEvent(HUD_START_EVENT, { detail: { source } }));
}

function emitStageAdvance(detail: HUDStageAdvanceDetail): void {
  window.dispatchEvent(new CustomEvent(HUD_STAGE_ADVANCE_EVENT, { detail }));
}

function emitTouchMove(x: number, y: number): void {
  const detail: TouchMoveDetail = { x, y };
  window.dispatchEvent(new CustomEvent(CHOBO_TOUCH_MOVE_EVENT, { detail }));
}

function emitTouchCamera(direction: -1 | 0 | 1): void {
  const detail: TouchCameraDetail = { direction };
  window.dispatchEvent(new CustomEvent(CHOBO_TOUCH_CAMERA_EVENT, { detail }));
}

function safeWhole(value: number, fallback: number, minimum = 0): number {
  return Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : fallback;
}

function normaliseAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  return ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

function headingLabel(angle: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(normaliseAngle(angle) / (Math.PI / 4)) % directions.length;
  return directions[index];
}

/**
 * Builds the title, in-game HUD, and stage-result UI.
 *
 * Integration events (dispatched on window):
 * - `chobo-game-start`: the visible start button is clicked or Enter is pressed.
 * - `chobo-stage-advance`: a result button is clicked or Enter is pressed. Its
 *   detail contains `{ source, stage, isFinal }`; final means return to title.
 */
export function createHUD(total: number): HUDController {
  teardownCurrentHUD?.();
  document.querySelector<HTMLElement>('[data-chobo-ui]')?.remove();

  const initialPartTotal = safeWhole(total, 3);
  const root = document.createElement('div');
  const gameSurface = document.querySelector<HTMLElement>('#app');
  gameSurface?.setAttribute('inert', '');
  gameSurface?.setAttribute('aria-hidden', 'true');
  root.className = 'chobo-ui';
  root.dataset.choboUi = '';
  root.innerHTML = `
    <header class="hud-top" aria-label="ゲームの進み具合">
      <section class="part-counter" aria-label="集めたほしあかりパーツ" aria-live="polite" aria-atomic="true">
        <span class="counter-icon" aria-hidden="true">✦</span>
        <span class="counter-copy">
          <span class="counter-label">ほしあかり</span>
          <span class="counter-value"><strong data-count>0</strong><span aria-hidden="true"> / </span><span data-total>${initialPartTotal}</span></span>
        </span>
        <span class="part-pips" data-pips aria-hidden="true"></span>
      </section>

      <section class="stage-indicator" data-stage-indicator aria-label="ステージ 1、全3ステージ" aria-live="polite" aria-atomic="true">
        <span>STAGE</span>
        <strong data-stage>1</strong>
        <small aria-hidden="true">/</small>
        <b data-stage-total>3</b>
      </section>

      <section class="compass" aria-label="ちょぼの向き">
        <span class="compass-caption">むき</span>
        <span class="compass-dial" aria-hidden="true">
          <span class="compass-cardinal compass-north">N</span>
          <span class="compass-cardinal compass-east">E</span>
          <span class="compass-cardinal compass-south">S</span>
          <span class="compass-cardinal compass-west">W</span>
          <span class="compass-needle" data-compass-needle></span>
          <span class="compass-center"></span>
        </span>
        <strong class="compass-heading" data-heading>N</strong>
      </section>
    </header>

    <aside class="controls-card" aria-label="操作ガイド">
      <span class="controls-title">そうさ</span>
      <span class="control-item"><kbd>WASD</kbd><span>あるく</span></span>
      <span class="control-item"><kbd>↑←↓→</kbd><span>あるく</span></span>
      <span class="control-item"><kbd>Q</kbd><kbd>E</kbd><span>カメラ</span></span>
      <span class="control-item mouse-control"><span class="mouse-icon" aria-hidden="true"></span><span>ドラッグ</span></span>
    </aside>

    <section class="touch-controls" data-touch-controls aria-label="タッチ操作">
      <div class="touch-move-control" data-joystick role="group" aria-label="移動ジョイスティック">
        <span class="joystick-guide" aria-hidden="true"></span>
        <span class="joystick-knob" data-joystick-knob aria-hidden="true"></span>
        <span class="joystick-label" aria-hidden="true">MOVE</span>
      </div>
      <div class="touch-camera-controls" role="group" aria-label="カメラ操作">
        <button class="touch-camera-button" type="button" data-touch-camera="-1" aria-label="カメラを左に回す">
          <span aria-hidden="true">‹</span>
        </button>
        <button class="touch-camera-button" type="button" data-touch-camera="1" aria-label="カメラを右に回す">
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </section>

    <div class="hint-toast" data-hint role="status" aria-live="polite" aria-atomic="true"></div>

    <section class="intro-overlay" data-intro role="dialog" aria-modal="true" aria-labelledby="intro-title" aria-describedby="intro-copy">
      <div class="intro-card">
        <div class="signal-mark" aria-hidden="true"><span></span><span></span><span></span></div>
        <p class="eyebrow">chobo // きどうログ 01</p>
        <h1 id="intro-title">おはよう、ちょぼ。</h1>
        <p id="intro-copy" class="intro-copy">小さな部屋に、ほしあかりパーツがこぼれちゃった。<br>3つのステージを、のんびり探検しよう。</p>
        <div class="intro-controls" aria-label="基本操作">
          <span><kbd>WASD</kbd><small>または矢印で歩く</small></span>
          <span><kbd>Q</kbd><kbd>E</kbd><small>カメラを回す</small></span>
          <span><i aria-hidden="true">✦</i><small>近づくと自動でひろう</small></span>
        </div>
        <div class="touch-intro-controls" aria-label="タッチでの基本操作">
          <span><i class="touch-demo-stick" aria-hidden="true"><b></b></i><small>左スティックで歩く</small></span>
          <span><i class="touch-demo-camera" aria-hidden="true"><b>‹</b><b>›</b></i><small>右ボタンでカメラ</small></span>
          <span><i class="touch-demo-star" aria-hidden="true">✦</i><small>近づくと自動でひろう</small></span>
        </div>
        <button class="primary-button" type="button" data-start aria-keyshortcuts="Enter">
          <span>たんけんを はじめる</span>
          <small class="keyboard-shortcut">Enter</small>
          <small class="touch-shortcut">タップ</small>
        </button>
        <p class="gentle-note">急がなくて大丈夫。ちょぼのペースで。</p>
      </div>
    </section>

    <section class="complete-overlay" data-complete role="dialog" aria-modal="true" aria-labelledby="complete-title" aria-describedby="complete-copy" aria-hidden="true" hidden>
      <div class="complete-card">
        <div class="celebration-stars" aria-hidden="true">
          <i>✦</i><i>·</i><i>✧</i><i>✦</i><i>·</i>
        </div>
        <p class="eyebrow" data-complete-eyebrow>STAGE CLEAR</p>
        <div class="happy-face" aria-hidden="true"><span>⌒</span><span>⌒</span><b>ᴗ</b></div>
        <h2 id="complete-title" data-complete-title>ステージ クリア！</h2>
        <p id="complete-copy" data-complete-copy>ほしあかりを、ぜんぶ見つけた！</p>
        <button class="primary-button advance-button" type="button" data-advance aria-keyshortcuts="Enter">
          <span data-advance-label>つぎのステージへ</span>
          <small class="keyboard-shortcut">Enter</small>
          <small class="touch-shortcut">タップ</small>
        </button>
      </div>
    </section>
  `;

  document.body.append(root);

  const countElement = root.querySelector<HTMLElement>('[data-count]')!;
  const totalElement = root.querySelector<HTMLElement>('[data-total]')!;
  const pipsElement = root.querySelector<HTMLElement>('[data-pips]')!;
  const counterElement = root.querySelector<HTMLElement>('.part-counter')!;
  const stageIndicator = root.querySelector<HTMLElement>('[data-stage-indicator]')!;
  const stageElement = root.querySelector<HTMLElement>('[data-stage]')!;
  const stageTotalElement = root.querySelector<HTMLElement>('[data-stage-total]')!;
  const needleElement = root.querySelector<HTMLElement>('[data-compass-needle]')!;
  const headingElement = root.querySelector<HTMLElement>('[data-heading]')!;
  const compassElement = root.querySelector<HTMLElement>('.compass')!;
  const hintElement = root.querySelector<HTMLElement>('[data-hint]')!;
  const joystickElement = root.querySelector<HTMLElement>('[data-joystick]')!;
  const joystickKnob = root.querySelector<HTMLElement>('[data-joystick-knob]')!;
  const cameraButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-touch-camera]'));
  const introElement = root.querySelector<HTMLElement>('[data-intro]')!;
  const startButton = root.querySelector<HTMLButtonElement>('[data-start]')!;
  const completeElement = root.querySelector<HTMLElement>('[data-complete]')!;
  const completeEyebrow = root.querySelector<HTMLElement>('[data-complete-eyebrow]')!;
  const completeTitle = root.querySelector<HTMLElement>('[data-complete-title]')!;
  const completeCopy = root.querySelector<HTMLElement>('[data-complete-copy]')!;
  const advanceButton = root.querySelector<HTMLButtonElement>('[data-advance]')!;
  const advanceLabel = root.querySelector<HTMLElement>('[data-advance-label]')!;

  let currentTotal = initialPartTotal;
  let currentStage = 1;
  let stageTotal = 3;
  let completedStage = 1;
  let finalStageComplete = false;
  let introVisible = true;
  let completeVisible = false;
  let advanceLocked = false;
  let hintTimer: number | undefined;
  let lastHeading = '';
  let joystickPointerId: number | null = null;
  let joystickCenterX = 0;
  let joystickCenterY = 0;
  let joystickMaxRadius = JOYSTICK_MAX_RADIUS;
  let cameraPointerId: number | null = null;
  let activeCameraButton: HTMLButtonElement | null = null;
  const compactTouchQuery = window.matchMedia('(pointer: coarse) and (max-height: 400px)');

  const renderPips = (current: number, pipTotal: number): void => {
    pipsElement.replaceChildren();
    for (let index = 0; index < pipTotal; index += 1) {
      const pip = document.createElement('i');
      if (index < current) pip.className = 'is-collected';
      pipsElement.append(pip);
    }
  };

  const renderStage = (): void => {
    stageElement.textContent = String(currentStage);
    stageTotalElement.textContent = String(stageTotal);
    stageIndicator.setAttribute('aria-label', `ステージ ${currentStage}、全${stageTotal}ステージ`);
  };

  const focusGame = (): void => {
    gameSurface?.querySelector<HTMLCanvasElement>('canvas')?.focus({ preventScroll: true });
  };

  const releaseGameSurface = (): void => {
    gameSurface?.removeAttribute('inert');
    gameSurface?.removeAttribute('aria-hidden');
  };

  const lockGameSurface = (): void => {
    gameSurface?.setAttribute('inert', '');
    gameSurface?.setAttribute('aria-hidden', 'true');
  };

  const touchInputEnabled = (): boolean => !introVisible && !completeVisible;

  const resetJoystick = (dispatch = true): void => {
    const pointerId = joystickPointerId;
    joystickPointerId = null;
    joystickElement.classList.remove('is-active');
    joystickKnob.style.transform = 'translate(-50%, -50%)';
    if (pointerId !== null && joystickElement.hasPointerCapture(pointerId)) {
      joystickElement.releasePointerCapture(pointerId);
    }
    if (dispatch) emitTouchMove(0, 0);
  };

  const resetCamera = (dispatch = true): void => {
    const pointerId = cameraPointerId;
    const button = activeCameraButton;
    cameraPointerId = null;
    button?.classList.remove('is-active');
    activeCameraButton = null;
    if (pointerId !== null && button?.hasPointerCapture(pointerId)) {
      button.releasePointerCapture(pointerId);
    }
    if (dispatch) emitTouchCamera(0);
  };

  const resetTouchInput = (dispatch = true): void => {
    resetJoystick(dispatch);
    resetCamera(dispatch);
  };

  const updateJoystick = (clientX: number, clientY: number): void => {
    const deltaX = clientX - joystickCenterX;
    const deltaY = clientY - joystickCenterY;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance <= JOYSTICK_DEADZONE) {
      joystickKnob.style.transform = 'translate(-50%, -50%)';
      emitTouchMove(0, 0);
      return;
    }

    const directionX = deltaX / distance;
    const directionY = deltaY / distance;
    const limitedDistance = Math.min(distance, joystickMaxRadius);
    const magnitude = (limitedDistance - JOYSTICK_DEADZONE) /
      (joystickMaxRadius - JOYSTICK_DEADZONE);
    joystickKnob.style.transform = `translate(calc(-50% + ${directionX * limitedDistance}px), calc(-50% + ${directionY * limitedDistance}px))`;
    emitTouchMove(directionX * magnitude, -directionY * magnitude);
  };

  const handleJoystickDown = (event: PointerEvent): void => {
    if (!touchInputEnabled() || joystickPointerId !== null || event.button !== 0) return;
    event.preventDefault();
    const bounds = joystickElement.getBoundingClientRect();
    joystickCenterX = bounds.left + bounds.width / 2;
    joystickCenterY = bounds.top + bounds.height / 2;
    joystickMaxRadius = Math.max(
      JOYSTICK_DEADZONE + 1,
      Math.min(JOYSTICK_MAX_RADIUS, (bounds.width - joystickKnob.offsetWidth) / 2),
    );
    joystickPointerId = event.pointerId;
    joystickElement.classList.add('is-active');
    joystickElement.setPointerCapture(event.pointerId);
    updateJoystick(event.clientX, event.clientY);
  };

  const handleJoystickMove = (event: PointerEvent): void => {
    if (event.pointerId !== joystickPointerId || !touchInputEnabled()) return;
    event.preventDefault();
    updateJoystick(event.clientX, event.clientY);
  };

  const endJoystick = (event: PointerEvent, releaseCapture: boolean): void => {
    if (event.pointerId !== joystickPointerId) return;
    const pointerId = joystickPointerId;
    resetJoystick();
    if (releaseCapture && joystickElement.hasPointerCapture(pointerId)) {
      joystickElement.releasePointerCapture(pointerId);
    }
  };

  const handleCameraDown = (event: PointerEvent): void => {
    if (!touchInputEnabled() || cameraPointerId !== null || event.button !== 0) return;
    const button = event.currentTarget as HTMLButtonElement;
    const direction = Number(button.dataset.touchCamera) as -1 | 1;
    event.preventDefault();
    cameraPointerId = event.pointerId;
    activeCameraButton = button;
    button.classList.add('is-active');
    button.setPointerCapture(event.pointerId);
    emitTouchCamera(direction);
  };

  const endCamera = (event: PointerEvent, releaseCapture: boolean): void => {
    if (event.pointerId !== cameraPointerId || !activeCameraButton) return;
    const pointerId = cameraPointerId;
    const button = activeCameraButton;
    resetCamera();
    if (releaseCapture && button.hasPointerCapture(pointerId)) {
      button.releasePointerCapture(pointerId);
    }
  };

  joystickElement.addEventListener('pointerdown', handleJoystickDown);
  joystickElement.addEventListener('pointermove', handleJoystickMove);
  joystickElement.addEventListener('pointerup', (event) => endJoystick(event, true));
  joystickElement.addEventListener('pointercancel', (event) => endJoystick(event, true));
  joystickElement.addEventListener('lostpointercapture', (event) => endJoystick(event, false));
  for (const button of cameraButtons) {
    button.addEventListener('pointerdown', handleCameraDown);
    button.addEventListener('pointerup', (event) => endCamera(event, true));
    button.addEventListener('pointercancel', (event) => endCamera(event, true));
    button.addEventListener('lostpointercapture', (event) => endCamera(event, false));
  }

  const hideIntro = (): void => {
    if (!introVisible) return;
    introVisible = false;
    startButton.blur();
    introElement.classList.add('is-hidden');
    introElement.setAttribute('aria-hidden', 'true');
    releaseGameSurface();
    focusGame();
    root.classList.add('has-started');
    window.setTimeout(() => {
      if (!introVisible) introElement.hidden = true;
    }, 420);
  };

  const begin = (source: ActivationSource): void => {
    if (!introVisible) return;
    hideIntro();
    emitStart(source);
  };

  const advance = (source: ActivationSource): void => {
    if (!completeVisible || advanceLocked) return;
    advanceLocked = true;
    advanceButton.disabled = true;
    emitStageAdvance({
      source,
      stage: completedStage,
      isFinal: finalStageComplete,
    });
  };

  startButton.addEventListener('click', () => begin('pointer'));
  advanceButton.addEventListener('click', () => advance('pointer'));

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.code === 'Space' && (introVisible || completeVisible)) {
      event.preventDefault();
      return;
    }
    if (event.code !== 'Enter' || event.repeat) return;
    if (introVisible) {
      event.preventDefault();
      begin('keyboard');
      return;
    }
    if (completeVisible) {
      event.preventDefault();
      advance('keyboard');
    }
  };

  window.addEventListener('keydown', handleKeydown);
  teardownCurrentHUD = () => {
    window.removeEventListener('keydown', handleKeydown);
    if (hintTimer !== undefined) window.clearTimeout(hintTimer);
    resetTouchInput();
    releaseGameSurface();
  };

  renderPips(0, currentTotal);
  renderStage();
  window.requestAnimationFrame(() => startButton.focus({ preventScroll: true }));

  return {
    setCount(current: number, totalCount: number): void {
      currentTotal = safeWhole(totalCount, currentTotal);
      const safeCurrent = Math.min(currentTotal, safeWhole(current, 0));
      countElement.textContent = String(safeCurrent);
      totalElement.textContent = String(currentTotal);
      counterElement.setAttribute('aria-label', `ほしあかりパーツ ${currentTotal}個中 ${safeCurrent}個`);
      counterElement.classList.toggle('is-full', currentTotal > 0 && safeCurrent >= currentTotal);
      renderPips(safeCurrent, currentTotal);
    },

    setStage(current: number, totalStages: number): void {
      stageTotal = safeWhole(totalStages, stageTotal, 1);
      currentStage = Math.min(stageTotal, safeWhole(current, currentStage, 1));
      renderStage();
    },

    showHint(message: string): void {
      if (hintTimer !== undefined) window.clearTimeout(hintTimer);
      hintElement.textContent = message;
      hintElement.classList.remove('is-visible');
      window.requestAnimationFrame(() => hintElement.classList.add('is-visible'));
      hintTimer = window.setTimeout(() => {
        hintElement.classList.remove('is-visible');
      }, compactTouchQuery.matches ? 1800 : 2800);
    },

    showStageComplete(stage: number, isFinal: boolean): void {
      if (hintTimer !== undefined) window.clearTimeout(hintTimer);
      hintTimer = undefined;
      hintElement.textContent = '';
      hintElement.classList.remove('is-visible');
      completedStage = safeWhole(stage, currentStage, 1);
      finalStageComplete = isFinal;
      completeVisible = true;
      resetTouchInput();
      advanceLocked = false;
      advanceButton.disabled = false;
      completeElement.hidden = false;
      completeElement.setAttribute('aria-hidden', 'false');
      completeElement.classList.toggle('is-final', isFinal);
      completeEyebrow.textContent = isFinal ? 'ALL STAGES CLEAR' : `STAGE ${completedStage} CLEAR`;
      completeTitle.textContent = isFinal ? 'ぜんぶ、みつけた！' : `ステージ ${completedStage} クリア！`;
      completeCopy.textContent = isFinal
        ? '3つの冒険をこえて、ほしあかりがちょぼのもとへ帰ってきた。'
        : 'ほしあかりを、ぜんぶ見つけた。ひと休みしたら次の場所へ。';
      advanceLabel.textContent = isFinal ? 'タイトルへ もどる' : 'つぎのステージへ';
      lockGameSurface();
      root.classList.add('is-complete');
      window.requestAnimationFrame(() => {
        if (!completeVisible) return;
        completeElement.classList.add('is-visible');
        advanceButton.focus({ preventScroll: true });
      });
    },

    hideComplete(): void {
      completeVisible = false;
      advanceLocked = false;
      advanceButton.disabled = false;
      advanceButton.blur();
      completeElement.classList.remove('is-visible');
      completeElement.setAttribute('aria-hidden', 'true');
      root.classList.remove('is-complete');
      if (introVisible) {
        lockGameSurface();
      } else {
        releaseGameSurface();
        focusGame();
      }
      window.setTimeout(() => {
        if (!completeVisible) completeElement.hidden = true;
      }, 360);
    },

    showIntro(): void {
      if (hintTimer !== undefined) window.clearTimeout(hintTimer);
      hintTimer = undefined;
      hintElement.textContent = '';
      hintElement.classList.remove('is-visible');
      resetTouchInput();

      completeVisible = false;
      advanceLocked = false;
      advanceButton.disabled = false;
      advanceButton.blur();
      completeElement.classList.remove('is-visible', 'is-final');
      completeElement.setAttribute('aria-hidden', 'true');
      completeElement.hidden = true;

      currentStage = 1;
      stageTotal = 3;
      currentTotal = initialPartTotal;
      renderStage();
      lastHeading = 'N';
      needleElement.style.transform = 'translate(-50%, -100%) rotate(0deg)';
      headingElement.textContent = 'N';
      compassElement.setAttribute('aria-label', 'ちょぼの向き N');
      countElement.textContent = '0';
      totalElement.textContent = String(initialPartTotal);
      counterElement.setAttribute('aria-label', `ほしあかりパーツ ${initialPartTotal}個中 0個`);
      counterElement.classList.remove('is-full');
      renderPips(0, initialPartTotal);

      introVisible = true;
      introElement.hidden = false;
      introElement.setAttribute('aria-hidden', 'false');
      introElement.classList.remove('is-hidden');
      root.classList.remove('has-started', 'is-complete');
      lockGameSurface();
      window.requestAnimationFrame(() => startButton.focus({ preventScroll: true }));
    },

    hideIntro,

    updateDirection(angle: number): void {
      const safeAngle = normaliseAngle(angle);
      const degrees = safeAngle * (180 / Math.PI);
      needleElement.style.transform = `translate(-50%, -100%) rotate(${degrees}deg)`;
      const label = headingLabel(safeAngle);
      if (label !== lastHeading) {
        lastHeading = label;
        headingElement.textContent = label;
        compassElement.setAttribute('aria-label', `ちょぼの向き ${label}`);
      }
    },
  };
}
