/**
 * exercises.ts: the exercise library and the name matching every training
 * screen leans on. Pure: no storage, no React.
 *
 * Matching is built for how people actually write in a gym: "db bench",
 * "rdl", "lat pull down", "pullups", "skullcrushers", typos included. Names
 * and aliases are normalized the same way as the query (equipment words
 * shortened, plurals folded, spaces ignored), then scored.
 */

export type Muscle =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'adductors'
  | 'calves';

export const MUSCLES: { id: Muscle; label: string }[] = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'biceps', label: 'Biceps' },
  { id: 'triceps', label: 'Triceps' },
  { id: 'forearms', label: 'Forearms' },
  { id: 'core', label: 'Core' },
  { id: 'quads', label: 'Quads' },
  { id: 'hamstrings', label: 'Hamstrings' },
  { id: 'glutes', label: 'Glutes' },
  { id: 'adductors', label: 'Adductors' },
  { id: 'calves', label: 'Calves' },
];

export const MUSCLE_LABEL = Object.fromEntries(
  MUSCLES.map((m) => [m.id, m.label]),
) as Record<Muscle, string>;

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'smith'
  | 'ezbar'
  | 'trapbar'
  | 'other';

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  cable: 'Cable',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  smith: 'Smith machine',
  ezbar: 'EZ bar',
  trapbar: 'Trap bar',
  other: 'Other',
};

/**
 * How a set is logged:
 *   weighted: a load and reps.
 *   bodyweight: reps, with an optional added load (a belt, a vest).
 *   assisted: reps, with the help a machine or band gives; less help is
 *     harder, so the load that counts is bodyweight minus the help.
 *   timed: a hold in seconds (plank, dead hang), with an optional load.
 *   distance: metres, with an optional load (farmers walk, sled push).
 */
export type ExerciseKind =
  | 'weighted'
  | 'bodyweight'
  | 'assisted'
  | 'timed'
  | 'distance';

export const KIND_LABEL: Record<ExerciseKind, string> = {
  weighted: 'Weight and reps',
  bodyweight: 'Bodyweight',
  assisted: 'Assisted',
  timed: 'Timed hold',
  distance: 'Distance',
};

export interface Exercise {
  id: string;
  name: string;
  muscle: Muscle;
  equipment: Equipment;
  kind: ExerciseKind;
  aliases: string[];
  /** One side at a time: reps and loads are for each side. */
  perSide?: boolean;
  /** Made by the user rather than shipped in the library. */
  custom?: boolean;
}

type Row = [
  id: string,
  name: string,
  muscle: Muscle,
  eq: Equipment,
  aliases: string,
  /** "assisted", "timed" or "distance", and "side" for one side at a time. */
  flags?: string,
];

