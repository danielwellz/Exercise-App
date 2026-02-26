/*
Summary:
- Defines the full move/exercise dataset and `ExerciseMove` shape.
- Derives runtime-facing fields (`phases`, `recommendedPreset`, `groundMode`, `animatorKey`).
- Feeds move lookup (`moveBySlug`) used by the Move page and animation runtime.
*/
export type MoveCategory = 'push' | 'pull' | 'legs' | 'core' | 'cardio' | 'mobility';

export type LegacyCameraPreset = 'front' | 'side' | 'fortyFive' | 'top';
export type CameraPreset = 'Front' | 'Side' | 'ThreeQuarter' | 'Top' | 'Vertical';
export type GroundMode = 'feet' | 'hands' | 'none';

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export type PhaseLabel = {
  label: string;
  start: number;
  end: number;
};

export type MovePhase = {
  t: number;
  label: string;
};

export type ExerciseMove = {
  slug: string;
  title: string;
  category: MoveCategory;
  steps: string[];
  coachingCues: string[];
  commonMistakes: string[];
  defaultCameraPreset: LegacyCameraPreset;
  animationName: string;
  difficulty: Difficulty;
  targetMuscles: string[];
  phaseLabels: PhaseLabel[];
  phases?: MovePhase[];
  recommendedPreset?: CameraPreset;
  modelRotationY?: number;
  groundMode?: GroundMode;
  animatorKey?: string;
};

export const categoryOptions: MoveCategory[] = ['push', 'pull', 'legs', 'core', 'cardio', 'mobility'];

