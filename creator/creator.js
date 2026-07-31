/*
 * creator/creator.js
 * Initialises all Creator Programme modules:
 *   initCreatorOnboarding()   — wires the Apply CTA (already HTML)
 *   initEarningsCalculator()  — live earnings calculator
 *   initTestimonialsCarousel() — fetch+render testimonials carousel
 *   initCreatorFAQ()          — keyboard-operable FAQ accordion
 *   initPricingFromJSON()     — reconciles pricing cards from /data/pricing.json
 *
 * Called once from a DOMContentLoaded listener at the bottom of this file.
 * Respects prefers-reduced-motion throughout. Degrades gracefully when JS
 * is absent (calculator hides, carousel shows noscript fallback, FAQ stays open).
 */

(function () {
  'use strict';

  /* ── Earnings Calculator constants ─────────────────────────────────────
   * Edit CALC_CONFIG to change rates without touching the UI code.       */
  var CALC_CONFIG = {
    tiers: {
      emerging: { ratePerListen: 0.40, revenueSharePct: 60 },
      verified: { ratePerListen: 0.50, revenueSharePct: 70 },
      heritage: { ratePerListen: 0.65, revenueSharePct: 80 }
    }
  };

  /* ── Formatting helpers ────────────────────────────────────────────── */
  function fmtINR(val) {
    if (val >= 100000) return '₹' + (val / 100000).toFixed(1) + 'L';
    if (val >= 1000)   return '₹' + (val / 1000).toFixed(1) + 'K';
    return '₹' + Math.round(val).toLocaleString('en-IN');
  }
  function fmtListens(val) {
    return Number(val).toLocaleString('en-IN');
  }
  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ════════════════════════════════════════════════════════════════════
     1. EARNINGS CALCULATOR
  ════════════════════════════════════════════════════════════════════ */
  function initEarningsCalculator() {
    var sliderEl   = document.getElementById('calc-listens');
    var sliderVal  = document.getElementById('calc-listens-val');
    var tierSelect = document.getElementById('calc-tier');
    var perListen  = document.getElementById('calc-per-listen');
    var monthly    = document.getElementById('calc-monthly');
    var annual     = document.getElementById('calc-annual');

    if (!sliderEl || !tierSelect || !perListen || !monthly || !annual) return;

    function update() {
      var listens = parseInt(sliderEl.value, 10);
      var tierKey = tierSelect.value;
      var tier    = CALC_CONFIG.tiers[tierKey] || CALC_CONFIG.tiers.verified;
      var mon     = listens * tier.ratePerListen;
      var ann     = mon * 12;

      if (sliderVal) sliderVal.textContent = fmtListens(listens);
      perListen.textContent = '₹' + tier.ratePerListen.toFixed(2);
      monthly.textContent   = fmtINR(mon);
      annual.textContent    = fmtINR(ann);

      /* update aria-valuenow for screen readers */
      sliderEl.setAttribute('aria-valuenow', listens);
    }

    sliderEl.addEventListener('input', update);
    tierSelect.addEventListener('change', update);
    update(); /* initial render */
  }

  /* ════════════════════════════════════════════════════════════════════
     2. CREATOR TESTIMONIALS CAROUSEL
  ════════════════════════════════════════════════════════════════════ */
  function initTestimonialsCarousel() {
    var carousel = document.getElementById('cr-carousel');
    var track    = document.getElementById('cr-carousel-track');
    var dotsWrap = document.getElementById('cr-dots');
    var prevBtn  = document.getElementById('cr-prev');
    var nextBtn  = document.getElementById('cr-next');

    if (!carousel || !track) return;

    var current    = 0;
    var total      = 0;
    var autoTimer  = null;
    var AUTO_DELAY = 5000; /* ms between auto-advances */
    var startX     = 0;
    var dragging   = false;

    /* ── Render testimonials from JSON ── */
    function renderCards(testimonials) {
      total = testimonials.length;
      track.innerHTML = '';

      testimonials.forEach(function (t, i) {
        var initial = t.name.charAt(0).toUpperCase();
        var card = document.createElement('div');
        card.className = 'cr-testimonial-card';
        card.setAttribute('role', 'listitem');
        card.setAttribute('aria-label', 'Testimonial ' + (i + 1) + ' of ' + total);
        card.innerHTML =
          '<div class="cr-testimonial-inner">' +
            '<blockquote class="cr-testimonial-quote" cite="">' +
              escHtml(t.quote) +
            '</blockquote>' +
            '<div class="cr-testimonial-meta">' +
              '<div class="cr-testimonial-avatar" aria-hidden="true">' + escHtml(initial) + '</div>' +
              '<div>' +
                '<div class="cr-testimonial-name">' + escHtml(t.name) + '</div>' +
                '<div class="cr-testimonial-location">' + escHtml(t.location) + '</div>' +
                '<span class="cr-testimonial-tier">' + escHtml(t.tier) + '</span>' +
              '</div>' +
              '<div class="cr-testimonial-listens" aria-label="' + fmtListens(t.avgMonthlyListens) + ' avg listens per month">' +
                '<span class="cr-listen-val">' + fmtListens(t.avgMonthlyListens) + '</span>' +
                '<span class="cr-listen-lbl">avg listens/mo</span>' +
              '</div>' +
            '</div>' +
          '</div>';
        track.appendChild(card);
      });

      /* ── Dots ── */
      if (dotsWrap) {
        dotsWrap.innerHTML = '';
        for (var j = 0; j < total; j++) {
          (function (idx) {
            var dot = document.createElement('button');
            dot.className = 'cr-dot' + (idx === 0 ? ' active' : '');
            dot.setAttribute('role', 'tab');
            dot.setAttribute('aria-label', 'Go to testimonial ' + (idx + 1));
            dot.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
            dot.addEventListener('click', function () { goTo(idx); startAuto(); });
            dotsWrap.appendChild(dot);
          })(j);
        }
      }

      goTo(0);
      startAuto();
    }

    function goTo(idx) {
      if (total === 0) return;
      current = (idx + total) % total;
      var offset = reducedMotion() ? 0 : -current * 100;
      if (reducedMotion()) {
        /* instant swap: hide all, show current */
        var cards = track.querySelectorAll('.cr-testimonial-card');
        cards.forEach(function (c, i) {
          c.style.display = i === current ? '' : 'none';
        });
      } else {
        track.style.transform = 'translateX(' + offset + '%)';
      }
      /* update dots + aria */
      if (dotsWrap) {
        var dots = dotsWrap.querySelectorAll('.cr-dot');
        dots.forEach(function (d, i) {
          d.classList.toggle('active', i === current);
          d.setAttribute('aria-selected', i === current ? 'true' : 'false');
        });
      }
      /* announce to screen readers */
      track.setAttribute('aria-label', 'Testimonial ' + (current + 1) + ' of ' + total);
    }

    function startAuto() {
      if (reducedMotion()) return;
      clearInterval(autoTimer);
      autoTimer = setInterval(function () { goTo(current + 1); }, AUTO_DELAY);
    }
    function stopAuto() { clearInterval(autoTimer); }

    /* ── Controls ── */
    if (prevBtn) prevBtn.addEventListener('click', function () { goTo(current - 1); startAuto(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(current + 1); startAuto(); });

    /* Keyboard navigation inside carousel */
    carousel.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { goTo(current - 1); startAuto(); e.preventDefault(); }
      if (e.key === 'ArrowRight') { goTo(current + 1); startAuto(); e.preventDefault(); }
    });

    /* Auto-pause on hover / focus */
    carousel.addEventListener('mouseenter', stopAuto);
    carousel.addEventListener('mouseleave', startAuto);
    carousel.addEventListener('focusin',  stopAuto);
    carousel.addEventListener('focusout', startAuto);

    /* Touch swipe */
    track.addEventListener('touchstart', function (e) {
      startX  = e.touches[0].clientX;
      dragging = true;
    }, { passive: true });
    track.addEventListener('touchend', function (e) {
      if (!dragging) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) {
        dx < 0 ? goTo(current + 1) : goTo(current - 1);
        startAuto();
      }
      dragging = false;
    }, { passive: true });

    /* ── Fetch testimonials ── */
    fetch('/data/creator-testimonials.json')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) {
        if (data && Array.isArray(data.testimonials) && data.testimonials.length) {
          renderCards(data.testimonials);
        }
      })
      .catch(function () {
        /* Silent fail — static noscript fallback is visible */
        if (track) track.innerHTML = '<p style="text-align:center;padding:32px;font-size:14px;color:var(--txm)">Stories loading… <a href="mailto:creators@naarad.io" style="color:var(--terra)">Email us</a> to hear from our creators.</p>';
      });
  }

  /* ════════════════════════════════════════════════════════════════════
     3. CREATOR FAQ ACCORDION
  ════════════════════════════════════════════════════════════════════ */
  function initCreatorFAQ() {
    var faq = document.getElementById('cr-faq');
    if (!faq) return;

    var items = faq.querySelectorAll('.cr-faq-item');
    items.forEach(function (item) {
      var btn = item.querySelector('.cr-faq-q');
      var panel = btn ? document.getElementById(btn.getAttribute('aria-controls')) : null;
      if (!btn || !panel) return;

      btn.addEventListener('click', function () {
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        /* close all others */
        items.forEach(function (other) {
          var ob = other.querySelector('.cr-faq-q');
          var op = ob ? document.getElementById(ob.getAttribute('aria-controls')) : null;
          if (ob && op) { ob.setAttribute('aria-expanded', 'false'); op.hidden = true; }
        });
        /* toggle this one */
        btn.setAttribute('aria-expanded', String(!expanded));
        panel.hidden = expanded;
      });

      /* Keyboard: Space/Enter handled natively for <button>, but ensure arrow keys work */
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     4. PRICING JSON RECONCILER
     Fetches /data/pricing.json and patches the two sets of pricing cards
     already in the HTML (page-app .pricing-grid and page-features is same
     page-app). Also updates Terms list item for Creator tier.
  ════════════════════════════════════════════════════════════════════ */
  function initPricingFromJSON() {
    fetch('/data/pricing.json')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) {
        if (!data || !Array.isArray(data.tiers)) return;
        var creatorTier = data.tiers.find(function (t) { return t.id === 'creator'; });
        if (!creatorTier) return;

        /* Update every Creator pricing card button label + action */
        var pricingGrids = document.querySelectorAll('.pricing-grid');
        pricingGrids.forEach(function (grid) {
          var cards = grid.querySelectorAll('.price-card');
          cards.forEach(function (card) {
            var nameEl = card.querySelector('.price-name');
            if (!nameEl || nameEl.textContent.trim() !== 'Creator') return;

            /* Fix price display */
            var amtEl = card.querySelector('.price-amt');
            var perEl = card.querySelector('.price-per');
            if (amtEl) amtEl.textContent = creatorTier.price;
            if (perEl) perEl.textContent  = creatorTier.pricePer;

            /* Fix feature list */
            var ul = card.querySelector('.price-list');
            if (ul && Array.isArray(creatorTier.features)) {
              ul.innerHTML = creatorTier.features
                .map(function (f) { return '<li>' + escHtml(f) + '</li>'; })
                .join('');
            }

            /* Fix CTA button */
            var btn = card.querySelector('.price-btn');
            if (btn) {
              btn.textContent   = creatorTier.ctaLabel;
              btn.setAttribute('onclick', creatorTier.ctaAction);
            }
          });
        });

        /* Update Terms of Use Creator description */
        var termsItems = document.querySelectorAll('#page-terms li');
        termsItems.forEach(function (li) {
          if (li.querySelector('strong') && li.querySelector('strong').textContent.includes('Creator')) {
            li.innerHTML = '<strong>Creator:</strong> ' + escHtml(creatorTier.termsDescription || 'Free to join. Earn ' + creatorTier.revenueSharePct + '% revenue share per listen, paid monthly via UPI.');
          }
        });
      })
      .catch(function () { /* silent — HTML fallback already shows correct data */ });
  }

  /* ════════════════════════════════════════════════════════════════════
     5. LAZY-LOAD OBSERVER — reuses site's existing .fade-up pattern
  ════════════════════════════════════════════════════════════════════ */
  function initFadeUps() {
    if (!window.IntersectionObserver) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('vis'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('#page-creator .fade-up').forEach(function (el) { obs.observe(el); });
  }

  /* ── HTML escaper (prevents XSS in dynamically inserted JSON content) */
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ── Bootstrap ─────────────────────────────────────────────────────── */
  function init() {
    initEarningsCalculator();
    initTestimonialsCarousel();
    initCreatorFAQ();
    initPricingFromJSON();
    initFadeUps();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