// Ordered roughly by how often each is done, so ties go to the common one.
// One exercise per line reads like a table, so prettier leaves it alone.
// prettier-ignore
const ROWS: Row[] = [
  // Chest
  ['bench_press', 'Bench press', 'chest', 'barbell', 'bench|flat bench|barbell bench|bb bench|bp|barbell bench press'],
  ['incline_bench_press', 'Incline bench press', 'chest', 'barbell', 'incline bench|incline bb press|incline barbell press'],
  ['db_bench_press', 'Dumbbell bench press', 'chest', 'dumbbell', 'db bench|db press|dumbbell press|flat db press|db chest press'],
  ['incline_db_press', 'Incline dumbbell press', 'chest', 'dumbbell', 'incline db|incline db press|incline dumbbell bench'],
  ['machine_chest_press', 'Chest press machine', 'chest', 'machine', 'chest press|machine press|machine chest press|seated chest press'],
  ['cable_fly', 'Cable fly', 'chest', 'cable', 'cable crossover|crossover|cable cross|cable chest fly'],
  ['pec_deck', 'Pec deck', 'chest', 'machine', 'pec fly|machine fly|butterfly|pec deck fly'],
  ['db_fly', 'Dumbbell fly', 'chest', 'dumbbell', 'fly|db fly|chest fly'],
  ['decline_bench_press', 'Decline bench press', 'chest', 'barbell', 'decline bench|decline press'],
  ['smith_bench_press', 'Smith machine bench press', 'chest', 'smith', 'smith bench|smith press'],
  ['push_up', 'Push ups', 'chest', 'bodyweight', 'pushup|push up'],
  ['dip', 'Dips', 'chest', 'bodyweight', 'dip|chest dip|parallel bar dip|weighted dip'],
  // Back
  ['deadlift', 'Deadlift', 'back', 'barbell', 'dl|deads|conventional deadlift|barbell deadlift'],
  ['pull_up', 'Pull ups', 'back', 'bodyweight', 'pullup|pull up|weighted pull up'],
  ['lat_pulldown', 'Lat pulldown', 'back', 'cable', 'pulldown|lat pull down|lat pull|lpd|wide grip pulldown'],
  ['barbell_row', 'Barbell row', 'back', 'barbell', 'row|bb row|bent over row|bent row|pendlay row'],
  ['db_row', 'Dumbbell row', 'back', 'dumbbell', 'db row|single arm row|one arm row|single arm db row|kroc row', 'side'],
  ['cable_row', 'Seated cable row', 'back', 'cable', 'cable row|seated row|low row'],
  ['chin_up', 'Chin ups', 'back', 'bodyweight', 'chinup|chin up|weighted chin up'],
  ['t_bar_row', 'T bar row', 'back', 'barbell', 'tbar row|t bar|landmine row'],
  ['machine_row', 'Machine row', 'back', 'machine', 'seated machine row|hammer strength row|iso row|plate loaded row'],
  ['chest_supported_row', 'Chest supported row', 'back', 'dumbbell', 'incline row|incline db row|chest supported db row'],
  ['close_grip_pulldown', 'Close grip pulldown', 'back', 'cable', 'v bar pulldown|neutral grip pulldown|close grip lat pulldown'],
  ['straight_arm_pulldown', 'Straight arm pulldown', 'back', 'cable', 'straight arm pushdown|lat prayer|cable pullover'],
  ['rack_pull', 'Rack pull', 'back', 'barbell', 'block pull'],
  ['inverted_row', 'Inverted row', 'back', 'bodyweight', 'australian pull up|body row|bodyweight row'],
  ['back_extension', 'Back extension', 'back', 'bodyweight', 'hyperextension|hyper|45 degree back extension'],
  ['shrug', 'Barbell shrug', 'back', 'barbell', 'shrug|bb shrug'],
  ['db_shrug', 'Dumbbell shrug', 'back', 'dumbbell', 'db shrug'],
  ['power_clean', 'Power clean', 'back', 'barbell', 'clean|hang clean'],
  // Shoulders
  ['ohp', 'Overhead press', 'shoulders', 'barbell', 'ohp|military press|standing press|strict press|barbell overhead press|barbell shoulder press'],
  ['db_shoulder_press', 'Dumbbell shoulder press', 'shoulders', 'dumbbell', 'shoulder press|db shoulder press|seated db press|db ohp|dumbbell overhead press|seated dumbbell press'],
  ['lateral_raise', 'Lateral raise', 'shoulders', 'dumbbell', 'side raise|lat raise|laterals|side lateral raise|db lateral raise'],
  ['machine_shoulder_press', 'Shoulder press machine', 'shoulders', 'machine', 'machine shoulder press'],
  ['cable_lateral_raise', 'Cable lateral raise', 'shoulders', 'cable', 'cable laterals|cable side raise'],
  ['rear_delt_fly', 'Rear delt fly', 'shoulders', 'dumbbell', 'reverse fly|rear fly|rear delt raise|bent over reverse fly'],
  ['face_pull', 'Face pull', 'shoulders', 'cable', 'rope face pull'],
  ['reverse_pec_deck', 'Reverse pec deck', 'shoulders', 'machine', 'reverse machine fly|rear delt machine|reverse pec fly'],
  ['machine_lateral_raise', 'Lateral raise machine', 'shoulders', 'machine', 'machine lateral raise|machine laterals'],
  ['arnold_press', 'Arnold press', 'shoulders', 'dumbbell', 'arnold'],
  ['front_raise', 'Front raise', 'shoulders', 'dumbbell', 'db front raise|plate front raise'],
  ['upright_row', 'Upright row', 'shoulders', 'barbell', ''],
  ['push_press', 'Push press', 'shoulders', 'barbell', ''],
  ['landmine_press', 'Landmine press', 'shoulders', 'barbell', ''],
  // Biceps
  ['db_curl', 'Dumbbell curl', 'biceps', 'dumbbell', 'curl|db curl|bicep curl|dumbbell bicep curl|alternating curl'],
  ['barbell_curl', 'Barbell curl', 'biceps', 'barbell', 'bb curl|barbell bicep curl|standing barbell curl'],
  ['hammer_curl', 'Hammer curl', 'biceps', 'dumbbell', 'hammer|db hammer curl'],
  ['ez_bar_curl', 'EZ bar curl', 'biceps', 'ezbar', 'ez curl|ez bar bicep curl'],
  ['preacher_curl', 'Preacher curl', 'biceps', 'ezbar', 'preacher|ez preacher curl|scott curl'],
  ['incline_db_curl', 'Incline dumbbell curl', 'biceps', 'dumbbell', 'incline curl|incline db curl'],
  ['cable_curl', 'Cable curl', 'biceps', 'cable', 'cable bicep curl|rope curl'],
  ['machine_curl', 'Machine curl', 'biceps', 'machine', 'bicep curl machine|machine preacher curl'],
  ['concentration_curl', 'Concentration curl', 'biceps', 'dumbbell', '', 'side'],
  ['bayesian_curl', 'Bayesian curl', 'biceps', 'cable', 'behind the body cable curl'],
  // Triceps
  ['tricep_pushdown', 'Triceps pushdown', 'triceps', 'cable', 'pushdown|tricep pushdown|rope pushdown|tricep rope|rope extension|cable pushdown'],
  ['overhead_tricep_extension', 'Overhead triceps extension', 'triceps', 'cable', 'overhead extension|overhead tricep extension|overhead cable extension'],
  ['skull_crusher', 'Skull crusher', 'triceps', 'ezbar', 'skullcrusher|lying tricep extension|ez skull crusher|lying extension'],
  ['close_grip_bench', 'Close grip bench press', 'triceps', 'barbell', 'cgbp|close grip bench|close grip press|narrow bench'],
  ['db_overhead_extension', 'Dumbbell overhead extension', 'triceps', 'dumbbell', 'db overhead extension|seated tricep extension|french press'],
  ['tricep_kickback', 'Triceps kickback', 'triceps', 'dumbbell', 'kickback|tricep kickback'],
  ['bench_dip', 'Bench dips', 'triceps', 'bodyweight', 'bench dip|tricep dip'],
  ['jm_press', 'JM press', 'triceps', 'barbell', ''],
  // Forearms
  ['wrist_curl', 'Wrist curl', 'forearms', 'barbell', 'forearm curl'],
  ['reverse_curl', 'Reverse curl', 'forearms', 'ezbar', 'reverse grip curl|reverse ez curl'],
  // Core
  ['hanging_leg_raise', 'Hanging leg raise', 'core', 'bodyweight', 'leg raise|hanging knee raise|knee raise|toes to bar'],
  ['cable_crunch', 'Cable crunch', 'core', 'cable', 'kneeling cable crunch|rope crunch'],
  ['crunch', 'Crunches', 'core', 'bodyweight', 'crunch|ab crunch'],
  ['ab_wheel', 'Ab wheel rollout', 'core', 'bodyweight', 'ab wheel|ab rollout|rollout'],
  ['machine_crunch', 'Ab crunch machine', 'core', 'machine', 'machine crunch|ab machine'],
  ['sit_up', 'Sit ups', 'core', 'bodyweight', 'situp|sit up|decline sit up'],
  ['russian_twist', 'Russian twist', 'core', 'bodyweight', ''],
  // Quads
  ['squat', 'Squat', 'quads', 'barbell', 'back squat|bb squat|barbell squat|high bar squat|low bar squat'],
  ['leg_press', 'Leg press', 'quads', 'machine', 'leg press machine|45 degree leg press|seated leg press'],
  ['leg_extension', 'Leg extension', 'quads', 'machine', 'quad extension|leg ext'],
  ['hack_squat', 'Hack squat', 'quads', 'machine', 'hack squat machine|hack'],
  ['bulgarian_split_squat', 'Bulgarian split squat', 'quads', 'dumbbell', 'bss|bulgarian|split squat|rear foot elevated split squat', 'side'],
  ['front_squat', 'Front squat', 'quads', 'barbell', ''],
  ['lunge', 'Lunges', 'quads', 'dumbbell', 'lunge|walking lunge|db lunge|reverse lunge', 'side'],
  ['goblet_squat', 'Goblet squat', 'quads', 'dumbbell', ''],
  ['smith_squat', 'Smith machine squat', 'quads', 'smith', 'smith squat'],
  ['pendulum_squat', 'Pendulum squat', 'quads', 'machine', ''],
  ['trap_bar_deadlift', 'Trap bar deadlift', 'quads', 'trapbar', 'hex bar deadlift|trap bar|hex bar|trap bar dl'],
  ['step_up', 'Step ups', 'quads', 'dumbbell', 'step up|stepup|box step up', 'side'],
  ['belt_squat', 'Belt squat', 'quads', 'machine', ''],
  // Hamstrings
  ['rdl', 'Romanian deadlift', 'hamstrings', 'barbell', 'rdl|romanian|romanian dl|bb rdl'],
  ['lying_leg_curl', 'Lying leg curl', 'hamstrings', 'machine', 'leg curl|hamstring curl|lying curl|prone leg curl'],
  ['seated_leg_curl', 'Seated leg curl', 'hamstrings', 'machine', 'seated hamstring curl'],
  ['db_rdl', 'Dumbbell Romanian deadlift', 'hamstrings', 'dumbbell', 'db rdl|dumbbell rdl'],
  ['stiff_leg_deadlift', 'Stiff leg deadlift', 'hamstrings', 'barbell', 'sldl|stiff legged deadlift|stiff leg dl'],
  ['good_morning', 'Good morning', 'hamstrings', 'barbell', ''],
  ['nordic_curl', 'Nordic curl', 'hamstrings', 'bodyweight', 'nordic|nordic hamstring curl'],
  // Glutes
  ['hip_thrust', 'Hip thrust', 'glutes', 'barbell', 'barbell hip thrust|ht|glute thrust'],
  ['machine_hip_thrust', 'Hip thrust machine', 'glutes', 'machine', 'machine hip thrust|glute drive'],
  ['hip_abduction', 'Hip abduction', 'glutes', 'machine', 'abduction|abductor|abductor machine|outer thigh|hip abductor'],
  ['glute_bridge', 'Glute bridge', 'glutes', 'barbell', 'bridge|barbell glute bridge'],
  ['cable_kickback', 'Cable glute kickback', 'glutes', 'cable', 'glute kickback|cable kickback|donkey kick'],
  ['sumo_deadlift', 'Sumo deadlift', 'glutes', 'barbell', 'sumo|sumo dl'],
  ['kb_swing', 'Kettlebell swing', 'glutes', 'kettlebell', 'kb swing|swing|russian swing'],
  // Adductors
  ['hip_adduction', 'Hip adduction', 'adductors', 'machine', 'adduction|adductor|adductor machine|inner thigh|hip adductor'],
  ['sumo_squat', 'Sumo squat', 'adductors', 'dumbbell', 'plie squat|sumo goblet squat'],
  // Calves
  ['standing_calf_raise', 'Standing calf raise', 'calves', 'machine', 'calf raise|calf|standing calf|calf raise machine'],
  ['seated_calf_raise', 'Seated calf raise', 'calves', 'machine', 'seated calf'],
  ['leg_press_calf_raise', 'Calf press', 'calves', 'machine', 'leg press calf raise|calf press on leg press'],
  ['single_leg_calf_raise', 'Single leg calf raise', 'calves', 'dumbbell', 'single leg calf', 'side'],
  // Chest, more
  ['decline_db_press', 'Decline dumbbell press', 'chest', 'dumbbell', 'decline db press|decline db bench'],
  ['incline_machine_press', 'Incline chest press machine', 'chest', 'machine', 'incline machine press|incline chest press'],
  ['incline_cable_fly', 'Low to high cable fly', 'chest', 'cable', 'low cable fly|incline cable fly|low to high fly'],
  ['high_cable_fly', 'High to low cable fly', 'chest', 'cable', 'high cable fly|high to low fly'],
  ['incline_db_fly', 'Incline dumbbell fly', 'chest', 'dumbbell', 'incline fly|incline db fly'],
  ['smith_incline_press', 'Smith machine incline press', 'chest', 'smith', 'smith incline|incline smith press|smith incline bench'],
  ['floor_press', 'Floor press', 'chest', 'barbell', 'barbell floor press|bb floor press'],
  ['db_floor_press', 'Dumbbell floor press', 'chest', 'dumbbell', 'db floor press'],
  ['svend_press', 'Svend press', 'chest', 'other', 'plate squeeze press'],
  ['incline_push_up', 'Incline push ups', 'chest', 'bodyweight', 'incline pushup|hands elevated push up'],
  ['decline_push_up', 'Decline push ups', 'chest', 'bodyweight', 'decline pushup|feet elevated push up'],
  ['deficit_push_up', 'Deficit push ups', 'chest', 'bodyweight', 'deficit pushup'],
  ['ring_dip', 'Ring dips', 'chest', 'bodyweight', 'ring dip'],
  ['assisted_dip', 'Assisted dips', 'chest', 'machine', 'assisted dip|assisted dip machine|band assisted dip', 'assisted'],
  // Back, more
  ['assisted_pull_up', 'Assisted pull ups', 'back', 'machine', 'assisted pullup|assisted pull up machine|band assisted pull up|gravitron', 'assisted'],
  ['assisted_chin_up', 'Assisted chin ups', 'back', 'machine', 'assisted chinup|band assisted chin up', 'assisted'],
  ['neutral_pull_up', 'Neutral grip pull ups', 'back', 'bodyweight', 'neutral pullup|hammer grip pull up|parallel grip pull up'],
  ['muscle_up', 'Muscle ups', 'back', 'bodyweight', 'muscle up|bar muscle up|ring muscle up'],
  ['single_arm_pulldown', 'Single arm lat pulldown', 'back', 'cable', 'one arm pulldown|single arm pulldown', 'side'],
  ['machine_pulldown', 'Lat pulldown machine', 'back', 'machine', 'plate loaded pulldown|machine lat pulldown|iso lateral pulldown'],
  ['high_row_machine', 'High row machine', 'back', 'machine', 'high row|iso lateral high row'],
  ['low_row_machine', 'Low row machine', 'back', 'machine', 'iso lateral low row|low row machine'],
  ['single_arm_cable_row', 'Single arm cable row', 'back', 'cable', 'one arm cable row', 'side'],
  ['seal_row', 'Seal row', 'back', 'barbell', 'bench row|prone row'],
  ['meadows_row', 'Meadows row', 'back', 'barbell', 'meadows', 'side'],
  ['db_pullover', 'Dumbbell pullover', 'back', 'dumbbell', 'pullover|db pullover'],
  ['reverse_hyper', 'Reverse hyperextension', 'back', 'machine', 'reverse hyper'],
  ['deficit_deadlift', 'Deficit deadlift', 'back', 'barbell', 'deficit dl'],
  ['snatch_grip_deadlift', 'Snatch grip deadlift', 'back', 'barbell', 'snatch grip dl'],
  ['clean_and_jerk', 'Clean and jerk', 'back', 'barbell', 'clean jerk|c and j'],
  ['snatch', 'Snatch', 'back', 'barbell', 'power snatch|squat snatch'],
  ['trap_bar_shrug', 'Trap bar shrug', 'back', 'trapbar', 'trap bar shrugs'],
  ['cable_shrug', 'Cable shrug', 'back', 'cable', 'cable shrugs'],
  // Shoulders, more
  ['behind_neck_press', 'Behind the neck press', 'shoulders', 'barbell', 'btn press|behind neck press'],
  ['z_press', 'Z press', 'shoulders', 'barbell', 'zpress'],
  ['smith_shoulder_press', 'Smith machine shoulder press', 'shoulders', 'smith', 'smith ohp|smith overhead press'],
  ['single_arm_db_press', 'Single arm dumbbell press', 'shoulders', 'dumbbell', 'one arm db press|single arm shoulder press', 'side'],
  ['kb_press', 'Kettlebell press', 'shoulders', 'kettlebell', 'kb press|kettlebell overhead press', 'side'],
  ['seated_lateral_raise', 'Seated lateral raise', 'shoulders', 'dumbbell', 'seated laterals'],
  ['lean_away_lateral', 'Lean away lateral raise', 'shoulders', 'dumbbell', 'lean away raise', 'side'],
  ['single_arm_cable_lateral', 'Single arm cable lateral raise', 'shoulders', 'cable', 'one arm cable lateral', 'side'],
  ['cable_rear_delt_fly', 'Cable rear delt fly', 'shoulders', 'cable', 'reverse cable fly|cable reverse fly'],
  ['cable_front_raise', 'Cable front raise', 'shoulders', 'cable', 'cable front raises'],
  ['db_upright_row', 'Dumbbell upright row', 'shoulders', 'dumbbell', 'db upright row'],
  ['cable_upright_row', 'Cable upright row', 'shoulders', 'cable', ''],
  ['y_raise', 'Y raise', 'shoulders', 'dumbbell', 'incline y raise'],
  ['band_pull_apart', 'Band pull apart', 'shoulders', 'other', 'pull apart|band pull aparts'],
  ['pike_push_up', 'Pike push ups', 'shoulders', 'bodyweight', 'pike pushup'],
  ['handstand_push_up', 'Handstand push ups', 'shoulders', 'bodyweight', 'hspu|handstand pushup'],
  ['overhead_carry', 'Overhead carry', 'shoulders', 'dumbbell', 'waiter walk|overhead walk', 'distance'],
  // Biceps, more
  ['spider_curl', 'Spider curl', 'biceps', 'dumbbell', 'spider curls'],
  ['db_preacher_curl', 'Dumbbell preacher curl', 'biceps', 'dumbbell', 'single arm preacher curl|db preacher', 'side'],
  ['machine_preacher_curl', 'Preacher curl machine', 'biceps', 'machine', 'machine preacher'],
  ['rope_hammer_curl', 'Rope hammer curl', 'biceps', 'cable', 'cable hammer curl|cable rope curl'],
  ['cross_body_curl', 'Cross body hammer curl', 'biceps', 'dumbbell', 'cross body curl|pinwheel curl', 'side'],
  ['drag_curl', 'Drag curl', 'biceps', 'barbell', 'bar drag curl'],
  ['zottman_curl', 'Zottman curl', 'biceps', 'dumbbell', ''],
  ['curl_21s', '21s', 'biceps', 'barbell', 'twenty ones|21 curls'],
  // Triceps, more
  ['single_arm_pushdown', 'Single arm pushdown', 'triceps', 'cable', 'one arm pushdown', 'side'],
  ['reverse_grip_pushdown', 'Reverse grip pushdown', 'triceps', 'cable', 'underhand pushdown'],
  ['single_arm_overhead_extension', 'Single arm overhead cable extension', 'triceps', 'cable', 'one arm overhead extension', 'side'],
  ['ez_overhead_extension', 'EZ bar overhead extension', 'triceps', 'ezbar', 'ez overhead extension|ez bar french press'],
  ['db_skull_crusher', 'Dumbbell skull crusher', 'triceps', 'dumbbell', 'db skull crusher|db lying extension'],
  ['cable_tricep_kickback', 'Cable triceps kickback', 'triceps', 'cable', 'cable tricep kickback', 'side'],
  ['machine_tricep_extension', 'Triceps extension machine', 'triceps', 'machine', 'tricep machine|triceps machine'],
  ['machine_dip', 'Dip machine', 'triceps', 'machine', 'seated dip|tricep dip machine'],
  ['diamond_push_up', 'Diamond push ups', 'triceps', 'bodyweight', 'diamond pushup|close grip push up'],
  ['tate_press', 'Tate press', 'triceps', 'dumbbell', ''],
  // Forearms and grip, more
  ['reverse_wrist_curl', 'Reverse wrist curl', 'forearms', 'barbell', 'wrist extension'],
  ['db_wrist_curl', 'Dumbbell wrist curl', 'forearms', 'dumbbell', 'db wrist curl'],
  ['wrist_roller', 'Wrist roller', 'forearms', 'other', ''],
  ['farmers_walk', 'Farmers walk', 'forearms', 'dumbbell', 'farmers carry|farmer walk|farmer carry|farmers', 'distance'],
  ['dead_hang', 'Dead hang', 'forearms', 'bodyweight', 'bar hang|hang from bar', 'timed'],
  ['plate_pinch', 'Plate pinch', 'forearms', 'other', 'pinch grip|plate pinch hold', 'timed'],
  // Core, more
  ['plank', 'Plank', 'core', 'bodyweight', 'front plank|forearm plank|planks', 'timed'],
  ['side_plank', 'Side plank', 'core', 'bodyweight', 'side planks', 'timed|side'],
  ['hollow_hold', 'Hollow body hold', 'core', 'bodyweight', 'hollow hold|hollow body', 'timed'],
  ['l_sit', 'L sit', 'core', 'bodyweight', 'lsit|l sit hold', 'timed'],
  ['dead_bug', 'Dead bug', 'core', 'bodyweight', 'deadbug|dead bugs'],
  ['pallof_press', 'Pallof press', 'core', 'cable', 'anti rotation press', 'side'],
  ['woodchop', 'Cable woodchop', 'core', 'cable', 'woodchopper|wood chop|cable wood chop', 'side'],
  ['captains_chair', 'Captains chair leg raise', 'core', 'machine', 'roman chair leg raise|vertical knee raise'],
  ['v_up', 'V ups', 'core', 'bodyweight', 'v up|jackknife'],
  ['bicycle_crunch', 'Bicycle crunch', 'core', 'bodyweight', 'bicycle crunches'],
  ['reverse_crunch', 'Reverse crunch', 'core', 'bodyweight', 'reverse crunches'],
  ['mountain_climber', 'Mountain climbers', 'core', 'bodyweight', 'mountain climber'],
  ['landmine_rotation', 'Landmine rotation', 'core', 'barbell', 'landmine twist|landmine 180'],
  ['suitcase_carry', 'Suitcase carry', 'core', 'kettlebell', 'suitcase walk|single arm carry', 'distance|side'],
  // Quads, more
  ['pause_squat', 'Pause squat', 'quads', 'barbell', 'paused squat'],
  ['box_squat', 'Box squat', 'quads', 'barbell', 'box squats'],
  ['safety_bar_squat', 'Safety bar squat', 'quads', 'barbell', 'ssb squat|safety squat bar'],
  ['zercher_squat', 'Zercher squat', 'quads', 'barbell', 'zercher'],
  ['barbell_lunge', 'Barbell lunges', 'quads', 'barbell', 'bb lunge|barbell lunge', 'side'],
  ['smith_split_squat', 'Smith machine split squat', 'quads', 'smith', 'smith bulgarian|smith split squat', 'side'],
  ['single_leg_press', 'Single leg press', 'quads', 'machine', 'one leg press', 'side'],
  ['single_leg_extension', 'Single leg extension', 'quads', 'machine', 'one leg extension', 'side'],
  ['v_squat', 'V squat', 'quads', 'machine', 'v squat machine'],
  ['heel_elevated_goblet', 'Heel elevated goblet squat', 'quads', 'dumbbell', 'cyclist squat|heels elevated squat'],
  ['sissy_squat', 'Sissy squat', 'quads', 'bodyweight', 'sissy squats'],
  ['pistol_squat', 'Pistol squat', 'quads', 'bodyweight', 'pistol|single leg squat', 'side'],
  ['air_squat', 'Air squats', 'quads', 'bodyweight', 'bodyweight squat|air squat'],
  ['jump_squat', 'Jump squats', 'quads', 'bodyweight', 'squat jump'],
  ['box_jump', 'Box jumps', 'quads', 'bodyweight', 'box jump'],
  ['thruster', 'Thrusters', 'quads', 'barbell', 'thruster|barbell thruster'],
  ['wall_ball', 'Wall balls', 'quads', 'other', 'wall ball shots|wallball|wall ball'],
  ['wall_sit', 'Wall sit', 'quads', 'bodyweight', 'wall squat hold|wall sits', 'timed'],
  ['sled_push', 'Sled push', 'quads', 'other', 'prowler|prowler push|sled', 'distance'],
  ['sandbag_lunge', 'Sandbag lunges', 'quads', 'other', 'sandbag walking lunge|sandbag lunge', 'distance'],
  // Hamstrings, more
  ['single_leg_rdl', 'Single leg Romanian deadlift', 'hamstrings', 'dumbbell', 'single leg rdl|sl rdl|one leg rdl', 'side'],
  ['standing_leg_curl', 'Standing leg curl', 'hamstrings', 'machine', 'standing hamstring curl', 'side'],
  ['glute_ham_raise', 'Glute ham raise', 'hamstrings', 'bodyweight', 'ghr|glute ham'],
  ['cable_pull_through', 'Cable pull through', 'hamstrings', 'cable', 'pull through|pull throughs'],
  ['trap_bar_rdl', 'Trap bar Romanian deadlift', 'hamstrings', 'trapbar', 'trap bar rdl'],
  ['smith_rdl', 'Smith machine Romanian deadlift', 'hamstrings', 'smith', 'smith rdl'],
  ['ball_leg_curl', 'Stability ball leg curl', 'hamstrings', 'bodyweight', 'ball leg curl|swiss ball leg curl'],
  ['sled_pull', 'Sled pull', 'hamstrings', 'other', 'sled drag|backward sled drag', 'distance'],
  // Glutes, more
  ['db_hip_thrust', 'Dumbbell hip thrust', 'glutes', 'dumbbell', 'db hip thrust'],
  ['smith_hip_thrust', 'Smith machine hip thrust', 'glutes', 'smith', 'smith hip thrust'],
  ['single_leg_hip_thrust', 'Single leg hip thrust', 'glutes', 'bodyweight', 'sl hip thrust|one leg hip thrust', 'side'],
  ['frog_pump', 'Frog pumps', 'glutes', 'bodyweight', 'frog pump'],
  ['cable_abduction', 'Cable hip abduction', 'glutes', 'cable', 'standing cable abduction', 'side'],
  ['machine_kickback', 'Glute kickback machine', 'glutes', 'machine', 'kickback machine'],
  ['curtsy_lunge', 'Curtsy lunge', 'glutes', 'dumbbell', 'curtsy lunges', 'side'],
  ['band_walk', 'Banded lateral walk', 'glutes', 'other', 'monster walk|lateral band walk|band walk'],
  // Adductors, more
  ['cable_adduction', 'Cable hip adduction', 'adductors', 'cable', 'standing cable adduction', 'side'],
  ['cossack_squat', 'Cossack squat', 'adductors', 'bodyweight', 'cossack squats', 'side'],
  ['copenhagen_plank', 'Copenhagen plank', 'adductors', 'bodyweight', 'copenhagen|copenhagen hold', 'timed|side'],
  // Calves, more
  ['smith_calf_raise', 'Smith machine calf raise', 'calves', 'smith', 'smith calf raise'],
  ['donkey_calf_raise', 'Donkey calf raise', 'calves', 'machine', 'donkey calf'],
  ['tibialis_raise', 'Tibialis raise', 'calves', 'bodyweight', 'tib raise|tib bar raise'],
];

