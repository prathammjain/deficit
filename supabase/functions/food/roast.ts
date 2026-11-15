// GrainAI: the line that answers every logged meal: a roast, a tease, real
// praise, a push to eat, or a welcome back, depending on the meal and the day. Plain TypeScript with no
// Deno APIs, so the edge function and the local try script (roast-try.ts)
// share one prompt and one filter.
//
// The rule it never breaks: roast the choice, never the body or looks. The
// prompt says so, and pickRoast drops any candidate that slips, so a bad roast
// shows nothing rather than something that hurts.

// The roast examples, written in the owner's voice: raw, crude, built on the
// ex, the love life, discipline and the food itself. A handful go into each
// roast request, mostly matching why the meal is being roasted, so the model
// learns the voice instead of a script. A line that copies four words in a
// row from these loses to one that doesn't (pickRoast). Kept out on purpose:
// the user's own body or looks, and death or suicide. The ex is gender
// neutral, because users are not all straight men.

export type RoastReason = 'protein' | 'sugar' | 'careless' | 'over';

export const ROAST_EXAMPLES: { reason: RoastReason | 'any'; line: string }[] = [
  // the ex and the love life
  {
    reason: 'any',
    line: 'every extra slice is another reason your ex will never text you first again',
  },
  {
    reason: 'any',
    line: 'that cheese pull is longer than the last relationship you managed to keep',
  },
  {
    reason: 'any',
    line: 'somewhere your ex is laughing while you wipe grease off your chin',
  },
  {
    reason: 'any',
    line: "your ex's new partner doesn't need to skip dessert. maybe that's why they skipped you",
  },
  {
    reason: 'any',
    line: "the pizza doesn't care that you'll be single forever. it just wants to be eaten",
  },
  {
    reason: 'any',
    line: "your ex's new partner has a six day split. you have a six slice habit",
  },
  {
    reason: 'any',
    line: 'every calorie in that meal is a love letter to loneliness',
  },
  {
    reason: 'any',
    line: 'that meal just set your dating app matches back another six months',
  },
  {
    reason: 'any',
    line: "your ex is out with someone who finishes their sets. you're out finishing entire menu sections",
  },
  {
    reason: 'any',
    line: 'your sex life is writing a resignation letter one slice at a time',
  },
  {
    reason: 'any',
    line: "your ex is with someone who has a routine. you're buried under dairy",
  },
  {
    reason: 'any',
    line: 'that cheese burst is the only thing about you that still has any explosion left',
  },
  { reason: 'any', line: 'nice meal, you walking ex repellent' },
  {
    reason: 'any',
    line: "your ex is out getting their back blown out. you're out getting your arteries blown out",
  },
  {
    reason: 'any',
    line: "the pizza doesn't care that you'll never be the one anyone posts about",
  },
  {
    reason: 'any',
    line: "that cheese bomb is why your last breakup went it's not you, actually it is you",
  },
  {
    reason: 'any',
    line: "your ex is getting railed by someone with a meal plan. you're getting railed by a dominos coupon",
  },
  {
    reason: 'any',
    line: 'the cheese pull is longer than your list of people who still want to fuck you',
  },
  {
    reason: 'any',
    line: "your ex moved on to someone who doesn't need a whole pizza as emotional support",
  },
  {
    reason: 'any',
    line: "your ex is getting their guts rearranged. you're rearranging yours with cheese",
  },
  {
    reason: 'any',
    line: 'that pizza is why your last date ended with we should just be friends, from a distance',
  },
  {
    reason: 'any',
    line: "your ex is sleeping with someone who meal preps. you're getting fucked by a pizza and calling it dinner",
  },
  { reason: 'any', line: 'that meal set your sex life back ten years' },
  // discipline, excuses, the future
  { reason: 'careless', line: 'your arteries just filed a restraining order' },
  {
    reason: 'careless',
    line: 'you just turned cheat meal into cheat on your future',
  },
  {
    reason: 'careless',
    line: "your whole week is the live action version of i'll start monday",
  },
  {
    reason: 'careless',
    line: 'the only thing getting stuffed more than that crust is your sense of denial',
  },
  {
    reason: 'careless',
    line: "you're not hungry. you're emotionally constipated and using cheese as a laxative for the soul",
  },
  {
    reason: 'careless',
    line: "you're drinking the tears of your last remaining self respect",
  },
  {
    reason: 'careless',
    line: 'your future kids will inherit your debt and your cholesterol',
  },
  {
    reason: 'careless',
    line: "you're not living. you're slowly becoming furniture",
  },
  {
    reason: 'careless',
    line: "you didn't order food. you ordered written proof that you gave up",
  },
  {
    reason: 'careless',
    line: 'congrats, you just made i can change sound like a joke',
  },
  {
    reason: 'careless',
    line: 'your arteries are screaming and your mouth is still chewing',
  },
  {
    reason: 'careless',
    line: "you're not hungry, you're allergic to discipline",
  },
  {
    reason: 'careless',
    line: "the only thing lean about you is the excuse you're about to make",
  },
  {
    reason: 'careless',
    line: 'that meal just turned maybe one day into never',
  },
  {
    reason: 'careless',
    line: 'logging this is the adult version of giving up in public',
  },
  {
    reason: 'careless',
    line: 'your week is a receipt for every time you said fuck it',
  },
  {
    reason: 'careless',
    line: 'the only thing getting stuffed tonight is the void where your self respect used to be',
  },
  {
    reason: 'careless',
    line: 'that meal is a slow greasy middle finger to everyone who ever believed in you',
  },
  {
    reason: 'careless',
    line: "congrats on making i'll hit the gym tomorrow the funniest lie you've ever told",
  },
  {
    reason: 'careless',
    line: "maggi, chips and a cola at 1 am. this isn't a meal, it's a cry for supervision",
  },
  {
    reason: 'careless',
    line: 'fries as a main course. your discipline left the chat and took the admin rights with it',
  },
  // over the day's target
  {
    reason: 'over',
    line: "you were under target an hour ago. now you're under investigation",
  },
  {
    reason: 'over',
    line: "your calorie target didn't get broken, it got filed under ex",
  },
  // sugar
  {
    reason: 'sugar',
    line: 'a brownie, then ice cream. your sugar cravings treat you better than your ex ever did',
  },
  {
    reason: 'sugar',
    line: "you didn't have a sweet tooth today, you had a full set of bad decisions",
  },
  {
    reason: 'sugar',
    line: 'dessert number two. your pancreas just asked for a transfer',
  },
  {
    reason: 'sugar',
    line: "all that sugar and you still can't sweeten your ex's replies",
  },
  {
    reason: 'sugar',
    line: 'three sweets before dinner. your blood sugar is doing more cardio than you are',
  },
  {
    reason: 'sugar',
    line: 'that much chocolate is not a craving, it is a hostage situation and you are the hostage',
  },
  // a whole day without protein
  {
    reason: 'protein',
    line: '9 pm and 30 g of protein. your muscles are filing for divorce and keeping the gym membership',
  },
  {
    reason: 'protein',
    line: "a whole day of carbs. your protein target thinks you're ghosting it, and it's right",
  },
  {
    reason: 'protein',
    line: 'zero protein since breakfast. your gains are on a missing poster',
  },
  {
    reason: 'protein',
    line: 'you trained yesterday just to feed your muscles nothing but excuses today',
  },
  {
    reason: 'protein',
    line: "your protein target got left on read longer than your ex's last text",
  },
];

