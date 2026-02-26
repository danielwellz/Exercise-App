import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { CHARACTERS, getCharacterById, type CharacterDef } from '../data/characters';

type CharacterOverride = Partial<Pick<CharacterDef, 'scale' | 'rotationY' | 'yOffset'>>;

type CharacterContextValue = {
  characterId: string;
  setCharacterId: (id: string) => void;
  character: CharacterDef;
  flipFacing: boolean;
  setFlipFacing: (value: boolean) => void;
  setCharacterOverride: (override: CharacterOverride) => void;
  resetCharacterOverride: () => void;
};

const CHARACTER_ID_KEY = 'exerciseApp.characterId';
const flipFacingKey = (id: string) => `exerciseApp.flipFacing.${id}`;
const overrideKey = (id: string) => `exerciseApp.characterOverride.${id}`;

function readStoredCharacterId() {
  if (typeof window === 'undefined') {
    return 'default';
  }

  try {
    return getCharacterById(window.localStorage.getItem(CHARACTER_ID_KEY)).id;
  } catch {
    return 'default';
  }
}

function readStoredFlipFacing(characterId: string) {
  if (typeof window === 'undefined') {
    return getCharacterById(characterId).defaultFlipFacing ?? false;
  }

  try {
    const value = window.localStorage.getItem(flipFacingKey(characterId));
    if (value == null) {
      return getCharacterById(characterId).defaultFlipFacing ?? false;
    }
    return value === '1';
  } catch {
    return getCharacterById(characterId).defaultFlipFacing ?? false;
  }
}

function readStoredOverride(characterId: string): CharacterOverride {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const value = window.localStorage.getItem(overrideKey(characterId));
    if (!value) {
      return {};
    }

    const parsed = JSON.parse(value) as CharacterOverride;
    return {
      scale: typeof parsed.scale === 'number' ? parsed.scale : undefined,
      rotationY: typeof parsed.rotationY === 'number' ? parsed.rotationY : undefined,
      yOffset: typeof parsed.yOffset === 'number' ? parsed.yOffset : undefined,
    };
  } catch {
    return {};
  }
}

function loadOverrideMap() {
  const map: Record<string, CharacterOverride> = {};
  for (const character of CHARACTERS) {
    map[character.id] = readStoredOverride(character.id);
  }
  return map;
}

function loadFlipFacingMap() {
  const map: Record<string, boolean> = {};
  for (const character of CHARACTERS) {
    map[character.id] = readStoredFlipFacing(character.id);
  }
  return map;
}

const CharacterContext = createContext<CharacterContextValue | null>(null);

export function CharacterProvider({ children }: { children: ReactNode }) {
  const [characterId, setCharacterIdState] = useState(readStoredCharacterId);
  const [overridesById, setOverridesById] = useState<Record<string, CharacterOverride>>(loadOverrideMap);
  const [flipFacingById, setFlipFacingById] = useState<Record<string, boolean>>(loadFlipFacingMap);

  const setCharacterId = useCallback((id: string) => {
    const nextId = getCharacterById(id).id;
    setCharacterIdState(nextId);

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(CHARACTER_ID_KEY, nextId);
      } catch {
        // Ignore write failures.
      }
    }
  }, []);

  const baseCharacter = useMemo(() => getCharacterById(characterId), [characterId]);

  const character = useMemo(() => {
    const override = overridesById[baseCharacter.id] ?? {};
    return {
      ...baseCharacter,
      ...override,
    };
  }, [baseCharacter, overridesById]);

  const flipFacing = useMemo(() => {
    const stored = flipFacingById[baseCharacter.id];
    if (typeof stored === 'boolean') {
      return stored;
    }
    return baseCharacter.defaultFlipFacing ?? false;
  }, [baseCharacter, flipFacingById]);

  const setFlipFacing = useCallback(
    (value: boolean) => {
      setFlipFacingById((prev) => ({
        ...prev,
        [baseCharacter.id]: value,
      }));

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(flipFacingKey(baseCharacter.id), value ? '1' : '0');
        } catch {
          // Ignore write failures.
        }
      }
    },
    [baseCharacter.id],
  );

  const setCharacterOverride = useCallback(
    (override: CharacterOverride) => {
      setOverridesById((prev) => {
        const merged = {
          ...(prev[baseCharacter.id] ?? {}),
          ...override,
        };

        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(overrideKey(baseCharacter.id), JSON.stringify(merged));
          } catch {
            // Ignore write failures.
          }
        }

        return {
          ...prev,
          [baseCharacter.id]: merged,
        };
      });
    },
    [baseCharacter.id],
  );

  const resetCharacterOverride = useCallback(() => {
    setOverridesById((prev) => {
      const next = { ...prev };
      delete next[baseCharacter.id];

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(overrideKey(baseCharacter.id));
        } catch {
          // Ignore write failures.
        }
      }

      return next;
    });
  }, [baseCharacter.id]);

  const value = useMemo<CharacterContextValue>(
    () => ({
      characterId: baseCharacter.id,
      setCharacterId,
      character,
      flipFacing,
      setFlipFacing,
      setCharacterOverride,
      resetCharacterOverride,
    }),
    [baseCharacter.id, character, flipFacing, resetCharacterOverride, setCharacterId, setCharacterOverride, setFlipFacing],
  );

  return <CharacterContext.Provider value={value}>{children}</CharacterContext.Provider>;
}

export function useCharacter() {
  const context = useContext(CharacterContext);
  if (!context) {
    throw new Error('useCharacter must be used within CharacterProvider');
  }
  return context;
}
