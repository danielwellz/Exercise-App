import { Box3, PerspectiveCamera, Vector3, type Object3D } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { CameraPreset } from '../data/moves';

export type BoundsInfo = {
  box: Box3;
  center: Vector3;
  size: Vector3;
  maxDimension: number;
};

export type CameraFrame = {
  position: Vector3;
  target: Vector3;
  up: Vector3;
};

export type BaseFraming = {
  target: Vector3;
  radius: number;
  verticalSpan: number;
  basePosition: Vector3;
};

const FALLBACK_BOUNDS: BoundsInfo = {
  box: new Box3(new Vector3(-0.7, 0, -0.4), new Vector3(0.7, 1.9, 0.4)),
  center: new Vector3(0, 0.95, 0),
  size: new Vector3(1.4, 1.9, 0.8),
  maxDimension: 1.9,
};

export function computeCharacterBounds(root: Object3D): BoundsInfo {
  const box = new Box3().setFromObject(root);
  if (box.isEmpty()) {
    return FALLBACK_BOUNDS;
  }

  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 0.001);

  return {
    box,
    center,
    size,
    maxDimension,
  };
}

export function computeBaseFraming(bounds: BoundsInfo, camera: PerspectiveCamera, aspect: number): BaseFraming {
  const verticalFov = (camera.fov * Math.PI) / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(aspect, 0.4));

  const fitHeightDistance = bounds.size.y / (2 * Math.tan(verticalFov / 2));
  const fitWidthDistance = bounds.size.x / (2 * Math.tan(horizontalFov / 2));
  const rawRadius = Math.max(fitHeightDistance, fitWidthDistance, bounds.maxDimension * 0.75) * 1.35;
  const radius = Math.min(28, Math.max(1.05, rawRadius));

  const target = bounds.center.clone();
  target.y = bounds.box.min.y + bounds.size.y * 0.5;

  const basePosition = new Vector3(target.x, target.y + bounds.size.y * 0.08, target.z + radius);

  return {
    target,
    radius,
    verticalSpan: bounds.size.y,
    basePosition,
  };
}

export function getPresetFrame(base: BaseFraming, preset: CameraPreset): CameraFrame {
  const target = base.target.clone();
  const up = new Vector3(0, 1, 0);

  if (preset === 'Front') {
    return {
      target,
      up,
      position: new Vector3(target.x, target.y + base.verticalSpan * 0.08, target.z + base.radius),
    };
  }

  if (preset === 'Side') {
    return {
      target,
      up,
      position: new Vector3(target.x + base.radius, target.y + base.verticalSpan * 0.06, target.z),
    };
  }

  if (preset === 'Top') {
    return {
      target,
      up: new Vector3(0, 0, -1),
      position: new Vector3(target.x, target.y + base.radius * 1.45, target.z + 0.001),
    };
  }

  if (preset === 'Vertical') {
    return {
      target: target.clone().add(new Vector3(0, base.verticalSpan * 0.12, 0)),
      up,
      position: new Vector3(
        target.x + base.radius * 0.28,
        target.y + base.radius * 0.72,
        target.z + base.radius * 0.68,
      ),
    };
  }

  return {
    target,
    up,
    position: new Vector3(
      target.x + base.radius * 0.74,
      target.y + base.verticalSpan * 0.12,
      target.z + base.radius * 0.74,
    ),
  };
}

export function applyCameraFrame(
  camera: PerspectiveCamera,
  controls: OrbitControlsImpl | null,
  frame: CameraFrame,
  immediate = true,
) {
  if (immediate) {
    camera.position.copy(frame.position);
    camera.up.copy(frame.up);
    if (controls) {
      controls.target.copy(frame.target);
      controls.update();
    } else {
      camera.lookAt(frame.target);
    }
    return;
  }

  camera.position.lerp(frame.position, 0.12);
  camera.up.lerp(frame.up, 0.16);

  if (controls) {
    controls.target.lerp(frame.target, 0.12);
    controls.update();
  } else {
    camera.lookAt(frame.target);
  }
}
