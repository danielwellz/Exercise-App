import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Viewer3D, { type ModelMetrics } from '../components/Viewer3D';
import { CHARACTERS } from '../data/characters';
import { moveBySlug, type CameraPreset } from '../data/moves';
import {
  canRecordMp4,
  exportGifFromCanvas,
  exportMp4FromCanvas,
  exportPngSequenceZip,
  getSupportedMp4MimeType,
} from '../lib/export';
import { useCharacter } from '../state/character';

const CAMERA_PRESETS: Array<{ value: CameraPreset; label: string }> = [
  { value: 'Front', label: 'Front' },
  { value: 'Side', label: 'Side' },
  { value: 'ThreeQuarter', label: '45°' },
  { value: 'Top', label: 'Top' },
  { value: 'Vertical', label: 'Vertical' },
];

const degToRad = (value: number) => (value * Math.PI) / 180;
const radToDeg = (value: number) => (value * 180) / Math.PI;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const SCALE_MIN = 0.001;
const SCALE_MAX = 10;
const Y_OFFSET_MIN = -4;
const Y_OFFSET_MAX = 4;
const TARGET_CHARACTER_HEIGHT_METERS = 1.75;

function waitForRender() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export default function Move() {
  const { slug } = useParams();
  const move = slug ? moveBySlug.get(slug) : undefined;
  const {
    characterId,
    setCharacterId,
    character,
    flipFacing,
    setFlipFacing,
    setCharacterOverride,
    resetCharacterOverride,
  } = useCharacter();

  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>(move?.recommendedPreset ?? 'Front');
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [showMesh, setShowMesh] = useState(true);
  const [showJoints, setShowJoints] = useState(false);
  const [highlightTargets, setHighlightTargets] = useState(true);
  const [forcedTNorm, setForcedTNorm] = useState<number | null>(null);

  const [repCount, setRepCount] = useState(0);
  const [phaseLabel, setPhaseLabel] = useState(move?.phases?.[0]?.label ?? '');
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [loopDuration, setLoopDuration] = useState(2);
  const [modelMetrics, setModelMetrics] = useState<ModelMetrics | null>(null);

  const [exporting, setExporting] = useState<'gif' | 'mp4' | 'png' | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);

  const mp4Supported = useMemo(() => canRecordMp4(), []);
  const mp4Mime = useMemo(() => getSupportedMp4MimeType(), []);

  useEffect(() => {
    if (!move) {
      return;
    }

    setPlaying(true);
    setSpeed(1);
    setCameraPreset(move.recommendedPreset ?? 'Front');
    setShowSkeleton(false);
    setShowMesh(true);
    setShowJoints(false);
    setHighlightTargets(true);
    setForcedTNorm(null);
    setRepCount(0);
    setPhaseLabel(move.phases?.[0]?.label ?? '');
    setLoopDuration(2);
    setModelMetrics(null);
    setExporting(null);
    setExportProgress(0);
    setExportError(null);
  }, [move?.slug]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        setPlaying((value) => !value);
      }

      if (event.code === 'ArrowUp') {
        event.preventDefault();
        setSpeed((value) => Math.min(2, Number((value + 0.05).toFixed(2))));
      }

      if (event.code === 'ArrowDown') {
        event.preventDefault();
        setSpeed((value) => Math.max(0.25, Number((value - 0.05).toFixed(2))));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  if (!move) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <h1 className="font-display text-2xl font-semibold text-slate-900">Move not found</h1>
        <p className="mt-2 text-sm text-slate-600">The requested movement does not exist in the current library dataset.</p>
        <Link to="/" className="mt-4 inline-block text-brand-600 hover:text-brand-700">
          Back to library
        </Link>
      </div>
    );
  }

  const durationMs = Math.max(850, Math.round((loopDuration / Math.max(speed, 0.1)) * 1000));
  const tuningScale = character.scale ?? 1;
  const tuningYOffset = character.yOffset ?? 0;
  const tuningRotationDeg = radToDeg(character.rotationY ?? 0);
  const tuningScaleLabel = tuningScale >= 0.1 ? tuningScale.toFixed(2) : tuningScale.toFixed(4);

  const handleExportGif = async () => {
    if (!canvas || exporting) {
      return;
    }

    try {
      setExportError(null);
      setExporting('gif');
      setExportProgress(0);
      setForcedTNorm(null);

      await exportGifFromCanvas({
        canvas,
        durationMs,
        fps: 18,
        width: 520,
        height: 520,
        fileName: `${move.slug}.gif`,
        onProgress: setExportProgress,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'GIF export failed.';
      setExportError(message);
    } finally {
      setExporting(null);
      setExportProgress(0);
    }
  };

  const handleExportMp4 = async () => {
    if (!canvas || exporting) {
      return;
    }

    try {
      setExportError(null);
      setExporting('mp4');
      setForcedTNorm(null);
      await exportMp4FromCanvas({
        canvas,
        durationMs,
        fps: 30,
        fileName: `${move.slug}.mp4`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'MP4 export failed.';
      setExportError(message);
    } finally {
      setExporting(null);
    }
  };

  const handleExportPngZip = async () => {
    if (!canvas || exporting) {
      return;
    }

    const wasPlaying = playing;

    try {
      setExportError(null);
      setExporting('png');
      setExportProgress(0);
      setPlaying(false);

      await exportPngSequenceZip({
        canvas,
        frameCount: 60,
        width: 520,
        height: 520,
        fileName: `${move.slug}-frames.zip`,
        onProgress: setExportProgress,
        setNormalizedTime: async (tNorm) => {
          setForcedTNorm(tNorm);
          await waitForRender();
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PNG sequence export failed.';
      setExportError(message);
    } finally {
      setForcedTNorm(null);
      setPlaying(wasPlaying);
      setExporting(null);
      setExportProgress(0);
    }
  };

  const handleAutoFitScale = () => {
    if (!modelMetrics || !Number.isFinite(modelMetrics.height) || modelMetrics.height <= 0.0001) {
      return;
    }

    const nextScale = clamp(
      tuningScale * (TARGET_CHARACTER_HEIGHT_METERS / modelMetrics.height),
      SCALE_MIN,
      SCALE_MAX,
    );
    setCharacterOverride({ scale: nextScale });
  };

  const handleAutoGroundYOffset = () => {
    if (!modelMetrics || !Number.isFinite(modelMetrics.minY)) {
      return;
    }

    const nextYOffset = clamp(tuningYOffset - modelMetrics.minY, Y_OFFSET_MIN, Y_OFFSET_MAX);
    setCharacterOverride({ yOffset: nextYOffset });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div>
          <Link to="/" className="text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700">
            Back to library
          </Link>
          <h1 className="mt-1 font-display text-2xl font-semibold text-slate-900 sm:text-3xl">{move.title}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-w-[180px] flex-col text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Character
            <select
              className="mt-1 rounded-xl border border-slate-300 px-2 py-2 text-sm font-medium normal-case text-slate-900"
              value={characterId}
              onChange={(event) => setCharacterId(event.target.value)}
              aria-label="Select character"
            >
              {CHARACTERS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-2 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Rep counter</p>
            <p className="font-display text-2xl text-brand-700">{repCount}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)]">
        <section className="space-y-4">
          <div className="relative">
            <Viewer3D
              move={move}
              playing={playing}
              speed={speed}
              cameraPreset={cameraPreset}
              showSkeleton={showSkeleton}
              showMesh={showMesh}
              showJoints={showJoints}
              highlightTargets={highlightTargets}
              modelUrl={character.url}
              modelScale={character.scale}
              modelRotationY={character.rotationY}
              modelYOffset={character.yOffset}
              flipFacing={flipFacing}
              characterName={character.name}
              forcedTNorm={forcedTNorm}
              onRepChange={setRepCount}
              onPhaseChange={setPhaseLabel}
              onLoopDurationChange={setLoopDuration}
              onCanvasReady={setCanvas}
              onModelMetrics={setModelMetrics}
              className="h-[380px] w-full sm:h-[500px]"
            />

            <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-slate-200/80 bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow">
              Phase: {phaseLabel}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => setPlaying((value) => !value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-400"
              aria-label={playing ? 'Pause animation' : 'Play animation'}
            >
              {playing ? 'Pause' : 'Play'}
            </button>

            <label className="col-span-1 flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2 lg:col-span-2">
              Speed ({speed.toFixed(2)}x)
              <input
                type="range"
                min={0.25}
                max={2}
                step={0.05}
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
                className="range-track mt-2"
                aria-label="Animation speed"
              />
            </label>

            <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-500">
              Camera
              <select
                className="mt-2 rounded-xl border border-slate-300 px-2 py-2 text-sm font-medium text-slate-900"
                value={cameraPreset}
                onChange={(event) => setCameraPreset(event.target.value as CameraPreset)}
                aria-label="Camera preset"
              >
                {CAMERA_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showSkeleton}
                onChange={(event) => setShowSkeleton(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Show skeleton
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showMesh}
                onChange={(event) => setShowMesh(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Show mesh
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showJoints}
                onChange={(event) => setShowJoints(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Show joints
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={highlightTargets}
                onChange={(event) => setHighlightTargets(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Highlight targets
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={flipFacing}
                onChange={(event) => setFlipFacing(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Flip facing
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">Character tuning</h2>
                <p className="text-xs text-slate-500">Active: {character.name}. Saved per character in localStorage.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoFitScale}
                  disabled={!modelMetrics}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Auto-fit scale
                </button>
                <button
                  type="button"
                  onClick={handleAutoGroundYOffset}
                  disabled={!modelMetrics}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Auto-ground yOffset
                </button>
                <button
                  type="button"
                  onClick={resetCharacterOverride}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                >
                  Reset character tuning
                </button>
              </div>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              {modelMetrics
                ? `Measured height: ${modelMetrics.height.toFixed(3)}m, minY: ${modelMetrics.minY.toFixed(3)} (${modelMetrics.source})`
                : 'Measuring model bounds...'}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-500">
                Scale ({tuningScaleLabel})
                <input
                  type="range"
                  min={SCALE_MIN}
                  max={SCALE_MAX}
                  step={0.001}
                  value={tuningScale}
                  onChange={(event) =>
                    setCharacterOverride({
                      scale: clamp(Number(event.target.value), SCALE_MIN, SCALE_MAX),
                    })
                  }
                  className="range-track mt-2"
                  aria-label="Character scale"
                />
                <input
                  type="number"
                  min={SCALE_MIN}
                  max={SCALE_MAX}
                  step={0.001}
                  value={Number(tuningScale.toFixed(4))}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (Number.isFinite(next)) {
                      setCharacterOverride({ scale: clamp(next, SCALE_MIN, SCALE_MAX) });
                    }
                  }}
                  className="mt-2 rounded-xl border border-slate-300 px-2 py-1.5 text-sm font-medium normal-case text-slate-900"
                  aria-label="Character scale input"
                />
              </label>

              <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-500">
                Y Offset ({tuningYOffset.toFixed(3)})
                <input
                  type="range"
                  min={Y_OFFSET_MIN}
                  max={Y_OFFSET_MAX}
                  step={0.005}
                  value={tuningYOffset}
                  onChange={(event) =>
                    setCharacterOverride({
                      yOffset: clamp(Number(event.target.value), Y_OFFSET_MIN, Y_OFFSET_MAX),
                    })
                  }
                  className="range-track mt-2"
                  aria-label="Character y offset"
                />
                <input
                  type="number"
                  min={Y_OFFSET_MIN}
                  max={Y_OFFSET_MAX}
                  step={0.005}
                  value={Number(tuningYOffset.toFixed(3))}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (Number.isFinite(next)) {
                      setCharacterOverride({ yOffset: clamp(next, Y_OFFSET_MIN, Y_OFFSET_MAX) });
                    }
                  }}
                  className="mt-2 rounded-xl border border-slate-300 px-2 py-1.5 text-sm font-medium normal-case text-slate-900"
                  aria-label="Character y offset input"
                />
              </label>

              <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-500">
                Rotation Y ({Math.round(tuningRotationDeg)}°)
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={clamp(tuningRotationDeg, -180, 180)}
                  onChange={(event) =>
                    setCharacterOverride({
                      rotationY: degToRad(clamp(Number(event.target.value), -180, 180)),
                    })
                  }
                  className="range-track mt-2"
                  aria-label="Character rotation y"
                />
                <input
                  type="number"
                  min={-180}
                  max={180}
                  step={1}
                  value={Math.round(clamp(tuningRotationDeg, -180, 180))}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (Number.isFinite(next)) {
                      setCharacterOverride({
                        rotationY: degToRad(clamp(next, -180, 180)),
                      });
                    }
                  }}
                  className="mt-2 rounded-xl border border-slate-300 px-2 py-1.5 text-sm font-medium normal-case text-slate-900"
                  aria-label="Character rotation y input"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
            <h2 className="font-display text-lg font-semibold text-slate-900">Export</h2>
            <p className="mt-1 text-sm text-slate-600">
              GIF is the primary export. MP4 is best-effort. PNG sequence ZIP captures 60 deterministic frames across one loop.
            </p>

            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleExportGif}
                disabled={!canvas || exporting !== null}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting === 'gif' ? `Exporting GIF ${Math.round(exportProgress * 100)}%` : 'Export GIF'}
              </button>

              <button
                type="button"
                onClick={handleExportMp4}
                disabled={!canvas || exporting !== null || !mp4Supported}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting === 'mp4' ? 'Exporting MP4...' : 'Export MP4'}
              </button>

              <button
                type="button"
                onClick={handleExportPngZip}
                disabled={!canvas || exporting !== null}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting === 'png' ? `Exporting PNG ZIP ${Math.round(exportProgress * 100)}%` : 'Export PNG ZIP'}
              </button>
            </div>

            {!mp4Supported ? (
              <p className="mt-2 text-xs text-amber-700">MP4 works best on Chrome/Edge; use GIF otherwise.</p>
            ) : (
              <p className="mt-2 text-xs text-slate-500">MP4 mime: <code>{mp4Mime}</code></p>
            )}

            {exportError ? <p className="mt-2 text-xs text-rose-600">{exportError}</p> : null}
          </div>

          <p className="text-xs text-slate-500">
            Keyboard: <kbd className="rounded border border-slate-300 bg-slate-50 px-1">Space</kbd> play/pause,
            <kbd className="ml-1 rounded border border-slate-300 bg-slate-50 px-1">↑</kbd>/
            <kbd className="rounded border border-slate-300 bg-slate-50 px-1">↓</kbd> speed.
          </p>
        </section>

        <aside className="space-y-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="font-display text-lg font-semibold text-slate-900">Steps</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
              {move.steps.map((step, index) => (
                <li key={`${move.slug}-step-${index}`}>{step}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="font-display text-lg font-semibold text-slate-900">Coaching Cues</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
              {move.coachingCues.map((cue, index) => (
                <li key={`${move.slug}-cue-${index}`}>{cue}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="font-display text-lg font-semibold text-slate-900">Common Mistakes</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
              {move.commonMistakes.map((mistake, index) => (
                <li key={`${move.slug}-mistake-${index}`}>{mistake}</li>
              ))}
            </ul>
          </article>
        </aside>
      </div>
    </div>
  );
}
