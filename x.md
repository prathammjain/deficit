# Grain: build log

Plain notes on what was decided and built in the app and the landing page, and
why. Newest at the bottom. Written to be turned into posts. Engine work has its
own log in the grain_engine repository.

---

## Earlier

### The bug that deleted meals

Meals disappeared and came back. The cause was the service worker: it cached
every request, including database reads. A stale read of today's log, plus a
fresh write, saved a day with the newest meals missing. They were not hidden,
they were deleted. Fix: the service worker never touches API traffic. Lesson:
offline caching and a read, modify, write data model do not mix.

### 7 grams became 50 grams

Half a tablespoon of sugar showed 27 kcal while composing and was saved as
193 kcal. Quantities had a hidden floor of half a serving, and for a per 100 g
food half a serving is 50 g. Fix: the engine's quantity is saved exactly,
weighed foods step in 5 g, countable ones in halves.

### The install button that never appeared

Chrome offers "install app" once, at page load. The button lived on a screen
opened much later, long after the offer was gone. Fix: catch the offer in a
tiny script in the page head and hand it to the button when it appears.

### Deficit became Grain

A name about precision rather than a diet word. The domain is getgrain.fit:
grain.fit was too expensive, and "get" was the shortest, most natural prefix.

### Describe, don't scan

A photo can't see the oil in the pan, the food underneath, or how many grams
are on the plate. Grain asks you to describe the meal instead, which is faster
for anyone who already knows what they ate.

### Who it's for

Athletes, lifters, models and fitness creators. They weigh their food, notice
when a number is wrong, and pay for tools that get it right. Everyone else is
welcome, but every decision is made for them.

### A landing page with no framework

One static page, its own Vercel project, deployed on every push. The phone demo
is built in HTML and CSS rather than a video: it stays sharp at any size, weighs
kilobytes, and shows the app working faster than the real UI does today.

## 2026-10-22

### Google sign in only

The email magic link is gone. One sign in path, nothing to deliver to an inbox,
nothing to land in spam.

### Privacy, said plainly

The sign in screen and Profile now say that meals are saved without your name to
make estimates better.

## 2026-10-23

### Glass cards, done properly

Three rounds to get the landing's look right. What worked: the page stays pure
white, and each card carries its own soft colour inside it, a different tone per
card. Faint glows on the page are measured, not eyeballed: a script checks at
five screen widths, 375 to 1920 pixels, that no glow sits behind a card or the
phone.

### X kept showing an old preview

After the share image changed, X kept showing the old one. A new image file
didn't fix it, removing the page's canonical address didn't, and neither did a
"?" link: X ignores query strings when it caches previews. A new path did.
getgrain.fit/go serves the same page, and X fetched a fresh card for it at once.

### The landing now shows the app working

Each section plays what the app does: typing a meal, matching each food,
"left to eat" counting down, a calendar stepping through past days, the target
learning your real maintenance, the icon landing on a home screen. A senior
engineer reviewed the page. Most of the advice was taken: equal cards, tighter
spacing, one signature section, a shorter ending. One part was not: naming the
food data sources on the page, until a licence is settled.

### Engine first for the next two weeks

With the landing done, the next one to two weeks go to the engine. The app gets
only bug fixes and what the engine needs. Accuracy is the promise on the landing
page, and a wrong number loses a user faster than a rough screen.

### The site can now be found

Until today getgrain.fit had no sitemap, no robots file and a page title nobody
searches for. Now: a title and description built around what people type
("calorie and macro tracker"), structured data that tells search engines Grain
is a free web app, a robots file and a sitemap. The headline still leads every
shared link. Next: verify the domain in Google Search Console so Google indexes
it.

## 2026-10-28

### Say the meal

"Describe a meal" now takes your voice. Tap the mic, say "do roti, ek katori
dal, 200 g chicken breast", tap again, and the words land in the box to check
before matching. The phone records in whatever format it likes (Chrome webm,
Safari mp4); the app turns it into 16 kHz mono WAV before sending, because
that is the one format every speech model reads, and speech models work at
16 kHz anyway. A minute of audio is about 2 MB.

