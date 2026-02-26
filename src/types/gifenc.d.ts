declare module 'gifenc' {
  export function GIFEncoder(): {
    writeFrame(indexedPixels: Uint8Array | number[], width: number, height: number, options: { palette: number[] | Uint8Array; delay?: number }): void;
    finish(): void;
    bytes(): Uint8Array;
  };
  export function quantize(data: Uint8ClampedArray, maxColors: number): number[] | Uint8Array;
  export function applyPalette(data: Uint8ClampedArray, palette: number[] | Uint8Array): Uint8Array;
}
