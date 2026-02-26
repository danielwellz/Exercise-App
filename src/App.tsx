import { Link, Route, Routes } from 'react-router-dom';
import Library from './pages/Library';
import Move from './pages/Move';
import { CharacterProvider } from './state/character';

export default function App() {
  return (
    <CharacterProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-cyan-50 to-slate-100 text-slate-900">
        <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <Link to="/" className="font-display text-lg font-semibold tracking-tight text-slate-900">
              Exercise Movement Library
            </Link>
            <p className="text-xs text-slate-600">3D coaching previews with fallback mannequin mode</p>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<Library />} />
            <Route path="/move/:slug" element={<Move />} />
            <Route
              path="*"
              element={
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
                  <h1 className="font-display text-2xl font-semibold">Not Found</h1>
                  <Link to="/" className="mt-4 inline-block text-brand-600 hover:text-brand-700">
                    Back to library
                  </Link>
                </div>
              }
            />
          </Routes>
        </main>

        <footer className="mx-auto mb-6 mt-2 max-w-7xl px-4 text-xs text-slate-500 sm:px-6 lg:px-8">
          Model attribution: RiggedFigure © 2017 Cesium (CC BY 4.0).
        </footer>
      </div>
    </CharacterProvider>
  );
}
