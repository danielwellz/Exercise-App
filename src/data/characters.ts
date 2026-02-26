export type CharacterDef = {
  id: string;
  name: string;
  url: string;
  scale?: number;
  rotationY?: number;
  yOffset?: number;
  defaultFlipFacing?: boolean;
  notes?: string;
};

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'default',
    name: 'Default',
    url: '/models/humanoid.glb',
    scale: 1,
    rotationY: 0,
    yOffset: 0,
  },
  {
    id: 'a',
    name: 'Character A',
    url: '/characters/a.glb',
    scale: 1,
    rotationY: 0,
    yOffset: 0,
  },
  {
    id: 'b',
    name: 'Character B',
    url: '/characters/b.glb',
    scale: 0.01,
    rotationY: 0,
    yOffset: 0,
  },
];

const DEFAULT_CHARACTER = CHARACTERS[0];

export function getCharacterById(id: string | null | undefined): CharacterDef {
  if (!id) {
    return DEFAULT_CHARACTER;
  }

  return CHARACTERS.find((character) => character.id === id) ?? DEFAULT_CHARACTER;
}