const baseMoves: ExerciseMove[] = [
  {
    slug: 'scapular-push-up',
    title: 'Scapular Push-Up',
    category: 'mobility',
    steps: [
      'High plank position.',
      'Keep arms straight; pinch shoulder blades together then push floor away.',
      'Small controlled range; core tight.',
    ],
    coachingCues: ['Long neck, no shrugging.', 'Move from shoulder blades, not elbows.', 'Breathe out as you press away.'],
    commonMistakes: ['Bending elbows into a full push-up.', 'Dropping hips and losing plank line.', 'Rushing the scap motion.'],
    defaultCameraPreset: 'side',
    animationName: 'scapular-push-up',
    difficulty: 'Beginner',
    targetMuscles: ['serratus', 'upper-back', 'core'],
    phaseLabels: [
      { label: 'Set plank', start: 0.0, end: 0.2 },
      { label: 'Pinch scapula', start: 0.2, end: 0.55 },
      { label: 'Push away', start: 0.55, end: 1.0 },
    ],
  },
  {
    slug: 'treadmill-walk',
    title: 'Treadmill Walk',
    category: 'cardio',
    steps: ['Stand tall; easy pace.', 'Light arm swing; relaxed shoulders.', 'Land softly mid-foot.'],
    coachingCues: ['Eyes forward.', 'Short, smooth steps.', 'Keep cadence steady.'],
    commonMistakes: ['Leaning on rails.', 'Over-striding.', 'Tense shoulders.'],
    defaultCameraPreset: 'side',
    animationName: 'treadmill-walk',
    difficulty: 'Beginner',
    targetMuscles: ['calves', 'quads', 'glutes'],
    phaseLabels: [
      { label: 'Heel pass', start: 0.0, end: 0.33 },
      { label: 'Mid stance', start: 0.33, end: 0.66 },
      { label: 'Toe off', start: 0.66, end: 1.0 },
    ],
  },
  {
    slug: 'push-up',
    title: 'Push-Up',
    category: 'push',
    steps: ['Hands under shoulders; body in one line.', 'Lower chest toward floor.', 'Press back up; keep core tight.'],
    coachingCues: ['Brace abs before each rep.', 'Elbows around 45 degrees from torso.', 'Exhale during the press.'],
    commonMistakes: ['Sagging hips.', 'Head dropping first.', 'Flared elbows.'],
    defaultCameraPreset: 'side',
    animationName: 'push-up',
    difficulty: 'Intermediate',
    targetMuscles: ['chest', 'triceps', 'front-delts', 'core'],
    phaseLabels: [
      { label: 'Top plank', start: 0.0, end: 0.2 },
      { label: 'Lower down', start: 0.2, end: 0.6 },
      { label: 'Press up', start: 0.6, end: 1.0 },
    ],
  },
  {
    slug: 'pike-push-up',
    title: 'Pike Push-Up',
    category: 'push',
    steps: ['Hips high in an inverted V.', 'Bend elbows; head toward floor.', 'Press up; keep weight toward hands.'],
    coachingCues: ['Push floor away at top.', 'Keep heels lifted naturally.', 'Aim crown of head toward floor.'],
    commonMistakes: ['Turning it into a flat push-up.', 'Elbows flaring too wide.', 'Short half reps.'],
    defaultCameraPreset: 'fortyFive',
    animationName: 'pike-push-up',
    difficulty: 'Intermediate',
    targetMuscles: ['shoulders', 'triceps', 'upper-chest'],
    phaseLabels: [
      { label: 'Pike setup', start: 0.0, end: 0.2 },
      { label: 'Lower head', start: 0.2, end: 0.6 },
      { label: 'Press tall', start: 0.6, end: 1.0 },
    ],
  },
  {
    slug: 'dip',
    title: 'Dip',
    category: 'push',
    steps: ['Hands on bars; shoulders down.', 'Lower with elbows back.', 'Press up to lockout (no shrug).'],
    coachingCues: ['Keep chest open.', 'Control the bottom position.', 'Press through whole palm.'],
    commonMistakes: ['Shrugging shoulders at top.', 'Dropping too fast.', 'Flaring elbows out.'],
    defaultCameraPreset: 'side',
    animationName: 'dip',
    difficulty: 'Advanced',
    targetMuscles: ['triceps', 'chest', 'front-delts'],
    phaseLabels: [
      { label: 'Support', start: 0.0, end: 0.2 },
      { label: 'Lower', start: 0.2, end: 0.6 },
      { label: 'Drive up', start: 0.6, end: 1.0 },
    ],
  },
  {
    slug: 'bench-dip',
    title: 'Bench Dip',
    category: 'push',
    steps: ['Hands on bench; hips close.', 'Lower until upper arms ~parallel.', 'Press up; keep shoulders down.'],
    coachingCues: ['Keep hips near the bench edge.', 'Use smooth tempo.', 'Fully extend elbows at top.'],
    commonMistakes: ['Feet too far out and shoulders overloaded.', 'Shrugging neck.', 'Bouncing at bottom.'],
    defaultCameraPreset: 'side',
    animationName: 'bench-dip',
    difficulty: 'Intermediate',
    targetMuscles: ['triceps', 'front-delts'],
    phaseLabels: [
      { label: 'Top support', start: 0.0, end: 0.22 },
      { label: 'Controlled lower', start: 0.22, end: 0.62 },
      { label: 'Press up', start: 0.62, end: 1.0 },
    ],
  },
  {
    slug: 'push-up-slow-tempo',
    title: 'Push-Up (Slow Tempo)',
    category: 'push',
    steps: ['Same as push-up.', 'Lower for ~3–5 seconds.', 'Pause briefly; press up smoothly.'],
    coachingCues: ['Stay rigid from head to heels.', 'Count the descent.', 'Pause under control.'],
    commonMistakes: ['Dropping quickly.', 'Losing body line in pause.', 'Rushing concentric rep.'],
    defaultCameraPreset: 'side',
    animationName: 'push-up-slow-tempo',
    difficulty: 'Advanced',
    targetMuscles: ['chest', 'triceps', 'core'],
    phaseLabels: [
      { label: 'Brace at top', start: 0.0, end: 0.1 },
      { label: 'Slow lower', start: 0.1, end: 0.72 },
      { label: 'Pause + press', start: 0.72, end: 1.0 },
    ],
  },
  {
    slug: 'plank',
    title: 'Plank',
    category: 'core',
    steps: ['Forearms on floor; elbows under shoulders.', 'Glutes squeezed; ribs down.', 'Hold steady; breathe slowly.'],
    coachingCues: ['Press forearms into floor.', 'Tuck pelvis slightly.', 'Keep chin neutral.'],
    commonMistakes: ['Hips too high or too low.', 'Holding breath.', 'Neck craned upward.'],
    defaultCameraPreset: 'side',
    animationName: 'plank',
    difficulty: 'Beginner',
    targetMuscles: ['core', 'glutes', 'shoulders'],
    phaseLabels: [
      { label: 'Set position', start: 0.0, end: 0.25 },
      { label: 'Hold tension', start: 0.25, end: 0.75 },
      { label: 'Reset breath', start: 0.75, end: 1.0 },
    ],
  },
  {
    slug: 'hollow-body-hold',
    title: 'Hollow Body Hold',
    category: 'core',
    steps: ['Lie on back; low back pressed down.', 'Lift shoulders/legs slightly.', 'Hold; keep ribs tucked.'],
    coachingCues: ['Think "zip ribs to pelvis".', 'Arms long by ears.', 'Keep low back glued down.'],
    commonMistakes: ['Arching lower back.', 'Legs lifting too high.', 'Neck strain from over-tucking.'],
    defaultCameraPreset: 'side',
    animationName: 'hollow-body-hold',
    difficulty: 'Advanced',
    targetMuscles: ['core', 'hip-flexors'],
    phaseLabels: [
      { label: 'Set back position', start: 0.0, end: 0.25 },
      { label: 'Reach + hold', start: 0.25, end: 0.8 },
      { label: 'Reset', start: 0.8, end: 1.0 },
    ],
  },
  {
    slug: 'glute-bridge',
    title: 'Glute Bridge',
    category: 'legs',
    steps: ['Lie on back; feet flat.', 'Drive through heels; lift hips.', 'Squeeze glutes at top; control down.'],
    coachingCues: ['Ribs stay down.', 'Push through whole foot.', 'Pause at top briefly.'],
    commonMistakes: ['Overarching low back.', 'Pushing from toes only.', 'No pause at lockout.'],
    defaultCameraPreset: 'side',
    animationName: 'glute-bridge',
    difficulty: 'Beginner',
    targetMuscles: ['glutes', 'hamstrings'],
    phaseLabels: [
      { label: 'Start on floor', start: 0.0, end: 0.2 },
      { label: 'Bridge up', start: 0.2, end: 0.55 },
      { label: 'Lower with control', start: 0.55, end: 1.0 },
    ],
  },
  {
    slug: 'bodyweight-squat',
    title: 'Bodyweight Squat',
    category: 'legs',
    steps: ['Feet shoulder-width.', 'Sit hips back & down.', 'Stand tall; knees track over toes.'],
    coachingCues: ['Brace before descent.', 'Keep heels grounded.', 'Drive floor away on ascent.'],
    commonMistakes: ['Knees collapsing inward.', 'Heels lifting.', 'Chest dropping too far forward.'],
    defaultCameraPreset: 'side',
    animationName: 'bodyweight-squat',
    difficulty: 'Beginner',
    targetMuscles: ['quads', 'glutes', 'adductors'],
    phaseLabels: [
      { label: 'Tall stance', start: 0.0, end: 0.2 },
      { label: 'Descend', start: 0.2, end: 0.6 },
      { label: 'Stand up', start: 0.6, end: 1.0 },
    ],
  },
  {
    slug: 'bulgarian-split-squat',
    title: 'Bulgarian Split Squat',
    category: 'legs',
    steps: ['Back foot elevated.', 'Lower straight down.', 'Front knee over mid-foot; drive up.'],
    coachingCues: ['Keep torso mostly upright.', 'Load front leg strongly.', 'Push through front heel.'],
    commonMistakes: ['Drifting forward onto toes.', 'Wobbling hips sideways.', 'Pushing from rear leg.'],
    defaultCameraPreset: 'fortyFive',
    animationName: 'bulgarian-split-squat',
    difficulty: 'Advanced',
    targetMuscles: ['quads', 'glutes', 'hamstrings'],
    phaseLabels: [
      { label: 'Split setup', start: 0.0, end: 0.2 },
      { label: 'Lower down', start: 0.2, end: 0.6 },
      { label: 'Drive up', start: 0.6, end: 1.0 },
    ],
  },
  {
    slug: 'jump-squat',
    title: 'Jump Squat',
    category: 'legs',
    steps: ['Squat down.', 'Explode upward into a jump.', 'Land softly; reset with control.'],
    coachingCues: ['Swing arms naturally.', 'Explode through hips and ankles.', 'Absorb landing quietly.'],
    commonMistakes: ['Stiff, loud landings.', 'Knees caving in.', 'No reset between reps.'],
    defaultCameraPreset: 'side',
    animationName: 'jump-squat',
    difficulty: 'Intermediate',
    targetMuscles: ['quads', 'glutes', 'calves'],
    phaseLabels: [
      { label: 'Dip', start: 0.0, end: 0.35 },
      { label: 'Jump', start: 0.35, end: 0.62 },
      { label: 'Land + reset', start: 0.62, end: 1.0 },
    ],
  },
  {
    slug: 'nordic-curl',
    title: 'Nordic Curl',
    category: 'legs',
    steps: ['Kneel; ankles anchored.', 'Keep hips extended; lower slowly.', 'Use hands to catch; push back up.'],
    coachingCues: ['Maintain straight line from knees to shoulders.', 'Resist the descent.', 'Use minimal hand assist.'],
    commonMistakes: ['Bending at hips.', 'Dropping too fast.', 'No hamstring tension on way down.'],
    defaultCameraPreset: 'side',
    animationName: 'nordic-curl',
    difficulty: 'Advanced',
    targetMuscles: ['hamstrings', 'glutes'],
    phaseLabels: [
      { label: 'Tall kneel', start: 0.0, end: 0.2 },
      { label: 'Controlled lower', start: 0.2, end: 0.68 },
      { label: 'Assisted return', start: 0.68, end: 1.0 },
    ],
  },
  {
    slug: 'hamstring-slide',
    title: 'Hamstring Slide',
    category: 'legs',
    steps: ['Heels on sliders/towel.', 'Bridge hips up.', 'Slide heels out/in with control.'],
    coachingCues: ['Keep hips elevated.', 'Move slowly through full length.', 'Exhale as heels pull in.'],
    commonMistakes: ['Hips dropping early.', 'Jerky slider motion.', 'Partial range only.'],
    defaultCameraPreset: 'side',
    animationName: 'hamstring-slide',
    difficulty: 'Intermediate',
    targetMuscles: ['hamstrings', 'glutes', 'core'],
    phaseLabels: [
      { label: 'Bridge up', start: 0.0, end: 0.25 },
      { label: 'Legs extend', start: 0.25, end: 0.62 },
      { label: 'Heels pull in', start: 0.62, end: 1.0 },
    ],
  },
  {
    slug: 'walking-lunge',
    title: 'Walking Lunge',
    category: 'legs',
    steps: ['Step forward into lunge.', 'Back knee toward floor.', 'Push through front heel; step through.'],
    coachingCues: ['Stay tall through torso.', 'Land heel then full foot.', 'Alternate legs smoothly.'],
    commonMistakes: ['Over-striding and losing balance.', 'Front knee collapsing inward.', 'Pushing from back toe only.'],
    defaultCameraPreset: 'fortyFive',
    animationName: 'walking-lunge',
    difficulty: 'Intermediate',
    targetMuscles: ['quads', 'glutes', 'hamstrings'],
    phaseLabels: [
      { label: 'Step forward', start: 0.0, end: 0.32 },
      { label: 'Drop into lunge', start: 0.32, end: 0.62 },
      { label: 'Drive through', start: 0.62, end: 1.0 },
    ],
  },
  {
    slug: 'calf-raise',
    title: 'Calf Raise',
    category: 'legs',
    steps: ['Stand tall; hold support if needed.', 'Rise onto toes.', 'Lower slowly to full stretch.'],
    coachingCues: ['Move straight up and down.', 'Pause at top squeeze.', 'Keep knees softly unlocked.'],
    commonMistakes: ['Rocking side to side.', 'Bouncing reps.', 'Cutting off bottom range.'],
    defaultCameraPreset: 'side',
    animationName: 'calf-raise',
    difficulty: 'Beginner',
    targetMuscles: ['calves'],
    phaseLabels: [
      { label: 'Flat foot start', start: 0.0, end: 0.25 },
      { label: 'Rise up', start: 0.25, end: 0.55 },
      { label: 'Lower down', start: 0.55, end: 1.0 },
    ],
  },
  {
    slug: 'hanging-leg-raise',
    title: 'Hanging Leg Raise',
    category: 'core',
    steps: ['Hang from bar; brace core.', 'Lift straight legs up.', 'Lower slowly without swinging.'],
    coachingCues: ['Set shoulders down.', 'Posteriorly tilt pelvis at top.', 'Control the eccentric.'],
    commonMistakes: ['Using momentum swing.', 'Bent knees reducing challenge.', 'Shrugged shoulders.'],
    defaultCameraPreset: 'side',
    animationName: 'hanging-leg-raise',
    difficulty: 'Advanced',
    targetMuscles: ['lower-abs', 'hip-flexors', 'lats'],
    phaseLabels: [
      { label: 'Dead hang', start: 0.0, end: 0.2 },
      { label: 'Raise legs', start: 0.2, end: 0.55 },
      { label: 'Lower slow', start: 0.55, end: 1.0 },
    ],
  },
  {
    slug: 'treadmill-jog',
    title: 'Treadmill Jog',
    category: 'cardio',
    steps: ['Light jog pace.', 'Quick, quiet steps.', 'Tall posture; relaxed arms.'],
    coachingCues: ['Cadence slightly higher than walk.', 'Soft foot strike.', 'Arms swing close to body.'],
    commonMistakes: ['Over-striding.', 'Crossing arms across torso.', 'Leaning heavily forward.'],
    defaultCameraPreset: 'side',
    animationName: 'treadmill-jog',
    difficulty: 'Intermediate',
    targetMuscles: ['quads', 'calves', 'glutes'],
    phaseLabels: [
      { label: 'Flight', start: 0.0, end: 0.28 },
      { label: 'Support', start: 0.28, end: 0.62 },
      { label: 'Drive', start: 0.62, end: 1.0 },
    ],
  },
  {
    slug: 'band-row',
    title: 'Band Row',
    category: 'pull',
    steps: ['Band anchored ahead.', 'Pull elbows back to ribs.', 'Squeeze shoulder blades; slow return.'],
    coachingCues: ['Keep ribs stacked.', 'Lead with elbows.', 'Pause squeeze at end range.'],
    commonMistakes: ['Shrugging traps.', 'Leaning way back.', 'Snapping band forward.'],
    defaultCameraPreset: 'side',
    animationName: 'band-row',
    difficulty: 'Beginner',
    targetMuscles: ['lats', 'mid-back', 'rear-delts', 'biceps'],
    phaseLabels: [
      { label: 'Arms long', start: 0.0, end: 0.25 },
      { label: 'Row back', start: 0.25, end: 0.6 },
      { label: 'Slow return', start: 0.6, end: 1.0 },
    ],
  },
  {
    slug: 'pull-up',
    title: 'Pull-Up',
    category: 'pull',
    steps: ['Overhand grip.', 'Pull chest toward bar.', 'Lower fully with control.'],
    coachingCues: ['Initiate by pulling shoulders down.', 'Drive elbows toward ribs.', 'Stay tight through trunk.'],
    commonMistakes: ['Half reps.', 'Neck craning over bar.', 'Swinging to kip.'],
    defaultCameraPreset: 'side',
    animationName: 'pull-up',
    difficulty: 'Advanced',
    targetMuscles: ['lats', 'biceps', 'mid-back'],
    phaseLabels: [
      { label: 'Dead hang', start: 0.0, end: 0.2 },
      { label: 'Pull to bar', start: 0.2, end: 0.56 },
      { label: 'Controlled lower', start: 0.56, end: 1.0 },
    ],
  },
  {
    slug: 'inverted-row',
    title: 'Inverted Row',
    category: 'pull',
    steps: ['Body straight under bar.', 'Pull chest to bar.', 'Control down; keep hips up.'],
    coachingCues: ['Squeeze glutes to hold line.', 'Lead with sternum.', 'Pause briefly at top.'],
    commonMistakes: ['Hips sagging.', 'Neck poking forward.', 'Dropping quickly.'],
    defaultCameraPreset: 'side',
    animationName: 'inverted-row',
    difficulty: 'Intermediate',
    targetMuscles: ['mid-back', 'lats', 'biceps', 'core'],
    phaseLabels: [
      { label: 'Body line set', start: 0.0, end: 0.2 },
      { label: 'Pull up', start: 0.2, end: 0.55 },
      { label: 'Lower controlled', start: 0.55, end: 1.0 },
    ],
  },
  {
    slug: 'chin-up',
    title: 'Chin-Up',
    category: 'pull',
    steps: ['Underhand grip.', 'Pull chin over bar.', 'Lower slowly to full hang.'],
    coachingCues: ['Keep elbows close.', 'Lift chest to bar.', 'Lower with full range.'],
    commonMistakes: ['Using leg kick.', 'Partial range reps.', 'Shrugging shoulders.'],
    defaultCameraPreset: 'side',
    animationName: 'chin-up',
    difficulty: 'Advanced',
    targetMuscles: ['biceps', 'lats', 'mid-back'],
    phaseLabels: [
      { label: 'Full hang', start: 0.0, end: 0.2 },
      { label: 'Pull up', start: 0.2, end: 0.56 },
      { label: 'Slow eccentric', start: 0.56, end: 1.0 },
    ],
  },
  {
    slug: 'face-pull-band',
    title: 'Band Face Pull',
    category: 'pull',
    steps: ['Band anchored at face height.', 'Pull hands toward face.', 'Elbows high; squeeze upper back.'],
    coachingCues: ['Thumbs travel toward temples.', 'Keep wrists neutral.', 'Control return tension.'],
    commonMistakes: ['Dropping elbows low.', 'Extending lower back.', 'Band snapping forward.'],
    defaultCameraPreset: 'front',
    animationName: 'face-pull-band',
    difficulty: 'Beginner',
    targetMuscles: ['rear-delts', 'upper-back', 'rotator-cuff'],
    phaseLabels: [
      { label: 'Arms extended', start: 0.0, end: 0.25 },
      { label: 'Pull to face', start: 0.25, end: 0.6 },
      { label: 'Return', start: 0.6, end: 1.0 },
    ],
  },
  {
    slug: 'hanging-knee-raise',
    title: 'Hanging Knee Raise',
    category: 'core',
    steps: ['Hang; brace core.', 'Bring knees up to chest.', 'Lower slowly; no swing.'],
    coachingCues: ['Exhale hard on raise.', 'Keep shoulder blades set.', 'Stop swing before next rep.'],
    commonMistakes: ['Using momentum.', 'Knees drifting apart.', 'Lowering too fast.'],
    defaultCameraPreset: 'side',
    animationName: 'hanging-knee-raise',
    difficulty: 'Intermediate',
    targetMuscles: ['lower-abs', 'hip-flexors', 'lats'],
    phaseLabels: [
      { label: 'Dead hang', start: 0.0, end: 0.2 },
      { label: 'Knees up', start: 0.2, end: 0.56 },
      { label: 'Lower down', start: 0.56, end: 1.0 },
    ],
  },
  {
    slug: 'treadmill-incline-walk',
    title: 'Incline Treadmill Walk',
    category: 'cardio',
    steps: ['Set incline; walk strong.', 'Shorter steps; drive through heels.', 'Keep torso tall; no holding rails.'],
    coachingCues: ['Lean slightly from ankles only.', 'Keep stride compact.', 'Pump arms naturally.'],
    commonMistakes: ['Hanging on rails.', 'Over-leaning from hips.', 'Stomping footsteps.'],
    defaultCameraPreset: 'side',
    animationName: 'treadmill-incline-walk',
    difficulty: 'Intermediate',
    targetMuscles: ['glutes', 'hamstrings', 'calves'],
    phaseLabels: [
      { label: 'Foot strike', start: 0.0, end: 0.33 },
      { label: 'Drive phase', start: 0.33, end: 0.66 },
      { label: 'Recover', start: 0.66, end: 1.0 },
    ],
  },
];

