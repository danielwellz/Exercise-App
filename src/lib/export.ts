import JSZip from 'jszip';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';

export type GifExportOptions = {
  canvas: HTMLCanvasElement;
  durationMs: number;
  fps?: number;
  width?: number;
  height?: number;
  fileName?: string;
  onProgress?: (progress: number) => void;
};

export type Mp4ExportOptions = {
  canvas: HTMLCanvasElement;
  durationMs: number;
  fps?: number;
  bitsPerSecond?: number;
  fileName?: string;
};

export type PngSequenceZipOptions = {
  canvas: HTMLCanvasElement;
  frameCount?: number;
  width?: number;
  height?: number;
  fileName?: string;
  onProgress?: (progress: number) => void;
  setNormalizedTime?: (tNorm: number) => Promise<void> | void;
};

const MP4_MIME_CANDIDATES = [
  'video/mp4;codecs=h264',
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

async function waitForRenderedFrame() {
  await nextFrame();
  await nextFrame();
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas export returned an empty blob.'));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

export async function exportGifFromCanvas({
  canvas,
  durationMs,
  fps = 20,
  width = 420,
  height = 420,
  fileName = 'exercise-loop.gif',
  onProgress,
}: GifExportOptions) {
  const frameCount = Math.max(1, Math.ceil((durationMs / 1000) * fps));
  const frameDelay = Math.max(20, Math.round(1000 / fps));

  const captureCanvas = document.createElement('canvas');
  captureCanvas.width = width;
  captureCanvas.height = height;
  const captureCtx = captureCanvas.getContext('2d', { willReadFrequently: true });
  if (!captureCtx) {
    throw new Error('Failed to initialize GIF capture context.');
  }

  const encoder = GIFEncoder();

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    await nextFrame();
    captureCtx.clearRect(0, 0, width, height);
    captureCtx.drawImage(canvas, 0, 0, width, height);

    const { data } = captureCtx.getImageData(0, 0, width, height);
    const palette = quantize(data, 256);
    const indexed = applyPalette(data, palette);

    encoder.writeFrame(indexed, width, height, {
      palette,
      delay: frameDelay,
    });

    onProgress?.((frameIndex + 1) / frameCount);
    await sleep(frameDelay);
  }

  encoder.finish();
  const bytes = Uint8Array.from(encoder.bytes());
  const blob = new Blob([bytes], { type: 'image/gif' });
  downloadBlob(blob, fileName);
}

export function getSupportedMp4MimeType() {
  if (typeof MediaRecorder === 'undefined') {
    return null;
  }

  for (const mimeType of MP4_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return null;
}

export function canRecordMp4() {
  return Boolean(getSupportedMp4MimeType());
}

export async function exportMp4FromCanvas({
  canvas,
  durationMs,
  fps = 30,
  bitsPerSecond = 7_000_000,
  fileName = 'exercise-loop.mp4',
}: Mp4ExportOptions) {
  const mimeType = getSupportedMp4MimeType();
  if (!mimeType) {
    throw new Error('MP4 works best on Chrome/Edge; use GIF otherwise.');
  }

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: bitsPerSecond,
  });

  const chunks: BlobPart[] = [];

  const done = new Promise<void>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onerror = () => {
      reject(new Error('MediaRecorder failed during MP4 export.'));
    };

    recorder.onstop = () => resolve();
  });

  recorder.start();
  await sleep(durationMs);
  recorder.stop();
  await done;

  for (const track of stream.getTracks()) {
    track.stop();
  }

  const blob = new Blob(chunks, { type: mimeType });
  downloadBlob(blob, fileName);
}

export async function exportPngSequenceZip({
  canvas,
  frameCount = 60,
  width = canvas.width,
  height = canvas.height,
  fileName = 'exercise-frames.zip',
  onProgress,
  setNormalizedTime,
}: PngSequenceZipOptions) {
  const safeFrameCount = Math.max(1, frameCount);
  const zip = new JSZip();

  const captureCanvas = document.createElement('canvas');
  captureCanvas.width = width;
  captureCanvas.height = height;
  const captureCtx = captureCanvas.getContext('2d', { alpha: false });
  if (!captureCtx) {
    throw new Error('Failed to initialize PNG capture context.');
  }

  for (let index = 0; index < safeFrameCount; index += 1) {
    const tNorm = safeFrameCount === 1 ? 0 : index / safeFrameCount;

    if (setNormalizedTime) {
      await setNormalizedTime(tNorm);
      await waitForRenderedFrame();
    } else {
      await nextFrame();
    }

    captureCtx.clearRect(0, 0, width, height);
    captureCtx.drawImage(canvas, 0, 0, width, height);

    const blob = await toBlob(captureCanvas, 'image/png');
    const frameNumber = String(index + 1).padStart(4, '0');
    zip.file(`frame_${frameNumber}.png`, blob);

    onProgress?.(((index + 1) / safeFrameCount) * 0.92);
    await sleep(0);
  }

  const archive = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      onProgress?.(0.92 + (metadata.percent / 100) * 0.08);
    },
  );

  downloadBlob(archive, fileName);
}
