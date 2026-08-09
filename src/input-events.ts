export const CHOBO_TOUCH_MOVE_EVENT = 'chobo-touch-move';
export const CHOBO_TOUCH_CAMERA_EVENT = 'chobo-touch-camera';

export interface TouchMoveDetail {
  x: number;
  y: number;
}

export interface TouchCameraDetail {
  direction: -1 | 0 | 1;
}
