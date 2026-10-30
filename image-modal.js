/* ==========================================================================
   image-modal.js
   A small, dependency-free image lightbox (no Bootstrap, no jQuery).

   HOW TO USE
   1. Add class="modal-img" to a link that wraps a thumbnail:
        <a class="modal-img" href="big.png" target="_blank" rel="noopener">
          <img src="big.png" alt="Describe the image">
        </a>
      ...or directly to an <img>:
        <img class="modal-img" src="big.png" alt="Describe the image">
   2. Load css/image-modal.css and js/image-modal.js on the page.
   That's it. Every .modal-img on the page opens in one shared modal, and
   the arrows move between all of them.

   FALLBACK: if JavaScript is off, the link just opens the image in a new
   tab. When JavaScript is on, we stop that and show the modal instead.
   (Ctrl/Cmd/Shift-click and middle-click still open a new tab as usual.)
   ========================================================================== */
(function () {
  'use strict';

  var SELECTOR = '.modal-img';   // the class that marks expandable images
  var FADE_MS = 200;             // must match the CSS opacity transition

  // The shared modal's pieces (built once, the first time it's needed)
  var modal, stage, imgEl, captionEl, countEl, closeBtn, prevBtn, nextBtn;
  var items = [];          // every .modal-img on the page
  var index = 0;           // which one is showing
  var lastTrigger = null;  // the element to give focus back to on close
  var isOpen = false;

  /* ---------- helpers ---------- */

  // Get the full-size image address and the alt text from a trigger element
  function dataFor(el) {
    var inner = el.tagName === 'IMG' ? el : el.querySelector('img');
    var src = el.tagName === 'A' ? el.getAttribute('href')
            : (el.getAttribute('data-full') || el.currentSrc || el.src);
    return { src: src, alt: inner ? (inner.getAttribute('alt') || '') : '' };
  }

  // Make a button with an accessible label (no innerHTML, so nothing can
  // be injected into the page)
  function makeButton(cls, label, glyph) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'imodal-btn ' + cls;
    b.setAttribute('aria-label', label);
    var s = document.createElement('span');
    s.setAttribute('aria-hidden', 'true');   // screen readers use the label
    s.textContent = glyph;
    b.appendChild(s);
    return b;
  }

  /* ---------- build the modal (once) ---------- */

  function build() {
    if (modal) return;

    modal = document.createElement('div');
    modal.className = 'imodal';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'imodal-caption');

    stage = document.createElement('div');
    stage.className = 'imodal-stage';

    imgEl = document.createElement('img');
    imgEl.className = 'imodal-img';
    imgEl.alt = '';
    stage.appendChild(imgEl);

    var bar = document.createElement('div');
    bar.className = 'imodal-bar';
    captionEl = document.createElement('div');
    captionEl.id = 'imodal-caption';
    captionEl.setAttribute('aria-live', 'polite');  // announce on next/prev
    countEl = document.createElement('span');
    countEl.className = 'imodal-count';
    bar.appendChild(captionEl);
    bar.appendChild(countEl);

    closeBtn = makeButton('imodal-close', 'Close image viewer', '×'); // ×
    prevBtn  = makeButton('imodal-prev',  'Previous image', '‹');     // ‹
    nextBtn  = makeButton('imodal-next',  'Next image', '›');         // ›

    modal.appendChild(stage);
    modal.appendChild(bar);
    modal.appendChild(closeBtn);
    modal.appendChild(prevBtn);
    modal.appendChild(nextBtn);
    document.body.appendChild(modal);

    // Buttons
    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', function () { step(-1); });
    nextBtn.addEventListener('click', function () { step(1); });

    // Click the image to toggle between "fit the screen" and "full width"
    imgEl.addEventListener('click', function () {
      imgEl.classList.toggle('is-zoomed');
      stage.scrollTop = 0;
    });

    // Click the dark backdrop (anywhere that isn't the image, caption or a
    // button) to close
    modal.addEventListener('click', function (e) {
      if (!e.target.closest('.imodal-img, .imodal-bar, .imodal-btn')) close();
    });
  }

  /* ---------- show / navigate / close ---------- */

  // Put image number i into the modal
  function show(i) {
    index = (i + items.length) % items.length;      // wrap around the ends
    var d = dataFor(items[index]);

    imgEl.classList.remove('is-ready', 'is-zoomed'); // reset fade + zoom
    imgEl.onload = function () { imgEl.classList.add('is-ready'); };
    imgEl.alt = d.alt;
    imgEl.src = d.src;
    if (imgEl.complete) imgEl.classList.add('is-ready'); // already cached

    captionEl.textContent = d.alt;                   // alt text = caption
    countEl.textContent = items.length > 1
      ? (index + 1) + ' of ' + items.length : '';
    stage.scrollTop = 0;

    // Only one image on the page? Hide the arrows.
    prevBtn.hidden = nextBtn.hidden = items.length < 2;

    // Quietly preload the neighbours so next/prev feels instant
    if (items.length > 1) {
      new Image().src = dataFor(items[(index + 1) % items.length]).src;
      new Image().src = dataFor(items[(index - 1 + items.length) % items.length]).src;
    }
  }

  function step(dir) { if (isOpen) show(index + dir); }

  function open(trigger) {
    build();
    items = Array.prototype.slice.call(document.querySelectorAll(SELECTOR));
    lastTrigger = trigger;
    show(items.indexOf(trigger));

    // Lock page scroll; pad the page by the scrollbar width so nothing jumps
    var sbw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = sbw > 0 ? sbw + 'px' : '';
    document.documentElement.classList.add('imodal-open');

    modal.hidden = false;
    void modal.offsetWidth;            // force a repaint so the fade-in runs
    modal.classList.add('is-open');
    isOpen = true;
    closeBtn.focus();                  // move keyboard focus into the modal
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    modal.classList.remove('is-open');          // start the fade-out
    setTimeout(function () {                    // then hide and clean up
      modal.hidden = true;
      imgEl.removeAttribute('src');
    }, FADE_MS);
    document.documentElement.classList.remove('imodal-open');
    document.body.style.paddingRight = '';
    if (lastTrigger) lastTrigger.focus();       // give focus back
  }

  /* ---------- events ---------- */

  // Open: one click listener for the whole page, so any .modal-img added
  // later works automatically.
  document.addEventListener('click', function (e) {
    // Let Ctrl/Cmd/Shift/Alt-click and middle-click behave normally
    if (e.defaultPrevented || e.button !== 0 ||
        e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var el = e.target.closest(SELECTOR);
    if (!el) return;
    e.preventDefault();                // stop the new-tab fallback
    open(el);
  });

  // Keyboard
  document.addEventListener('keydown', function (e) {
    // Plain <img class="modal-img"> isn't focusable by default, so we make
    // it act like a button (Enter or Space opens it). Links already open
    // with Enter on their own.
    if (!isOpen) {
      var t = e.target;
      if (t.matches && t.matches('img' + SELECTOR) &&
          (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        open(t);
      }
      return;
    }

    if (e.key === 'Escape')          { e.preventDefault(); close(); }
    else if (e.key === 'ArrowLeft')  { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'Tab') {
      // Focus trap: Tab cycles only through the modal's own buttons
      var f = [closeBtn, prevBtn, nextBtn].filter(function (b) { return !b.hidden; });
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!modal.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
  });

  // Make bare <img class="modal-img"> keyboard-friendly and clearly clickable
  function prepBareImages() {
    var imgs = document.querySelectorAll('img' + SELECTOR);
    Array.prototype.forEach.call(imgs, function (im) {
      if (im.closest('a')) return;               // linked ones are already focusable
      im.tabIndex = 0;
      im.setAttribute('role', 'button');
      im.style.cursor = 'zoom-in';
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', prepBareImages);
  } else {
    prepBareImages();
  }
})();