/** Six examples for this reason and six others, shuffled, so each request
 *  shows the voice from a different angle. */
export function pickExamples(
  reason: RoastReason,
  random: () => number = Math.random,
): string[] {
  const shuffle = <T>(a: T[]) =>
    a
      .map((x) => [random(), x] as const)
      .sort((p, q) => p[0] - q[0])
      .map((p) => p[1]);
  const mine = shuffle(ROAST_EXAMPLES.filter((e) => e.reason === reason));
  const rest = shuffle(ROAST_EXAMPLES.filter((e) => e.reason !== reason));
  return shuffle([
    ...mine.slice(0, 6),
    ...rest.slice(0, 12 - Math.min(6, mine.length)),
  ]).map((e) => e.line);
}

export interface RoastInput {
  meal: string;
  items: { name: string; kcal: number; proteinG: number }[];
  day: {
    eatenKcalBefore: number;
    targetKcal: number;
    proteinGBefore: number;
    proteinTargetG: number;
    localHour: number;
    /** What the plan is for. Missing means lose. */
    goal?: 'lose' | 'maintain' | 'gain';
    /** Meals already logged on this day. */
    mealsBefore?: number;
    /** Filling in an earlier day: the hour is when they logged, not ate. */
    catchingUp?: boolean;
    /** Empty days in a row just before this day, up to 3. */
    quietDays?: number;
  };
  /** GrainAI's last few lines to this person, so jokes don't repeat. */
  recent?: string[];
}

