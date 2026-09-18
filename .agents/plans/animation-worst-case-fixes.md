# Animation worst-case fixes

Findings from a worst-case pass over the entrance animations (2026-09-16), and
the plan to fix them. Written to be executed by an agent: each task names the
file, the cause, the change, and how to verify it.

Test environment: Chrome, dev server on `localhost`, viewport 1280x665, fresh
load at `scrollY: 0` with `document.fonts.status === "loaded"`.

**Two caveats on the evidence below.** A window resize to 390px wide did not
take effect (the window stayed 1280 wide), so narrow-viewport behaviour is
*not* verified — see task 6. And the tab was backgrounded for part of the run,
which pauses `requestAnimationFrame` and therefore framer-motion's frame loop;
every conclusion below rests on static measurements (computed transforms,
offsets) that do not depend on animation timing.

---

## 1. Right-column cards tilt the wrong way — HIGH — ✅ FIXED

**File:** `frontend/src/components/ProjectsGrid.tsx`

Fixed by the lazy `useState` initializer described below. Re-measured on a
fresh load at 1280px with the cards out of view: the six cards now alternate
`-6deg` with a top-right origin and `+6deg` with a top-left origin, so both
columns start with their *outer* edge low. The optional remount-on-breakpoint
key was not applied — see the note at the end of the fix.

**Symptom.** On every load at `lg` and wider, the right-hand card of each row
starts with its outer edge *high* and swings it *down* — the opposite of the
intended motion, and a mirror of what the left card does.

**Evidence.** Fresh load, 1280px, cards out of view:

| card | `transformOrigin` | rotation | expected rotation |
|---|---|---|---|
| left column (`left: 104`) | `564px 0px` (top-right) | `-6deg` | `-6deg` ✅ |
| right column (`left: 660`) | `0px 0px` (top-left) | `-6deg` | `+6deg` ❌ |

**Cause.** `useTwoColumns` returns `false` on the first render. framer-motion
commits `initial` once, at mount, so the card's rotation is fixed at the
left-column sign. The layout effect then flips the state to `true`:
`style={{ transformOrigin: pivot }}` is a plain style prop and updates live,
but `initial` is never re-applied while the element is out of view. The card is
left with a right-column pivot and a left-column tilt.

**Fix.** Resolve the breakpoint during the first render so `initial` is correct
from the start, using a lazy `useState` initializer:

```ts
const [twoColumns, setTwoColumns] = useState(
  () => typeof window !== 'undefined' && window.matchMedia(TWO_COLUMN_QUERY).matches
);
```

Keep the existing effect for later changes. Note this fixes load, not a resize
across the 1024px boundary while the cards are out of view — that still leaves a
stale `initial`. If that matters, additionally key the wrapper on the
breakpoint (`key={`${project.title}-${twoColumns}`}`) so it remounts with a
fresh `initial`; the trade-off is a remount mid-animation if the user drags the
window across the boundary.

**Verify.** Load at ≥1024px with the grid below the fold, then in the console:

```js
[...document.querySelectorAll('.will-change-transform')]
  .filter(el => el.querySelector('h3'))
  .map(el => {
    const cs = getComputedStyle(el);
    const m = new DOMMatrixReadOnly(cs.transform);
    return { origin: cs.transformOrigin, rot: +(Math.atan2(m.b, m.a) * 180 / Math.PI).toFixed(1) };
  });
```

Expect alternating `-6` / `+6`, with `+6` paired with the `0px 0px` origin.

---

## 2. Headline split is missing on "refresh, then scroll straight down" — HIGH

**File:** `frontend/src/components/IdentitySectionAlt.tsx`

**Symptom.** Refresh and scroll to the identity section within about 1.3
seconds and the two headline lines barely split, or do not split at all. If the
section happens to be on screen during that window, the lines first slide
*outwards* to the centre — a visible backwards move — before the real animation.

**Evidence.** 1350ms after a fresh load, with the section still out of view:

- live `x` of all four headline words: `0, 0, 0, 0`
- measured start offsets they should be sitting at: `-65` (top), `+225` (bottom)

**Cause.** `useCentredStart` can only measure after mount, so the first render
puts the words at `x: 0` — which is their *settled* position. The measured
offset then arrives through the `animate` prop, and that animation uses the
same `transition` as the slide, including `delay: SLIDE_START (+ WORD_STAGGER)`
— roughly 0.73s to 0.85s of delay plus 0.6s of travel. For the first ~1.3s
after mount the lines are in the wrong pre-state, and `useInView` firing during
that window cancels the move to the start offset and sends them back to 0.

**Fix.** Position instantly when out of view; animate only on the way in.

