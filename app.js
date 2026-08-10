(() => {
  'use strict';

  // ---------- Tab navigation ----------
  const railBtns = document.querySelectorAll('.rail-btn');
  const views = {
    tool: document.getElementById('view-tool'),
    rules: document.getElementById('view-rules'),
    token: document.getElementById('view-token'),
    config: document.getElementById('view-config'),
  };

  railBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      railBtns.forEach(b => { b.classList.remove('is-active'); b.removeAttribute('aria-current'); });
      btn.classList.add('is-active');
      btn.setAttribute('aria-current', 'page');
      Object.values(views).forEach(v => v.classList.remove('is-active'));
      views[btn.dataset.tab].classList.add('is-active');
    });
  });

  // ---------- Keypad / LED display ----------
  const ledDigits = document.getElementById('led-digits');
  let entry = '';

  function renderEntry() {
    ledDigits.textContent = entry.length ? entry : '–';
  }

  document.querySelectorAll('.key').forEach(key => {
    key.addEventListener('click', () => {
      const k = key.dataset.key;
      if (k === 'clear') {
        entry = '';
        renderEntry();
        return;
      }
      if (k === 'enter') {
        if (entry.length === 0) return;
        fetchCard({ cmc: parseInt(entry, 10) });
        return;
      }
      // digit
      if (entry.length < 2) {
        entry += k;
        renderEntry();
      }
    });
  });

  document.getElementById('btn-random').addEventListener('click', () => {
    entry = '';
    renderEntry();
    fetchCard({ cmc: null });
  });

  // ---------- Config state ----------
  const typeToggles = document.querySelectorAll('#type-toggles input');
  const formatToggles = document.querySelectorAll('#format-toggles input');

  function getSelectedTypes() {
    const picked = Array.from(typeToggles).filter(i => i.checked).map(i => i.value);
    return picked.length ? picked : ['creature'];
  }

  function getSelectedFormat() {
    const checked = Array.from(formatToggles).find(i => i.checked);
    return checked ? checked.value : 'paper';
  }

  typeToggles.forEach(input => {
    input.addEventListener('change', () => {
      // Prevent zero types selected — fall back to Creature.
      if (!Array.from(typeToggles).some(i => i.checked)) {
        typeToggles[0].checked = true;
      }
    });
  });

  // ---------- Scryfall lookup ----------
  const els = {
    empty: document.getElementById('result-empty'),
    loading: document.getElementById('result-loading'),
    error: document.getElementById('result-error'),
    errorText: document.getElementById('result-error-text'),
    card: document.getElementById('receipt-card'),
    img: document.getElementById('card-image'),
    name: document.getElementById('card-name'),
    typeline: document.getElementById('card-typeline'),
    costline: document.getElementById('card-costline'),
  };

  function showState(state) {
    els.empty.hidden = state !== 'empty';
    els.loading.hidden = state !== 'loading';
    els.error.hidden = state !== 'error';
    els.card.hidden = state !== 'card';
  }

  function buildQuery({ cmc }) {
    const types = getSelectedTypes();
    const typeClause = types.length > 1
      ? '(' + types.map(t => `t:${t}`).join(' or ') + ')'
      : `t:${types[0]}`;
    const format = getSelectedFormat();
    let q = `${typeClause} game:${format}`;
    if (cmc !== null && cmc !== undefined && !Number.isNaN(cmc)) {
      q += ` cmc:${cmc}`;
    }
    return q;
  }

  async function fetchCard(opts) {
    showState('loading');
    const query = buildQuery(opts);
    const url = `https://api.scryfall.com/cards/random?q=${encodeURIComponent(query)}`;
    try {
      const res = await fetch(url);
      if (res.status === 404) {
        els.errorText.textContent = opts.cmc !== null
          ? `No card found at mana value ${opts.cmc} for the current Card Types / Format. Try another value or loosen Config.`
          : `No card found for the current Card Types / Format. Try loosening Config.`;
        showState('error');
        return;
      }
      if (!res.ok) throw new Error(`Scryfall error ${res.status}`);
      const card = await res.json();
      renderCard(card);
    } catch (err) {
      els.errorText.textContent = 'Could not reach the card database. Check your connection and try again.';
      showState('error');
      console.error(err);
    }
  }

  function renderCard(card) {
    const face = card.image_uris ? card : (card.card_faces && card.card_faces[0]);
    const imageUris = face && face.image_uris;
    const imgSrc = imageUris ? (imageUris.normal || imageUris.large || imageUris.small) : '';

    els.img.src = imgSrc;
    els.img.alt = card.name;
    els.name.textContent = card.name;
    els.typeline.textContent = card.type_line || '';
    const manaCost = card.mana_cost || (card.card_faces && card.card_faces[0].mana_cost) || '';
    const cmcText = `MV ${Math.floor(card.cmc)}${manaCost ? '  ·  ' + manaCost.replace(/[{}]/g, '') : ''}`;
    els.costline.textContent = cmcText;

    showState('card');
  }

  // ---------- Printing ----------
  // Convert a (possibly cross-origin) image URL to a base64 data URL so the
  // print render pass has the pixels already in hand — no dependency on a
  // network fetch completing mid-print, which is what causes blank images.
  async function toDataURL(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function waitForImageLoad(imgEl) {
    if (imgEl.complete && imgEl.naturalWidth > 0) return Promise.resolve();
    return new Promise((resolve) => {
      imgEl.onload = () => resolve();
      imgEl.onerror = () => resolve(); // proceed even if it fails — best effort
    });
  }

  const printArea = document.getElementById('print-area');
  const printImage = document.getElementById('print-image');
  const printName = document.getElementById('print-name');
  const printTypeline = document.getElementById('print-typeline');
  const printCostline = document.getElementById('print-costline');

  async function printImageWithMeta(srcUrl, { name = '', typeline = '', costline = '' } = {}) {
    printName.textContent = name;
    printTypeline.textContent = typeline;
    printCostline.textContent = costline;

    let dataUrl = srcUrl;
    try {
      dataUrl = await toDataURL(srcUrl);
    } catch (err) {
      console.warn('Could not inline image for printing, falling back to direct URL.', err);
    }

    printImage.src = dataUrl;
    await waitForImageLoad(printImage);
    window.print();
  }

  document.getElementById('btn-print-card').addEventListener('click', () => {
    printImageWithMeta(els.img.src, {
      name: els.name.textContent,
      typeline: els.typeline.textContent,
      costline: els.costline.textContent,
    });
  });

  document.getElementById('btn-print-token').addEventListener('click', () => {
    const tokenImg = document.getElementById('token-image');
    printImageWithMeta(tokenImg.src, {
      name: 'Momir Vig, Simic Visionary — Emblem',
    });
  });

  // ---------- Service worker (offline app shell) ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }

  renderEntry();
})();
