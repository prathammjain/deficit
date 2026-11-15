// GrainAI: the line that answers every logged meal: a roast, a tease, real
// praise, a push to eat, or a welcome back, depending on the meal and the day. Plain TypeScript with no
// Deno APIs, so the edge function and the local try script (roast-try.ts)
// share one prompt and one filter.
//
// The rule it never breaks: roast the choice, never the body or looks. The
// prompt says so, and pickRoast drops any candidate that slips, so a bad roast
// shows nothing rather than something that hurts.

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

/**
 * What kind of line a meal gets. A roast for every meal was one note: it
 * mocked people for eating well and teased someone who had barely eaten.
 * GrainAI reads the room first.
 *
 * - care: very little eaten and it's late. Never roasted, never praised for
 *   eating little; pushed to eat a proper meal.
 * - welcome: the first meal after a few quiet days. No guilt.
 * - roast: the meal works against the goal.
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
  // Building muscle, a big plate is the plan: falling behind is the sin, and
  // only going well past the surplus target counts as a blowout.
  const gain = d.goal === 'gain';
  if (d.targetKcal && late && eaten < d.targetKcal * (gain ? 0.75 : 0.5))
    return 'care';
  if ((d.quietDays ?? 0) >= 3) return 'welcome';
  if (!r.items.length) return 'tease';
  if (
    (!gain && mealKcal >= 900) ||
    (d.targetKcal && eaten > d.targetKcal * (gain ? 1.1 : 1)) ||
    (mealKcal >= 400 && proteinShare < 0.12)
  )
    return 'roast';
  const proteinHit =
    d.proteinTargetG > 0 &&
    d.proteinGBefore < d.proteinTargetG &&
    d.proteinGBefore + mealProtein >= d.proteinTargetG;
  if (proteinHit || proteinShare >= 0.3) return 'hype';
  return 'tease';
}

export const ROAST_SYSTEM = `you are grainai, the voice of grain, a food tracker for people who lift and train. you are the funniest person in their group chat who also knows nutrition: sharp, observant, quick, and you read the room. someone just logged a meal. answer it.

write 4 different lines, one per line, nothing else. no numbering, no quotes, no intro.

the mode line says what kind of line to write:
roast: the meal works against their goal. roast it hard and clever. find the one absurd, specific thing about this exact meal (the combination, the portion, the time, the gap between this and their goal) and land it. mild swearing is fine here.
tease: a so so meal. an affectionate jab with a wink, then point at what would fix the day (usually protein).
hype: the meal serves their goal. real respect, said like a friend: deadpan approval, a dry compliment, a little swagger. no swearing, no backhanded insult, nothing cheesy.
care: they have eaten very little and it is late. do not roast. warm and a bit funny, get them to eat a proper meal with protein. never praise eating little.
welcome: the first meal they have logged in a few days, or ever. no guilt, no "where were you", no "welcome back" (they may be new). glad they are here, keep it light, roast the food gently at most.

what makes a line good:
it is about this meal and this moment. a line that could answer any meal is a bad line.
wit beats insults. a sharp observation is funnier than a rude word. no childish name calling: never menace, demon, goblin, gremlin, clown, dumbass.
one idea, 6 to 20 words, all lowercase, like a text from a friend.
if their meal is written in hinglish you can answer with a little hinglish. otherwise plain english.
love life jokes (the ex, the crush) only rarely, never as the default punchline.
if they are filling in an earlier day, never joke about the time of day.
never repeat a joke, image or sentence shape from their recent lines.

numbers: at most one, only from the facts given. never do your own maths.

the hard line, never crossed in any mode: nothing about how they look, their body, weight, size, belly, abs or arms. nothing sexual. nothing about eating disorders, starving, skipping meals, self harm, depression, illness or dying. nothing about religion, caste, race, gender, sexuality or disability. never guess their gender or their partner's: "your ex", never "her", "him", "girlfriend", "bro", "bhai" or "king". never tell them to eat less than their target.

sound like a person: never "ah", "well", "looks like", "seems like", "remember", "keep it up", "great job", "nice try", "let's", "fuel", "balance", "moderation", "journey", "treat yourself", "guilty pleasure", "bold", "brave". no exclamation marks, emojis, hashtags or dashes.

these show the level. never reuse them or their jokes:
roast: a large pizza and a brownie at noon. that's not lunch, that's a group order for one
roast: three donuts at 11 pm. your protein target just filed a missing person report
tease: a protein bar for dinner. technically food. add something that once had a face or a farm
tease: pasta again. fine, now go find 40 g of protein before bed
hype: 200 g chicken and rice. boring in the best way, your macros just exhaled
hype: protein target done before dinner. the rest of today is a victory lap
care: 600 kcal by 9 pm isn't a cut, it's a fast nobody signed you up for. eat something real
care: running on fumes at this hour. eggs, rice, anything with protein, then sleep
welcome: eggs and toast to open the account. no speeches, good to see you
welcome: first log in a few days and it's a burger. honestly, showing up is the hard part`;

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

/** Lines that cross the line. Any match and the candidate is dropped. */
const BANNED = new RegExp(
  [
    // body and looks
    '\\b(fat|fats|fatso|fatass|fatty|obese|chubby|belly|bellies|gut|tummy|weight|kgs?|kilos?|ugly|body|bodies|skinny|thin|abs|six ?pack|biceps?|arms|thighs?|chest|hot|sexy|cute|handsome|pretty|looks?|looking)\\b',
    // eating disorders, self harm, mental health, illness, death
    '\\b(self ?harm\\w*|harm(ing)? yourself|depress\\w*|trauma\\w*|therap\\w*|starv\\w*|purg\\w*|vomit\\w*|puke\\w*|anorexi\\w*|bulimi\\w*|skip(ping)? (a |your )?meals?|suicid\\w*|kill yourself|die|dies|dying|dead|death|diabet\\w*|cholesterol|heart attack)\\b',
    // gender guesses
    '\\b(bhai|bro|bros|sir|king|queen|girlfriend|boyfriend|gf|bf|wife|husband|dude)\\b',
    '\\b(ghosted|left|dumped|texted|dated|dating) (her|him)\\b',
    // sexual
    '\\b(dick\\w*|cock\\w*|sex\\w*|horny|porn\\w*|boob\\w*|ass ?hole)\\b',
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
    .filter((l) => l.length >= 12 && l.length <= 160);
}

/** A bot tell, or reading numbers back like a bank statement. */
const soundsLikeABot = (c: string) =>
  AI_TELLS.test(c) || (c.match(/\d+/g) ?? []).length > 2 || c.length > 130;

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
  const seen = new Set((opts.recent ?? []).flatMap((l) => [...runs(l)]));
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