const KIND_FLAGS: ExerciseKind[] = ['assisted', 'timed', 'distance'];

export const LIBRARY: Exercise[] = ROWS.map(
  ([id, name, muscle, equipment, aliases, flags = '']) => {
    const f = flags.split('|');
    const kind: ExerciseKind =
      KIND_FLAGS.find((k) => f.includes(k)) ??
      (equipment === 'bodyweight' ? 'bodyweight' : 'weighted');
    return {
      id,
      name,
      muscle,
      equipment,
      kind,
      aliases: aliases ? aliases.split('|') : [],
      ...(f.includes('side') ? { perSide: true } : {}),
    };
  },
);

/** Equipment words shortened, so "dumbbell press" and "db press" meet. */
const WORDS: Record<string, string> = {
  dumbbell: 'db',
  dumbell: 'db',
  barbell: 'bb',
  kettlebell: 'kb',
  calves: 'calf',
  ups: 'up',
  flies: 'fly',
  flyes: 'fly',
  flye: 'fly',
};
const FILLER = new Set(['the', 'a', 'an', 'with', 'on', 'my', 'some']);

/** One word in its plain singular form: "curls" curl, "crunches" crunch. */
function singular(w: string): string {
  if (WORDS[w]) return WORDS[w];
  if (/(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 3 && w.endsWith('s') && !/(ss|us)$/.test(w)) {
    const base = w.slice(0, -1);
    return WORDS[base] ?? base;
  }
  return w;
}

/** Lowercase words, equipment shortened, plurals folded, filler dropped. */
export function normalizeName(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w && !FILLER.has(w))
    .map(singular)
    .join(' ');
}

