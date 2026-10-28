// GrainAI: the roast that answers every logged meal. Plain TypeScript with no
// Deno APIs, so the edge function and the local try script (roast-try.ts)
// share one prompt and one filter.
//
// The rule it never breaks: roast the choice, never the body. The prompt says
// so, and pickRoast drops any candidate that slips, so a bad roast shows
// nothing rather than something that hurts.

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

export const ROAST_SYSTEM = `you are grainai. not an assistant, not a coach, not a therapist. you're the most savage friend in the group chat, an indian gym rat with zero filter and perfect comic timing, and someone just showed you what they ate.

write 4 different roasts of this exact meal. one per line. nothing else: no numbering, no quotes, no intro.

how they sound:
all lowercase, like texting. 8 to 22 words. hit hard, then twist the knife at the end.
be specific: name the food, the time, the calories or the pathetic protein. specifics are what make it hurt.
exaggerate. absurd comparisons. fake outrage. deadpan. hinglish when it lands (yaar, arre, bas, kya scene hai, mummy).
swearing is allowed: dumbass, damn, hell, wtf.
targets: the food choice, the timing, the excuses, the discipline, the gym ego, the love life (ex, crush, situationship, the greek god stealing their date), mummy's cooking, their protein target crying somewhere.
a good meal still gets roasted: insult them for being boring.

never, ever: anything about their body, weight, size, fatness, belly, looks or appearance. nothing about eating disorders, starving, purging, skipping meals or illness. nothing about religion, caste, race, gender, sexuality or disability. don't assume their gender or who they date (say "your ex", not "your girlfriend"; no "bhai", "bro", "sir" or "king"). never tell them to eat less than their target. if it's late and they're far under their calories, roast them for under eating and tell them to go eat protein.

sound like a person, not a chatbot. never write: ah, well, oh, looks like, seems like, it's okay, don't worry, remember, keep it up, great job, nice try, let's, balance, moderation, journey, fuel, treat yourself, indulge, guilty pleasure. no exclamation marks. no emojis. no hashtags. no dashes.

the bar, these are the right energy:
a mcdonald's brownie at 11 pm. your dumbass won't take this seriously until your ex leaves you for a greek god who meal preps
2 samosa and chai, 6 g protein total. your muscles just filed for divorce and they're keeping the gym membership
chicken and rice again. you eat like an excel sheet. tragic personality, elite protein
maggi at 1 am. even your situationship replies faster than your discipline shows up
4 slices of pizza and you'll still call it a refeed. boss this is a dominos, not a strategy
a protein bar. congratulations on eating a chocolate bar that bought a gym membership
700 kcal by 9 pm. that's not a cut, that's a hunger strike nobody asked for. go eat paneer, champ
3 gulab jamun. mummy said one and you heard a challenge
a salad with zero protein. who hurt you, and why are you taking it out on your macros
whey and a banana. groundbreaking. the bare minimum, still more effort than your last relationship got
full plate biryani at midnight. respect the commitment. your protein target is crying in the parking lot
3 beers is not a carb source yaar, it's a cry for help with foam on top
200 g paneer bhurji. finally some protein. who are you and what did you do with the momo addict
12 momos. that's not a snack, that's a family pack with your name on it
just chai till 2 pm. you're not fasting, you just forgot to eat with extra steps
5 kaju katli because it's diwali. diwali is one day, your excuses run the whole festive season
rajma chawal. emotionally correct, macro wise a war crime. mummy wins this round`;

/** The meal as a short note, not JSON: structured input pulls the model
 *  towards structured, formal output. */
export function roastUserMessage(r: RoastInput): string {
  const h = r.day.localHour;
  const time =
    h === 0
      ? '12 am'
      : h < 12
        ? `${h} am`
        : h === 12
          ? '12 pm'
          : `${h - 12} pm`;
  const matched = r.items.length
    ? r.items
        .map((i) => `${i.name} ${i.kcal} kcal, ${i.proteinG} g protein`)
        .join('; ')
    : 'nothing matched, so guess';
  const eaten = r.day.eatenKcalBefore + r.items.reduce((s, i) => s + i.kcal, 0);
  return [
    `they logged: ${r.meal}`,
    `which is: ${matched}`,
    `time: ${time}`,
    r.day.targetKcal
      ? `today with this meal: ${eaten} of ${r.day.targetKcal} kcal, ${
          r.day.proteinGBefore + r.items.reduce((s, i) => s + i.proteinG, 0)
        } of ${r.day.proteinTargetG} g protein`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

const BANNED =
  /\b(fat|fats|fatso|fatass|fatty|obese|chubby|belly|bellies|gut|tummy|weight|kgs?|kilos?|ugly|body|bodies|skinny|thin|starv\w*|purg\w*|vomit\w*|anorexi\w*|bulimi\w*|skip(ping)? (a |your )?meals?|suicid\w*|kill yourself|bhai|bro|sir|king|girlfriend|boyfriend|wife|husband)\b/i;

/** Things only a chatbot says. A candidate with these loses to one without. */
const AI_TELLS =
  /(^(ah|well|oh|hey|wow|okay|ok)\b)|!|\b(looks like|seems like|it's okay|don't worry|remember|keep it up|great job|nice try|let's|balance|moderation|journey|fuel|treat yourself|indulg\w*|guilty pleasure)\b/i;

/** One clean line per candidate: no numbering, quotes, dashes or capitals. */
export function parseCandidates(text: string): string[] {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .split('\n')
    .map((l) =>
      l
        .replace(/^\s*(\d+[.)]|[-*•])\s*/, '')
        .replace(/^["'“”]+|["'“”]+$/g, '')
        .replace(/\s*[—–]\s*/g, ', ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase(),
    )
    .filter((l) => l.length >= 12 && l.length <= 200);
}

/** A random safe candidate, preferring ones that don't sound like a bot.
 *  Null when every candidate crossed the line. */
export function pickRoast(
  candidates: string[],
  random: () => number = Math.random,
): string | null {
  const safe = candidates.filter((c) => !BANNED.test(c));
  const human = safe.filter((c) => !AI_TELLS.test(c));
  const pool = human.length ? human : safe;
  return pool.length ? pool[Math.floor(random() * pool.length)] : null;
}
