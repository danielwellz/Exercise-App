import { Object3D, Vector3 } from 'three';
import type { NormalizedRig } from './rig';

export type GroundMode = 'feet' | 'hands' | 'none';

type GroundingOptions = {
  root: Object3D;
  rig: NormalizedRig;
  mode?: GroundMode;
  smoothing?: number;
};

const tmpWorldPosition = new Vector3();

function getGroundMarkers(rig: NormalizedRig, mode: GroundMode) {
  const markers: Object3D[] = [];

  const leftFoot = rig.bones.leftToe ?? rig.bones.leftFoot;
  const rightFoot = rig.bones.rightToe ?? rig.bones.rightFoot;

  if (mode === 'feet' || mode === 'hands') {
    if (leftFoot) {
      markers.push(leftFoot);
    }
    if (rightFoot) {
      markers.push(rightFoot);
    }
  }

  if (mode === 'hands') {
    if (rig.bones.leftHand) {
      markers.push(rig.bones.leftHand);
    }
    if (rig.bones.rightHand) {
      markers.push(rig.bones.rightHand);
    }
  }

  return markers;
}

export function applyGroundingOffset({ root, rig, mode = 'feet', smoothing = 0.35 }: GroundingOptions) {
  if (mode === 'none') {
    return root.position.y;
  }

  const markers = getGroundMarkers(rig, mode);
  if (!markers.length) {
    return root.position.y;
  }

  let minGroundY = Number.POSITIVE_INFINITY;
  for (const marker of markers) {
    marker.getWorldPosition(tmpWorldPosition);
    minGroundY = Math.min(minGroundY, tmpWorldPosition.y);
  }

  if (!Number.isFinite(minGroundY)) {
    return root.position.y;
  }

  let correction = -minGroundY;

  // During airborne phases (jog/jump), avoid snapping the body downward when both feet are above ground.
  if (mode === 'feet' && minGroundY > 0.03 && correction < 0) {
    correction = 0;
  }

  root.position.y += correction * smoothing;

  if (Math.abs(root.position.y) < 0.0001) {
    root.position.y = 0;
  }

  return root.position.y;
}