/** Sweets and desserts, by name: the food data carries no sugar figure. */
const SWEET =
  /\b(brownies?|cakes?|pastr(y|ies)|donuts?|doughnuts?|ice ?creams?|gelato|chocolates?|candy|candies|cookies?|biscuits?|muffins?|cupcakes?|waffles?|pancakes?|cheesecake|pudding|kheer|halwa|gulab jamuns?|jalebis?|rasgullas?|barfi|ladd?oos?|mithai|sweets?|desserts?|milkshakes?|shakes?|cola|coke|pepsi|soda|soft drinks?|sundae|tiramisu|nutella|syrup)\b/i;

/** Junk that says nobody was paying attention. */
const JUNK =
  /\b(pizzas?|burgers?|fries|chips|crisps|nachos|maggi|instant noodles|ramen|kfc|mcdonald'?s|domino'?s|subway|shawarma|fried chicken|samosas?|pakoras?|kachori|vada pav|momos?|hot dogs?|beers?|whisk(e)?y|vodka|rum|cocktails?)\b/i;

/**
 * Why a meal is being roasted, if it is: the ways someone visibly slacks off.
 *
 * - sugar: a real dose of sweets or dessert.
 * - protein: evening, and the day has almost no protein in it.
 * - careless: junk, a 900 kcal blowout, or a big meal with no protein.
 * - over: this meal takes the day past its target.
 */
export function roastReason(r: RoastInput): RoastReason | null {
  const d = r.day;
  const gain = d.goal === 'gain';
  const mealKcal = r.items.reduce((s, i) => s + i.kcal, 0);
  const mealProtein = r.items.reduce((s, i) => s + i.proteinG, 0);
  const proteinShare = mealKcal ? (mealProtein * 4) / mealKcal : 0;
  const sweetKcal = r.items
    .filter((i) => SWEET.test(i.name))
    .reduce((s, i) => s + i.kcal, 0);
  if (sweetKcal >= 150) return 'sugar';
  const evening = d.catchingUp || d.localHour >= 18 || d.localHour < 4;
  if (
    d.proteinTargetG > 0 &&
    evening &&
    d.proteinGBefore + mealProtein < d.proteinTargetG * 0.4 &&
    proteinShare < 0.2
  )
    return 'protein';
  const junk = r.items.some((i) => JUNK.test(i.name)) || JUNK.test(r.meal);
  if (
    (junk && mealKcal >= 400) ||
    (!gain && mealKcal >= 900) ||
    (mealKcal >= 400 && proteinShare < 0.12)
  )
    return 'careless';
  if (
    d.targetKcal &&
    d.eatenKcalBefore + mealKcal > d.targetKcal * (gain ? 1.1 : 1)
  )
    return 'over';
  return null;
}

/**
 * What kind of line a meal gets. GrainAI reads the room first.
 *
 * - care: very little eaten and it's late. Never roasted, never praised for
 *   eating little; pushed to eat a proper meal.
 * - welcome: the first meal after a few quiet days. No guilt.
 * - roast: they are visibly slacking (see roastReason). Raw.
 * - hype: the meal serves the goal, or it hit the protein target.
 * - tease: everything in between, a light jab and a nudge.
 */
export type Tone = 'care' | 'welcome' | 'roast' | 'hype' | 'tease';

