(() => {
  'use strict';

  const STORAGE_PREFIX = 'obsidian.v1.';
  const DECK_SIZE = 3;
  const MAX_BUILDS = 3;
  const DEFAULT_BUDGET = 14;
  const MIN_BUDGET = 0;
  const MAX_BUDGET = 9999;
  const LEGACY_DECK_SIZE = 6;
  const CATEGORY_NAMES = Object.freeze({
    attack: 'Attack',
    defend: 'Defense',
    heal: 'Healing',
  });
  const CATEGORY_IDS = Object.keys(CATEGORY_NAMES);
  const TOAST_DURATION = 3400;
  const CLASS_IDS = ['knight', 'mage', 'rogue'];
  const COLORS = ['violet', 'teal', 'amber'];
  const DEFAULT_HERO = Object.freeze({
    name: 'Eirin',
    classId: 'knight',
    portrait: 'knight',
    color: 'violet',
    strength: 6,
    agility: 5,
    magic: 4,
    vitality: 5,
  });
  const DEFAULT_DECK = ['iron-strike', 'bulwark', 'restoration'];

  const catalog = [
    {
      id: 'iron-strike',
      name: 'Steel Strike',
      type: 'attack',
      cost: 4,
      incompatibleWith: [],
      icon: 'sword_iron',
      description: 'A trusty blade never fails.',
      rarity: 'Common',
      tags: ['steel', 'weapon'],
      starter: true,
    },
    {
      id: 'flame',
      name: 'Fireball',
      type: 'attack',
      cost: 6,
      incompatibleWith: [],
      icon: 'spell_fireball',
      description: 'Flames from the rift.',
      rarity: 'Rare',
      tags: ['fire', 'magic'],
      starter: false,
    },
    {
      id: 'frost',
      name: 'Ice Lance',
      type: 'attack',
      cost: 5,
      incompatibleWith: [],
      icon: 'spell_ice_lance',
      description: 'Cold takes shape.',
      rarity: 'Uncommon',
      tags: ['ice', 'magic'],
      starter: false,
    },
    {
      id: 'bulwark',
      name: 'Bulwark',
      type: 'defend',
      cost: 4,
      incompatibleWith: [],
      icon: 'shield_iron',
      description: 'Stand unbroken.',
      rarity: 'Common',
      tags: ['shield', 'steel'],
      starter: true,
    },
    {
      id: 'parry',
      name: 'Parry',
      type: 'defend',
      cost: 3,
      incompatibleWith: [],
      icon: 'skill_parry',
      description: 'The perfect moment to defend.',
      rarity: 'Common',
      tags: ['weapon', 'agility'],
      starter: false,
    },
    {
      id: 'restoration',
      name: 'Living Spring',
      type: 'heal',
      cost: 4,
      incompatibleWith: ['curse'],
      icon: 'spell_heal',
      description: 'The healing power of light.',
      rarity: 'Uncommon',
      tags: ['light', 'healing'],
      starter: true,
    },
    {
      id: 'lightning',
      name: 'Thunder’s Call',
      type: 'attack',
      cost: 7,
      incompatibleWith: [],
      icon: 'spell_lightning',
      description: 'Let the skies answer.',
      rarity: 'Rare',
      tags: ['lightning', 'magic'],
      starter: false,
    },
    {
      id: 'charge',
      name: 'Charge',
      type: 'attack',
      cost: 5,
      incompatibleWith: [],
      icon: 'skill_charge',
      description: 'Never retreat.',
      rarity: 'Common',
      tags: ['strength', 'weapon'],
      starter: false,
    },
    {
      id: 'curse',
      name: 'Abyssal Whisper',
      type: 'attack',
      cost: 6,
      incompatibleWith: ['restoration', 'moonlight'],
      icon: 'spell_curse',
      description: 'Dark magic cannot be combined with light-based healing.',
      rarity: 'Epic',
      tags: ['darkness', 'magic'],
      starter: false,
    },
    {
      id: 'aegis',
      name: 'Runic Barrier',
      type: 'defend',
      cost: 6,
      incompatibleWith: [],
      icon: 'spell_shield',
      description: 'A protective circle of ancient runes.',
      rarity: 'Rare',
      tags: ['runes', 'magic'],
      starter: false,
    },
    {
      id: 'potion',
      name: 'Crimson Elixir',
      type: 'heal',
      cost: 3,
      incompatibleWith: [],
      icon: 'potion_red',
      description: 'A final sip of hope.',
      rarity: 'Common',
      tags: ['potion', 'healing'],
      starter: false,
    },
    {
      id: 'moonlight',
      name: 'Moon Charm',
      type: 'heal',
      cost: 5,
      incompatibleWith: ['curse'],
      icon: 'amulet_moon',
      description: 'The light of the guiding moon.',
      rarity: 'Rare',
      tags: ['moon', 'light', 'healing'],
      starter: false,
    },
  ];

  function el(tag, className = '', text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(name, className = '') {
    const img = el('img', `pixel-icon ${className}`.trim());
    img.src = `assets/icons/${name}.png`;
    img.alt = '';
    img.width = 32;
    img.height = 32;
    return img;
  }

  const memoryStore = new Map();
  function readStore(key, fallback) {
    try {
      const value = localStorage.getItem(STORAGE_PREFIX + key);
      return value === null ? memoryStore.get(key) ?? fallback : JSON.parse(value);
    } catch {
      return memoryStore.get(key) ?? fallback;
    }
  }

  function writeStore(key, value) {
    memoryStore.set(key, value);
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch {}
  }

  function validHero(value) {
    if (!value || typeof value !== 'object' || typeof value.name !== 'string')
      return false;
    const name = value.name.normalize('NFKC').trim().replace(/\s+/g, ' ');
    const reserved = [
      'admin',
      'obsidian',
      'dark knight',
      'game master',
      '\u0430\u0434\u043c\u0438\u043d',
      '\u043e\u0431\u0441\u0438\u0434\u0438\u0430\u043d',
      '\u0442\u0435\u043c\u043d\u044b\u0439 \u0440\u044b\u0446\u0430\u0440\u044c',
      '\u043c\u0430\u0441\u0442\u0435\u0440 \u0438\u0433\u0440\u044b',
    ];
    if (
      name.length < 2 ||
      name.length > 18 ||
      !/^[A-Za-z\u0410-\u042f\u0430-\u044f\u0401\u0451][A-Za-z\u0410-\u042f\u0430-\u044f\u0401\u04510-9 '\u2019-]*$/u.test(
        name,
      )
    )
      return false;
    if (reserved.includes(name.toLocaleLowerCase('en-US').replace(/\u0451/g, '\u0435')))
      return false;
    if (!CLASS_IDS.includes(value.classId) || !COLORS.includes(value.color)) return false;
    const requiredSkill = { knight: 'strength', mage: 'magic', rogue: 'agility' }[
      value.classId
    ];
    if (
      value[requiredSkill] < 6 ||
      value.vitality < 3 ||
      value.vitality < Math.ceil(value.strength / 2)
    )
      return false;
    const values = ['strength', 'agility', 'magic', 'vitality'].map((key) => value[key]);
    return (
      values.every((n) => Number.isInteger(n) && n >= 1 && n <= 10) &&
      values.reduce((a, b) => a + b, 0) === 20
    );
  }

  function getDeckTotal(ids) {
    let total = 0;
    for (const id of ids) {
      const card = catalog.find((item) => item.id === id);
      if (card) total += card.cost;
    }
    return total;
  }

  function getDeckConflict(ids) {
    const cards = ids.map((id) => catalog.find((card) => card.id === id)).filter(Boolean);
    for (let first = 0; first < cards.length; first += 1) {
      for (let second = first + 1; second < cards.length; second += 1) {
        const left = cards[first];
        const right = cards[second];
        if (
          left.incompatibleWith?.includes(right.id) ||
          right.incompatibleWith?.includes(left.id)
        ) {
          return `“${left.name}” and “${right.name}” are incompatible.`;
        }
      }
    }
    return '';
  }

  function validBudget(value) {
    return Number.isInteger(value) && value >= MIN_BUDGET && value <= MAX_BUDGET;
  }

  function validDeck(ids, budget) {
    if (
      !Array.isArray(ids) ||
      ids.length !== DECK_SIZE ||
      new Set(ids).size !== DECK_SIZE
    )
      return false;
    if (!ids.every((id) => catalog.some((card) => card.id === id))) return false;
    if (
      !CATEGORY_IDS.every(
        (type) =>
          ids.filter((id) => catalog.find((card) => card.id === id).type === type)
            .length === 1,
      )
    )
      return false;
    if (getDeckConflict(ids)) return false;
    return budget === undefined || (validBudget(budget) && getDeckTotal(ids) <= budget);
  }

  function migrateDeck(ids) {
    if (validDeck(ids))
      return CATEGORY_IDS.map((type) =>
        ids.find((id) => catalog.find((card) => card.id === id).type === type),
      );
    if (
      !Array.isArray(ids) ||
      ids.length !== LEGACY_DECK_SIZE ||
      new Set(ids).size !== LEGACY_DECK_SIZE
    )
      return null;
    if (!ids.every((id) => catalog.some((card) => card.id === id))) return null;

    function choose(index, selected) {
      if (index === CATEGORY_IDS.length) return validDeck(selected) ? selected : null;
      for (const id of ids) {
        if (catalog.find((card) => card.id === id).type !== CATEGORY_IDS[index]) continue;
        const next = [...selected, id];
        if (getDeckConflict(next)) continue;
        const result = choose(index + 1, next);
        if (result) return result;
      }
      return null;
    }
    return choose(0, []);
  }

  const deckConfig = Object.freeze({
    size: DECK_SIZE,
    maxBuilds: MAX_BUILDS,
    defaultBudget: DEFAULT_BUDGET,
    minBudget: MIN_BUDGET,
    maxBudget: MAX_BUDGET,
    categoryNames: CATEGORY_NAMES,
    getTotal: getDeckTotal,
    getConflict: getDeckConflict,
    validate: validDeck,
    migrate: migrateDeck,
  });

  function localizeBuildName(name) {
    const legacyTitle =
      /^(?:\u0421\u0431\u043e\u0440\u043a\u0430|\u0421\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u044f)\s+(\d+)$/iu.exec(
        name,
      );
    return legacyTitle ? `Build ${Number(legacyTitle[1])}` : name;
  }

  const savedHero = readStore('hero', null);
  let hero = validHero(savedHero)
    ? { ...savedHero, portrait: savedHero.classId }
    : { ...DEFAULT_HERO };

  if (hero.name === '\u042d\u0439\u0440\u0438\u043d') hero.name = DEFAULT_HERO.name;
  const savedDeck = readStore('deck', null);
  let deck = migrateDeck(savedDeck) || [...DEFAULT_DECK];
  const savedBudget = readStore('deckBudget', DEFAULT_BUDGET);
  let deckBudget =
    validBudget(savedBudget) && savedBudget >= getDeckTotal(deck)
      ? savedBudget
      : Math.max(DEFAULT_BUDGET, getDeckTotal(deck));
  let toastTimer;

  function notify(message, tone = 'success') {
    const toast = document.getElementById('toast');
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `toast ${tone === 'error' ? 'toast-error' : 'toast-success'}`;
    toast.hidden = false;
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, TOAST_DURATION);
  }

  function setHero(profile) {
    if (!validHero(profile)) return false;
    hero = {
      ...profile,
      name: profile.name.normalize('NFKC').trim().replace(/\s+/g, ' '),
      portrait: profile.classId,
    };
    writeStore('hero', hero);
    updateHeader();
    document.dispatchEvent(
      new CustomEvent('obsidian:herochange', { detail: { ...hero } }),
    );
    return true;
  }

  function setDeck(ids, budget = deckBudget) {
    if (!validDeck(ids, budget)) return false;
    deck = [...ids];
    deckBudget = budget;
    writeStore('deck', deck);
    writeStore('deckBudget', deckBudget);
    document.dispatchEvent(new CustomEvent('obsidian:deckchange', { detail: [...deck] }));
    return true;
  }

  let activeTab = null;
  let arenaTransition = null;
  const transitionCover = el('div', 'arena-transition');
  transitionCover.hidden = true;
  transitionCover.setAttribute('aria-hidden', 'true');
  document.body.append(transitionCover);

  function activateTab(name, target, focus) {
    activeTab = name;
    document.body.classList.toggle('is-arena-view', name === 'battle');
    document.querySelectorAll('[data-tab]').forEach((button) => {
      const active = button.dataset.tab === name;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll('.game-panel').forEach((panel) => {
      panel.hidden = panel !== target;
    });
    try {
      history.replaceState(null, '', `#${name}`);
    } catch {}
    if (name === 'battle') window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (focus) document.getElementById(`tab-${name}`).focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent('obsidian:tabchange', { detail: name }));
  }

  function openTab(name, focus = false) {
    const target = document.getElementById(`${name}-panel`);
    if (!target) return;
    if (arenaTransition) {
      arenaTransition.cancel();
      arenaTransition = null;
      transitionCover.hidden = true;
    }
    const animateEntry =
      activeTab !== null &&
      activeTab !== 'battle' &&
      name === 'battle' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      typeof transitionCover.animate === 'function';
    if (!animateEntry) {
      activateTab(name, target, focus);
      return;
    }

    transitionCover.hidden = false;
    const cover = transitionCover.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 140,
      easing: 'ease-out',
      fill: 'forwards',
    });
    arenaTransition = cover;
    cover.finished
      .then(() => {
        if (arenaTransition !== cover) return;
        activateTab(name, target, focus);
        const reveal = transitionCover.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 240,
          easing: 'ease-in-out',
          fill: 'forwards',
        });
        arenaTransition = reveal;
        cover.cancel();
        return reveal.finished.then(() => {
          if (arenaTransition !== reveal) return;
          transitionCover.hidden = true;
          arenaTransition = null;
          reveal.cancel();
        });
      })
      .catch(() => {});
  }

  function updateHeader() {
    document.getElementById('header-name').textContent = hero.name;
    document.getElementById(
      'header-portrait',
    ).src = `assets/portraits/${hero.portrait}.png`;
    const wins = readStore('wins', 0);
    const winCount = Number.isInteger(wins) && wins >= 0 ? wins : 0;
    document.getElementById('header-wins').textContent = winCount;
    document.querySelector('.wins-counter > span:last-child').textContent =
      winCount === 1 ? 'win' : 'wins';
  }

  window.Obsidian = {
    el,
    icon,
    catalog,
    deckConfig,
    localizeBuildName,
    readStore,
    writeStore,
    notify,
    getHero: () => ({ ...hero }),
    setHero,
    getDeck: () => [...deck],
    getDeckBudget: () => deckBudget,
    setDeck,
    openTab,
  };

  const tabs = [...document.querySelectorAll('[data-tab]')];
  tabs.forEach((button) => {
    button.addEventListener('click', () => openTab(button.dataset.tab));
    button.addEventListener('keydown', (event) => {
      const index = tabs.indexOf(button);
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        openTab(tabs[next].dataset.tab, true);
      }
    });
  });
  document
    .getElementById('profile-shortcut')
    .addEventListener('click', () => openTab('hero', true));
  document.querySelector('.brand').addEventListener('click', (event) => {
    event.preventDefault();
    openTab('battle', true);
  });
  document.addEventListener('obsidian:statschange', updateHeader);

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-open-help], [data-close-dialog]');
    if (!trigger) return;
    if (trigger.hasAttribute('data-close-dialog')) {
      trigger.closest('dialog').close();
      return;
    }
    document.getElementById('help-dialog').showModal();
  });
  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      const rect = dialog.getBoundingClientRect();
      if (
        event.target === dialog &&
        (event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom)
      )
        dialog.close();
    });
  });
  updateHeader();
  openTab(
    ['battle', 'deck', 'hero'].includes(location.hash.slice(1))
      ? location.hash.slice(1)
      : 'battle',
  );
})();
