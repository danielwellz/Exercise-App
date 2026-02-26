import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Viewer3D from '../components/Viewer3D';
import { CHARACTERS } from '../data/characters';
import { categoryOptions, moves, type MoveCategory } from '../data/moves';
import { useCharacter } from '../state/character';

const categoryLabel: Record<MoveCategory, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  core: 'Core',
  cardio: 'Cardio',
  mobility: 'Mobility',
};

export default function Library() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | MoveCategory>('all');
  const [hovered, setHovered] = useState<string | null>(null);
  const { characterId, character, flipFacing, setCharacterId } = useCharacter();

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return moves.filter((move) => {
      const matchesCategory = category === 'all' || move.category === category;
      const matchesQuery =
        normalized.length === 0 ||
        move.title.toLowerCase().includes(normalized) ||
        move.slug.toLowerCase().includes(normalized) ||
        move.targetMuscles.some((item) => item.toLowerCase().includes(normalized));
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          3D Exercise Movement Library
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">
          Browse drills by category, then open each move for camera presets, playback controls, rep tracking, step overlays,
          and export.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px_220px]">
          <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-500">
            Search
            <input
              className="mt-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search moves, slug, or target muscle"
              aria-label="Search exercise movement"
            />
          </label>

          <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-500">
            Category
            <select
              className="mt-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none transition focus:border-brand-500"
              value={category}
              onChange={(event) => setCategory(event.target.value as 'all' | MoveCategory)}
              aria-label="Filter category"
            >
              <option value="all">All categories</option>
              {categoryOptions.map((item) => (
                <option key={item} value={item}>
                  {categoryLabel[item]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-500">
            Character
            <select
              className="mt-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none transition focus:border-brand-500"
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
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Showing {filtered.length} of {moves.length} movements. Active character: {character.name}.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((move) => {
          const previewVisible = hovered === move.slug;
          return (
            <Link
              key={move.slug}
              to={`/move/${move.slug}`}
              onMouseEnter={() => setHovered(move.slug)}
              onMouseLeave={() => setHovered((current) => (current === move.slug ? null : current))}
              onFocus={() => setHovered(move.slug)}
              onBlur={() => setHovered((current) => (current === move.slug ? null : current))}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div className="relative h-44 w-full bg-gradient-to-br from-cyan-50 via-slate-100 to-slate-200">
                {previewVisible ? (
                  <Viewer3D
                    move={move}
                    playing
                    speed={1}
                    cameraPreset={move.recommendedPreset ?? 'Front'}
                    showSkeleton={false}
                    showMesh
                    showJoints={false}
                    highlightTargets={false}
                    modelUrl={character.url}
                    modelScale={character.scale}
                    modelRotationY={character.rotationY}
                    modelYOffset={character.yOffset}
                    flipFacing={flipFacing}
                    characterName={character.name}
                    quality="low"
                    interactive={false}
                    className="h-full w-full rounded-none border-0"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                    <div className="rounded-full border border-white/80 bg-white/80 px-3 py-1 text-xs font-semibold tracking-wide shadow">
                      Hover to preview
                    </div>
                    <span className="text-[11px] uppercase tracking-wide">3D animation</span>
                  </div>
                )}
              </div>

              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-lg font-semibold text-slate-900">{move.title}</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                    {move.difficulty}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-brand-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                    {categoryLabel[move.category]}
                  </span>
                  {move.targetMuscles.slice(0, 2).map((target) => (
                    <span
                      key={target}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-600"
                    >
                      {target}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