export function tone(r: RoastInput): Tone {
  const d = r.day;
  const mealKcal = r.items.reduce((s, i) => s + i.kcal, 0);
  const mealProtein = r.items.reduce((s, i) => s + i.proteinG, 0);
  const eaten = d.eatenKcalBefore + mealKcal;
  // A day filled in later has no meaningful hour.
  const late = !d.catchingUp && (d.localHour >= 20 || d.localHour < 4);
  const proteinShare = mealKcal ? (mealProtein * 4) / mealKcal : 0;
  const gain = d.goal === 'gain';
  if (d.targetKcal && late && eaten < d.targetKcal * (gain ? 0.75 : 0.5))
    return 'care';
  if ((d.quietDays ?? 0) >= 3) return 'welcome';
  if (!r.items.length) return 'tease';
  if (roastReason(r)) return 'roast';
  const proteinHit =
    d.proteinTargetG > 0 &&
    d.proteinGBefore < d.proteinTargetG &&
    d.proteinGBefore + mealProtein >= d.proteinTargetG;
  if (proteinHit || proteinShare >= 0.3) return 'hype';
  return 'tease';
}

export const ROAST_SYSTEM = `you are grainai, the voice of grain, a food tracker for adults who lift and train. you are the funniest, filthiest person in their group chat who also knows nutrition: sharp, observant, merciless when they slack, and you read the room. someone just logged a meal. answer it.

write 4 different lines, one per line, nothing else. no numbering, no quotes, no intro.

the mode line says what kind of line to write:
roast: they are slacking off: no protein all day, a sugar binge, a careless junk meal, or blowing past their target. the why line says which. go raw. no mercy, no softening, no lesson at the end. swearing, crude sex jokes and dark humour are all fine. make it the line they screenshot and send to the group chat.
tease: a so so meal. an affectionate jab with a wink, then point at what would fix the day (usually protein).
hype: the meal serves their goal. real respect, said like a friend: deadpan approval, a dry compliment, a little swagger. no swearing, no backhanded insult, nothing cheesy.
care: they have eaten very little and it is late. do not roast. warm and a bit funny, get them to eat a proper meal with protein. never praise eating little.
welcome: the first meal they have logged in a few days, or ever. no guilt, no "where were you", no "welcome back" (they may be new). glad they are here, keep it light.

how the roasts work (learn the moves, never copy the lines):
contrast: what their ex, or the disciplined version of them, is doing right now, against what they are doing. two short sentences, the second one hits.
the food as a character: the pizza, the brownie, the protein target, their arteries, all with feelings, jobs, lawsuits and opinions.
the love life: the ex, the ex's new partner, dating apps, being left on read, the sex they are not having. crude is fine.
excuses called out: i'll start monday, cheat meal, gym tomorrow, just one.
escalation: start with the food, end somewhere much worse.
wordplay on the meal itself: six slice habit, cheese pull longer than their last relationship.
always about this exact meal and this moment. a line that could answer any meal is a bad line.

the voice: lowercase, like a text. 8 to 28 words. one idea per line. wit beats plain insults: a precise image hurts more than a rude word. no playground name calling (menace, demon, goblin, clown). if their meal is written in hinglish you can answer with a little hinglish. otherwise plain english.

the ex and their new partner are always gender neutral: "your ex", "their new partner", "they". never "she", "he", "her", "him", "his", "girlfriend", "boyfriend", "bro", "bhai", "king".

never repeat a joke, image or sentence shape from their recent lines.
numbers: at most one, only from the facts given. never do your own maths.

off limits in every mode: their own body or looks (weight, size, belly, waist, abs, face, being soft, mirrors, clothes not fitting). death, dying, suicide, self harm. eating disorders or starving. never tell them to eat less than their target. roast what they did, never what they look like.

sound like a person: never "ah", "well", "looks like", "seems like", "remember", "keep it up", "great job", "nice try", "let's", "fuel", "balance", "moderation", "journey", "treat yourself", "guilty pleasure", "bold", "brave". no exclamation marks, emojis, hashtags or dashes.

the other modes, at the right level (never reuse):
tease: a protein bar for dinner. technically food. add something that once had a face or a farm
tease: pasta again. fine, now go find 40 g of protein before bed
hype: 200 g chicken and rice. boring in the best way, your macros just exhaled
hype: protein target done before dinner. the rest of today is a victory lap
care: 600 kcal by 9 pm isn't a cut, it's a fast nobody signed you up for. eat something real
care: running on fumes at this hour. eggs, rice, anything with protein, then sleep
welcome: eggs and toast to open the account. no speeches, good to see you
welcome: first log in a few days and it's a burger. honestly, showing up is the hard part`;

