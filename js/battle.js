(() => {
  'use strict';

  const MAX_HP = 100;
  const ATTACK_MIN = 8;
  const ATTACK_MAX = 15;
  const ENEMY_MIN = 5;
  const ENEMY_MAX = 14;
  const CRITICAL_CHANCE = 0.1;
  const CRITICAL_MULTIPLIER = 2;
  const PERCENT_SCALE = 100;
  const DEFENSE_DIVISOR = 2;
  const HEAL_AMOUNT = 20;
  const MAX_HEALS = 3;
  const LOG_LIMIT = 5;
  const ENEMY_DELAY = 360;
  const FIRST_TURN = 1;
  const ZERO = 0;
  const DISPLAY_DECIMALS = 2;

  const RULES = Object.freeze({
    MAX_HP,
    ATTACK_MIN,
    ATTACK_MAX,
    ENEMY_MIN,
    ENEMY_MAX,
    CRITICAL_CHANCE,
    CRITICAL_MULTIPLIER,
    PERCENT_SCALE,
    DEFENSE_DIVISOR,
    HEAL_AMOUNT,
    MAX_HEALS,
    LOG_LIMIT,
    ENEMY_DELAY,
    FIRST_TURN,
    ZERO,
  });

  const app = window.Obsidian;
  const mount = document.querySelector('#battle-panel');
  if (!app || !mount) return;

  const enemies = [
    {
      id: 'dark-knight',
      name: 'Void Warden',
      title: 'FALLEN KNIGHT',
      chapter: 'Obsidian Gates',
      number: 'I',
      description:
        'Once the guardian of these gates, now a suit of armor consumed by darkness.',
      trait: 'Heavy blade · melee',
    },
    {
      id: 'goblin',
      name: 'Goblin Raider',
      title: 'FOREST BANDIT',
      chapter: 'Forgotten Road',
      number: 'II',
      description:
        'Stolen coins jingle in the woods. Someone has already spotted your deck.',
      trait: 'Cunning foe · melee',
    },
    {
      id: 'dragon',
      name: 'Ashen Dragon',
      title: 'ANCIENT GUARDIAN',
      chapter: 'Heart of the Volcano',
      number: 'III',
      description:
        'The last keeper of the ancient runes has awakened. Brave the ashes and prove your strength.',
      trait: 'Fire breath · ranged',
    },
  ];
  const classNames = { knight: 'Knight', mage: 'Mage', rogue: 'Rogue' };
  const actionDefaults = {
    attack: { name: 'Steel Strike' },
    defend: { name: 'Bulwark' },
    heal: { name: 'Crimson Elixir' },
  };

  let timer = null;
  let state;
  let encounterHero;
  let encounterDeck;
  let updateNoticeSignature = '';
  const nodes = {};
  const actions = {};
  const make = app.el;

  function formatNumber(value) {
    return value.toLocaleString('en-US', { maximumFractionDigits: DISPLAY_DECIMALS });
  }

  function defensePercent() {
    return formatNumber((FIRST_TURN - FIRST_TURN / DEFENSE_DIVISOR) * PERCENT_SCALE);
  }

  function getActionEffect(type) {
    if (type === 'attack') return `${ATTACK_MIN}–${ATTACK_MAX} damage`;
    if (type === 'defend') return `−${defensePercent()}% damage`;
    if (type === 'heal') return `+${HEAL_AMOUNT} HP`;
    return '';
  }

  function describeCard(card) {
    if (card?.type === 'attack') {
      return `Deals ${ATTACK_MIN}–${ATTACK_MAX} damage. Critical hit: ×${formatNumber(
        CRITICAL_MULTIPLIER,
      )}, ${formatNumber(CRITICAL_CHANCE * PERCENT_SCALE)}% chance.`;
    }
    if (card?.type === 'defend') {
      return `Reduces damage from the next hit by ${defensePercent()}%. Damage taken is rounded up.`;
    }
    if (card?.type === 'heal') {
      return `Restores up to ${HEAL_AMOUNT} HP, capped at ${MAX_HP} HP. Uses per battle: ${MAX_HEALS}.`;
    }
    return '';
  }

  function renderHelp() {
    const config = app.deckConfig;
    const texts = {
      'battle-attack': `You and your opponent start with ${MAX_HP} HP. Attacks deal ${getActionEffect(
        'attack',
      )}. Both sides have a ${formatNumber(
        CRITICAL_CHANCE * PERCENT_SCALE,
      )}% chance to deal ×${formatNumber(CRITICAL_MULTIPLIER)} critical damage.`,
      'battle-survival': `The enemy deals ${ENEMY_MIN}–${ENEMY_MAX} damage after your action. ${describeCard(
        { type: 'defend' },
      )} ${describeCard({
        type: 'heal',
      })} The battle log keeps the last ${LOG_LIMIT} actions.`,
    };
    if (config) {
      texts.deck = `In Deck, choose exactly ${config.size} cards: one Attack, one Defense, and one Healing. Stay within your chosen coin budget. Abyssal Whisper cannot be paired with Living Spring or Moon Charm. Save and compare up to ${config.maxBuilds} builds. In the Arena, each card shows its current name and effect.`;
    }
    for (const [key, text] of Object.entries(texts)) {
      document.querySelectorAll(`[data-rule="${key}"]`).forEach((node) => {
        node.textContent = text;
      });
    }
  }

  function image(path, alt, className) {
    const img = make('img', className);
    img.src = path;
    img.alt = alt;
    img.draggable = false;
    return img;
  }

  function add(parent, ...children) {
    parent.append(...children);
    return parent;
  }

  function getEnemy() {
    return enemies.find((enemy) => enemy.id === state.enemyId) || enemies[ZERO];
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + FIRST_TURN)) + min;
  }

  function rollDamage(min, max) {
    const critical = Math.random() < CRITICAL_CHANCE;
    const damage = randomInt(min, max) * (critical ? CRITICAL_MULTIPLIER : FIRST_TURN);
    return { damage, critical };
  }

  function addLog(text, tone = 'neutral') {
    state.log.unshift({ text, tone });
    state.log = state.log.slice(ZERO, LOG_LIMIT);
  }

  function createFighter(side) {
    const figure = make('div', `battle-fighter battle-fighter--${side}`);
    const label = make(
      'span',
      'battle-fighter-label',
      side === 'hero' ? 'YOUR HERO' : 'ENEMY',
    );
    const portraitWrap = make('div', 'battle-portrait-wrap');
    const portrait = image('assets/portraits/knight.png', '', 'battle-portrait');
    add(portraitWrap, portrait);
    const name = make('h3', 'battle-fighter-name');
    const subtitle = make('p', 'battle-fighter-subtitle');
    const hpText = make('span', 'battle-hp-text');
    const hpIcon = make('span', 'battle-hp-symbol', '♥');
    const hpCaption = add(make('div', 'battle-hp-caption'), hpIcon, hpText);
    const progress = make('progress', 'battle-hp');
    progress.max = MAX_HP;
    progress.value = MAX_HP;
    progress.setAttribute('aria-label', side === 'hero' ? 'Hero health' : 'Enemy health');
    const hp = add(make('div', 'battle-health'), hpCaption, progress);
    add(figure, label, portraitWrap, name, subtitle, hp);
    nodes[`${side}Portrait`] = portrait;
    nodes[`${side}Name`] = name;
    nodes[`${side}Subtitle`] = subtitle;
    nodes[`${side}Hp`] = progress;
    nodes[`${side}HpText`] = hpText;
    nodes[`${side}Figure`] = figure;
    return figure;
  }

  function createAction(type, key) {
    const button = make('button', `battle-action battle-action--${type}`);
    button.type = 'button';
    button.dataset.action = type;
    button.setAttribute('aria-keyshortcuts', key);
    const name = make('span', 'battle-action-name', actionDefaults[type].name);
    const effect = make('span', 'battle-action-effect', getActionEffect(type));
    add(button, name, effect);
    actions[type] = { button, name, effect };
    return button;
  }

  function createDialog(id, title, trigger) {
    const dialog = make('dialog', 'game-dialog battle-dialog');
    dialog.id = id;
    const titleId = `${id}-title`;
    dialog.setAttribute('aria-labelledby', titleId);
    const close = make('button', 'dialog-close', '×');
    close.type = 'button';
    close.dataset.closeDialog = '';
    close.setAttribute('aria-label', `Close ${title}`);
    const heading = make('h2', 'battle-dialog-title', title);
    heading.id = titleId;
    add(dialog, close, heading);

    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const outside =
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom;
      if (outside) dialog.close();
    });
    dialog.addEventListener('close', () => {
      if (mount.hidden || dialog.returnValue === 'tabchange') return;
      const target = dialog.returnValue === 'started' ? actions.attack.button : trigger;
      target.focus({ preventScroll: true });
    });
    document.body.append(dialog);
    return dialog;
  }

  function openNewGameDialog() {
    nodes.enemySelect.value = state.enemyId;
    renderEnemyInfo();
    nodes.newGameDialog.returnValue = '';
    nodes.newGameDialog.showModal();
  }

  function renderEnemyInfo() {
    const enemy =
      enemies.find((item) => item.id === nodes.enemySelect.value) || enemies[ZERO];
    nodes.enemyInfoPortrait.src = `assets/portraits/${enemy.id}.png`;
    nodes.enemyInfoPortrait.alt = enemy.name;
    nodes.enemyInfoName.textContent = enemy.name;
    nodes.enemyInfoTitle.textContent = enemy.title;
    nodes.enemyLore.textContent = enemy.description;
    nodes.enemyTrait.textContent = enemy.trait;
  }

  function renderCurrentEnemyInfo() {
    const enemy = getEnemy();
    nodes.currentEnemyPortrait.src = `assets/portraits/${enemy.id}.png`;
    nodes.currentEnemyPortrait.alt = enemy.name;
    nodes.currentEnemyName.textContent = enemy.name;
    nodes.currentEnemyTitle.textContent = enemy.title;
    nodes.currentEnemyLore.textContent = enemy.description;
    nodes.currentEnemyHp.textContent = `${state.enemyHp} / ${MAX_HP} HP`;
    nodes.currentEnemyTrait.textContent = enemy.trait;
  }

  function buildDialogs() {
    nodes.newGameDialog = createDialog(
      'battle-new-game-dialog',
      'New Game',
      nodes.restart,
    );
    const selectLabel = make('label', 'battle-select-label', 'Enemy');
    selectLabel.htmlFor = 'battle-enemy-select';
    nodes.enemySelect = make('select', 'battle-enemy-select');
    nodes.enemySelect.id = 'battle-enemy-select';
    for (const enemy of enemies) {
      const option = make('option', '', enemy.name);
      option.value = enemy.id;
      nodes.enemySelect.append(option);
    }

    nodes.enemySelect.addEventListener('change', renderEnemyInfo);
    const enemyPreview = make('div', 'battle-enemy-preview');
    nodes.enemyInfoPortrait = image(
      'assets/portraits/dark-knight.png',
      '',
      'battle-enemy-info-portrait',
    );
    nodes.enemyInfoName = make('h3', 'battle-enemy-info-name');
    nodes.enemyInfoTitle = make('p', 'battle-enemy-info-title');
    nodes.enemyLore = make('p', 'battle-enemy-lore');
    const enemyDescription = add(
      make('div', 'battle-enemy-description'),
      nodes.enemyInfoTitle,
      nodes.enemyInfoName,
      nodes.enemyLore,
    );
    add(enemyPreview, nodes.enemyInfoPortrait, enemyDescription);
    const enemyStats = make('dl', 'battle-enemy-stats');
    const stats = [
      ['Health', `${MAX_HP} HP`],
      ['Attack', `${ENEMY_MIN}–${ENEMY_MAX}`],
      [
        'Critical hit',
        `${formatNumber(CRITICAL_CHANCE * PERCENT_SCALE)}% · ×${formatNumber(
          CRITICAL_MULTIPLIER,
        )}`,
      ],
    ];
    for (const [label, value] of stats) {
      enemyStats.append(make('dt', '', label), make('dd', '', value));
    }
    nodes.enemyTrait = make('p', 'battle-enemy-trait');
    const hint = make(
      'p',
      'battle-select-hint',
      'Start with your saved hero and deck. This will reset the current battle.',
    );
    nodes.startGame = make('button', 'btn btn-primary battle-start-game', 'Start Battle');
    nodes.startGame.type = 'button';
    nodes.startGame.addEventListener('click', () => {
      restart(nodes.enemySelect.value);
      nodes.newGameDialog.close('started');
      actions.attack.button.focus({ preventScroll: true });
    });
    add(
      nodes.newGameDialog,
      selectLabel,
      nodes.enemySelect,
      enemyPreview,
      enemyStats,
      nodes.enemyTrait,
      hint,
      nodes.startGame,
    );

    nodes.enemyDialog = createDialog(
      'battle-enemy-dialog',
      'Enemy Info',
      nodes.enemyTrigger,
    );
    const currentPreview = make('div', 'battle-enemy-preview');
    nodes.currentEnemyPortrait = image(
      'assets/portraits/dark-knight.png',
      '',
      'battle-enemy-info-portrait',
    );
    nodes.currentEnemyName = make(
      'h3',
      'battle-enemy-info-name battle-current-enemy-name',
    );
    nodes.currentEnemyTitle = make('p', 'battle-enemy-info-title');
    nodes.currentEnemyLore = make('p', 'battle-enemy-lore');
    const currentDescription = add(
      make('div', 'battle-enemy-description'),
      nodes.currentEnemyTitle,
      nodes.currentEnemyName,
      nodes.currentEnemyLore,
    );
    add(currentPreview, nodes.currentEnemyPortrait, currentDescription);
    const currentStats = make('dl', 'battle-enemy-stats');
    nodes.currentEnemyHp = make('dd', 'battle-current-enemy-hp');
    add(
      currentStats,
      make('dt', '', 'Health'),
      nodes.currentEnemyHp,
      make('dt', '', 'Attack'),
      make('dd', '', `${ENEMY_MIN}–${ENEMY_MAX}`),
      make('dt', '', 'Critical hit'),
      make(
        'dd',
        '',
        `${formatNumber(CRITICAL_CHANCE * PERCENT_SCALE)}% · ×${formatNumber(
          CRITICAL_MULTIPLIER,
        )}`,
      ),
    );
    nodes.currentEnemyTrait = make('p', 'battle-enemy-trait');
    const enemyBack = make(
      'button',
      'btn btn-secondary battle-enemy-back',
      'Back to Battle',
    );
    enemyBack.type = 'button';
    enemyBack.dataset.closeDialog = '';
    add(
      nodes.enemyDialog,
      currentPreview,
      currentStats,
      nodes.currentEnemyTrait,
      enemyBack,
    );

    nodes.logDialog = createDialog(
      'battle-log-dialog',
      'Battle Log',
      nodes.historyTrigger,
    );
    nodes.log = make('ol', 'battle-log');
    nodes.log.setAttribute('aria-label', `Last ${LOG_LIMIT} actions`);
    nodes.round = make('p', 'battle-log-round');
    const back = make('button', 'btn btn-secondary battle-log-back', 'Back to Battle');
    back.type = 'button';
    back.dataset.closeDialog = '';
    add(nodes.logDialog, nodes.log, nodes.round, back);
  }

  function build() {
    const intro = make('div', 'battle-intro');
    const heading = make('h1', 'battle-title', 'Arena');
    const help = make('button', 'btn btn-ghost battle-help', 'How to Play');
    help.type = 'button';
    help.dataset.openHelp = '';
    nodes.restart = make('button', 'btn btn-primary battle-restart', 'New Game');
    nodes.restart.type = 'button';
    nodes.restart.title = 'Choose an enemy and start a new battle';
    nodes.restart.setAttribute('aria-haspopup', 'dialog');
    nodes.restart.setAttribute('aria-controls', 'battle-new-game-dialog');
    nodes.restart.addEventListener('click', openNewGameDialog);
    nodes.enemyTrigger = make(
      'button',
      'btn btn-secondary battle-enemy-trigger',
      'Enemy Info',
    );
    nodes.enemyTrigger.type = 'button';
    nodes.enemyTrigger.setAttribute('aria-haspopup', 'dialog');
    nodes.enemyTrigger.setAttribute('aria-controls', 'battle-enemy-dialog');
    nodes.enemyTrigger.addEventListener('click', () => {
      renderCurrentEnemyInfo();
      nodes.enemyDialog.returnValue = '';
      nodes.enemyDialog.showModal();
    });
    nodes.historyTrigger = make(
      'button',
      'btn btn-secondary battle-history-trigger',
      'Battle Log',
    );
    nodes.historyTrigger.type = 'button';
    nodes.historyTrigger.setAttribute('aria-haspopup', 'dialog');
    nodes.historyTrigger.setAttribute('aria-controls', 'battle-log-dialog');
    nodes.historyTrigger.addEventListener('click', () => {
      nodes.logDialog.returnValue = '';
      nodes.logDialog.showModal();
    });
    const introControls = add(
      make('div', 'battle-intro-controls'),
      nodes.restart,
      nodes.enemyTrigger,
      nodes.historyTrigger,
      help,
    );
    add(intro, heading, introControls);

    nodes.updateNotice = make('div', 'battle-update battle-update-notice');
    nodes.updateNotice.hidden = true;
    nodes.updateNotice.setAttribute('role', 'status');
    nodes.updateNotice.setAttribute('aria-live', 'polite');
    nodes.updatePortrait = image(
      'assets/portraits/knight.png',
      '',
      'battle-update-portrait',
    );
    nodes.updateTitle = make('h2', 'battle-update-title');
    nodes.updateCopy = make('p', 'battle-update-copy');
    const updateText = add(
      make('div', 'battle-update-text'),
      nodes.updateTitle,
      nodes.updateCopy,
    );
    nodes.updateButton = make(
      'button',
      'btn btn-primary battle-update-button',
      'Update Battle',
    );
    nodes.updateButton.type = 'button';
    nodes.updateButton.addEventListener('click', () => {
      restart();
      actions.attack.button.focus({ preventScroll: true });
    });
    add(nodes.updateNotice, nodes.updatePortrait, updateText, nodes.updateButton);

    const layout = make('div', 'battle-layout');
    const main = make('div', 'battle-main');
    const field = make('div', 'battle-field panel');
    nodes.field = field;
    const fighters = make('div', 'battle-fighters');
    add(fighters, createFighter('hero'), createFighter('enemy'));
    nodes.message = make('p', 'battle-message', 'Choose a card to begin.');
    nodes.message.setAttribute('role', 'status');
    nodes.message.setAttribute('aria-live', 'polite');
    nodes.outcome = make('div', 'battle-outcome');
    nodes.outcome.hidden = true;
    nodes.outcome.setAttribute('role', 'region');
    nodes.outcome.setAttribute('aria-labelledby', 'battle-result-title');
    nodes.outcomeMark = make('span', 'battle-outcome-mark', '✦');
    nodes.outcomeTitle = make('h2', 'battle-outcome-title');
    nodes.outcomeTitle.id = 'battle-result-title';
    nodes.outcomeText = make('p', 'battle-outcome-copy');
    const again = make('button', 'btn btn-primary', 'Play Again');
    again.type = 'button';
    again.addEventListener('click', () => {
      restart();
      actions.attack.button.focus({ preventScroll: true });
    });
    nodes.again = again;
    const changeDeck = make('button', 'btn btn-secondary', 'Edit Deck');
    changeDeck.type = 'button';
    changeDeck.addEventListener('click', () => app.openTab('deck'));
    const outcomeButtons = add(make('div', 'battle-outcome-buttons'), again, changeDeck);
    add(
      nodes.outcome,
      nodes.outcomeMark,
      nodes.outcomeTitle,
      nodes.outcomeText,
      outcomeButtons,
    );
    add(field, fighters, nodes.message);

    const hand = make('div', 'battle-actions');
    hand.setAttribute('aria-label', 'Choose your action');
    add(
      hand,
      createAction('attack', '1'),
      createAction('defend', '2'),
      createAction('heal', '3'),
    );
    hand.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (button && hand.contains(button)) act(button.dataset.action);
    });
    const supplies = make('div', 'battle-supplies');
    supplies.setAttribute('role', 'status');
    supplies.setAttribute('aria-label', 'Healing potions remaining');
    nodes.suppliesCount = make(
      'strong',
      'battle-supplies-count',
      `${MAX_HEALS}/${MAX_HEALS}`,
    );
    add(supplies, app.icon('potion_red', 'battle-supplies-icon'), nodes.suppliesCount);

    add(main, field, hand, supplies, nodes.outcome);

    add(layout, main);
    add(mount, intro, nodes.updateNotice, layout);
    buildDialogs();
  }

  function updatePendingNotice() {
    const savedHero = app.getHero();
    const savedDeck = app.getDeck();
    const heroFields = [
      'name',
      'classId',
      'portrait',
      'color',
      'strength',
      'agility',
      'magic',
      'vitality',
    ];
    const heroChanged = heroFields.some((key) => savedHero[key] !== encounterHero[key]);
    const deckChanged =
      savedDeck.length !== encounterDeck.length ||
      savedDeck.some((id, index) => id !== encounterDeck[index]);
    const showNotice = state.turns > ZERO && (heroChanged || deckChanged);
    nodes.updateNotice.hidden = !showNotice;
    if (!showNotice) {
      updateNoticeSignature = '';
      return;
    }

    const signature = JSON.stringify([heroChanged, deckChanged, savedHero, savedDeck]);
    if (signature === updateNoticeSignature) return;
    updateNoticeSignature = signature;
    nodes.updatePortrait.src = `assets/portraits/${savedHero.portrait}.png`;
    nodes.updatePortrait.alt = `${classNames[savedHero.classId] || 'Hero'} ${
      savedHero.name
    }`;
    nodes.updateTitle.textContent = heroChanged
      ? `New hero ready: ${savedHero.name}`
      : 'New deck ready';
    nodes.updateCopy.textContent =
      heroChanged && deckChanged
        ? `Start a new battle with ${savedHero.name} and the new deck. This will reset the current battle.`
        : heroChanged
        ? `Start a new battle with ${savedHero.name}. This will reset the current battle.`
        : `Start a new battle to use the new deck with ${savedHero.name}. This will reset the current battle.`;
  }

  function selectedCard(type) {
    const ids = encounterDeck;
    const cards = ids
      .map((id) => app.catalog.find((card) => card.id === id))
      .filter((card) => card && card.type === type);
    return cards.length ? cards[state.turns % cards.length] : actionDefaults[type];
  }

  function updateActionLabels() {
    for (const [type, action] of Object.entries(actions)) {
      const card = selectedCard(type);
      action.name.textContent = card.name;
      action.effect.textContent = getActionEffect(type);
    }
  }

  function render() {
    const enemy = getEnemy();
    const finished = state.status === 'won' || state.status === 'lost';
    const hero = encounterHero;
    nodes.field.dataset.scene = enemy.id;
    nodes.heroName.textContent = hero.name;
    nodes.heroSubtitle.textContent = classNames[hero.classId] || 'Adventurer';
    nodes.heroPortrait.src = `assets/portraits/${hero.portrait}.png`;
    nodes.heroPortrait.alt = `${nodes.heroSubtitle.textContent} ${hero.name}`;
    for (const color of ['violet', 'teal', 'amber']) {
      nodes.heroFigure.classList.toggle(`aura-${color}`, hero.color === color);
    }
    nodes.enemyName.textContent = enemy.name;
    nodes.enemySubtitle.textContent = enemy.title;
    nodes.enemyPortrait.src = `assets/portraits/${enemy.id}.png`;
    nodes.enemyPortrait.alt = enemy.name;
    nodes.heroHp.value = state.heroHp;
    nodes.enemyHp.value = state.enemyHp;
    nodes.heroHpText.textContent = `${state.heroHp} / ${MAX_HP}`;
    nodes.enemyHpText.textContent = `${state.enemyHp} / ${MAX_HP}`;
    nodes.heroHp.classList.toggle('is-low', state.heroHp <= HEAL_AMOUNT);
    nodes.enemyHp.classList.toggle('is-low', state.enemyHp <= HEAL_AMOUNT);
    nodes.round.textContent = finished
      ? `Turns played: ${state.turns}`
      : `Turn ${state.turns + FIRST_TURN} · last ${LOG_LIMIT} actions`;
    nodes.message.textContent = state.message;
    nodes.message.classList.toggle('is-error', state.invalid);
    nodes.message.classList.toggle('is-critical', state.lastCritical);
    nodes.outcome.hidden = !finished;
    nodes.outcome.classList.toggle('is-victory', state.status === 'won');
    if (finished) {
      nodes.outcomeTitle.textContent = state.status === 'won' ? 'Victory' : 'Defeat';
      nodes.outcomeText.textContent =
        state.status === 'won'
          ? `${enemy.name} is defeated. Your story continues.`
          : 'Change your strategy and try again. Every battle is a fresh chance.';
      nodes.outcomeMark.textContent = state.status === 'won' ? '✦' : '◇';
    }
    for (const [type, action] of Object.entries(actions)) {
      const noHealing =
        type === 'heal' && (state.heals === ZERO || state.heroHp === MAX_HP);
      action.button.disabled = finished || state.pending || noHealing;
      action.button.title =
        type === 'heal'
          ? state.heals === ZERO
            ? `All potions (${MAX_HEALS}) have been used.`
            : state.heroHp === MAX_HP
            ? 'Health is full.'
            : `Restore up to ${HEAL_AMOUNT} HP. Potions left: ${state.heals}.`
          : describeCard({ type });
    }
    nodes.suppliesCount.textContent = `${state.heals}/${MAX_HEALS}`;
    nodes.log.replaceChildren();
    for (const entry of state.log) {
      const item = make('li', `battle-log-entry battle-log-entry--${entry.tone}`);
      add(item, make('span', 'battle-log-bullet'), make('span', '', entry.text));
      nodes.log.append(item);
    }
    if (state.log.length === ZERO) {
      const item = add(
        make('li', 'battle-log-empty'),
        make('span', '', '✧'),
        make('p', '', 'The calm before battle.'),
        make('small', '', 'Your first move will start the log.'),
      );
      nodes.log.append(item);
    }
    updateActionLabels();
    renderCurrentEnemyInfo();
    updatePendingNotice();
  }

  function invalid(message) {
    nodes.message.textContent = message;
    nodes.message.classList.add('is-error');
    return false;
  }

  function finish(status) {
    state.status = status;
    state.pending = false;
    state.message =
      status === 'won'
        ? 'Victory! The enemy is defeated.'
        : 'Defeat. Start a new battle and try a different strategy.';
    if (status === 'won') {
      const saved = app.readStore('wins', ZERO);
      const wins = Number.isInteger(saved) && saved >= ZERO ? saved : ZERO;
      app.writeStore('wins', wins + FIRST_TURN);
      document.dispatchEvent(new CustomEvent('obsidian:statschange'));
      addLog('Victory! The enemy is defeated.', 'victory');
    } else {
      addLog('Defeat. Your hero fell in battle.', 'danger');
    }
    render();
    nodes.again.focus({ preventScroll: true });
  }

  function enemyTurn(defending) {
    timer = null;
    const hit = rollDamage(ENEMY_MIN, ENEMY_MAX);
    const damage = defending ? Math.ceil(hit.damage / DEFENSE_DIVISOR) : hit.damage;
    state.heroHp = Math.max(ZERO, state.heroHp - damage);
    state.pending = false;
    state.lastCritical = hit.critical;
    state.message = `${getEnemy().name}: ${damage} damage${
      hit.critical ? ' — critical hit!' : '.'
    }${defending ? ` Defense: −${defensePercent()}% damage, rounded up.` : ''}`;
    addLog(
      `${hit.critical ? 'Enemy critical hit' : 'Enemy response'}: −${damage} HP${
        defending ? ' (defended)' : ''
      }.`,
      'danger',
    );
    if (state.heroHp === ZERO) {
      finish('lost');
    } else {
      render();
    }
  }

  function act(type) {
    if (type !== 'attack' && type !== 'defend' && type !== 'heal')
      return invalid('Choose Attack, Defense, or Healing.');
    if (state.status === 'won' || state.status === 'lost')
      return invalid('Battle over. Start a new battle.');
    if (state.pending) return invalid('Wait for the enemy to finish its turn.');
    if (type === 'heal' && (state.heals === ZERO || state.heroHp === MAX_HP)) {
      return invalid(
        state.heals === ZERO
          ? 'No potions left.'
          : 'Health is full. Choose another action.',
      );
    }
    state.status = 'playing';
    state.turns += FIRST_TURN;
    state.invalid = false;
    state.lastCritical = false;
    if (type === 'attack') {
      const hit = rollDamage(ATTACK_MIN, ATTACK_MAX);
      state.enemyHp = Math.max(ZERO, state.enemyHp - hit.damage);
      state.lastCritical = hit.critical;
      state.message = `${hit.critical ? 'Critical hit!' : 'Direct hit.'} You dealt ${
        hit.damage
      } damage.`;
      addLog(
        `${hit.critical ? 'Your critical hit' : 'Your attack'}: −${hit.damage} enemy HP.`,
        'attack',
      );
    } else if (type === 'defend') {
      state.message = `Shield raised. Next hit: −${defensePercent()}% damage, rounded up.`;
      addLog(
        `Defense: −${defensePercent()}% damage on the next hit, rounded up.`,
        'defend',
      );
    } else {
      const recovered = Math.min(HEAL_AMOUNT, MAX_HP - state.heroHp);
      state.heroHp += recovered;
      state.heals -= FIRST_TURN;
      state.message = `The elixir restored ${recovered} HP.`;
      addLog(`Healing: +${recovered} HP. Potions left: ${state.heals}.`, 'heal');
    }
    if (state.enemyHp === ZERO) {
      finish('won');
      return true;
    }
    state.pending = true;
    render();
    timer = window.setTimeout(() => enemyTurn(type === 'defend'), ENEMY_DELAY);
    return true;
  }

  function restart(enemyId) {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    const id = enemyId || (state && state.enemyId) || enemies[ZERO].id;
    const enemy = enemies.find((item) => item.id === id) || enemies[ZERO];
    encounterHero = { ...app.getHero() };
    encounterDeck = [...app.getDeck()];
    state = {
      heroHp: MAX_HP,
      enemyHp: MAX_HP,
      heals: MAX_HEALS,
      turns: ZERO,
      enemyId: enemy.id,
      status: 'ready',
      pending: false,
      invalid: false,
      lastCritical: false,
      message: 'Choose a card to begin.',
      log: [],
    };
    render();
  }

  build();
  restart();
  document.addEventListener('obsidian:herochange', () => {
    if (state.turns === ZERO) {
      encounterHero = { ...app.getHero() };
      render();
    } else {
      updatePendingNotice();
    }
  });
  document.addEventListener('obsidian:deckchange', () => {
    if (state.turns === ZERO) {
      encounterDeck = [...app.getDeck()];
      render();
    } else {
      updatePendingNotice();
    }
  });
  document.addEventListener('obsidian:tabchange', (event) => {
    if (event.detail === 'battle') return;
    for (const dialog of [nodes.newGameDialog, nodes.enemyDialog, nodes.logDialog]) {
      if (dialog.open) dialog.close('tabchange');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (
      mount.hidden ||
      document.querySelector('dialog[open]') ||
      event.repeat ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    if (event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
    const keys = { 1: 'attack', 2: 'defend', 3: 'heal' };
    if (keys[event.key]) {
      event.preventDefault();
      if (!actions[keys[event.key]].button.disabled) act(keys[event.key]);
    }
  });
  app.battle = {
    getState: () => ({ ...state, log: state.log.map((entry) => ({ ...entry })) }),
    getEncounterHero: () => ({ ...encounterHero }),
    getEncounterDeck: () => [...encounterDeck],
    act,
    restart,
    getActionEffect,
    describeCard,
    rules: RULES,
  };
  renderHelp();
})();