const verticalPresetSlugs = new Set(['pull-up', 'chin-up', 'hanging-leg-raise', 'hanging-knee-raise']);
const handsGroundSlugs = new Set(['push-up', 'push-up-slow-tempo', 'pike-push-up', 'scapular-push-up', 'plank']);
const noGroundSlugs = new Set(['pull-up', 'chin-up', 'hanging-leg-raise', 'hanging-knee-raise']);

const animatorKeyBySlug: Record<string, string> = {
  'scapular-push-up': 'scapularPushup',
  'treadmill-walk': 'walk',
  'push-up': 'pushup',
  'pike-push-up': 'pikePushup',
  dip: 'dip',
  'bench-dip': 'benchDip',
  'push-up-slow-tempo': 'pushupSlow',
  plank: 'plank',
  'hollow-body-hold': 'hollowHold',
  'glute-bridge': 'gluteBridge',
  'bodyweight-squat': 'squat',
  'bulgarian-split-squat': 'splitSquat',
  'jump-squat': 'jumpSquat',
  'nordic-curl': 'nordic',
  'hamstring-slide': 'hamstringSlide',
  'walking-lunge': 'lungeWalk',
  'calf-raise': 'calfRaise',
  'hanging-leg-raise': 'hangingLegRaise',
  'treadmill-jog': 'jog',
  'band-row': 'bandRow',
  'pull-up': 'pullup',
  'inverted-row': 'invertedRow',
  'chin-up': 'chinup',
  'face-pull-band': 'facePull',
  'hanging-knee-raise': 'hangingKneeRaise',
  'treadmill-incline-walk': 'inclineWalk',
};