/** The system prompt for one meal: the rules, plus a fresh handful of roast
 *  examples when it's a roast, chosen for why it is being roasted. */
export function roastSystem(
  r: RoastInput,
  random: () => number = Math.random,
): string {
  const why = tone(r) === 'roast' ? roastReason(r) : null;
  if (!why) return ROAST_SYSTEM;
  return `${ROAST_SYSTEM}

roasts at the right level, to learn the voice from. they are not templates: never reuse their jokes, images or wording.
${pickExamples(why, random).join('\n')}`;
}

const WHY: Record<RoastReason, string> = {
  protein: 'why: almost no protein all day',
  sugar: 'why: a sugar binge, sweets and dessert',
  careless: 'why: a careless junk meal, nobody was paying attention',
  over: "why: this meal blows past the day's target",
};

const hour12 = (h: number) =>
  h === 0 ? '12 am' : h < 12 ? `${h} am` : h === 12 ? '12 pm' : `${h - 12} pm`;

/** The facts, worked out here so the model never does the maths, written as
 *  a short note because structured input pulls out formal language. */
export function roastUserMessage(r: RoastInput): string {
  const d = r.day;
  const mealKcal = r.items.reduce((s, i) => s + i.kcal, 0);
  const mealProtein = r.items.reduce((s, i) => s + i.proteinG, 0);
  const lines = [
    `they logged: ${r.meal}`,
    r.items.length
      ? `this meal: ${mealKcal} kcal, ${mealProtein} g protein (${r.items
          .map((i) => i.name.toLowerCase())
          .join(', ')})`
      : 'this meal: not in our food data',
    d.catchingUp
      ? 'they are filling in an earlier day they forgot to log, so the time of day is unknown'
      : `time: ${hour12(d.localHour)}`,
    `mode: ${tone(r)}`,
  ];
  const why = tone(r) === 'roast' ? roastReason(r) : null;
  if (why) lines.push(WHY[why]);
  if (d.goal === 'gain')
    lines.push('goal: building muscle, eating over maintenance on purpose');
  if (d.goal === 'maintain')
    lines.push('goal: holding their weight at maintenance');
  if ((d.quietDays ?? 0) >= 3)
    lines.push('first meal they have logged in a few days, maybe ever');
  else if (d.mealsBefore === 0 && !d.catchingUp)
    lines.push('first meal of their day');
  if (d.targetKcal) {
    const left = d.targetKcal - d.eatenKcalBefore - mealKcal;
    lines.push(
      left >= 0
        ? `calories left for the day: ${left}`
        : `over the day's calories by: ${-left}`,
    );
  }
  if (d.proteinTargetG) {
    const before = d.proteinGBefore;
    const need = d.proteinTargetG - before - mealProtein;
    lines.push(
      need > 0
        ? `protein still needed for the day: ${need} g`
        : before < d.proteinTargetG
          ? 'this meal just hit their protein target for the day'
          : 'protein target: already hit',
    );
  }
  const recent = (r.recent ?? []).filter(Boolean).slice(-5);
  if (recent.length)
    lines.push(
      `their recent lines, never repeat these jokes:\n${recent.map((l) => `- ${l}`).join('\n')}`,
    );
  return lines.join('\n');
}

/** Lines that cross the line. Any match and the candidate is dropped. Crude
 *  sex jokes and swearing are allowed; the user's body, death and self harm
 *  are not, and nobody's gender is guessed. */