The transcription is done by Gemini with a prompt that knows what a meal
sounds like: Hinglish kept as spoken, numbers as digits, katori and besan
spelled the usual way. Plain speech models (Whisper) tend to hear Hindi food
words as English ones. Whisper on the existing Groq key stays as the fallback
when no Gemini key is set. A note costs a few paise.

### A stronger model for the engine

The engine moves from gpt-oss-120b on Groq to Gemini 3.8 Flash, through
Google's OpenAI compatible endpoint, so nothing else in the pipeline changed.
Setting GEMINI_API_KEY is enough to switch; LLM_PROVIDER can still pick Groq
or OpenAI. Gemini 3 models are tuned for their default temperature, so the
engine no longer forces 0 for them. The cache key includes the model, so old
answers from the previous model are not reused.

Gemini Flash costs about $0.75 in and $3.75 out per million tokens, rising on
1 January 2027. Roughly a rupee per uncached meal now, two after the rise.
The proper bake off against
the practice set is still step 5 of the engine plan; this is the switch, not
the proof.

### Quieter screens

A pass to make every screen calmer and line up:

- No dashes or minus signs anywhere in the UI. "Daily deficit 550",
  "Predicted loss 0.42 kg", "Down 1.2 kg": the label carries the direction,
  so the number needs no sign in front. The engine's own reasons are cleaned
  of dashes too.
- Describe is now the default on the Log screen, with Search and Custom as
  plain text tabs beside it, instead of a search box plus two pills plus a
  panel.
- Each food is two lines: name and calories on top, details and controls
  below. The name no longer gets cut to "Chicken brea…" by the stepper.
- Text glyphs for search, close, plus and minus replaced by one set of line
  icons. Glyphs render differently per font and never sit on the baseline.
- Cards are flat with a hairline, no drop shadows. The active tab is ink, not
  an orange pill. Macros are one card with three columns, not three tiles
  that wrapped "140 g" onto two lines.
- Fixed: the welcome screen's Get started button sat off to the right of an
  empty Back slot; the disabled Next button had white text on a light grey
  button; the focus underline on inputs stopped short of their rounded edges;
  "kg" floated across the weigh in card away from its number.
- The engine status line only appears when the engine is offline. When it
  works, it needs no label.

### Groq only, for now

Same day, the engine went back to Groq: gpt-oss-120b for meals, as before,
and Whisper large v3 on Groq for voice. One key, one bill, nothing new to set
up, and Groq is fast and nearly free. Gemini is out of the code until the
practice set can show it is worth paying for.

Whisper is a general speech model, so it gets a sample of how meals are said
here ("do roti, ek katori dal, 1 tablespoon ghee") as its prompt. That steers
it to Roman script Hinglish and the usual spellings of Indian foods. Whisper
costs $0.111 per hour of audio and bills at least 10 seconds per note, so a
short note costs about 3 paise.

### A week worth sharing

History now opens with "Your week": a card with the week's deficit, days
logged, days the protein target was hit, average calories against target and
the weight change, and one button to share it. The image is drawn on a canvas
at 1080 by 1350, Instagram's portrait size, in the app's own look, with
getgrain.fit at the bottom. The preview in the app is the exact file that gets
shared, and the share sheet opens straight to Instagram or WhatsApp on a phone;
desktop browsers download it instead. This is the marketing loop for an
audience that already posts its progress.

### GrainAI, the roast

Describe now has a "Roast me" switch. Turned on, GrainAI answers every meal
with one brutal line: the choice, the timing, the excuses, the love life.
"A McDonald's brownie. Good job, your dumbass won't take things seriously
until your ex leaves you for a Greek god who meal preps." It's off until the
user turns it on, and the choice is remembered.

