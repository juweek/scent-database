import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Modal from './Modal';
import { emailAlreadyAsked, markSeen } from '../lib/engagement';
import site from '../site.config';

const FLAG = 'newsletter';

/**
 * The signup offer, once per browser, on the landing page only.
 *
 * Substack's embed is an iframe because it has to be — the address, the double
 * opt-in and the CAPTCHA all belong to their origin, and there is no public
 * endpoint a page like this may POST to. So our copy sits outside the frame
 * and their form sits inside it.
 */
export default function NewsletterModal() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const publication = site.newsletter.substack;

  useEffect(() => {
    // Deep links into a wheel or a perfume are someone arriving mid-thought.
    // The ask belongs on the front door.
    // emailAlreadyAsked, not hasSeen(FLAG): someone who already met the
    // builder's prompt has been asked, and asking again is just nagging.
    if (!publication || pathname !== '/' || emailAlreadyAsked()) return undefined;
    const timer = setTimeout(() => {
      setOpen(true);
      // Marked on sight, not on dismiss: it is a once-ever prompt, and a
      // reload should not be a way to be asked again.
      markSeen(FLAG);
    }, site.newsletter.delayMs);
    return () => clearTimeout(timer);
  }, [pathname, publication]);

  if (!open) return null;

  return (
    <Modal label="Subscribe by email" onClose={() => setOpen(false)}>
      <h2 className="modalHeading">{site.newsletter.heading}</h2>
      <p className="modalBlurb">{site.newsletter.blurb}</p>
      <div className="substackFrame">
        <iframe
          title="Subscribe"
          src={`https://${publication}.substack.com/embed`}
          width="100%"
          height="150"
          frameBorder="0"
          scrolling="no"
        />
      </div>
      <button type="button" className="modalDismiss" onClick={() => setOpen(false)}>
        No thanks, take me to the wheels
      </button>
    </Modal>
  );
}