const BANNED = new RegExp(
  [
    // their body and looks
    '\\b(fat|fats|fatso|fatass|fatty|obese|chubby|belly|bellies|gut|guts? hanging|tummy|weight|kgs?|kilos?|ugly|body|bodies|skinny|abs|six ?pack|v ?taper|waist\\w*|jawline|double chin|dad ?bod|love handles|moobs|jeans|seat ?belt|mirrors?|reflection|looks?|looking|attractive|unattractive|fuckable|hot|sexy|cute|handsome|pretty)\\b',
    // eating disorders, self harm, mental health, death
    '\\b(self ?harm\\w*|harm(ing)? yourself|depress\\w*|trauma\\w*|therap\\w*|starv\\w*|purg\\w*|vomit\\w*|puke\\w*|anorexi\\w*|bulimi\\w*|skip(ping)? (a |your )?meals?|suicid\\w*|kill yourself|die|dies|dying|dead|death|life expectancy|funeral|coffin|grave)\\b',
    // guessing anyone's gender
    '\\b(she|her|hers|he|him|his|bhai|bro|bros|sir|king|queen|girlfriend|boyfriend|gf|bf|wife|husband|dude)\\b',
  ].join('|'),
  'i',
);

/** Things only a chatbot says. A candidate with these loses to one without. */
const AI_TELLS =
  /(^(ah|well|oh|hey|wow|okay|ok)\b)|!|\b(looks like|seems like|it's okay|don't worry|remember|keep it up|great job|nice try|let's|balance|moderation|journey|fuel|treat yourself|indulg\w*|guilty pleasure|bold|brave|interesting choice|best life|self care)\b/i;

/** One clean line per candidate: no numbering, quotes, dashes, hyphens or
 *  capitals. */
export function parseCandidates(text: string): string[] {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .split('\n')
    .map((l) =>
      l
        .replace(/^\s*(\d+[.)]|[-*•])\s*/, '')
        .replace(/^["'“”]+|["'“”]+$/g, '')
        .replace(/\s*[–—]\s*/g, ', ')
        .replace(/[‐‑‒−-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase(),
    )
    .filter((l) => l.length >= 12 && l.length <= 190);
}

/** A bot tell, or reading numbers back like a bank statement. */
const soundsLikeABot = (c: string) =>
  AI_TELLS.test(c) || (c.match(/\d+/g) ?? []).length > 2 || c.length > 170;

/** Playground insults: they read as a child trying to be rude. */
const CHILDISH =
  /\b(menace|demon|goblin|gremlin|clown|dumbass|idiot|loser|stupid)\b/i;

/** Swearing belongs to a roast, never to praise, care or a welcome back. */
const SWEARING = /\b(shit\w*|damn\w*|hell|wtf|fuck\w*|crap|ass|bastard)\b/i;

/** Word runs of four, to spot a joke repeated from a recent line. */
const runs = (c: string) => {
  const w = c.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  const out = new Set<string>();
  for (let i = 0; i + 4 <= w.length; i++) out.add(w.slice(i, i + 4).join(' '));
  return out;
};

/**
 * A random safe candidate, preferring ones that sound like a person, aren't
 * childish and don't repeat a recent line. Null when every candidate crossed
 * the line, or swore where the tone doesn't allow it.
 */
export function pickRoast(
  candidates: string[],
  random: () => number = Math.random,
  opts: { tone?: Tone; recent?: string[] } = {},
): string | null {
  const gentle = opts.tone && opts.tone !== 'roast' && opts.tone !== 'tease';
  const safe = candidates.filter(
    (c) => !BANNED.test(c) && !(gentle && SWEARING.test(c)),
  );
  // A line copied from a recent one, or from an example, is not learning.
  const seen = new Set(
    [...(opts.recent ?? []), ...ROAST_EXAMPLES.map((e) => e.line)].flatMap(
      (l) => [...runs(l)],
    ),
  );
  const fresh = (c: string) => ![...runs(c)].some((r) => seen.has(r));
  const tiers = [
    safe.filter((c) => !soundsLikeABot(c) && !CHILDISH.test(c) && fresh(c)),
    safe.filter((c) => !soundsLikeABot(c) && fresh(c)),
    safe.filter((c) => !soundsLikeABot(c)),
    safe,
  ];
  const pool = tiers.find((t) => t.length) ?? [];
  return pool.length ? pool[Math.floor(random() * pool.length)] : null;
}
