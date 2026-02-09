/* ==========================================================================
   SIGHT WORD FLASHCARDS — APP
   Vanilla JS, no dependencies
   ========================================================================== */

(() => {
  'use strict';

  /* ---------- Constants ---------- */
  const STORAGE_KEY = 'flashcards_v1';
  const CARD_COLORS = ['#FF6B6B', '#FF8FA3', '#FFB830', '#B197FC', '#74C0FC', '#63E6BE'];
  const EMPTY_CARD_COUNT = 2;
  const SWIPE_THRESHOLD = 80;       // px
  const VELOCITY_THRESHOLD = 0.4;   // px/ms
  const MAX_ROTATION_DEG = 15;
  const FLY_DURATION = 400;         // ms

  const DEFAULT_WORDS = [
    'she','he','the','to','is','for','am','we','I','a','see','can',
    'in','me','like','my','it','look','you','an','as','and','they',
    'not','on','do','did','said','man','its','no','go','yes','down',
    'where','here'
  ];

  const STICKER_POOL = [
    '🐶','🐱','🐰','🦊','🐻','🦁','🐼','🐸','🐵','🦄',
    '🌈','⭐','🌸','🌺','🍀','🌻','🦋','🐞','🌙','☀️',
    '🍓','🍕','🍩','🧁','🍭','🎂','🍉','🍎',
    '🎈','🎨','🎸','🚀','🎪','🏆','👑','💎','🎯','🎠'
  ];

  const STREAK_MILESTONES = { 3: '🔥', 5: '⚡', 8: '🌟' };

  const MASTERY_LEVELS = [
    { threshold: 0, cls: '' },
    { threshold: 2, cls: 'card--mastery-1' },
    { threshold: 4, cls: 'card--mastery-2' },
    { threshold: 6, cls: 'card--mastery-3' },
    { threshold: 8, cls: 'card--mastery-4' },
  ];

  const DEFAULT_REWARDS = { streak: true, stickers: true, mastery: true, skipMastered: false };

  /* ---------- State ---------- */
  const State = {
    childName: 'Luna',
    words: [],          // { id, text, color }
    stickers: [],       // { emoji, date }
    mastery: {},        // word.id → correctCount
    theme: 'candy',
    rewards: { ...DEFAULT_REWARDS },
    currentScreen: 'grid',
    // Play session (ephemeral)
    deck: [],
    currentIndex: 0,
    totalCards: 0,
    correctFirst: 0,
    seen: new Set(),    // ids already attempted this round
    streak: 0,
  };

  /* ---------- DOM References ---------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {};

  function cacheDom() {
    els.app = $('#app');
    els.childName = $('#childName');
    els.headerTitle = $('.header__title');
    els.screenGrid = $('#screenGrid');
    els.screenPlay = $('#screenPlay');
    els.screenCongrats = $('#screenCongrats');
    els.cardGrid = $('#cardGrid');
    els.playBtn = $('#playBtn');
    els.backBtn = $('#backBtn');
    els.cardStack = $('#cardStack');
    els.progressBar = $('#progressBar');
    els.progressText = $('#progressText');
    els.hintLeft = $('#hintLeft');
    els.hintRight = $('#hintRight');
    els.confettiCanvas = $('#confettiCanvas');
    els.congratsContent = $('#congratsContent');
    els.congratsName = $('#congratsName');
    els.congratsStats = $('#congratsStats');
    els.playAgainBtn = $('#playAgainBtn');
    els.backToGridBtn = $('#backToGridBtn');
    els.nameModal = $('#nameModal');
    els.modalBackdrop = $('#modalBackdrop');
    els.nameInput = $('#nameInput');
    els.nameSave = $('#nameSave');
    // Settings
    els.settingsBtn = $('#settingsBtn');
    // Stickers
    els.stickerBtn = $('#stickerBtn');
    els.stickerCount = $('#stickerCount');
    els.stickerModal = $('#stickerModal');
    els.stickerBackdrop = $('#stickerBackdrop');
    els.stickerSheetName = $('#stickerSheetName');
    els.stickerSheetCount = $('#stickerSheetCount');
    els.stickerGrid = $('#stickerGrid');
    els.stickerClose = $('#stickerClose');
    // Control panel
    els.controlModal = $('#controlModal');
    els.controlBackdrop = $('#controlBackdrop');
    els.themeOptions = $('#themeOptions');
    els.toggleStreak = $('#toggleStreak');
    els.toggleStickers = $('#toggleStickers');
    els.toggleMastery = $('#toggleMastery');
    els.toggleSkipMastered = $('#toggleSkipMastered');
    els.controlClose = $('#controlClose');
    els.controlNameInput = $('#controlNameInput');
    els.controlShareBtn = $('#controlShareBtn');
    // Streak meter
    els.streakMeter = $('#streakMeter');
    els.streakDots = $$('.streak-dot');
  }


  /* ==========================================================================
     PERSISTENCE
     ========================================================================== */

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        State.childName = data.childName || 'Luna';
        State.words = Array.isArray(data.words) ? data.words : [];
        State.stickers = Array.isArray(data.stickers) ? data.stickers : [];
        State.mastery = data.mastery || {};
        State.theme = data.theme || 'candy';
        // Migrate old figjam theme to notebook
        if (State.theme === 'figjam') State.theme = 'notebook';
        State.rewards = { ...DEFAULT_REWARDS, ...(data.rewards || {}) };
      } else {
        // First load — populate with default words
        State.words = DEFAULT_WORDS.map(text => ({
          id: generateId(),
          text,
          color: assignColor(),
        }));
        saveState();
      }
    } catch (e) {
      console.warn('Could not load state:', e);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        childName: State.childName,
        words: State.words,
        stickers: State.stickers,
        mastery: State.mastery,
        theme: State.theme,
        rewards: State.rewards,
      }));
    } catch (e) {
      console.warn('Could not save state:', e);
    }
  }


  /* ==========================================================================
     URL PARAMS (Shareable Links)
     ========================================================================== */

  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const name = params.get('name');
    const wordsParam = params.get('words');

    if (!name && !wordsParam) return;

    // Preserve existing stickers/mastery/theme from localStorage
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        State.stickers = Array.isArray(data.stickers) ? data.stickers : [];
        State.mastery = data.mastery || {};
        State.theme = data.theme || 'candy';
        State.rewards = { ...DEFAULT_REWARDS, ...(data.rewards || {}) };
      }
    } catch (e) { /* ignore */ }

    if (name) {
      State.childName = decodeURIComponent(name).trim().slice(0, 20);
    }

    if (wordsParam) {
      const wordList = [...new Set(
        decodeURIComponent(wordsParam)
          .split(',')
          .map(w => w.trim().toLowerCase())
          .filter(w => w.length > 0 && w.length <= 20)
      )];
      State.words = wordList.map(text => ({
        id: generateId(),
        text,
        color: assignColor(),
      }));
      // Reset mastery for new word set
      State.mastery = {};
    }

    saveState();

    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
  }

  function generateShareUrl() {
    const base = window.location.origin + window.location.pathname;
    const name = encodeURIComponent(State.childName);
    const words = State.words.map(w => w.text.toLowerCase()).join(',');
    return `${base}?name=${name}&words=${encodeURIComponent(words)}`;
  }

  function shareWords() {
    const url = generateShareUrl();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        showToast('Link copied to clipboard! 📋');
      }).catch(() => {
        fallbackCopy(url);
      });
    } else {
      fallbackCopy(url);
    }
  }

  function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast('Link copied to clipboard! 📋');
    } catch (e) {
      showToast('Could not copy link');
    }
    document.body.removeChild(textarea);
  }

  function showToast(msg) {
    const existing = $('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('toast--visible');
    });

    setTimeout(() => {
      toast.classList.remove('toast--visible');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
      // Fallback removal
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 500);
    }, 2000);
  }


  /* ==========================================================================
     THEME SYSTEM
     ========================================================================== */

  function applyTheme(theme) {
    State.theme = theme;
    document.body.className = `theme-${theme}`;

    // Update meta theme-color
    const meta = $('meta[name="theme-color"]');
    if (meta) {
      const colors = { candy: '#FFF8F0', win95: '#008000', notebook: '#E6E8E6' };
      meta.content = colors[theme] || '#FFF8F0';
    }

    saveState();
  }


  /* ==========================================================================
     COLOR ASSIGNMENT
     ========================================================================== */

  let lastColorIndex = -1;

  function assignColor() {
    let idx;
    do {
      idx = Math.floor(Math.random() * CARD_COLORS.length);
    } while (idx === lastColorIndex && CARD_COLORS.length > 1);
    lastColorIndex = idx;
    return CARD_COLORS[idx];
  }

  function randomRotation() {
    return (Math.random() - 0.5) * 6; // ±3 degrees
  }

  function generateId() {
    return 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  }


  /* ==========================================================================
     MASTERY
     ========================================================================== */

  function getMasteryLevel(wordId) {
    const count = State.mastery[wordId] || 0;
    for (let i = MASTERY_LEVELS.length - 1; i >= 0; i--) {
      if (count >= MASTERY_LEVELS[i].threshold) return i;
    }
    return 0;
  }

  function getMasteryClass(wordId) {
    if (!State.rewards.mastery) return '';
    const level = getMasteryLevel(wordId);
    return MASTERY_LEVELS[level].cls;
  }


  /* ==========================================================================
     GRID VIEW
     ========================================================================== */

  function renderGrid(animate = false) {
    els.cardGrid.innerHTML = '';

    // Filled cards
    State.words.forEach((word, i) => {
      const card = createFilledCard(word);
      if (animate) {
        card.classList.add('card--entering');
        card.style.animationDelay = `${i * 60}ms`;
      }
      els.cardGrid.appendChild(card);
    });

    // Empty cards
    for (let i = 0; i < EMPTY_CARD_COUNT; i++) {
      const empty = createEmptyCard();
      if (animate) {
        empty.classList.add('card--entering');
        empty.style.animationDelay = `${(State.words.length + i) * 60}ms`;
      }
      els.cardGrid.appendChild(empty);
    }

    updatePlayButton();
  }

  function createFilledCard(word) {
    const card = document.createElement('div');
    card.className = 'card card--filled';
    card.style.setProperty('--card-bg', word.color);
    card.style.setProperty('--card-rotation', `${randomRotation()}deg`);
    card.dataset.id = word.id;

    // Mastery class
    const masteryClass = getMasteryClass(word.id);
    if (masteryClass) card.classList.add(masteryClass);

    const span = document.createElement('span');
    span.className = 'card__word';
    span.textContent = word.text;
    card.appendChild(span);

    const del = document.createElement('button');
    del.className = 'card__delete';
    del.setAttribute('aria-label', `Delete ${word.text}`);
    del.textContent = '✕';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteWord(word.id, card);
    });
    card.appendChild(del);

    return card;
  }

  function createEmptyCard() {
    const card = document.createElement('div');
    card.className = 'card card--empty';
    card.style.setProperty('--card-rotation', `${randomRotation()}deg`);

    card.addEventListener('click', () => startEditing(card));

    return card;
  }

  function startEditing(card) {
    if (card.classList.contains('editing')) return;

    card.classList.add('editing');

    const input = document.createElement('input');
    input.className = 'card__input';
    input.type = 'text';
    input.maxLength = 20;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Type a sight word');
    card.appendChild(input);

    // Focus with slight delay so mobile keyboard opens
    requestAnimationFrame(() => {
      input.focus();
    });

    // Handle enter
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
    });

    // Handle blur — save the word
    input.addEventListener('blur', () => {
      const text = (input.value || '').trim().toLowerCase();

      if (text && text.length > 0 && text.length <= 20) {
        // Check for duplicates
        const exists = State.words.some(w => w.text === text);
        if (!exists) {
          const word = { id: generateId(), text, color: assignColor() };
          State.words.push(word);
          saveState();
          renderGrid(false);

          // Animate just the new card
          const newCard = els.cardGrid.querySelector(`[data-id="${word.id}"]`);
          if (newCard) {
            newCard.classList.add('card--entering');
          }
          return;
        }
      }

      // Revert to empty state
      card.classList.remove('editing');
      input.remove();
    });
  }

  function deleteWord(id, cardEl) {
    cardEl.classList.add('card--removing');
    cardEl.addEventListener('animationend', () => {
      State.words = State.words.filter(w => w.id !== id);
      // Clean up mastery for deleted word
      delete State.mastery[id];
      saveState();
      renderGrid(false);
    }, { once: true });
  }

  function updatePlayButton() {
    const disabled = State.words.length === 0;
    els.playBtn.disabled = disabled;
    els.playBtn.querySelector('.play-btn__label').textContent =
      disabled ? 'Add words first!' : "Let's Play!";
  }


  /* ==========================================================================
     NAME EDITING
     ========================================================================== */

  function updateNameDisplays() {
    els.childName.textContent = State.childName;
    els.congratsName.textContent = State.childName;
    document.title = `${State.childName}'s Words`;
  }

  function openNameModal() {
    els.nameModal.classList.remove('hidden');
    els.nameInput.value = State.childName;
    requestAnimationFrame(() => {
      els.nameInput.focus();
      els.nameInput.select();
    });
  }

  function closeNameModal() {
    els.nameModal.classList.add('hidden');
  }

  function saveName() {
    const name = els.nameInput.value.trim();
    if (name && name.length > 0) {
      State.childName = name;
      saveState();
      updateNameDisplays();
    }
    closeNameModal();
  }


  /* ==========================================================================
     STICKER COLLECTION
     ========================================================================== */

  function earnSticker() {
    if (!State.rewards.stickers) return null;
    const emoji = STICKER_POOL[Math.floor(Math.random() * STICKER_POOL.length)];
    const sticker = { emoji, date: new Date().toISOString() };
    State.stickers.push(sticker);
    saveState();
    updateStickerCount();
    return sticker;
  }

  function updateStickerCount() {
    if (els.stickerCount) {
      els.stickerCount.textContent = State.stickers.length;
    }
    // Show/hide sticker button based on reward toggle
    if (els.stickerBtn) {
      els.stickerBtn.style.visibility = State.rewards.stickers ? 'visible' : 'hidden';
    }
  }

  function showStickerReveal(sticker) {
    if (!sticker) return;

    // Remove any existing reveal
    const existing = els.congratsContent.querySelector('.sticker-reveal');
    if (existing) existing.remove();

    const reveal = document.createElement('div');
    reveal.className = 'sticker-reveal';

    const card = document.createElement('div');
    card.className = 'sticker-reveal__card';
    card.textContent = '?';
    reveal.appendChild(card);

    const label = document.createElement('p');
    label.className = 'sticker-reveal__label';
    label.textContent = 'New sticker!';
    reveal.appendChild(label);

    // Insert before stats
    els.congratsStats.parentNode.insertBefore(reveal, els.congratsStats);

    // Reveal after delay
    setTimeout(() => {
      card.textContent = sticker.emoji;
      card.classList.add('sticker-reveal__card--revealed');
    }, 800);
  }

  function openStickerSheet() {
    els.stickerSheetName.textContent = `${State.childName}'s Stickers`;
    els.stickerSheetCount.textContent = `${State.stickers.length} collected`;
    renderStickerGrid();
    els.stickerModal.classList.remove('hidden');
  }

  function closeStickerSheet() {
    els.stickerModal.classList.add('hidden');
  }

  function renderStickerGrid() {
    els.stickerGrid.innerHTML = '';
    const totalSlots = Math.max(30, State.stickers.length);

    for (let i = 0; i < totalSlots; i++) {
      const slot = document.createElement('div');
      if (i < State.stickers.length) {
        slot.className = 'sticker-slot sticker-slot--filled';
        slot.textContent = State.stickers[i].emoji;
        slot.style.animationDelay = `${i * 40}ms`;
      } else {
        slot.className = 'sticker-slot sticker-slot--empty';
      }
      els.stickerGrid.appendChild(slot);
    }
  }


  /* ==========================================================================
     SCREEN TRANSITIONS
     ========================================================================== */

  function showScreen(screen) {
    const screens = [els.screenGrid, els.screenPlay, els.screenCongrats];
    screens.forEach(s => {
      s.classList.add('hidden');
      s.classList.remove('entering', 'exiting');
    });

    const target = screen === 'grid' ? els.screenGrid
      : screen === 'play' ? els.screenPlay
      : els.screenCongrats;

    target.classList.remove('hidden');
    target.classList.add('entering');

    // Show/hide header
    const header = $('.header');
    if (screen === 'grid') {
      header.classList.remove('hidden');
    } else {
      header.classList.add('hidden');
    }

    State.currentScreen = screen;

    // Clean up entering class after animation
    target.addEventListener('animationend', () => {
      target.classList.remove('entering');
    }, { once: true });
  }


  /* ==========================================================================
     PLAY MODE
     ========================================================================== */

  function startPlay() {
    if (State.words.length === 0) return;

    // Build deck — filter out mastered if toggle is on
    let playWords = [...State.words];
    if (State.rewards.skipMastered) {
      playWords = playWords.filter(w => getMasteryLevel(w.id) < 4);
      if (playWords.length === 0) {
        showToast('All words mastered! Turn off "Skip Mastered" to play again.');
        return;
      }
    }

    State.deck = shuffle(playWords);
    State.currentIndex = 0;
    State.totalCards = playWords.length;
    State.correctFirst = 0;
    State.seen = new Set();
    State.streak = 0;

    showScreen('play');
    renderPlayCard();
    updateProgress();
    updateStreakMeter(0);
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function renderPlayCard() {
    els.cardStack.innerHTML = '';
    els.hintLeft.classList.remove('visible');
    els.hintRight.classList.remove('visible');

    if (State.deck.length === 0) {
      showCongrats();
      return;
    }

    const word = State.deck[0];
    const card = document.createElement('div');
    card.className = 'play-card play-card--dealing';
    card.style.setProperty('--card-bg', word.color);
    card.dataset.id = word.id;

    // Mastery class on play card
    const masteryClass = getMasteryClass(word.id);
    if (masteryClass) {
      card.classList.add(masteryClass.replace('card--', 'play-card--'));
    }

    const wordEl = document.createElement('span');
    wordEl.className = 'play-card__word';
    wordEl.textContent = word.text;
    card.appendChild(wordEl);

    // Right overlay (correct)
    const overlayRight = document.createElement('div');
    overlayRight.className = 'play-card__overlay play-card__overlay--right';
    overlayRight.textContent = '✓';
    card.appendChild(overlayRight);

    // Left overlay (wrong)
    const overlayLeft = document.createElement('div');
    overlayLeft.className = 'play-card__overlay play-card__overlay--left';
    overlayLeft.textContent = '✗';
    card.appendChild(overlayLeft);

    els.cardStack.appendChild(card);

    // Attach gesture
    attachSwipeGesture(card);
  }

  function updateProgress() {
    const completed = State.totalCards - State.deck.length;
    const pct = State.totalCards > 0 ? (completed / State.totalCards) * 100 : 0;
    els.progressBar.style.width = `${pct}%`;
    els.progressText.textContent = `${completed} / ${State.totalCards}`;
  }

  function advanceCard(correct) {
    const word = State.deck[0];

    if (correct) {
      // First time seeing this word = correct on first try
      if (!State.seen.has(word.id)) {
        State.correctFirst++;
        // Update mastery
        State.mastery[word.id] = (State.mastery[word.id] || 0) + 1;
        saveState();
      }
      // Remove from deck
      State.deck.shift();

      // Streak
      State.streak++;
      if (State.rewards.streak && STREAK_MILESTONES[State.streak]) {
        triggerStreakCelebration(State.streak);
      }
    } else {
      // Mark as seen (not first try anymore for future correct)
      State.seen.add(word.id);
      // Remove from front, reinsert at random later position
      State.deck.shift();
      const minPos = Math.min(2, State.deck.length);
      const insertPos = minPos + Math.floor(Math.random() * (State.deck.length - minPos + 1));
      State.deck.splice(insertPos, 0, word);

      // Reset streak
      State.streak = 0;
    }

    updateProgress();
    updateStreakMeter(State.streak);

    // Small delay before showing next card
    setTimeout(() => {
      renderPlayCard();
    }, 150);
  }

  function endPlay() {
    showScreen('grid');
    renderGrid(false);
  }


  /* ==========================================================================
     STREAK CELEBRATIONS
     ========================================================================== */

  function triggerStreakCelebration(streak) {
    const emoji = STREAK_MILESTONES[streak];
    if (!emoji) return;

    // Check reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    triggerMiniConfetti();
    showStreakEmoji(emoji);

    // Pulse the card stack
    els.cardStack.classList.add('card-stack--pulse');
    setTimeout(() => els.cardStack.classList.remove('card-stack--pulse'), 600);
  }

  function triggerMiniConfetti() {
    const canvas = document.createElement('canvas');
    canvas.className = 'mini-confetti-canvas';
    els.screenPlay.appendChild(canvas);

    const miniConfetti = new ConfettiEngine(canvas);
    miniConfetti.start(35);

    setTimeout(() => {
      miniConfetti.stop();
      if (canvas.parentNode) canvas.remove();
    }, 2500);
  }

  function showStreakEmoji(emoji) {
    const el = document.createElement('div');
    el.className = 'streak-emoji';
    el.textContent = emoji;
    els.cardStack.appendChild(el);

    el.addEventListener('animationend', () => {
      if (el.parentNode) el.remove();
    }, { once: true });

    // Fallback removal
    setTimeout(() => { if (el.parentNode) el.remove(); }, 1500);
  }


  /* ==========================================================================
     STREAK METER
     ========================================================================== */

  function updateStreakMeter(streak) {
    if (!els.streakMeter) return;

    // Hide meter if streak reward is disabled
    els.streakMeter.style.display = State.rewards.streak ? 'flex' : 'none';

    els.streakDots.forEach(dot => {
      const pos = parseInt(dot.dataset.pos, 10);
      if (pos <= streak) {
        dot.classList.add('streak-dot--active');
      } else {
        dot.classList.remove('streak-dot--active');
      }
    });
  }


  /* ==========================================================================
     SWIPE GESTURE ENGINE
     ========================================================================== */

  function attachSwipeGesture(card) {
    const gesture = {
      active: false,
      intent: null,  // null | 'horizontal' | 'vertical'
      startX: 0,
      startY: 0,
      startTime: 0,
      currentX: 0,
      pointerId: null,
    };

    const overlayRight = card.querySelector('.play-card__overlay--right');
    const overlayLeft = card.querySelector('.play-card__overlay--left');

    card.addEventListener('pointerdown', onDown, { passive: false });

    function onDown(e) {
      if (gesture.active) return;
      gesture.active = true;
      gesture.intent = null;
      gesture.startX = e.clientX;
      gesture.startY = e.clientY;
      gesture.startTime = Date.now();
      gesture.currentX = e.clientX;
      gesture.pointerId = e.pointerId;

      card.setPointerCapture(e.pointerId);
      card.style.transition = 'none';
      card.classList.remove('play-card--dealing');

      card.addEventListener('pointermove', onMove, { passive: false });
      card.addEventListener('pointerup', onUp, { once: true });
      card.addEventListener('pointercancel', onCancel, { once: true });
    }

    function onMove(e) {
      if (!gesture.active) return;

      const dx = e.clientX - gesture.startX;
      const dy = e.clientY - gesture.startY;

      // Determine intent on first significant move
      if (gesture.intent === null) {
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (absDx < 5 && absDy < 5) return; // dead zone

        if (absDy > absDx * 1.5) {
          // Vertical intent — let page scroll
          gesture.intent = 'vertical';
          cleanup();
          return;
        }
        gesture.intent = 'horizontal';
      }

      if (gesture.intent !== 'horizontal') return;
      e.preventDefault();

      gesture.currentX = e.clientX;
      const deltaX = gesture.currentX - gesture.startX;
      const progress = deltaX / (window.innerWidth * 0.5);
      const rotation = progress * MAX_ROTATION_DEG;
      const opacity = Math.max(0.4, 1 - Math.abs(progress) * 0.5);

      card.style.transform = `translateX(${deltaX}px) rotate(${rotation}deg)`;
      card.style.opacity = opacity;

      // Show overlays
      const threshold = 0.3; // show overlay at 30% of threshold
      if (progress > threshold) {
        overlayRight.style.opacity = Math.min((progress - threshold) / 0.5, 0.9);
        overlayLeft.style.opacity = 0;
        els.hintRight.classList.add('visible');
        els.hintLeft.classList.remove('visible');
      } else if (progress < -threshold) {
        overlayLeft.style.opacity = Math.min((Math.abs(progress) - threshold) / 0.5, 0.9);
        overlayRight.style.opacity = 0;
        els.hintLeft.classList.add('visible');
        els.hintRight.classList.remove('visible');
      } else {
        overlayRight.style.opacity = 0;
        overlayLeft.style.opacity = 0;
        els.hintLeft.classList.remove('visible');
        els.hintRight.classList.remove('visible');
      }
    }

    function onUp(e) {
      if (!gesture.active || gesture.intent !== 'horizontal') {
        cleanup();
        return;
      }

      const deltaX = e.clientX - gesture.startX;
      const elapsed = Math.max(Date.now() - gesture.startTime, 1);
      const velocity = deltaX / elapsed;
      const distance = Math.abs(deltaX);

      if (distance > SWIPE_THRESHOLD || Math.abs(velocity) > VELOCITY_THRESHOLD) {
        const direction = deltaX > 0 ? 1 : -1;
        flyOff(card, direction);
      } else {
        springBack(card);
      }

      cleanup();
    }

    function onCancel() {
      springBack(card);
      cleanup();
    }

    function cleanup() {
      gesture.active = false;
      gesture.intent = null;
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerup', onUp);
      card.removeEventListener('pointercancel', onCancel);
    }
  }

  function flyOff(card, direction) {
    const correct = direction === 1;

    card.style.transition = `transform ${FLY_DURATION}ms ease-in, opacity ${FLY_DURATION}ms ease-in`;
    card.style.transform = `translateX(${direction * window.innerWidth * 1.5}px) rotate(${direction * 30}deg)`;
    card.style.opacity = '0';

    card.addEventListener('transitionend', () => {
      advanceCard(correct);
    }, { once: true });

    // Safety timeout in case transitionend doesn't fire
    setTimeout(() => {
      if (card.parentNode) {
        advanceCard(correct);
      }
    }, FLY_DURATION + 100);
  }

  function springBack(card) {
    card.style.transition = `transform 700ms var(--spring), opacity 200ms ease`;

    // Need to read the computed spring value
    card.style.transitionTimingFunction = '';
    card.style.transition = 'transform 700ms, opacity 200ms ease';

    // Use the CSS variable via a class or inline
    requestAnimationFrame(() => {
      card.style.transition = 'none';
      // Force reflow
      card.offsetHeight;
      card.style.transition = 'transform 700ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease';
      card.style.transform = 'translateX(0) rotate(0deg)';
      card.style.opacity = '1';
    });

    // Reset overlays
    const overlayRight = card.querySelector('.play-card__overlay--right');
    const overlayLeft = card.querySelector('.play-card__overlay--left');
    if (overlayRight) overlayRight.style.opacity = 0;
    if (overlayLeft) overlayLeft.style.opacity = 0;
    els.hintLeft.classList.remove('visible');
    els.hintRight.classList.remove('visible');
  }


  /* ==========================================================================
     CONGRATS / CONFETTI
     ========================================================================== */

  let confetti = null;
  let solitaireWin = null;

  function showCongrats() {
    updateNameDisplays();

    // Stats
    els.congratsStats.textContent =
      `${State.correctFirst} out of ${State.totalCards} on the first try!`;

    showScreen('congrats');

    // Trigger content animation
    els.congratsContent.classList.remove('entering');
    void els.congratsContent.offsetHeight; // force reflow
    els.congratsContent.classList.add('entering');

    // Sticker reward
    const sticker = earnSticker();
    showStickerReveal(sticker);

    // Start celebration based on theme
    if (confetti) confetti.stop();
    if (solitaireWin) solitaireWin.stop();

    if (State.theme === 'win95') {
      solitaireWin = new SolitaireWinEngine(els.confettiCanvas);
      solitaireWin.start();
    } else if (State.theme === 'notebook') {
      confetti = new NotebookShapesEngine(els.confettiCanvas);
      confetti.start();
    } else {
      confetti = new ConfettiEngine(els.confettiCanvas);
      confetti.start();
    }
  }

  class ConfettiEngine {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.particles = [];
      this.running = false;
      this.raf = null;
    }

    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.canvas.width = rect.width * window.devicePixelRatio;
      this.canvas.height = rect.height * window.devicePixelRatio;
      this.canvas.style.width = rect.width + 'px';
      this.canvas.style.height = rect.height + 'px';
      this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      this.w = rect.width;
      this.h = rect.height;
    }

    start(count = 140) {
      // Check reduced motion
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      this.resize();
      this.particles = Array.from({ length: count }, () => this.create());
      this.running = true;
      this.loop();
    }

    create() {
      return {
        x: Math.random() * this.w,
        y: -10 - Math.random() * this.h * 0.5,
        w: 6 + Math.random() * 8,
        h: 4 + Math.random() * 6,
        color: CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 6,
        vy: 2 + Math.random() * 5,
        gravity: 0.06 + Math.random() * 0.04,
        opacity: 1,
        shape: Math.random() > 0.4 ? 'rect' : 'circle',
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.02 + Math.random() * 0.03,
      };
    }

    loop() {
      if (!this.running) return;
      this.ctx.clearRect(0, 0, this.w, this.h);

      let alive = false;
      for (const p of this.particles) {
        p.vy += p.gravity;
        p.vx += Math.sin(p.wobble) * 0.15;
        p.wobble += p.wobbleSpeed;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;

        if (p.y > this.h + 30) {
          p.opacity -= 0.03;
        }

        if (p.opacity > 0) {
          alive = true;
          this.draw(p);
        }
      }

      if (alive) {
        this.raf = requestAnimationFrame(() => this.loop());
      } else {
        this.running = false;
      }
    }

    draw(p) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);

      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    stop() {
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.ctx.clearRect(0, 0, this.w, this.h);
    }
  }


  /* ==========================================================================
     SOLITAIRE WIN ENGINE (Win95 theme)
     ========================================================================== */

  class SolitaireWinEngine {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.cards = [];
      this.running = false;
      this.raf = null;
      this.spawnTimer = null;
      this.spawnCount = 0;
    }

    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.canvas.width = rect.width * window.devicePixelRatio;
      this.canvas.height = rect.height * window.devicePixelRatio;
      this.canvas.style.width = rect.width + 'px';
      this.canvas.style.height = rect.height + 'px';
      this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      this.w = rect.width;
      this.h = rect.height;
    }

    start() {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      this.resize();
      // Don't clear — trails are the effect!
      this.ctx.fillStyle = '#008000';
      this.ctx.fillRect(0, 0, this.w, this.h);
      this.cards = [];
      this.running = true;
      this.spawnCount = 0;

      // Spawn cards over time
      this.spawnTimer = setInterval(() => {
        if (this.spawnCount >= 30) {
          clearInterval(this.spawnTimer);
          return;
        }
        this.cards.push(this.createCard());
        this.spawnCount++;
      }, 100);

      this.loop();

      // Auto-stop after 5 seconds
      setTimeout(() => this.stop(), 5000);
    }

    createCard() {
      const suits = ['♠', '♥', '♦', '♣'];
      const suitColors = { '♠': '#000', '♥': '#FF0000', '♦': '#FF0000', '♣': '#000' };
      const suit = suits[Math.floor(Math.random() * suits.length)];
      const fromLeft = Math.random() > 0.5;

      return {
        x: fromLeft ? 20 : this.w - 50,
        y: 10 + Math.random() * 30,
        vx: fromLeft ? 2 + Math.random() * 4 : -(2 + Math.random() * 4),
        vy: -2 - Math.random() * 4,
        gravity: 0.15,
        w: 36,
        h: 50,
        suit,
        suitColor: suitColors[suit],
        bounces: 0,
      };
    }

    loop() {
      if (!this.running) return;

      // DON'T clear — this creates the trail effect
      for (const c of this.cards) {
        c.vy += c.gravity;
        c.x += c.vx;
        c.y += c.vy;

        // Bounce off bottom
        if (c.y + c.h > this.h && c.vy > 0) {
          c.vy = -c.vy * 0.85;
          c.y = this.h - c.h;
          c.bounces++;
        }

        // Draw card with trail
        if (c.x > -c.w && c.x < this.w + c.w && c.bounces < 8) {
          this.drawCard(c);
        }
      }

      this.raf = requestAnimationFrame(() => this.loop());
    }

    drawCard(c) {
      const ctx = this.ctx;
      // Card body
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      // Border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(c.x, c.y, c.w, c.h);
      // Suit
      ctx.fillStyle = c.suitColor;
      ctx.font = '16px VT323, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(c.suit, c.x + c.w / 2, c.y + c.h / 2 + 6);
    }

    stop() {
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      if (this.spawnTimer) clearInterval(this.spawnTimer);
      this.ctx.clearRect(0, 0, this.w, this.h);
    }
  }


  /* ==========================================================================
     NOTEBOOK SHAPES ENGINE (Notebook theme)
     ========================================================================== */

  class NotebookShapesEngine {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.shapes = [];
      this.running = false;
      this.raf = null;
    }

    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.canvas.width = rect.width * window.devicePixelRatio;
      this.canvas.height = rect.height * window.devicePixelRatio;
      this.canvas.style.width = rect.width + 'px';
      this.canvas.style.height = rect.height + 'px';
      this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      this.w = rect.width;
      this.h = rect.height;
    }

    start(count = 60) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      this.resize();
      this.shapes = Array.from({ length: count }, () => this.create());
      this.running = true;
      this.loop();
    }

    create() {
      const pastelColors = ['#3772FF', '#5B8FFF', '#82ABFF', '#DF2935', '#FDCA40', '#A8D5F2'];
      const shapeTypes = ['circle', 'square', 'triangle', 'diamond'];
      return {
        x: Math.random() * this.w,
        y: this.h + 10 + Math.random() * this.h * 0.3,
        size: 10 + Math.random() * 20,
        color: pastelColors[Math.floor(Math.random() * pastelColors.length)],
        type: shapeTypes[Math.floor(Math.random() * shapeTypes.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 2,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -(1 + Math.random() * 2.5),
        opacity: 0.8 + Math.random() * 0.2,
      };
    }

    loop() {
      if (!this.running) return;
      this.ctx.clearRect(0, 0, this.w, this.h);

      let alive = false;
      for (const s of this.shapes) {
        s.x += s.vx;
        s.y += s.vy;
        s.rotation += s.rotSpeed;

        if (s.y < -30) {
          s.opacity -= 0.02;
        }

        if (s.opacity > 0) {
          alive = true;
          this.drawShape(s);
        }
      }

      if (alive) {
        this.raf = requestAnimationFrame(() => this.loop());
      } else {
        this.running = false;
      }
    }

    drawShape(s) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = s.opacity;
      ctx.translate(s.x, s.y);
      ctx.rotate((s.rotation * Math.PI) / 180);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;

      const r = s.size / 2;

      switch (s.type) {
        case 'circle':
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'square':
          ctx.strokeRect(-r, -r, s.size, s.size);
          break;
        case 'triangle':
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.lineTo(r, r);
          ctx.lineTo(-r, r);
          ctx.closePath();
          ctx.stroke();
          break;
        case 'diamond':
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.lineTo(r, 0);
          ctx.lineTo(0, r);
          ctx.lineTo(-r, 0);
          ctx.closePath();
          ctx.stroke();
          break;
      }

      ctx.restore();
    }

    stop() {
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.ctx.clearRect(0, 0, this.w, this.h);
    }
  }


  /* ==========================================================================
     CONTROL PANEL
     ========================================================================== */

  function openControlPanel() {
    // Sync UI to current state
    els.controlNameInput.value = State.childName;
    els.toggleStreak.checked = State.rewards.streak;
    els.toggleStickers.checked = State.rewards.stickers;
    els.toggleMastery.checked = State.rewards.mastery;
    els.toggleSkipMastered.checked = State.rewards.skipMastered;

    // Update theme options
    const btns = els.themeOptions.querySelectorAll('.theme-option');
    btns.forEach(btn => {
      btn.classList.toggle('theme-option--active', btn.dataset.theme === State.theme);
    });

    els.controlModal.classList.remove('hidden');
  }

  function closeControlPanel() {
    // Read name input
    const name = (els.controlNameInput.value || '').trim();
    if (name && name.length > 0) {
      State.childName = name;
      updateNameDisplays();
    }

    // Read toggles
    State.rewards.streak = els.toggleStreak.checked;
    State.rewards.stickers = els.toggleStickers.checked;
    State.rewards.mastery = els.toggleMastery.checked;
    State.rewards.skipMastered = els.toggleSkipMastered.checked;
    saveState();

    els.controlModal.classList.add('hidden');

    // Re-render grid to reflect mastery toggle changes
    renderGrid(false);
    updateStickerCount();
  }

  function bindControlPanel() {
    // Theme buttons
    els.themeOptions.addEventListener('click', (e) => {
      const btn = e.target.closest('.theme-option');
      if (!btn) return;
      const theme = btn.dataset.theme;
      applyTheme(theme);

      // Update active state
      els.themeOptions.querySelectorAll('.theme-option').forEach(b => {
        b.classList.toggle('theme-option--active', b.dataset.theme === theme);
      });
    });

    // Share button in settings
    els.controlShareBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      shareWords();
    });

    // Close button
    els.controlClose.addEventListener('click', closeControlPanel);
    els.controlBackdrop.addEventListener('click', closeControlPanel);
  }


  /* ==========================================================================
     EVENT BINDINGS
     ========================================================================== */

  function bindEvents() {
    // Play button
    els.playBtn.addEventListener('click', startPlay);

    // Back from play
    els.backBtn.addEventListener('click', endPlay);

    // Congrats buttons
    els.playAgainBtn.addEventListener('click', () => {
      if (confetti) confetti.stop();
      if (solitaireWin) solitaireWin.stop();
      startPlay();
    });
    els.backToGridBtn.addEventListener('click', () => {
      if (confetti) confetti.stop();
      if (solitaireWin) solitaireWin.stop();
      endPlay();
    });

    // Name editing
    els.childName.addEventListener('click', openNameModal);
    els.childName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') openNameModal();
    });
    els.nameSave.addEventListener('click', saveName);
    els.modalBackdrop.addEventListener('click', closeNameModal);
    els.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveName();
      if (e.key === 'Escape') closeNameModal();
    });

    // Settings button
    els.settingsBtn.addEventListener('click', openControlPanel);

    // Sticker sheet
    els.stickerBtn.addEventListener('click', openStickerSheet);
    els.stickerClose.addEventListener('click', closeStickerSheet);
    els.stickerBackdrop.addEventListener('click', closeStickerSheet);

    // Control panel
    bindControlPanel();
  }


  /* ==========================================================================
     INIT
     ========================================================================== */

  function init() {
    cacheDom();
    checkUrlParams();
    loadState();
    applyTheme(State.theme);
    updateNameDisplays();
    updateStickerCount();
    renderGrid(true); // animate on first load
    bindEvents();
    showScreen('grid');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
