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

  function switchTab(tabName) {
    railBtns.forEach(b => {
      const isMatch = b.dataset.tab === tabName;
      b.classList.toggle('is-active', isMatch);
      if (isMatch) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    Object.values(views).forEach(v => v.classList.remove('is-active'));
    views[tabName].classList.add('is-active');
  }

  railBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
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
    printBtn: document.getElementById('btn-print-card'),
    relatedTokens: document.getElementById('related-tokens'),
  };

  function showState(state) {
    els.empty.hidden = state !== 'empty';
    els.loading.hidden = state !== 'loading';
    els.error.hidden = state !== 'error';
    els.card.hidden = state !== 'card';
    els.printBtn.hidden = state !== 'card';
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

    renderRelatedTokens(card);
    showState('card');
  }

  // Scryfall marks cards that produce named tokens, or conjure a copy of
  // a specific real card (e.g. Jet Collector → Mox Jet), via `all_parts` —
  // a curated relationship, not text-parsing, so it's reliably accurate
  // where Scryfall has recorded it (not exhaustive for every card with a
  // "create"/"conjure" ability, but covers a large share of them).
  function renderRelatedTokens(card) {
    const parts = (card.all_parts || []).filter(
      p => p.component === 'token' || p.component === 'combo_piece'
    );
    els.relatedTokens.innerHTML = '';
    if (parts.length === 0) {
      els.relatedTokens.hidden = true;
      return;
    }
    parts.forEach(part => {
      const isToken = part.component === 'token';
      const pill = document.createElement('button');
      pill.className = isToken ? 'related-token-pill' : 'related-token-pill related-token-pill--conjured';
      pill.type = 'button';
      pill.textContent = isToken ? `◈ ${part.name}` : `✦ Conjures: ${part.name}`;
      pill.title = isToken
        ? `View & print the ${part.name} token`
        : `View & print a copy of ${part.name}`;
      pill.addEventListener('click', () => openRelatedToken(part));
      els.relatedTokens.appendChild(pill);
    });
    els.relatedTokens.hidden = false;
  }

  async function openRelatedToken(part) {
    switchTab('token');
    tokenSearchStatus.textContent = 'Loading…';
    try {
      const res = await fetch(part.uri);
      if (!res.ok) throw new Error(`Scryfall error ${res.status}`);
      const relatedCard = await res.json();
      const face = relatedCard.image_uris ? relatedCard : (relatedCard.card_faces && relatedCard.card_faces[0]);
      const imageUris = face && face.image_uris;
      const imgSrc = imageUris ? (imageUris.normal || imageUris.large || imageUris.small) : '';
      setTokenPreview({ imgSrc, name: relatedCard.name, typeline: relatedCard.type_line || '' });
      tokenSearchStatus.textContent = '';
      clearActiveResultRow();
    } catch (err) {
      tokenSearchStatus.textContent = 'Could not load that card. Try again.';
      console.error(err);
    }
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

    // Switch the DOM itself to show only the print card, rather than
    // relying on @media print. Some print pipelines (RawBT included)
    // capture the on-screen DOM as-is instead of honoring media types,
    // so this guarantees the print card is what gets captured no matter
    // how the underlying print pipeline works.
    document.body.classList.add('print-mode');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    window.print();

    // Safety net: if 'afterprint' never fires (some Android print flows
    // skip it), restore the normal view after a few seconds anyway.
    clearTimeout(printModeTimeout);
    printModeTimeout = setTimeout(exitPrintMode, 15000);
  }

  let printModeTimeout;
  function exitPrintMode() {
    document.body.classList.remove('print-mode');
    clearTimeout(printModeTimeout);
  }
  window.addEventListener('afterprint', exitPrintMode);
  document.getElementById('btn-done-printing').addEventListener('click', exitPrintMode);

  document.getElementById('btn-print-card').addEventListener('click', () => {
    printImageWithMeta(els.img.src, {
      name: els.name.textContent,
      typeline: els.typeline.textContent,
      costline: els.costline.textContent,
    });
  });

  // ---------- Token search & preview ----------
  const tokenSearchInput = document.getElementById('token-search-input');
  const tokenSearchBtn = document.getElementById('token-search-btn');
  const tokenResultsEl = document.getElementById('token-results');
  const tokenSearchStatus = document.getElementById('token-search-status');
  const tokenPreviewImage = document.getElementById('token-preview-image');
  const tokenPreviewName = document.getElementById('token-preview-name');
  const tokenPreviewTypeline = document.getElementById('token-preview-typeline');

  let currentTokenPreview = {
    imgSrc: tokenPreviewImage.src,
    name: tokenPreviewName.textContent,
    typeline: tokenPreviewTypeline.textContent,
  };

  function setTokenPreview({ imgSrc, name, typeline }) {
    tokenPreviewImage.src = imgSrc;
    tokenPreviewImage.alt = name;
    tokenPreviewName.textContent = name;
    tokenPreviewTypeline.textContent = typeline || '';
    currentTokenPreview = { imgSrc, name, typeline: typeline || '' };
  }

  function clearActiveResultRow() {
    tokenResultsEl.querySelectorAll('.token-result-row').forEach(r => r.classList.remove('is-active'));
  }

  function setActiveResultRow(row) {
    clearActiveResultRow();
    row.classList.add('is-active');
  }

  // Wire the always-present default emblem row.
  const defaultEmblemRow = tokenResultsEl.querySelector('[data-default-emblem]');
  defaultEmblemRow.addEventListener('click', () => {
    setTokenPreview({
      imgSrc: 'https://i0.wp.com/mtgazone.com/wp-content/uploads/2019/05/factory-of-momir-vig-emblem.png?w=347&ssl=1',
      name: 'Momir Vig, Simic Visionary — Emblem',
      typeline: 'Emblem',
    });
    setActiveResultRow(defaultEmblemRow);
  });

  async function searchTokens(term) {
    if (!term.trim()) return;
    tokenSearchStatus.textContent = 'Searching…';
    const query = `is:token ${term}`;
    const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&order=name&unique=cards`;
    try {
      const res = await fetch(url);
      if (res.status === 404) {
        tokenSearchStatus.textContent = `No tokens found matching "${term}".`;
        clearSearchResultRows();
        return;
      }
      if (!res.ok) throw new Error(`Scryfall error ${res.status}`);
      const data = await res.json();
      renderTokenResults(data.cards.slice(0, 20));
      tokenSearchStatus.textContent = data.total_cards > 20
        ? `Showing 20 of ${data.total_cards} — refine your search for more.`
        : `${data.total_cards} match${data.total_cards === 1 ? '' : 'es'}.`;
    } catch (err) {
      tokenSearchStatus.textContent = 'Could not reach the card database. Check your connection and try again.';
      console.error(err);
    }
  }

  function clearSearchResultRows() {
    tokenResultsEl.querySelectorAll('.token-result-row:not([data-default-emblem])').forEach(r => r.remove());
  }

  function renderTokenResults(cards) {
    clearSearchResultRows();
    cards.forEach(card => {
      const face = card.image_uris ? card : (card.card_faces && card.card_faces[0]);
      const imageUris = face && face.image_uris;
      const thumbSrc = imageUris ? (imageUris.small || imageUris.normal) : '';
      const fullSrc = imageUris ? (imageUris.normal || imageUris.large || imageUris.small) : '';

      const row = document.createElement('button');
      row.className = 'token-result-row';
      row.type = 'button';
      row.innerHTML = `<img src="${thumbSrc}" alt=""><span></span>`;
      row.querySelector('span').textContent = card.name;
      row.addEventListener('click', () => {
        setTokenPreview({ imgSrc: fullSrc, name: card.name, typeline: card.type_line || '' });
        setActiveResultRow(row);
      });
      tokenResultsEl.appendChild(row);
    });
  }

  tokenSearchBtn.addEventListener('click', () => searchTokens(tokenSearchInput.value));
  tokenSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchTokens(tokenSearchInput.value);
  });

  document.getElementById('btn-print-token').addEventListener('click', () => {
    printImageWithMeta(currentTokenPreview.imgSrc, {
      name: currentTokenPreview.name,
      typeline: currentTokenPreview.typeline,
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
