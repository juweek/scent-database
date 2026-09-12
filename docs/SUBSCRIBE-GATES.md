# Email subscribe gates — strategy, rules, and implementation

A portable description of the email-capture system built for Scent chords, written
so another agent can rebuild it on a different site. It covers the strategy, the
exact mechanics, the rules that keep it from feeling hostile, and the provider
quirks that will silently break it if you don't know them.

**No credentials are in this document, and none should be.** See §9.

---

## 1. The honest framing — read this first

Every gate described here runs in the browser against a static site. That means:

- The data files are public. Anyone can `curl` the JSON the page filters.
- The unlock flag is `localStorage`. A private window or "clear site data" resets it.

**This is a conversion mechanism, not an access control.** It paces ordinary use
and converts willing readers. It stops nobody who doesn't want to be stopped.

Build it anyway — most people are not adversaries, and the alternative (moving the
data and the filtering behind an authenticated API) is a different, much larger
project. But never describe it to a stakeholder as enforcement, and never let the
copy imply the content is protected.

If real enforcement is ever required, the shape is: the index moves server-side,
the client sends a query, the server checks a session and returns only results.
Everything below becomes the free tier's UI on top of that.

---

## 2. Where to gate

The rule: **gate after value has been demonstrated, never before it.**

A visitor who has been on the site forty seconds and is first understanding what it
does is the worst possible moment to interrupt. The gates below all sit at the point
where someone has already got something and is reaching for more.

| Surface                | Free allowance   | Gate type                                 |
| ---------------------- | ---------------- | ----------------------------------------- |
| Ranked list of results | first 10 rows    | hard — "show more" opens the wall         |
| Record list for a term | first 10 rows    | hard — "show more" opens the wall         |
| Multi-select builder   | 2 selections     | hard — the 3rd opens the wall             |
| Search                 | 6 per day        | hard — the 7th opens the wall             |
| Anywhere               | every 7 searches | **soft** — a reminder that blocks nothing |

Three gate _types_ matter and they behave differently:

- **Hard gate** — refuses the action. Declining leaves the user exactly where they
  were. Reappears every time they retry, because it is the door.
- **Soft reminder** — interrupts, asks, and lets them past regardless. Shows on a
  cadence, not on an action.
- **Passive offer** — a landing-page modal, once ever per browser.

---

## 3. Artificial truncation + "show more" — the core pattern

This is the highest-value mechanic and the easiest to get subtly wrong.

### Why truncate

Lists that already fit on screen have no "show more" to gate. The page has to be
_deliberately_ cut short so the button exists. Pick a number that is genuinely
useful on its own — a truncated list nobody wants to extend converts nothing, and a
list that shows everything converts nothing either.

Used here: **10 rows**. Enough to answer the common question; short enough that a
long tail is visibly missing. The underlying page-1 payload held 40, so the cut is
purely presentational.

```js
const PREVIEW = 10;
const items = expanded ? allRows : allRows.slice(0, PREVIEW);
const remaining = total - items.length;
```

### The gated-expand hook

One hook serves every list. Subscribed users expand freely; everyone else raises
the wall, and the expansion happens **only if they come back unlocked**.

```js
function useGatedExpand(expand) {
  const [asking, setAsking] = useState(false);

  const request = useCallback(() => {
    if (isUnlocked()) {
      expand();
      return;
    }
    setAsking(true);
  }, [expand]);

  const gate = asking ? (
    <SubscribeGate
      onClose={(unlocked) => {
        setAsking(false);
        if (unlocked) expand();
      }}
    />
  ) : null;

  return [request, gate];
}
```

Two details that matter:

- **`onClose(unlocked)` carries the outcome**, so the caller decides whether the
  blocked action proceeds. Do not make the gate itself perform the action.
- **Defer expensive work past the wall.** One list here fetches a second page of
  data on expand; that fetch is inside `expand`, so a declined prompt costs no
  network request. Free users should not generate traffic for content they don't get.

---

## 4. The counted-allowance gate (builder pattern)

For a tool where the user accumulates selections, the allowance is a **width, not a
budget**: N selections are free, the N+1th asks.

```js
const add = useCallback(
  (item) => {
    setSelected((current) => {
      if (current.includes(item)) return current;
      if (freeCount > 0 && current.length >= freeCount && !isUnlocked()) {
        setPending(item); // hold it, don't drop it
        return current; // refuse the change
      }
      return [...current, item];
    });
  },
  [freeCount],
);
```

### Hold the refused action

`pending` is the thing they reached for. On unlock it goes through; on decline it
does not. **Never discard it silently** — interrupting someone is bad enough without
also losing the tap.

```js
const closeGate = useCallback(
  (unlocked) => {
    if (pending != null && (unlocked || !hardStop)) {
      setSelected((c) => (c.includes(pending) ? c : [...c, pending]));
    }
    setPending(null);
  },
  [pending, hardStop],
);
```