```tsx
transition={
  isInView
    ? { duration: SLIDE_DURATION, delay: SLIDE_START + WORD_STAGGER, ease: SLIDE_EASE }
    : { duration: 0 }
}
```

Apply to all four word spans, each keeping its own delay. The rise (`y`) does
not need this: 80 is a constant, so it is correct from the first render.

**Verify.** Reload, wait 200ms, and with the section still out of view read the
word transforms — they must already equal the measured offsets, not 0:

```js
const h2 = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Designing'));
[...h2.querySelectorAll('span')].map(s =>
  Math.round(new DOMMatrixReadOnly(getComputedStyle(s).transform).m41));
```

Then reload and scroll down immediately: both lines must still rise centred and
split outwards.

---

## 3. Resize before the section is seen strands the headline — MEDIUM

**File:** `frontend/src/components/IdentitySectionAlt.tsx`

Same root cause as task 2, different trigger: the `ResizeObserver` re-measure
also travels to the new offset through the delayed tween, so for over a second
after any resize the lines sit at a stale offset. Observed directly — after a
window resize the words read `x: 0` while the correct offset was `-65.5`.

Fixed by the same change as task 2. No separate work; verify by resizing the
window with the section out of view, then scrolling to it.

---

## 4. No `prefers-reduced-motion` support on the entrance animations — MEDIUM

**Files:** `frontend/src/components/ProjectsGrid.tsx`,
`frontend/src/components/IdentitySectionAlt.tsx`

Only `LiquidEtherOverlay.tsx`, `TrailOverlay.tsx` and `ui/chromatic-image.tsx`
check the setting. Cards still scale and tilt, headlines still rise and slide,
for users who asked the OS for reduced motion.

**Fix.** Use framer-motion's `useReducedMotion()`. When it returns true, drop
the transforms and keep a short opacity fade — the content must still appear,
so do not simply disable the animation and leave elements at `opacity: 0`.

**Verify.** DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce",
reload, scroll through: content appears with no movement and nothing stays
invisible.

---

## 5. `liquid-mouse.html` leaks GPU memory on resize — MEDIUM

**File:** `frontend/public/liquid-mouse.html`, `resize()`

`resize()` calls `createFBO` twice and overwrites `simA` / `simB` without
deleting the previous pair. A window drag fires `resize` continuously, so a few
seconds of dragging leaks dozens of full-viewport RGBA16F textures and their
framebuffers. The background texture is fine — it is reused and re-uploaded.

**Fix.** Delete before reallocating, and debounce:

```js
function destroyFBO(t) { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); } }
```

Call it on `simA`/`simB` at the top of `resize()`, and wrap the `resize`
listener in a ~150ms debounce so a drag reallocates once, not per frame.

**Verify.** Drag the window edge for ~10s, then check that
`performance.memory`/the Chrome task manager GPU memory column settles instead
of climbing, and that the fluid still reacts after the drag.

---

## 6. Narrow viewport — UNVERIFIED, must be tested

The attempted resize to 390px did not apply, so nothing below the `md`
breakpoint was actually observed. Two things to check by hand on a real narrow
viewport (or DevTools device toolbar):

- **Headline.** `useCentredStart` returns 0 when the line is wider than its row
  (`slack <= 0`), which is what happens once the headline wraps. Both lines then
  rise with no split at all. Confirm that reads as intentional rather than
  broken, and decide whether the split should be skipped or the rows should
  allow it.
- **Card tilt.** 6° of tilt adds roughly 17px to a card's outer edge at phone
  width against a 24px `page-gutter`. The margin is thin. Confirm
  `document.documentElement.scrollWidth - clientWidth === 0` at 360px, 390px and
  414px. At 1280px it measured 0. ✅

---

## 7. Lower priority / accepted behaviour

- **Cards replay on every pass** (`viewport={{ once: false, amount: 'some' }}`)
  — this is what was asked for. Side effect: a card sitting half-visible at the
  screen edge replays whenever the user nudges the scroll. If that reads as
  twitchy, raise to `amount: 0.15`.
- **The headline animates once** (`once: true`). Scroll past it fast and the
  animation burns off-screen; coming back, it is already settled. Consider
  matching the cards with `once: false` for consistency.
- **Lenis overrides `window.scrollTo`** — a programmatic scroll during testing
  reported `scrollY: 0` and did not move the page. Relevant to anchor links,
  skip links and any future scroll-driven test harness; use the Lenis instance
  instead.

---

## Suggested order

1. Task 1 and task 2 — both are visible on an ordinary page load.
2. Task 5 — self-contained, no effect on the app.
3. Task 6 — testing; it may add work.
4. Task 4 — accessibility.
5. Task 7 — only if the behaviour is judged wrong.

After tasks 1–2, re-run both verification snippets and watch one full
scroll-through at `lg` and one at phone width before calling it done.
