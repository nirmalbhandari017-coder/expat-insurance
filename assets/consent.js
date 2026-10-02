/* ──────────────────────────────────────────────────────────────────
   consent.js — notice-only cookie banner for Expat Protect Hub
   ──────────────────────────────────────────────────────────────────

   Behaviour: notice-only. The banner informs visitors that we use
   cookies and Meta Pixel for analytics; it does NOT gate tracking.
   This is lower-friction than a full GDPR consent-management
   platform and is suitable for non-EU audiences.

   Visitors in the EU/UK should either accept this reduced
   compliance level or we should swap this file for a true
   consent-mode banner (Pixel disabled by default until opt-in).

   Dismissed state is stored in localStorage['eph_consent_notice'].
   Reset with: localStorage.removeItem('eph_consent_notice')
*/
(function () {
  'use strict';

  var STORAGE_KEY = 'eph_consent_notice';
  var VERSION = '1';  // bump to force the banner to re-show after a policy change

  // Already dismissed? Respect it (and the version check lets us
  // re-prompt everyone after a material policy update).
  try {
    if (localStorage.getItem(STORAGE_KEY) === VERSION) return;
  } catch (e) {
    // localStorage unavailable (incognito, locked-down browser) — show the banner each visit
  }

  // Don't render on the 404 page or thank-you page (adds noise)
  if (document.body && document.body.getAttribute('data-eph-no-consent') === '1') return;

  var css = [
    '.eph-consent{position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;',
    'background:#1B263B;color:#fff;border-radius:14px;',
    'box-shadow:0 20px 50px -12px rgba(0,0,0,.45);',
    "font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;",
    'font-size:.86rem;line-height:1.5;',
    'padding:1rem 1.2rem;display:flex;flex-wrap:wrap;align-items:center;',
    'gap:.8rem 1.2rem;max-width:980px;margin:0 auto;',
    'transform:translateY(140%);transition:transform .35s ease-out}',
    '.eph-consent.is-ready{transform:translateY(0)}',
    '.eph-consent__msg{flex:1 1 320px;min-width:0;color:rgba(255,255,255,.9)}',
    '.eph-consent__msg strong{color:#fff;font-weight:700}',
    '.eph-consent__msg a{color:#3DD6CE;text-decoration:underline}',
    '.eph-consent__msg a:hover{color:#fff}',
    '.eph-consent__btn{appearance:none;border:0;cursor:pointer;',
    'background:linear-gradient(135deg,#0FB9B1,#0B6E6B);color:#fff;',
    "font-family:inherit;font-size:.85rem;font-weight:700;",
    'padding:.6rem 1.2rem;border-radius:999px;',
    'box-shadow:0 10px 28px -10px rgba(15,185,177,.6);transition:transform .12s ease-out}',
    '.eph-consent__btn:hover{transform:translateY(-1px)}',
    '.eph-consent__btn:focus-visible{outline:2px solid #fff;outline-offset:2px}',
    '@media (max-width:520px){',
    '.eph-consent{padding:.9rem 1rem;font-size:.8rem;align-items:flex-start;flex-direction:column}',
    '.eph-consent__btn{align-self:stretch;text-align:center}',
    '}'
  ].join('');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var box = document.createElement('div');
  box.className = 'eph-consent';
  box.setAttribute('role', 'region');
  box.setAttribute('aria-label', 'Cookie and tracking notice');

  var msg = document.createElement('div');
  msg.className = 'eph-consent__msg';
  msg.innerHTML =
    '<strong>Cookies and analytics.</strong> ' +
    'We use cookies and Meta Pixel to measure how visitors use this site and to improve our service. ' +
    'By continuing to browse, you accept this. Read our ' +
    '<a href="/privacy">Privacy Policy</a> for details.';
  box.appendChild(msg);

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'eph-consent__btn';
  btn.textContent = 'Got it';
  btn.setAttribute('aria-label', 'Dismiss cookie notice');
  box.appendChild(btn);

  btn.addEventListener('click', function () {
    try { localStorage.setItem(STORAGE_KEY, VERSION); } catch (e) {}
    box.classList.remove('is-ready');
    // Give the slide-out animation a moment, then remove
    setTimeout(function () {
      if (box.parentNode) box.parentNode.removeChild(box);
    }, 350);
  });

  function mount() {
    document.body.appendChild(box);
    // Fire the slide-in on the next frame so the transition runs
    requestAnimationFrame(function () {
      box.classList.add('is-ready');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