> **Bug to avoid:** do not call one state setter inside another setter's updater
> function. An updater with a side effect is impure, and React 19's StrictMode
> double-invokes updaters in development specifically to expose that — it will add
> the pending item **twice**. Call both setters flat, and keep the `includes` guard
> as belt and braces.

### Naming the held item in the copy

"Adding **vetiver** makes three" reads better than "your third note". It tells the
user what they just did. (Optional — the current copy dropped this in favour of a
shorter modal. Both work.)

---

## 5. The daily quota gate (file-converter pattern)

```js
function localDay() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

export function usedToday() {
  const seen = read();
  return seen.day === localDay() ? seen.count || 0 : 0;
}

export function recordUse() {
  const used = usedToday() + 1;
  write({ ...read(), day: localDay(), count: used });
  return used;
}
```

Rules:

- **Use the viewer's local day, not UTC.** The quota should reset at _their_
  midnight, not at an hour that makes no sense where they are.
- **Count actions, not navigation.** Here, following a "similar items" link or a
  featured tile is reading, not searching, and is never charged. Charging for
  navigation makes the site feel like a turnstile.
- **A refused action is not an action.** See §6.
- **Unlocking removes the limit entirely**, not just for that day.

---

## 6. The soft reminder

Fires on a cadence (`every 7 actions`), blocks nothing, and offers three things in
one row:

```
[ Subscribe ]  [ Buy me a coffee ]  [ Back to searching ]
```

Rules:

- **The exit sits WITH the other actions, not below them.** It is the button most
  people came to press. Burying it is the trick that makes these feel like a trap.
- **Never dark-pattern the decline.** "Back to searching" — not "No thanks, I hate
  perfume."
- **Subscribed users see a different body** — a thank-you and the tip jar, with the
  ask removed. Do not ask people for something they have already given.
- **Hand over, don't stack.** Clicking Subscribe _replaces_ the reminder with the
  subscribe modal rather than opening a second dialog on top.

```jsx
if (asking) return <SubscribeGate onClose={() => { setAsking(false); setOpen(false); }} />;
return <Modal …><Promo onSubscribe={() => setAsking(true)} /></Modal>;
```

---

## 7. Rules that keep it from feeling hostile

These are the ones that get skipped and then generate complaints.

1. **Ask for an email at most once, ever, passively.** Track a single
   "already asked" concept across _all_ passive prompts. A landing-page modal and an
   in-app gate are two features to you and one nagging site to the reader.
   _Exception:_ a hard gate must reappear on retry — it is a response to their
   action, not an unprompted interruption, and suppressing it would lock them out
   with no way back in.

2. **Never stack modals.** Two independent triggers can fire on the same action
   (the 7th search that is also the 7th of the day). Keep a global count of mounted
   modals and let the _reminder_ stand down; a gate the user's own click raised
   always wins.

   ```js
   let openModals = 0; // in the Modal component module
   export const isModalOpen = () => openModals > 0;
   // increment on mount, decrement on unmount, then:
   if (count % every === 0 && !isModalOpen()) setOpen(true);
   ```

3. **A refused action must not tick any counter.** If the quota check happens after
   the "record a search" call, hitting the limit still advances the reminder
   cadence — charging the user twice for something they didn't get. Count only
   after the action is allowed.

4. **Declining must be inert.** No state change, no navigation, no lost scroll
   position. The user ends exactly where they were.

5. **Never re-prompt someone who is unlocked.** Every gate checks `isUnlocked()`
   before it opens.

---

## 8. Percentage-filled pills (the suggestion UI)

Used for "notes also found in these results" — a row of tappable pills, each filled
proportionally to its share.

```jsx
<span className="pillFill" style={{ width: `${item.share * 100}%` }} aria-hidden="true" />
<span className="pillName">{item.name}</span>
<span className="pillShare">{Math.round(item.share * 100)}%</span>
```

The rule, arrived at by getting it wrong first:

- **The fill is the literal share.** A note in 20% of matches fills a fifth of its
  pill.
- **No scaling to the leader.** The first version scaled every bar against the top
  item so the leader always filled 100%. That looks better and lies: the same width
  meant a different thing in every selection. Literal share means one width means
  one thing everywhere.
- **No minimum floor.** A 3% sliver should look like 3%. A `Math.max(6, …)` floor
  rounds small values up into a visible lie.
- **Keep the number next to the bar.** Twelve percentages in a row is a table nobody
  reads; twelve pills of visibly different weight is a shape you take in at a glance
  — and you can still read the exact figure.

Trade-off to accept: nothing ever reaches the right edge, because a top suggestion
rarely exceeds ~55%. That is the correct reading of a percentage. Ordering still
carries the ranking.

---

## 9. Provider integration (Kit / ConvertKit) — the traps

### Do not use an API key in the browser

Anything imported by client code is compiled into the public bundle. Publishing an
API key there is publishing it. The browser-safe path uses a **form ID**, which is
not a credential — it is already visible in any embed snippet.

If server-side verification is ever needed, the key lives in a host environment
variable read by a serverless function, never in the repo.

### Finding the right identifier