function mapLegacyPresetToRecommended(preset: LegacyCameraPreset): CameraPreset {
  if (preset === 'front') {
    return 'Front';
  }
  if (preset === 'side') {
    return 'Side';
  }
  if (preset === 'top') {
    return 'Top';
  }
  return 'ThreeQuarter';
}

function derivePreset(move: ExerciseMove): CameraPreset {
  if (verticalPresetSlugs.has(move.slug)) {
    return 'Vertical';
  }
  return mapLegacyPresetToRecommended(move.defaultCameraPreset);
}

function deriveGroundMode(move: ExerciseMove): GroundMode {
  if (noGroundSlugs.has(move.slug)) {
    return 'none';
  }
  if (handsGroundSlugs.has(move.slug)) {
    return 'hands';
  }
  return 'feet';
}

function derivePhases(move: ExerciseMove): MovePhase[] {
  if (move.phases?.length) {
    return move.phases;
  }
  if (move.phaseLabels?.length) {
    return move.phaseLabels.map((phase) => ({ t: phase.start, label: phase.label }));
  }
  return [
    { t: 0, label: 'Start' },
    { t: 0.5, label: 'Mid' },
    { t: 0.95, label: 'Finish' },
  ];
}

export const moves: ExerciseMove[] = baseMoves.map((move) => ({
  ...move,
  phases: derivePhases(move),
  recommendedPreset: move.recommendedPreset ?? derivePreset(move),
  modelRotationY: move.modelRotationY ?? 0,
  groundMode: move.groundMode ?? deriveGroundMode(move),
  animatorKey: move.animatorKey ?? animatorKeyBySlug[move.slug] ?? 'idle',
}));

export const moveBySlug = new Map(moves.map((move) => [move.slug, move]));
