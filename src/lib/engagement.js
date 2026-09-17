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

/**
 * The record is kept twice: localStorage for the durable copy, and `memory`
 * for the one that still works when the durable copy does not.
 *
 * This is not belt and braces. localStorage throws on every call in Safari's
 * private mode and under "block site data", and a wheel embedded in another
 * site is third-party storage that Safari and Firefox partition or refuse
 * outright. With only the durable copy, an address typed into the gate bought
 * exactly one note before the wall went straight back up: the reader had paid
 * and was still standing outside, with no way through short of subscribing
 * again. Memory carries the unlock to the end of the tab, which is what the
 * gate has always claimed to do.
 *
 * Memory wins on read. It takes every write, so it is never the staler of the
 * two.
 */
let memory = {};

function readSeen() {
  try {
    const raw = window.localStorage.getItem(KEY);
    return { ...(raw ? JSON.parse(raw) : {}), ...memory };
  } catch {
    // Unreadable, or corrupt JSON left by an older build. Either way memory is
    // the whole of what we know.
    return { ...memory };
  }
}

/** Merge `patch` into the record. Memory always takes it; storage if it can. */
function writeSeen(patch) {
  memory = { ...readSeen(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* private mode, or a partitioned iframe — memory carries it for this tab */
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
  // Having subscribed counts as having been asked, whichever prompt took the
  // address. This is the site's one rule about email: nothing asks again once
  // an address has been given. It is stated here rather than left to depend on
  // 'builderGate' staying in the list above, because that list is about which
  // prompts have FIRED and this is about whether the reader has answered.
  if (builderUnlocked()) return true;
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
  // One write, not two: the "has been asked" flag and the unlock must never
  // end up on opposite sides of a storage failure.
  writeSeen({ builderGate: Date.now(), builderUnlocked: Date.now(), email: email || true });
}

/**
 * Has this reader already handed over an address? Every gate on the site asks
 * this before it goes up — the builder's third note, the wheel's "show more",
 * the perfume search's daily allowance — so that paying once pays for all of
 * them.
 */
export function builderUnlocked() {
  return Boolean(readSeen().builderUnlocked);
}

/** Has this browser been shown `flag` before? Unreadable storage → "no". */
export function hasSeen(flag) {
  return Boolean(readSeen()[flag]);
}

/** Remember that `flag` has been shown. */
export function markSeen(flag) {
  writeSeen({ [flag]: Date.now() });
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
  writeSeen({ searchDay: localDay(), searchCount: used });
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
