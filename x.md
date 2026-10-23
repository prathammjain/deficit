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