The one line it never crosses is the body. No weight, size, looks or fat
jokes, nothing about eating disorders, and it never tells anyone to eat less
than their target; late in the day and far under target, it roasts them for
under eating instead. Grain's users are exactly the people most at risk from
food and body shame, and a tracker that mocks people for logging the brownie
teaches them to stop logging it. The prompt says all this, and a word filter
on the server drops any line that slips through, so a bad roast shows nothing.

It runs on the same Groq model as the engine, after the numbers appear, so it
never slows a meal down. It also never assumes the user's gender or who they
date: "your ex", not "your girlfriend".

### GrainAI is the app, not a setting

The "Roast me" switch is gone: every described meal gets roasted. It is
Grain's personality now, not a feature to discover. The only way out is a
quiet Roasts switch on the Profile screen, for the few who need it.

First real use: the roasts read formal and polite, like an AI apologising.
Three causes, three fixes:

- The model. gpt-oss is tuned to be careful and sounds corporate when asked to
  be rude. Roasts now run on Qwen 3.8 on Groq, with gpt-oss only as a
  fallback. The engine itself stays on gpt-oss.
- The prompt. It now describes a person (the most savage friend in the group
  chat, texting in lowercase, Hinglish when it lands) instead of rules for a
  bot, lists the phrases that give an AI away ("ah", "keep it up",
  "moderation", exclamation marks) and shows seventeen roasts at the right
  pitch. The meal goes in as a short note instead of JSON, because JSON in
  pulls formal language out.
- One shot. It now writes four roasts and the server picks one, skipping any
  that cross the line or sound like a bot. Random among the good ones, so
  the same meal doesn't get the same joke twice.

The body rule is unchanged and enforced the same way. Words that assume a
gender ("bhai", "bro", "girlfriend") are filtered too.

supabase/functions/food/roast-try.ts runs the roast on a dozen sample meals
straight against Groq, so the prompt can be tuned on real output before it
ships.

## 2026-10-29

### The first real roasts

Ran the roast on twelve meals against both models. Qwen sounds like a person
("eat an egg, demon"); gpt-oss reads every number back like a bank statement
and tacks "yaar" on the end. Qwen stays.

What went wrong, and the fix for each:

