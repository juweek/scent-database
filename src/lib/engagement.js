/**
 * What this browser has already been shown, and how hard it is working right
 * now. Two different lifetimes, deliberately:
 *
 *   • the signup modal is a ONCE-EVER thing → localStorage, survives the tab
 *   • the search interstitial follows a BURST of use → a module counter, dies
 *     with the tab, so tomorrow's first search is not instantly ad number six
 *
 * Every storage call is wrapped: Safari private mode and "block site data"
 * make localStorage throw on access, not return null, and a signup prompt is
 * not worth taking the page down over.
 */
const KEY = 'scentchords:seen';

function readSeen() {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Every prompt that asks for an email address.
 *
 * They live in different places — the landing modal, the builder's allowance —
 * but they are one ask as far as a reader is concerned, and being asked twice
 * by the same site reads as nagging rather than as two features. So any one of
 * them firing closes all of them, for good.
 */
const EMAIL_PROMPTS = ['newsletter', 'builderGate'];

export function emailAlreadyAsked() {
  const seen = readSeen();
  return EMAIL_PROMPTS.some((flag) => seen[flag]);
}

/**
 * The builder's unlock.
 *
 * Separate from the "has been asked" flags above, because asking and unlocking
 * are different events now: the gate is a hard stop, so it has to be allowed
 * to reappear every time a locked reader reaches for a third note. Only an
 * actual unlock retires it.
 *
 * This is a local flag, not proof. Nothing here has verified that the address
 * belongs to anyone, and clearing site data clears the unlock — at which point
 * the reader re-enters the same address and is through again, which is the
 * intended behaviour rather than a hole in it.
 */
export function unlockBuilder(email) {
  markSeen('builderGate');
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ ...readSeen(), builderUnlocked: Date.now(), email: email || true }),
    );
  } catch {
    /* private mode — the unlock lasts as long as the tab does */
  }
}

export function builderUnlocked() {
  return Boolean(readSeen().builderUnlocked);
}

/** Has this browser been shown `flag` before? Unreadable storage → "no". */
export function hasSeen(flag) {
  return Boolean(readSeen()[flag]);
}

/** Remember that `flag` has been shown. Silently a no-op if storage is closed. */
export function markSeen(flag) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...readSeen(), [flag]: Date.now() }));
  } catch {
    /* private mode — the prompt just reappears next visit */
  }
}

/**
 * The perfume search's daily allowance — the file-converter pattern: a few a
 * day for free, more if you subscribe.
 *
 * The day is the VIEWER'S day, not UTC, so the quota resets when their own
 * midnight passes rather than at some hour that makes no sense where they are.
 *
 * Same honesty as everything else here: this counts in localStorage, so a
 * private window or a cleared site setting starts the day over. It paces
 * ordinary use; it stops nobody who does not want to be stopped.
 */
function localDay() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

export function perfumeSearchesToday() {
  const seen = readSeen();
  return seen.searchDay === localDay() ? seen.searchCount || 0 : 0;
}

export function recordPerfumeSearch() {
  const used = perfumeSearchesToday() + 1;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ ...readSeen(), searchDay: localDay(), searchCount: used }),
    );
  } catch {
    /* private mode — the allowance resets with the tab */
  }
  return used;
}

let searches = 0;
const listeners = new Set();

/**
 * Call once per deliberate search — a perfume chosen from the type-ahead, a
 * note picked on a wheel. Not per keystroke: the count is meant to track
 * intent, and an interstitial every five letters typed would be unusable.
 */
export function recordSearch() {
  searches += 1;
  listeners.forEach((fn) => fn(searches));
}

export function subscribeToSearches(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
