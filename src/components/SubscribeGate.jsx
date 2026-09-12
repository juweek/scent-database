import { useState } from 'react';
import Modal from './Modal';
import { unlockBuilder } from '../lib/engagement';
import site from '../site.config';

/** Cheap shape check. Real validation is the provider bouncing it later. */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * The subscribe wall. Raised wherever a free allowance runs out: the builder's
 * third note, and the "show more" on the wheel's pairing and perfume lists.
 *
 * ON WHAT THIS DOES AND DOES NOT KNOW. An address typed here is sent to Kit
 * and then trusted — nothing checks it against a subscriber list, because no
 * such check exists to make from a browser. No mailing provider exposes a
 * public "is this address subscribed?" endpoint, for the good reason that it
 * would let anyone enumerate a list. So a returning subscriber is not
 * recognised; they retype the address and are through, and Kit answers
 * "success" for an address it already holds, which is what makes that work.
 *
 * onClose(true) means unlocked, onClose(false) means declined — callers use it
 * to decide whether the action that raised this wall should now proceed.
 */
export default function SubscribeGate({ onClose }) {
  const { substack, kitFormId } = site.newsletter;
  const copy = site.gate;
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  // Kit's own wording when it has some; ours when it does not.
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    const address = email.trim();
    if (!LOOKS_LIKE_EMAIL.test(address)) {
      setStatus('invalid');
      return;
    }
    setStatus('sending');
    try {
      const response = await fetch(`https://app.kit.com/forms/${kitFormId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email_address: address }),
      });
      const body = await response.json();
      // Kit answers 200 even when it REJECTS the address — the verdict is in
      // the body, not the status line. Checking response.ok alone would unlock
      // the builder for an address Kit refused to store.
      if (body?.status !== 'success') {
        setError(body?.errors?.messages?.[0] || null);
        setStatus('failed');
        return;
      }
      // An address already on the list also comes back "success", which is the
      // whole recovery path: a returning reader retypes it and is through.
      unlockBuilder(address);
      onClose(true);
    } catch {
      setError(null);
      setStatus('failed');
    }
  };

  return (
    <Modal label="Keep building" tone="interstitial" onClose={() => onClose(false)}>
      <h2 className="modalHeading">{copy.heading}</h2>
      <p className="modalBlurb">{copy.blurb}</p>

      {kitFormId ? (
        <form className="gateForm" onSubmit={submit} noValidate>
          {/* noValidate, deliberately: type="email" still gets the right
              keyboard on a phone, but the browser's native bubble would fire
              ahead of this form's handler and the styled message below would
              never render. */}
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-label="Email address"
            aria-invalid={status === 'invalid'}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (status !== 'sending') setStatus('idle');
            }}
            disabled={status === 'sending'}
          />
          <button
            type="submit"
            className="promoAction promoAction--primary"
            disabled={status === 'sending'}
          >
            {status === 'sending' ? 'Sending…' : copy.submit}
          </button>
        </form>
      ) : (
        <div className="promoActions">
          {substack && (
            <a
              className="promoAction promoAction--primary"
              href={`https://${substack}.substack.com/subscribe`}
              target="_blank"
              rel="noreferrer"
            >
              Follow on Substack
            </a>
          )}
          {/* No endpoint configured, so there is nothing to send an address to
              and nothing to verify against. Trusting the reader is the only
              honest option left — and it is labelled as exactly that. */}
          <button
            type="button"
            className="promoAction"
            onClick={() => {
              unlockBuilder(null);
              onClose(true);
            }}
          >
            I am already on the list
          </button>
        </div>
      )}

      {status === 'invalid' && (
        <p className="gateNote gateNote--bad">That does not look like an email address.</p>
      )}
      {status === 'failed' && (
        <p className="gateNote gateNote--bad">
          {error || 'That did not go through — try again in a moment.'}
        </p>
      )}

      <div className="gateFooter">
        {substack && kitFormId && (
          <a href={`https://${substack}.substack.com/subscribe`} target="_blank" rel="noreferrer">
            Or follow on Substack
          </a>
        )}
        <button type="button" onClick={() => onClose(false)}>
          {copy.decline}
        </button>
      </div>
    </Modal>
  );
}
