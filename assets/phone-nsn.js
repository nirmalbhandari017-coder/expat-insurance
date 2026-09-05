/* ─────────────────────────────────────────────────────────────
   phone-nsn.js — per-country phone number length validation
   (ITU-T E.164 National Significant Number ranges)

   Shared across every lead-capture form on the site so a Thai
   +66 number caps at 9 digits, a Chinese +86 number caps at 11,
   a German +49 at 6–13, and so on. Any dial code not in the
   NSN_BY_CODE table falls back to a permissive 6–15 (the ITU
   generous default) so we never bounce a legit number from a
   country we haven't modelled.

   Usage:
     <script src="/assets/phone-nsn.js"></script>
     PhoneNSN.attach();
     // Later, at submit:
     const err = PhoneNSN.validate();
     if (err) { alert(err); return; }

   attach() expects #phone-cc (select of dial codes, values like
   "+66") and #phone (tel input) already in the DOM. It creates
   a small hint element under the phone input if one isn't
   already present.
   ───────────────────────────────────────────────────────────── */
(function (root) {
  var NSN_DEFAULT = { min: 6, max: 15 };
  var NSN_BY_CODE = {
    // 7 digits
    '+354': { min: 7,  max: 7  },   // Iceland
    // 8 digits
    '+65':  { min: 8,  max: 8  },   // Singapore
    '+852': { min: 8,  max: 8  },   // Hong Kong
    '+853': { min: 8,  max: 8  },   // Macau
    '+974': { min: 8,  max: 8  },   // Qatar
    '+965': { min: 8,  max: 8  },   // Kuwait
    '+973': { min: 8,  max: 8  },   // Bahrain
    '+968': { min: 8,  max: 8  },   // Oman
    '+47':  { min: 8,  max: 8  },   // Norway
    '+45':  { min: 8,  max: 8  },   // Denmark
    '+352': { min: 8,  max: 9  },   // Luxembourg
    '+855': { min: 8,  max: 9  },   // Cambodia
    // 9 digits
    '+66':  { min: 9,  max: 9  },   // Thailand
    '+61':  { min: 9,  max: 9  },   // Australia
    '+33':  { min: 9,  max: 9  },   // France
    '+34':  { min: 9,  max: 9  },   // Spain
    '+31':  { min: 9,  max: 9  },   // Netherlands
    '+41':  { min: 9,  max: 9  },   // Switzerland
    '+48':  { min: 9,  max: 9  },   // Poland
    '+351': { min: 9,  max: 9  },   // Portugal
    '+27':  { min: 9,  max: 9  },   // South Africa
    '+971': { min: 9,  max: 9  },   // UAE
    '+966': { min: 9,  max: 9  },   // Saudi Arabia
    '+972': { min: 9,  max: 9  },   // Israel
    '+254': { min: 9,  max: 9  },   // Kenya
    '+51':  { min: 9,  max: 9  },   // Peru
    '+56':  { min: 9,  max: 9  },   // Chile
    // 9–10 digits (mixed mobile/landline lengths)
    '+20':  { min: 9,  max: 10 },   // Egypt
    '+964': { min: 9,  max: 10 },   // Iraq
    '+39':  { min: 9,  max: 10 },   // Italy
    '+380': { min: 9,  max: 10 },   // Ukraine
    '+353': { min: 9,  max: 10 },   // Ireland
    '+94':  { min: 9,  max: 10 },   // Sri Lanka
    '+84':  { min: 9,  max: 10 },   // Vietnam
    '+60':  { min: 9,  max: 10 },   // Malaysia
    // 10 digits
    '+44':  { min: 10, max: 10 },   // UK
    '+1':   { min: 10, max: 10 },   // US / Canada / Caribbean (same NSN across the plan)
    '+91':  { min: 10, max: 10 },   // India
    '+63':  { min: 10, max: 10 },   // Philippines
    '+52':  { min: 10, max: 10 },   // Mexico
    '+57':  { min: 10, max: 10 },   // Colombia
    '+90':  { min: 10, max: 10 },   // Turkey
    '+234': { min: 10, max: 10 },   // Nigeria
    '+7':   { min: 10, max: 10 },   // Russia / Kazakhstan
    '+64':  { min: 8,  max: 10 },   // New Zealand
    // 9–11 (variable mobile ranges)
    '+81':  { min: 9,  max: 11 },   // Japan
    '+82':  { min: 9,  max: 11 },   // South Korea
    '+54':  { min: 10, max: 11 },   // Argentina
    '+55':  { min: 10, max: 11 },   // Brazil
    // 11 digits
    '+86':  { min: 11, max: 11 },   // China
    // 9–12
    '+62':  { min: 9,  max: 12 },   // Indonesia
    // Genuinely variable — will accept a wide range
    '+49':  { min: 6,  max: 13 },   // Germany
    '+358': { min: 5,  max: 12 },   // Finland
    '+43':  { min: 4,  max: 13 },   // Austria
    '+46':  { min: 7,  max: 13 },   // Sweden
    '+32':  { min: 8,  max: 9  }    // Belgium
  };

  function rangeFor(dialCode){ return NSN_BY_CODE[dialCode] || NSN_DEFAULT; }
  function rangeLabel(r){ return r.min === r.max ? r.min + ' digits' : r.min + '–' + r.max + ' digits'; }

  function ensureHintElement(phoneInput){
    // Reuse existing #phone-hint if the page already provides one, otherwise inject a
    // small note directly after the phone input's container.
    var existing = document.getElementById('phone-hint');
    if (existing) return existing;
    var host = phoneInput.closest('.phone-row') || phoneInput.closest('.field') || phoneInput.parentElement;
    if (!host) return null;
    var p = document.createElement('p');
    p.id = 'phone-hint';
    p.style.cssText = 'font-size:.74rem;color:#6B7280;margin-top:.35rem;line-height:1.4;';
    host.parentElement.insertBefore(p, host.nextSibling);
    return p;
  }

  function attach(opts){
    opts = opts || {};
    var ccSel     = opts.phoneCc     || document.getElementById('phone-cc');
    var phoneEl   = opts.phone       || document.getElementById('phone');
    if (!ccSel || !phoneEl) return null;
    var hintEl    = opts.hint        || ensureHintElement(phoneEl);
    var codeAccessor = opts.codeAccessor || function () { return ccSel.value || ''; };

    function applyConstraint(){
      var code = codeAccessor();
      // Values from the life-insurance quote are "+66|Thailand"; strip the country tag.
      if (code.indexOf('|') !== -1) code = code.split('|')[0];
      var range = rangeFor(code);
      phoneEl.setAttribute('maxlength', range.max);
      if (phoneEl.value.length > range.max) phoneEl.value = phoneEl.value.slice(0, range.max);
      if (hintEl) {
        hintEl.textContent = code
          ? 'Enter your phone number without the country code (' + rangeLabel(range) + ').'
          : 'Select the country code above, then enter your local number.';
      }
    }

    ccSel.addEventListener('change', applyConstraint);
    phoneEl.addEventListener('input', function () {
      var max = parseInt(phoneEl.getAttribute('maxlength'), 10) || NSN_DEFAULT.max;
      var cleaned = phoneEl.value.replace(/\D/g, '').slice(0, max);
      if (cleaned !== phoneEl.value) phoneEl.value = cleaned;
    });

    // Initialise straight away in case a code is already selected (or gets pre-selected
    // by other init code before ours has a chance to react to `change`).
    applyConstraint();

    function validate(){
      var code = codeAccessor();
      if (code.indexOf('|') !== -1) code = code.split('|')[0];
      var range = rangeFor(code);
      var digits = (phoneEl.value || '').replace(/\D/g, '');
      if (!code)      return 'Please pick the country code for your phone number.';
      if (!digits)    return 'Please enter your phone number.';
      if (digits.length < range.min || digits.length > range.max) {
        return "That phone number doesn't look right for the country code you picked "
             + '(' + code + ' expects ' + rangeLabel(range) + '). Please check and try again.';
      }
      return null; // valid
    }

    return { validate: validate, apply: applyConstraint };
  }

  root.PhoneNSN = { attach: attach, NSN_BY_CODE: NSN_BY_CODE, NSN_DEFAULT: NSN_DEFAULT };
})(window);