- Looks slipped through ("your crush thinks you're hot", "you look like a gym
  bro", "your abs are waiting for a text"), plus a line about dying and one
  crude one. The filter now covers looks and body parts, death, gendered
  words and anything sexual. Run against all 64 lines from the test, it drops
  every one that crossed the line.
- Wrong numbers ("217 g protein deficit"). The models did their own maths.
  The facts now arrive already worked out (calories left, protein still
  needed) and the prompt allows at most one number.
- Qwen copied the examples word for word. Fewer examples now, and an
  explicit "never reuse these".
- Hidden hyphens from gpt-oss ("missing‑person"). Every kind of hyphen is
  now turned into a space.
- Lines stuffed with three or more numbers, or over 120 characters, lose to
  shorter ones.

No more fallback to gpt-oss when Qwen fails: Groq limits are per model, and
a roast must never use up capacity that meal matching needs.

### Groq's free tier is a ceiling

The test hit Groq's free tier limits within a minute: Qwen allows 1,000
output tokens a minute, gpt-oss 8,000 tokens a minute, for the whole
account. Meal matching runs on gpt-oss, so in production that is a handful
of meals a minute across every user. Before any marketing push, the Groq
account needs the paid Developer tier.

### Brutal, with one line it doesn't cross

A real log, "1 large double cheese pizza with choco brownie", got back "double
cheese pizza at noon is just bold and self harm". Two failures: it was polite
("bold" is what an AI says when it won't commit), and it joked about self
harm, which the filter didn't cover. It does now, along with depression,
trauma and therapy.

To make the roasts actually hurt:

- A verdict, worked out from the numbers before the model sees the meal:
  disaster (900 kcal or more, over the day's target, or a big meal with
  almost no protein), sloppy, clean, or under eating late in the day. A
  disaster gets told to go nuclear, "the kind they screenshot and send to the
  group chat". A clean meal gets mocked for being boring.
- The soft words are named and banned ("bold", "brave", "interesting choice",
  "living your best life", "self care"), and lines using them lose.
- Harder examples, swearing allowed (shit, clown, menace), and the targets
  widened to the wallet and personal life: "your date tonight is a double
  cheese pizza and it's still the most committed relationship you've had".

Asked for roasts about the user's belly and their sex life. Declined: the
roast goes as far as it likes on choices, discipline and love life, but
never the body and nothing sexual. For this audience body shame is the
product failing, not the joke landing.

## 2026-11-08

### Grain becomes an ecosystem for people who train

Grain grows from a calorie tracker into one place for everything a serious
lifter tracks: food, training with every exercise, set and weight, plans,
and the history they already keep in other apps and notes, all on one
timeline. The engine stays the moat and the north star; everything else is
a service around it.

Why not stay a single vertical: the space is crowded and scattered, and
this audience wants it all in one place. The bar for each piece is the best
single purpose app, and the reason to switch is what only one timeline can
show, like strength held through a cut.

Growth starts with athletes and creators, in India first, with features
built alongside them. One subscription for everyone, price not set yet.
Athletes Grain works with get premium as a gift.

### A back office

An admin screen inside the app, opened from Profile and visible only to
admins, with three parts.

Creators is a small CRM for outreach: stage, a follow up date, an outreach
log, and numbers per platform (followers, reach, weekly and total views,
engagement). Every update is kept, so growth shows over time instead of one
number. A creator can be linked to their Grain account and gifted premium
from the same page.

Users lists everyone with an account and how active they are, and gifts
premium by hand, with no end date or for 3, 6 or 12 months. A paywall switch
stays off until payments exist; off means everyone gets every feature.

Stats shows signups, people logging each day, activation, second week
retention, the engine's week and premium counts, refreshed every minute.

The database decides who sees what. Admin functions refuse anyone who isn't
an admin, the CRM and premium tables only open to admins, and nobody can
gift themselves premium. The screens show counts, never anyone's meals. 31
checks on those rules passed in a local Postgres before this shipped.

## 2026-11-09

### A real CRM for the laptop

The first back office worked on a phone and felt like one on a laptop, which
is where the admin work actually happens. On a screen 1024 pixels or wider,
the admin is now a full workspace with a sidebar, built for deciding fast.

A strip on top answers what needs you today: follow ups due, overdue, people
who replied with nothing planned, reply rate, the roster and its total reach.
Each one filters the table when clicked. Saved views sort everyone into needs
action, all, roster, prospects and declined.

The table is dense and sorted by who needs you first: the most overdue at
the top, then due today, then replies waiting on you. Stage and follow up
change right in the row. Select several rows to move them or schedule them
at once, or export them to a spreadsheet for a pitch. Clicking a creator
opens them beside the table with their timeline, numbers with a growth line,
Grain account and details, and logging a touch is one Enter away. The
pipeline board shows each stage as a column, and dragging a card moves the
person along.

The keyboard drives all of it: J and K to move, Enter to open, 1 to 7 to set
the stage, T and W to follow up tomorrow or in a week, N for someone new, X
to select, slash to search. Every view shares one copy of the data, so
switching is instant, and changes show at once and save behind the scenes.
On a phone the stacked screens stay as they were.

### Training joins the food log

Grain now logs training as precisely as it logs food, the first piece of the
wider ecosystem. A Train tab sits between Log and History. The calorie engine
stays the core; training is the service around it.

The logger is built for one tap sets. Start empty, repeat the last workout,
or run a saved routine. Each exercise is a card of sets: set, previous, kg,
reps, tick. Last time's numbers already sit in the empty boxes, so a set done
the same as last time is one tap on the tick, and only what changed gets
typed. Tapping a previous set copies it in. A set's number opens its type
(warmup, drop, failure) and an optional RPE. Records show the moment a set is
ticked, judged on estimated one rep max. Bodyweight lifts count bodyweight
plus added load, so 10 pull ups compare fairly with 6 carrying 10 kg. Every
tick starts a rest timer whose length is remembered per exercise; the screen
stays on while it counts down and the phone buzzes when it ends. Finishing
names the session from what was trained (Push, Pull, Legs, Upper body, Full
body) unless it was named, offers to tick sets that have numbers but no tick,
lists the records, and can save the layout as a routine.

Gyms are basements, so no set depends on the network. Every change lands on
the phone first and reaches the account a moment later. A workout finished
offline waits on the phone and syncs when the signal is back. History is
cached on the phone after each load, so last time's numbers are there with
no signal at all. These phone copies are kept per account, so two people
signing in on one phone never see or sync each other's training.

Describe a workout takes it typed or spoken, for today or any day before:
"bench 80x8, 80x8, 85x6", "squat 100kg 5x5", "ohp 50 for 8 8 7", "lat
pulldown 3 sets of 12 at 60", "pull ups bw x 10, +10 x 6". Pounds become
kilograms and spoken numbers like "a hundred kilos" work. It is plain code on
the phone, not a model: instant, free, and the same words always read the
same way. Whatever it can't place, it asks about instead of guessing. It is
also how old training notes get in.

Progress shows a week or a month against the one before. A week still running
is compared with the same days last week, so a Monday isn't judged against a
whole week. It shows volume and hard sets, food averages against targets,
bodyweight change, hard sets per muscle against a 10 sets a week mark, and
each lift's best estimated max with its change. One line on top joins the
three, for example "Lifts up 3.0% while bodyweight fell 0.6 kg." Only an app
holding food, training and the scale together can write that line. Each
exercise has its own page: estimated max over time, records, the heaviest
weight for each rep count, and every session.

The library has 104 exercises and reads gym shorthand (rdl, ohp, db bench,
bss), ignores plurals and spacing, and forgives typos. Anything missing is a
custom exercise in two taps. 79 new tests cover the reader, the set math,
records, storage and the progress numbers; 270 pass in total.

### Missed days count as nothing, not as a deficit

History used to add up the deficit over every day with anything logged. Two
things made that number lie. A day where only breakfast was logged read as a
2,000 kcal deficit. And days nobody logged simply vanished from the total, so
a fortnight off looked like a fortnight of discipline. A person can't lie to
themselves, so a flattering number that isn't true is worse than no number.

Now only full days count. A day with nothing logged is unknown: it adds
nothing as deficit or as surplus, and nothing is ever guessed to fill it. A
day logged at under half the calorie target reads as unfinished and stays out
until it's finished, or until the user confirms it really was everything
(a fast, a sick day) from the calendar. Today is still open, so it never
counts against a streak in the morning. The History hero says what it covers:
"across the 18 full days you logged", "18 of 30 full days logged".

Three days in a row without a full day is a break. While one is running,
History says so plainly: last full day, how many days since, and that the
numbers start again from the next full day. Coming back, History leads for
two weeks with a fresh start: the break is named with its dates, and the
numbers count from the return, with 30 days, 90 days and Year still a tap
away. No cheering and no guilt, just what happened.

The same rule now runs everywhere food is summed: the weekly share card
("Full days logged"), the weekly prediction on Home, food averages in Train
progress, and the summary a coach sees. The adaptive maintenance estimate
also waits when fewer than 70% of the days between weigh ins were logged: the
scale keeps counting through a holiday, the intake average doesn't, and the
gap would pass for a slow metabolism and push the target down.

The weekly share card hides when the last seven days have no full day; the
away card now says why instead of leaving a blank.

### Consent, an 18 and over check, and owning your data

Before anything else, a new account confirms three things, each its own tap
with nothing pre ticked: 18 or older, the terms and privacy policy, and
health data being used for targets. Each agreement is a row that can't be
edited, with a version, so a material change to the terms asks everyone
again. Onboarding also refuses ages under 18. Profile gains Download my data
(every stored row as one JSON file) and Delete my account, which removes the
account and everything tied to it in one step. The landing site gains a
privacy policy and terms.

### Bring your training history

Import reads a Strong export, a Hevy export, any training spreadsheet saved
as CSV, or pasted notes ("Mon 3 Nov: bench 80x8, 85x6"). Exercise names are
matched to the library (Strong's "Incline Bench Press (Dumbbell)" becomes
Incline dumbbell press); anything unknown is listed first with a muscle
guessed, to keep, rename or leave out. Rest timers and timed or distance rows
are left out and counted. Importing the same file twice updates instead of
doubling. No model involved: it runs on the phone.

### Programs, meal plans and coaches

Anyone can write a program: named days with sets and rep ranges, how many
weeks it runs, and optionally a meal plan with daily calories, protein and
meals. Publishing gives a six character code and a link. Following one puts
today's day on top of Train with one tap to start it; the logger shows each
exercise's rep target. The next day is always the one after the last one
done, so a missed session shifts the plan instead of being skipped. Plan
meals sit on Today and log in one tap. One program at a time: following a
new one replaces the old.

A follower can choose to share a summary with the author: program workouts
done against the plan over the last four weeks, days with full food logs,
average calories and protein, weight change. Never meals, sets or notes.
Sharing is off until ticked, can be turned off any time, and turning it off
deletes the summary the coach could see. The database enforces all of it:
follows can only be changed through functions that check who is asking, and
a coach can only read followers who share.

### Nothing typed gets lost

A meal that fails to save (no signal) now stays on screen with Try again
instead of vanishing. Onboarding and weigh ins show an error and keep what
was typed. A crashing screen shows a way back instead of a blank page.
327 tests pass.

## 2026-11-10

### Agreeing never waits on the network

The consent screen went live before its database table existed, so saving
the agreement failed and every new sign in was stuck on a "check your
connection" message. The fix on the server is running the new SQL. The fix
in the app is that agreeing can't block anyone again: the person has agreed
the moment they tick the boxes, so the app opens. If the account can't store
the row right then (no signal, or the table not set up yet), the agreement
waits on the phone and is sent on a later launch. 333 tests pass.

### The landing page phone works

The phone on the landing page used to play a recording. Now it's a small
working Grain. Type any meal and it matches each food, shows calories and
protein, and logs it to a day that updates as you go. Open Train and tick
sets with last time's numbers already in: the rest timer starts itself and
beating last time shows a record. Open History and switch between a steady
month and one with a break to see how missed days count as nothing. It
runs entirely in the page with no account and nothing sent anywhere. Its
food list is about 60 common foods: measured values from USDA FoodData
Central, Indian dishes as the app's home recipe estimates (shown as
estimates), and anything else is named as not in the demo instead of
guessed. Before anyone touches it, it types a meal once by itself, so it's
obvious the phone is live; any touch hands it over.

The page also has three new sections: training (one tap sets, describe a
workout, progress joined with food and the scale, history import),
programs and coaches (follow with a code, meal plans that log in a tap, the
coach's view, writing a program), and numbers that don't flatter you, with
a card that switches between a steady month, a half logged day and a
break. On phones the training and program cards sit side by side and move
on by themselves, one at a time, pausing when touched; on wider screens
they're a grid. Copy elsewhere now says full days, not days logged.

### Training on Home

Home has a Training card under This week: the week's workouts as dots,
how many, hard sets and kilograms moved, and the next program day when
following one. One tap opens Train.

### Landing page: canonical addresses for search

The home, privacy and terms pages name their canonical address, and the
sitemap date moved, ahead of adding getgrain.fit to Google Search Console.

## 2026-11-11

### The hero phone gives a guided tour

The working phone now tours itself in nine steps: the day's ring, typing a
meal, the matches with their tags, logging it, last session's numbers in
Train, a record and the rest timer, the deficit that counts full days only,
and a break that starts clean. A touch dot taps through each step and the
part it's about is outlined. A card under the phone has the step's title
and one line on it, a progress bar you can jump along, Back, Next and
Pause. A tap or a key inside the phone hands control to the visitor; the
last step resets the phone for them. It pauses while off screen, and with
reduced motion it doesn't play by itself. On laptops the phone shrinks a
little on shorter screens so the phone and the card fit in the first view.

### Home leads with the hooks, History with the calendars, and a professional pass

Feedback from a senior product manager, all four points taken.

* The landing page button is one dark pill with its arrow set inside,
  instead of a pill and a separate circle. On hover the arrow turns orange.
* Home is now Overview and opens on the three cards that bring people
  back: the fresh start (or the away card while a break runs), Your week as
  a native card with Share in its header, and Total deficit maintained over
  the same range History uses. The plan, forecast, training, macros, weigh
  in and adaptive target follow.
* History opens on two calendars: Food, as before, and a new Training
  calendar. Days with a workout are filled, a dot marks a record, the month
  shows workouts, hard sets and volume, and the chosen day lists its
  workouts, each opening in full. Trends, the range and the charts follow.
  The share image left History, since Your week on Home shares it.
* Professional pass, same palette and layout: section headings are sentence
  case with an action on the right instead of small uppercase labels over
  every card; long explanations cut to a line or two; app copy no longer
  says "I"; charts carry a light scale and their first and last dates;
  stat labels no longer wrap; figures are tabular so columns line up;
  cards have a shadow too soft to notice.

## 2026-11-12

### The whole product, explained in one document

notes.pdf, at the repository root, with its source in docs/notes.html, walks
through everything: how the app, Vercel, Supabase and the engine fit
together; the key/value storage idea and why sign in only swaps what is
behind it; every table and policy in the schema; the engine stage by stage
(split, look up, judge, calculate in code, flag), with the confidence rule,
the cache, degraded runs and the run log; the three food tables and their
licences; voice and the roast; the maths for targets, budget, adaptive
maintenance and the forecast; full days, breaks and fresh starts; training,
the workout reader, progress and programs; consent and the back office;
hosting; and what the free tiers can carry today. The binding limit is
Groq's free tier at about 66 uncached meals a day, so roughly 15 to 20
daily users; Supabase storage is next, through engine traces; Vercel Hobby
is non-commercial and must move to Pro when the paywall turns on. Written
in plain words with analogies and diagrams, for the owner.

### Faster everywhere, measured

A pass to make Grain faster without changing a single number it shows. Every
change was checked against the old code: the same seeded data rendered the
same text on all eight screens in a real browser, the engine gave identical
answers on the same meals, and the database allowed and refused exactly the
same things.

* Reading many days is one request, not one per day. The Overview used to
  make about 70 database requests on every visit (each of 45 days, then 21
  of them again); it now makes about 7. A month on the History calendar went
  from 30 requests to 1, a year of History from 365 to 4. Screens that ask
  for the same thing at the same moment share one request.
* The Overview and History start every read at once instead of the profile
  first, and sign in no longer waits on a network check at each launch.
* The app downloads a fifth less: 430 KB instead of 545 KB compressed, and
  1.99 MB of JavaScript to run instead of 2.75 MB. A quarter of it was the
  animation library, pulled in by a leftover template icon nothing showed.
* Build files are cached by browsers for a year (their names change with
  every deploy), and the page opens its connections to the font hosts and
  the account while the app downloads.
* The database's privacy rules now work out who is asking once per query,
  not once per row. On a 60,000 row table a read that leans on them went
  from 0.75 ms to 0.055 ms. Run supabase/schema.sql again to apply it.
* Tests run in 2 seconds instead of 14: they no longer type check, since
  npm run typecheck does that.

Tried and left out: splitting the app per screen would save another 67 KB,
but on Expo SDK 56 it leaves every screen blank (Expo calls it stable from
SDK 58). Expo's experimental tree shaking saved only 10 KB, not worth an
experimental flag on a live app.
