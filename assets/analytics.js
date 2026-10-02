/* ──────────────────────────────────────────────────────────────────
   analytics.js — standardised event wiring for Expat Protect Hub
   ──────────────────────────────────────────────────────────────────

   Fires a consistent set of custom events through Meta Pixel (fbq).
   Safe to load before or after fbq — all tracking goes through
   trackEvent() which no-ops if fbq is not yet defined.

   No PII is ever sent as event params: no names, emails, phones,
   medical info, or quote amounts. Only page URLs, href values of
   clicked links, and the page category (homepage, blog, service,
   quote, etc.) are included.

   Events fired:
     - view_plan_comparison   when a plan comparison section
                              scrolls into view
     - view_life_insurance    on /life-insurance page load
     - start_quote            first interaction with a lead form
     - complete_quote         thank-you page arrival (success)
     - whatsapp_click         click on any wa.me / whatsapp link
     - phone_click            click on any tel: link
     - download_policy_wording click on any Regency PDF link
     - article_to_quote_click click from a blog post to the
                              quote funnel

   Nothing in this file touches the existing fbq('track','Lead')
   calls on the life-quote and thank-you pages — those keep firing
   as before. Our custom events are additive.
*/
(function () {
  'use strict';

  // ---- Core track helper ------------------------------------------
  function trackEvent(name, params) {
    try {
      params = params || {};
      // Guard: never include PII. Strip any keys that look sensitive.
      ['email', 'phone', 'name', 'full_name', 'first_name', 'ssn', 'dob'].forEach(function (k) {
        if (k in params) delete params[k];
      });

      // Meta Pixel custom event
      if (typeof window.fbq === 'function') {
        window.fbq('trackCustom', name, params);
      }

      // Dev-friendly console log
      if (window.console && console.debug) {
        console.debug('[eph.analytics]', name, params);
      }
    } catch (e) {
      // never let analytics break the page
      if (window.console && console.warn) console.warn('[eph.analytics] fail', e);
    }
  }

  // Expose a global so other scripts (e.g. existing form handlers)
  // can push additional events without re-implementing the guard.
  window.eph = window.eph || {};
  window.eph.track = trackEvent;

  // ---- Page-category helper ---------------------------------------
  function pageCategory() {
    var p = location.pathname.replace(/^\/+|\/+$/g, '');
    if (!p) return 'home';
    if (/^blog-/.test(p))                           return 'blog';
    if (p === 'life-insurance' || p === 'life-insurance.html') return 'life';
    if (p.indexOf('life-insurance-quote') > -1 || p === 'life-insurance/quote') return 'life_quote';
    if (p === 'expat-health-insurance' || p === 'expat-health-insurance.html') return 'health';
    if (p === 'find-my-plan' || p === 'find-my-plan.html')     return 'find_my_plan';
    if (p === 'free-expat-guide' || p === 'free-expat-guide.html') return 'guide';
    if (p === 'faq' || p === 'faq.html')                       return 'faq';
    if (p === 'claim' || p === 'claim.html')                   return 'claim';
    if (p === 'about' || p === 'about.html')                   return 'about';
    if (p === 'thank-you' || p === 'thank-you.html')           return 'thank_you';
    return 'other';
  }
  var category = pageCategory();

  // ---- Page-load events -------------------------------------------
  if (category === 'life') {
    trackEvent('view_life_insurance', { page: location.pathname });
  }

  if (category === 'thank_you') {
    // Fires alongside the existing fbq('track','Lead') on thank-you.html.
    // The existing Lead event is kept intact; this adds a standardised
    // name so cross-funnel analysis has a single, consistent event.
    try {
      var src = new URLSearchParams(location.search).get('src') || '';
      trackEvent('complete_quote', { source: src || 'unknown' });
    } catch (e) {}
  }

  // ---- view_plan_comparison (IntersectionObserver) ----------------
  (function () {
    if (!('IntersectionObserver' in window)) return;
    var selectors = [
      '#plan-comparison',
      '.plans-table-wrap',
      '[data-eph-event="plan-comparison"]'
    ];
    var el = null;
    for (var i = 0; i < selectors.length; i++) {
      el = document.querySelector(selectors[i]);
      if (el) break;
    }
    if (!el) return;
    var done = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!done && entry.isIntersecting && entry.intersectionRatio > 0.3) {
          done = true;
          trackEvent('view_plan_comparison', { page: location.pathname });
          io.disconnect();
        }
      });
    }, { threshold: 0.3 });
    io.observe(el);
  })();

  // ---- start_quote (first-focus on a lead form) -------------------
  (function () {
    var FORM_SELECTOR = '#lead-form, #quote-form, form.form-card, form[data-eph-form]';
    var fired = false;
    function handler(ev) {
      if (fired) return;
      var form = ev.target.closest(FORM_SELECTOR);
      if (!form) return;
      // Only trigger for actual inputs the user types / clicks into
      var tag = (ev.target.tagName || '').toLowerCase();
      if (tag !== 'input' && tag !== 'select' && tag !== 'textarea') return;
      fired = true;
      trackEvent('start_quote', { page: location.pathname, form_id: form.id || null });
    }
    document.addEventListener('focusin', handler, true);
    // Fallback for touch devices that may skip focusin for radio chips
    document.addEventListener('change', handler, true);
  })();

  // ---- Delegated click events: whatsapp, phone, pdf, article->quote
  function closestAnchor(target) {
    while (target && target !== document) {
      if (target.tagName === 'A') return target;
      target = target.parentNode;
    }
    return null;
  }

  document.addEventListener('click', function (ev) {
    var a = closestAnchor(ev.target);
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (!href) return;

    // whatsapp_click
    if (/^https?:\/\/wa\.me\//.test(href) ||
        /^https?:\/\/(api\.)?whatsapp\.com\//.test(href) ||
        /^whatsapp:/.test(href)) {
      trackEvent('whatsapp_click', { href: href, page: location.pathname });
      return;
    }

    // phone_click
    if (/^tel:/i.test(href)) {
      trackEvent('phone_click', { href: href, page: location.pathname });
      return;
    }

    // download_policy_wording — any Regency Assurance PDF link
    if (/regencyassurance\.com\/application\/files\//i.test(href) ||
        (/regencyassurance\.com/i.test(href) && /\.pdf(\?|$)/i.test(href))) {
      // Strip filename only, keep host for reporting
      trackEvent('download_policy_wording', {
        href: href,
        page: location.pathname,
        file: href.split('/').pop().split('?')[0]
      });
      return;
    }

    // article_to_quote_click — only on blog pages
    if (category === 'blog') {
      var isQuoteLink =
        /^#get-quote$/.test(href) ||
        /^\/#get-quote$/.test(href) ||
        /^\/?find-my-plan(\.html|\/|$|#|\?)/.test(href) ||
        /^\/?expat-health-insurance(\.html|\/|$|#|\?)/.test(href) ||
        /^\/?life-insurance(\.html|\/|$|#|\?|-quote)/.test(href);
      if (isQuoteLink) {
        trackEvent('article_to_quote_click', {
          href: href,
          from: location.pathname
        });
      }
    }
  }, true);

})();
