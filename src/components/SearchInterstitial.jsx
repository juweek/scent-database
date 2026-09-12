import { useEffect, useMemo, useRef, useState } from 'react';
import { track } from '@vercel/analytics';
import Modal, { isModalOpen } from './Modal';
import SubscribeGate from './SubscribeGate';
import { builderUnlocked, subscribeToSearches } from '../lib/engagement';
import site from '../site.config';

/**
 * A full-page takeover every Nth search. Dismissible on the first click — the
 * interruption is already the cost, and a forced countdown on top of it is the
 * part that makes these things hated.
 *
 * What fills it is site.config.js → interstitial.mode. Read the note there
 * before choosing 'ad'.
 */
export default function SearchInterstitial() {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    const every = site.interstitial.everyNSearches;
    if (!every || every < 1) return undefined;
    return subscribeToSearches((count) => {
      // Never on top of a wall the reader is already looking at.
      if (count % every === 0 && !isModalOpen()) setOpen(true);
    });
  }, []);

  if (!open) return null;

  const close = () => setOpen(false);

  // Hand straight over to the subscribe wall when they ask for it, rather than
  // closing and reopening — one modal, two faces.
  if (asking) {
    return (
      <SubscribeGate
        onClose={() => {
          setAsking(false);
          setOpen(false);
        }}
      />
    );
  }

  return (
    <Modal label="A quick word" tone="interstitial" onClose={close}>
      <Body onClose={close} onSubscribe={() => setAsking(true)} />
    </Modal>
  );
}

/** The quiet way out, under the offer list and the ad. */
function DismissLink({ onClose }) {
  return (
    <button type="button" className="modalDismiss" onClick={onClose}>
      Back to searching
    </button>
  );
}

/** Offers with nowhere to point are worse than no offers, so they never render. */
const liveOffers = () => site.interstitial.offers.filter((offer) => offer.href);

function Body({ onClose, onSubscribe }) {
  const { mode, adSlot } = site.interstitial;
  if (mode === 'ad' && adSlot) {
    return (
      <>
        <AdUnit slot={adSlot} />
        <DismissLink onClose={onClose} />
      </>
    );
  }
  if (mode === 'offers' && liveOffers().length) {
    return (
      <>
        <Offers />
        <DismissLink onClose={onClose} />
      </>
    );
  }
  return <HousePromo onClose={onClose} onSubscribe={onSubscribe} />;
}

/**
 * The affiliate list.
 *
 * Order is shuffled per impression. Not for variety — so the click data means
 * something. Fixed order bakes position bias into every number you collect,
 * and then the top slot always "wins" whatever you put in it.
 */
function Offers() {
  const offers = useMemo(() => shuffle(liveOffers()), []);

  // The denominator. Click counts alone cannot tell you whether an offer is
  // good or merely seen a lot, so the impression is worth an event of its own.
  useEffect(() => {
    track('interstitial_shown', { mode: 'offers', offers: offers.length });
  }, [offers.length]);

  return (
    <>
      <p className="eyebrow">While you are here</p>
      <h2 className="modalHeading">Ways to smell what you are reading about</h2>
      <p className="modalDisclosure">{site.interstitial.disclosure}</p>
      <ul className="offerList">
        {offers.map((offer, index) => (
          <li key={offer.name}>
            <a
              className="offerCard"
              href={offer.href}
              target="_blank"
              /* sponsored+nofollow is what a paid link is supposed to carry, and
                 Amazon's operating agreement asks for it by name. */
              rel="sponsored nofollow noreferrer"
              onClick={() => track('offer_click', { offer: offer.name, slot: index })}
            >
              <span className="offerTop">
                <strong>{offer.name}</strong>
                {offer.tag && <span className="offerTag">{offer.tag}</span>}
              </span>
              <span className="offerHook">{offer.hook}</span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Fisher–Yates on a copy — site.config's array is shared, never sort in place. */
function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The house pitch. A nudge, not a wall — nothing here is disabled, and the way
 * out sits WITH the other two rather than below them, because it is the button
 * most people came to press and burying it is the trick that makes these feel
 * like a trap.
 *
 * Someone already subscribed is not asked again; they just get the thanks and
 * the tip jar.
 */
function HousePromo({ onClose, onSubscribe }) {
  const subscribed = builderUnlocked();

  useEffect(() => {
    track('interstitial_shown', { mode: 'promo' });
  }, []);

  return (
    <>
      <h2 className="modalHeading">Scent chords is made by one person</h2>
      <p className="modalBlurb">
        {subscribed
          ? 'Thanks for following along — it genuinely is what keeps this going.'
          : 'If the wheels have been useful, consider following for updates and more apps like this one.'}
      </p>
      <div className="promoActions">
        {!subscribed && (
          <button
            type="button"
            className="promoAction promoAction--primary"
            onClick={() => {
              track('promo_click', { action: 'subscribe' });
              onSubscribe();
            }}
          >
            Subscribe
          </button>
        )}
        <a
          className="promoAction"
          href="https://ko-fi.com/gourmetmedia"
          target="_blank"
          rel="noreferrer"
          onClick={() => track('promo_click', { action: 'kofi' })}
        >
          Buy me a coffee
        </a>
        <button type="button" className="promoAction promoAction--quiet" onClick={onClose}>
          Back to searching
        </button>
      </div>
    </>
  );
}

/**
 * A real AdSense unit. Only mounted when interstitial.mode is 'ad' — read the
 * warning in site.config.js before you choose it.
 */
function AdUnit({ slot }) {
  const pushed = useRef(false);
  useEffect(() => {
    // React 19 double-invokes effects in dev; a second push on the same <ins>
    // makes AdSense throw "already have ads in them".
    if (pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* blocker, or the loader never arrived */
    }
  }, []);

  return (
    <>
      <p className="eyebrow">Advertisement</p>
      <ins
        className="adsbygoogle interstitialAd"
        style={{ display: 'block' }}
        data-ad-client={site.adsense.client}
        data-ad-slot={slot}
        data-ad-format="rectangle"
        data-full-width-responsive="true"
      />
    </>
  );
}