The `data-uid` in the embed snippet is **not** what the subscribe endpoint takes.
Read the real endpoint out of the embed script:

```bash
curl -s https://<account>.kit.com/<uid>/index.js | grep -oE 'forms/[0-9]+/subscriptions'
```

That yields a numeric form ID. Use a placeholder in config; each site has its own.

### The request

```js
const response = await fetch(`https://app.kit.com/forms/${FORM_ID}/subscriptions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ email_address: address }),
});
```

CORS is open (`Access-Control-Allow-Origin: *`), so this works from any origin.

### ⚠ Kit returns HTTP 200 on failure

The verdict is in the **body**, not the status line:

```json
{ "status": "failed", "errors": { "messages": ["Email address is invalid"] } }
```

```js
const body = await response.json();
if (body?.status !== 'success') {
  showError(body?.errors?.messages?.[0]);
  return;
}
unlock(address);
```

Checking `response.ok` alone **unlocks for addresses the provider rejected.** A mock
that returns 500 on failure will hide this completely — test against the real
endpoint.

### A duplicate submission also returns `success`

This is the entire "already subscribed" recovery path, and it is why you do not need
to detect existing subscribers:

- No mailing provider exposes a public "is this address subscribed?" endpoint, for
  the good reason that it would let anyone enumerate a list.
- Substack additionally cannot be used at all here: its embed is a cross-origin
  iframe, so the page cannot see whether anyone submitted it.
- So: a returning subscriber retypes their address and is through in three seconds.
  Say so in the copy — _"if you're already subscribed, just enter the same address."_

### Validate shape locally before sending

```js
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
```

Cheap check, keeps obvious typos off the network. Real validation is the provider
bouncing it.

---

## 10. Two UI bugs that will bite you

### Focus theft — the modal that unfocuses after every keystroke

If the modal's setup effect depends on `onClose`, and callers pass an inline arrow
(they always do), the effect re-runs on **every render**. Any `panel.focus()` inside
then steals focus from the input being typed into. On desktop you lose the caret
after one character; on a phone the keyboard closes after every letter.

```js
const closeRef = useRef(onClose);
useEffect(() => {
  closeRef.current = onClose;
}); // no deps: keep it fresh
useEffect(() => {
  /* setup, reads closeRef.current */
}, []); // runs once
```

**Test by actually typing.** Setting `input.value` programmatically and dispatching
an `input` event never exercises focus, so this class of bug survives that test.

### iOS zoom on focus

Mobile Safari zooms the whole page in when a focused input's text is under **16px**,
and does not zoom back out. Every text input must be `font-size: 16px` or larger.

---

## 11. Copy rules

- **Disclose what the list is for, before the address is typed.** If the emails will
  carry affiliate or sponsored links, say so at signup. The audience most likely to
  subscribe is also the audience most likely to notice the omission later and feel
  managed.
- **Unsubscribe is legally required**, not a courtesy — CAN-SPAM requires a working
  unsubscribe honoured within 10 business days plus a real physical mailing address
  in every commercial email. Most providers handle both if you let them.
- **Promise a cadence you will actually keep.** Copy that says "one a month" and
  delivers three a week is the dishonest part, regardless of how carefully the
  signup was worded.
- **GDPR**: gating a feature behind marketing consent is shaky in the EU, since
  consent is meant to be freely given and not a condition of service. Stating the
  list's purpose plainly is most of the defence.

Working copy, for reference:

> **Subscribe to keep exploring**
> Subscribe to <site> to access advanced features and learn about future updates.
> Unsubscribe at any time.
> `[ Subscribe ]` · Go back to site

---

## 12. Config shape

Keep every knob and every string in one file, out of the components — this is the
most-rewritten text on the site.

```js
newsletter: { kitFormId: '' },          // empty ⇒ capture off, gate falls back to trust
builder:    { freeNotes: 2, hardStop: true },
perfume:    { freeSearchesPerDay: 6 },  // 0 ⇒ no limit
interstitial: { everyNSearches: 7 },    // the soft reminder cadence
gate:       { heading, blurb, submit, decline },
```

`hardStop: false` turns any hard gate into a soft one. Useful while measuring.

---

## 13. Storage schema

One key, one object:

```js
{
  unlocked:  1789240249539,   // timestamp; presence = subscribed
  email:     'reader@…',      // what they typed, for debugging only
  newsletter: 1789238896639,  // passive landing prompt has been shown
  gateShown:  1789239603563,  // in-app gate has been shown
  day:       '2026-9-12',     // local day key for the quota
  count:     6                // uses today
}
```

Every read and write wrapped in `try/catch` — Safari private mode throws on access
rather than returning null, and a signup prompt is not worth taking the page down
for. Failing to persist degrades to "asks again next visit", which is acceptable.

---

## 14. Measure before you tighten

Instrument the funnel before tuning any number:

- `gate_shown` with which gate
- `gate_declined`
- `subscribe_success`
- and the denominator — how many people reach the gate at all

If only a handful of people a week hit the third-note gate, the allowance is not
what is limiting signups and tightening it will only cost you readers.
