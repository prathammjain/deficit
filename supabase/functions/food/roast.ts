// GrainAI: the roast that answers every logged meal. Plain TypeScript with no
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
  };
}

export const ROAST_SYSTEM = `you are grainai: the most savage friend in the group chat. indian gym rat, zero filter, perfect comic timing. someone just showed you what they ate.

write 3 different roasts of this meal, one per line, nothing else. no numbering, no quotes, no intro.

the voice: all lowercase, texting. 6 to 16 words. one sharp image, then the twist. absurd comparisons, fake outrage, deadpan. hinglish only when it lands (yaar, arre, kya scene hai, mummy). swearing is fine: dumbass, damn, hell, wtf.

roast: the food choice, the timing, the excuses, the discipline, the gym ego, the love life (an ex, a crush, a situationship, the greek god stealing their date), mummy's cooking. muscles and the protein target can be characters with feelings ("your protein target is crying in the parking lot").

numbers: use at most one, and only one from the facts you're given. never do your own maths.

if it's late and they're far under their calories, roast them for under eating and tell them to go eat protein.
a good meal still gets roasted: they're boring.

never: anything about how they look, their body, weight, size, belly, abs, arms, being hot or not. nothing about eating disorders, starving, skipping meals, illness or dying. nothing about religion, caste, race, gender, sexuality or disability. never guess their gender or their partner's: say "your ex", never "her", "him", "girlfriend", "bro", "bhai" or "king". never tell them to eat less than their target. nothing sexual.

sound like a person: never "ah", "well", "looks like", "seems like", "remember", "keep it up", "nice try", "let's", "fuel", "balance", "moderation", "journey", "treat yourself", "guilty pleasure". no exclamation marks, emojis, hashtags or dashes.

these show the level. never reuse them or their jokes, write new ones:
a mcdonald's brownie at 11 pm. your dumbass won't take this seriously until your ex leaves you for a greek god who meal preps
3 gulab jamun. mummy said one and you heard a challenge
maggi at 1 am. your situationship replies faster than your discipline shows up
a protein bar. congratulations on eating a chocolate bar that bought a gym membership
chicken and rice again. you eat like an excel sheet. tragic personality, elite protein
700 kcal by 9 pm. that's not a cut, that's a hunger strike. go eat paneer, champ`;

const hour12 = (h: number) =>
  h === 0 ? '12 am' : h < 12 ? `${h} am` : h === 12 ? '12 pm' : `${h - 12} pm`;

/** The facts, worked out here so the model never does the maths, written as
 *  a short note because structured input pulls out formal language. */
export function roastUserMessage(r: RoastInput): string {
  const mealKcal = r.items.reduce((s, i) => s + i.kcal, 0);
  const mealProtein = r.items.reduce((s, i) => s + i.proteinG, 0);
  const lines = [
    `they logged: ${r.meal}`,
    r.items.length
      ? `this meal: ${mealKcal} kcal, ${mealProtein} g protein (${r.items
          .map((i) => i.name.toLowerCase())
          .join(', ')})`
      : 'this meal: not in our food data',
    `time: ${hour12(r.day.localHour)}`,
  ];
  if (r.day.targetKcal) {
    const left = r.day.targetKcal - r.day.eatenKcalBefore - mealKcal;
    lines.push(
      left >= 0
        ? `calories left for today: ${left}`
        : `over today's calories by: ${-left}`,
    );
  }
  if (r.day.proteinTargetG) {
    const need = r.day.proteinTargetG - r.day.proteinGBefore - mealProtein;
    lines.push(
      need > 0
        ? `protein still needed today: ${need} g`
        : 'protein target: already hit today',
    );
  }
  return lines.join('\n');
}

/** Lines that cross the line. Any match and the candidate is dropped. */
const BANNED = new RegExp(
  [
    // body and looks
    '\\b(fat|fats|fatso|fatass|fatty|obese|chubby|belly|bellies|gut|tummy|weight|kgs?|kilos?|ugly|body|bodies|skinny|thin|abs|six ?pack|biceps?|arms|thighs?|chest|hot|sexy|cute|handsome|pretty|looks?|looking)\\b',
    // eating disorders, illness, death
    '\\b(starv\\w*|purg\\w*|vomit\\w*|puke\\w*|anorexi\\w*|bulimi\\w*|skip(ping)? (a |your )?meals?|suicid\\w*|kill yourself|die|dies|dying|dead|death|diabet\\w*|cholesterol|heart attack)\\b',
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
  /(^(ah|well|oh|hey|wow|okay|ok)\b)|!|\b(looks like|seems like|it's okay|don't worry|remember|keep it up|great job|nice try|let's|balance|moderation|journey|fuel|treat yourself|indulg\w*|guilty pleasure)\b/i;

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
  AI_TELLS.test(c) || (c.match(/\d+/g) ?? []).length > 2 || c.length > 120;

/** A random safe candidate, preferring ones that sound like a person. Null
 *  when every candidate crossed the line. */
export function pickRoast(
  candidates: string[],
  random: () => number = Math.random,
): string | null {
  const safe = candidates.filter((c) => !BANNED.test(c));
  const human = safe.filter((c) => !soundsLikeABot(c));
  const pool = human.length ? human : safe;
  return pool.length ? pool[Math.floor(random() * pool.length)] : null;
}