interface Candidate {
  tokens: string[];
  compact: string;
}

const index = new WeakMap<Exercise, Candidate[]>();

function candidates(ex: Exercise): Candidate[] {
  let c = index.get(ex);
  if (!c) {
    c = [ex.name, ...ex.aliases].map((text) => {
      const norm = normalizeName(text);
      return { tokens: norm.split(' '), compact: norm.replace(/ /g, '') };
    });
    index.set(ex, c);
  }
  return c;
}

/** Edit distance where swapping two neighbours counts as one edit. */
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** How well a normalized query fits one exercise, 0 to 100. */
function score(tokens: string[], compact: string, ex: Exercise): number {
  let best = 0;
  for (const c of candidates(ex)) {
    let s = 0;
    if (c.compact === compact) s = 100;
    else if (tokens.every((q) => c.tokens.some((t) => t.startsWith(q)))) {
      s = 72 - 3 * Math.max(0, c.tokens.length - tokens.length);
    } else if (c.compact.startsWith(compact)) s = 66;
    else if (compact.length >= 4 && c.compact.includes(compact)) s = 56;
    else {
      const max = compact.length >= 8 ? 2 : compact.length >= 5 ? 1 : 0;
      if (max > 0 && Math.abs(c.compact.length - compact.length) <= max) {
        const d = distance(compact, c.compact);
        if (d <= max) s = 50 - 10 * d;
      }
    }
    if (s > best) best = s;
  }
  return best;
}

