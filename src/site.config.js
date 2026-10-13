/**
 * ──────────────────────────────────────────────────────────────────────────
 * THE ONE FILE TO EDIT for this project's CONTENT.
 * Title, tagline, nav, attribution, newsletter, ads. Nothing structural here.
 *
 * Other seams, each its own file (see README §"Where things go"):
 *   • a wheel's behaviour → src/wheels/<slug>.js   (bands, controls, readout)
 *   • the chord renderer  → src/viz/chordEngine.js + src/viz/ChordWheel.jsx
 *   • the look            → src/index.css
 * ──────────────────────────────────────────────────────────────────────────
 */
const site = {
  // The studio the wordmark carries. `title` is this one project inside it.
  brand: 'Gourmet Data',
  title: 'Scent chords',
  tagline:
    'What goes with what in perfume — every pairing between the most common notes, drawn from 24,059 fragrances.',

  // 'live' → real aggregated data, no SAMPLE tag. Flip to 'sample' if a wheel
  // is ever rebuilt on placeholder numbers.
  dataStatus: 'live',

  // Attribution is required on every page. Credit the upstream data source.
  attribution: {
    sourceName: 'Fragrantica fragrance dataset (24,059 perfumes)',
    sourceOrg: 'aggregated by Gourmet Data; note→family grouping is our own',
    sourceUrl: 'https://www.kaggle.com/datasets/olgagmiufana1/fragrantica-com-fragrance-dataset',
  },

  // Where the "Support" nav menu points.
  support: [
    { label: 'Donate', href: 'https://ko-fi.com/gourmetmedia' },
    { label: 'Follow', href: 'https://juweek.studio/' },
    {
      label: 'Data',
      href: 'https://www.kaggle.com/datasets/olgagmiufana1/fragrantica-com-fragrance-dataset',
    },
  ],

  /**
   * Email capture. Substack has no public subscribe API you can POST to from a
   * browser — the supported route is their own embed, which is an iframe that
   * handles the address and the double opt-in itself. So we frame it: our copy
   * on the outside, their form on the inside.
   *
   * >>> SET THIS: the subdomain of your publication. For
   * >>> https://gourmetdata.substack.com the value is 'gourmetdata'.
   * Left empty, the signup modal never renders — no half-wired form that
   * swallows addresses into nowhere.
   */
  newsletter: {
    substack: '',

    /**
     * Kit (formerly ConvertKit) — the numeric form id, which is NOT the
     * `data-uid` in the embed snippet. Read it out of the embed script itself:
     *   curl https://<account>.kit.com/<uid>/index.js | grep -oE 'forms/[0-9]+/subscriptions'
     *
     * Empty turns capture off and the gate falls back to trusting the reader.
     *
     * Substack cannot be used here: its embed is a cross-origin iframe, so the
     * page cannot see whether anyone submitted it, and there is no public
     * endpoint to post to. Kit's is open (Access-Control-Allow-Origin: *) and
     * answers in JSON, which is why the gate can tell success from failure.
     */
    kitFormId: '9911192',
    heading: 'One chart a week, from the same data',
    blurb:
      'Scent chords started as a side of a bigger project — pulling a dataset apart until it shows you something. Get the next one when it lands.',
    // Wait this long after the landing page paints before the modal appears.
    // Instant is a pop-up; a beat later reads as an offer.
    delayMs: 1600,
  },

  /**
   * The every-N-searches interstitial.
   *
   * `mode` picks what fills it:
   *   'offers' — affiliate products from the list below. Your own content, so
   *              none of the AdSense placement risk described under 'ad'.
   *              Renders the disclosure below with them, always — the two are
   *              coupled on purpose. Undisclosed affiliate links breach FTC
   *              guidance and the Amazon Associates agreement, so there is no
   *              switch to show the links without it.
   *   'promo'  — the house pitch: subscribe + Ko-fi. The fallback whenever the
   *              offer list is empty, so an unconfigured build is never blank.
   *   'ad'     — a real AdSense unit. OFF for a reason: AdSense policy forbids
   *              display units inside pop-ups or anything that interferes with
   *              content, and a modal the user must dismiss is squarely that.
   *              That is an account-suspension risk, not a theoretical one.
   *              Google's sanctioned version of this placement is the Vignette
   *              format under Auto ads, which Google frequency-caps itself:
   *              AdSense → Ads → your site → Auto ads → Vignette. Choose 'ad'
   *              only having decided to take that risk knowingly.
   */
  interstitial: {
    everyNSearches: 7,
    mode: 'promo',
    adSlot: '',

    /**
     * >>> SET THESE: paste your own affiliate URLs into `href`. An entry with
     * >>> an empty href is skipped, and if none survive you get the house
     * >>> promo instead — so half-configured never ships as a broken link.
     *
     * The five slots are not arbitrary. This audience arrived to find out what
     * goes with what, which makes it a SAMPLING audience, not a full-bottle
     * audience: discovery sets, decants and books match the intent that got
     * them here, and intent is the whole game in affiliate. A $180 bottle at
     * 3% pays more per sale than a $20 book, but it converts so much worse from
     * cold traffic that the book usually wins on revenue per thousand views.
     *
     * `tag` is shown to the reader as a small label, so keep it honest.
     */
    offers: [
      {
        name: 'Fragrance discovery set',
        tag: 'Sampler',
        hook: 'Eight to twelve vials — the cheapest way to smell a whole family at once.',
        href: '',
      },
      {
        name: 'Decants and 5ml splits',
        tag: 'Samples',
        hook: 'Try the expensive end of a wheel without buying the expensive end.',
        href: '',
      },
      {
        name: 'Perfumes: The Guide',
        tag: 'Book',
        hook: 'Turin and Sanchez, the reviews that taught a generation to describe a smell.',
        href: '',
      },
      {
        name: 'Single-note reference bottles',
        tag: 'Soliflore',
        hook: 'One material, undressed — the fastest way to learn what rose or oud actually is.',
        href: '',
      },
      {
        name: 'Raw materials starter kit',
        tag: 'Kit',
        hook: 'Smell the notes on their own before you meet them blended.',
        href: '',
      },
    ],

    /**
     * Shown above the offers. Required, not decorative: the US FTC and the UK
     * ASA both want a disclosure a reader actually sees before the link, and
     * Amazon Associates requires one in its operating agreement.
     */
    disclosure:
      'Affiliate links — if you buy, this site earns a small commission at no extra cost to you.',
  },

  /**
   * The Note Builder's free allowance.
   *
   * `freeNotes` is how many notes may be stacked before the prompt appears —
   * 3 means the fourth note is the ask. 0 turns the gate off entirely.
   *
   * `hardStop` true keeps the reader at the free width if they decline, and is
   * what makes this a gate rather than a nag. Two things it is NOT: proof of
   * anything (an unlocked address is never verified against a list — see
   * BuilderGate), and enforcement (public/data/builder/index.json is a static
   * file anyone can fetch whole). It converts the willing; it stops no one.
   *
   * >>> BE CLEAR-EYED ABOUT WHAT THIS IS. There is no account system and no
   * >>> server, so this counts in localStorage and anyone who clears site data
   * >>> or opens a private window starts over. It is an ASK, not a wall, and
   * >>> `hardStop` below reflects that: false lets the reader continue past the
   * >>> prompt. Setting it true only annoys the honest ones — enforcing this
   * >>> properly needs a backend that holds the index and checks a session,
   * >>> which is a different and much larger piece of work.
   */
  builder: {
    freeNotes: 3,
    hardStop: true,
  },

  /**
   * The perfume search's daily allowance. 0 removes the limit.
   * Subscribing lifts it entirely — see engagement.js for what this can and
   * cannot actually enforce.
   */
  perfume: {
    freeSearchesPerDay: 6,
  },

  /**
   * The gate's words. Here rather than in the component so they can be tuned
   * without touching JSX — this is the most-rewritten text on the site.
   *
   * If the letters ever start carrying affiliate or sponsored links, this
   * copy has to say so before the address is typed. Right now it describes
   * what the list actually is — product updates — so it needs nothing more.
   */
  gate: {
    heading: 'Subscribe to keep exploring',
    blurb:
      'Subscribe to Gourmet Data to access advanced features and learn about future updates. Unsubscribe at any time.',
    submit: 'Subscribe',
    decline: 'Go back to site',
  },

  adsense: {
    client: 'ca-pub-7499516838534633',
  },
};

export default site;