function prepare(query: string) {
  const norm = normalizeName(query);
  return {
    tokens: norm ? norm.split(' ') : [],
    compact: norm.replace(/ /g, ''),
  };
}

/**
 * The exercise a written name most likely means, or null. Raise `min` to
 * 100 to accept only an exact name or alias.
 */
export function matchExercise(
  query: string,
  list: Exercise[],
  min = 30,
): Exercise | null {
  const hit = bestMatch(query, list);
  return hit && hit.score >= min ? hit.exercise : null;
}

/** The closest exercise and how close, 0 to 100 (100 is an exact name). */
export function bestMatch(
  query: string,
  list: Exercise[],
): { exercise: Exercise; score: number } | null {
  const { tokens, compact } = prepare(query);
  if (!compact) return null;
  let best: Exercise | null = null;
  let bestScore = 0;
  for (const ex of list) {
    const s = score(tokens, compact, ex);
    if (s > bestScore) {
      best = ex;
      bestScore = s;
    }
  }
  return best ? { exercise: best, score: bestScore } : null;
}

/**
 * Exercises for a search box, best first. An empty query lists everything
 * (or one muscle) from A to Z.
 */
export function searchExercises(
  query: string,
  list: Exercise[],
  muscle: Muscle | null = null,
): Exercise[] {
  const pool = muscle ? list.filter((e) => e.muscle === muscle) : list;
  const { tokens, compact } = prepare(query);
  if (!compact) return [...pool].sort((a, b) => a.name.localeCompare(b.name));
  return pool
    .map((ex) => ({ ex, s: score(tokens, compact, ex) }))
    .filter((r) => r.s >= 30)
    .sort(
      (a, b) =>
        b.s - a.s ||
        a.ex.name.length - b.ex.name.length ||
        a.ex.name.localeCompare(b.ex.name),
    )
    .map((r) => r.ex);
}

/** Library plus the user's own, looked up by id. */
export function exerciseMap(list: Exercise[]): Map<string, Exercise> {
  return new Map(list.map((e) => [e.id, e]));
}

/** A short random id for things the user makes. */
export function newId(prefix = ''): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** A custom exercise from a typed name. */
export function customExercise(
  name: string,
  muscle: Muscle,
  kind: ExerciseKind,
  perSide = false,
): Exercise {
  const clean = name.trim().replace(/\s+/g, ' ');
  return {
    id: newId('c_'),
    name: clean.charAt(0).toUpperCase() + clean.slice(1),
    muscle,
    equipment: kind === 'bodyweight' ? 'bodyweight' : 'other',
    kind,
    aliases: [],
    ...(perSide ? { perSide: true } : {}),
    custom: true,
  };
}
