(() => {
  'use strict';

  const app = window.Obsidian;
  const mount = document.getElementById('deck-panel');
  if (!app || !mount) return;

  const config = app.deckConfig;
  const TYPE_NAMES = config.categoryNames;
  const TYPES = Object.keys(TYPE_NAMES);
  const catalog = app.catalog;
  const byId = new Map(catalog.map((card) => [card.id, card]));
  const storedBudget = app.getDeckBudget();
  const state = {
    selected: [...app.getDeck()],
    budget: validBudget(storedBudget) ? storedBudget : config.defaultBudget,
    budgetValid: true,
    query: '',
    filter: 'all',
    message: '',
    messageTone: 'neutral',
    builds: [],
    buildMessage: '',
    buildTone: 'neutral',
  };

  function validBudget(value) {
    return (
      Number.isInteger(value) && value >= config.minBudget && value <= config.maxBudget
    );
  }

  function typeCounts(cards = state.selected) {
    const counts = Object.fromEntries(TYPES.map((type) => [type, 0]));
    for (const id of cards) {
      const card = byId.get(id);
      if (card && Object.hasOwn(counts, card.type)) counts[card.type] += 1;
    }
    return counts;
  }

  function compositionKey(cards) {
    return JSON.stringify([...cards].sort());
  }

  function coins(amount) {
    return `${amount} ${amount === 1 ? 'coin' : 'coins'}`;
  }

  function shortageMessage(amount) {
    return `Need ${amount} more ${amount === 1 ? 'coin' : 'coins'}.`;
  }

  function readBuilds() {
    const stored = app.readStore('builds', []);
    if (!Array.isArray(stored)) return [];
    const builds = [];
    const compositions = new Set();
    const ids = new Set();
    for (const [index, value] of stored.entries()) {
      if (!value || typeof value !== 'object' || typeof value.name !== 'string') continue;
      const oldCards = Array.isArray(value.cards) ? value.cards : value.ids;
      const cards = config.migrate(oldCards);
      if (!cards || !config.validate(cards)) continue;
      const key = compositionKey(cards);
      if (compositions.has(key)) continue;
      const budget =
        validBudget(value.budget) && config.validate(cards, value.budget)
          ? value.budget
          : Math.max(config.defaultBudget, config.getTotal(cards));
      if (!validBudget(budget) || !config.validate(cards, budget)) continue;
      let id =
        typeof value.id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value.id)
          ? value.id
          : `stored-${index}`;
      while (ids.has(id)) id = `${id}-copy`;
      const name =
        app.localizeBuildName(value.name.trim().replace(/\s+/g, ' ').slice(0, 30)) ||
        `Build ${builds.length + 1}`;
      builds.push({ id, name, cards: [...cards], budget });
      compositions.add(key);
      ids.add(id);
      if (builds.length === config.maxBuilds) break;
    }
    return builds;
  }

  state.builds = readBuilds();

  const heading = app.el('div', 'deck-heading');
  heading.append(
    app.el('h1', 'section-heading', 'Deck'),
    app.el('p', 'deck-intro', 'Choose one card of each type. Stay within your budget.'),
  );
  const layout = app.el('div', 'deck-layout');
  const library = app.el('div', 'deck-library');
  const toolbar = app.el('div', 'deck-toolbar');
  const searchWrap = app.el('label', 'deck-search');
  searchWrap.append(app.el('span', 'sr-only', 'Search cards'));
  const search = app.el('input');
  search.type = 'search';
  search.placeholder = 'Search';
  search.autocomplete = 'off';
  search.maxLength = 80;
  search.setAttribute('aria-label', 'Search cards by name or description');
  const searchGlyph = app.el('span', 'deck-search-glyph');
  searchGlyph.setAttribute('aria-hidden', 'true');
  searchWrap.append(searchGlyph, search);

  const filters = app.el('div', 'deck-filters');
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', 'Card type');
  const filterButtons = [];
  for (const [id, name] of [['all', 'All'], ...Object.entries(TYPE_NAMES)]) {
    const button = app.el('button', 'deck-filter', name);
    button.type = 'button';
    button.dataset.filter = id;
    button.addEventListener('click', () => {
      state.filter = id;
      render();
    });
    filters.append(button);
    filterButtons.push(button);
  }
  toolbar.append(searchWrap, filters);
  const results = app.el('p', 'deck-results sr-only');
  const grid = app.el('div', 'deck-card-grid');
  grid.setAttribute('aria-label', 'Card collection');
  library.append(toolbar, results, grid);

  const sidebar = app.el('aside', 'deck-sidebar panel');
  const sidebarHeader = app.el('div', 'deck-sidebar-heading');
  sidebarHeader.append(app.el('div', '', 'My Build'));
  const count = app.el('span', 'deck-count');
  sidebarHeader.append(count);
  const selectedList = app.el('div', 'deck-selected-list');
  selectedList.setAttribute('aria-label', 'One card of each type');

  const budgetWrap = app.el('div', 'deck-budget');
  const budgetLabel = app.el('label', 'deck-budget-label', 'Budget, coins');
  budgetLabel.htmlFor = 'deck-budget-input';
  const budgetInput = app.el('input', 'deck-budget-input');
  budgetInput.id = 'deck-budget-input';
  budgetInput.type = 'number';
  budgetInput.required = true;
  budgetInput.min = String(config.minBudget);
  budgetInput.max = String(config.maxBudget);
  budgetInput.step = '1';
  budgetInput.value = String(state.budget);
  budgetInput.setAttribute('aria-describedby', 'deck-budget-error deck-total');
  const budgetError = app.el('p', 'deck-budget-error');
  budgetError.id = 'deck-budget-error';
  budgetError.setAttribute('aria-live', 'polite');
  budgetWrap.append(budgetLabel, budgetInput, budgetError);
  const total = app.el('div', 'deck-total');
  total.id = 'deck-total';
  const totalValue = app.el('span', 'deck-total-value');
  total.append(app.el('span', '', 'Total'), totalValue);

  const status = app.el('p', 'deck-status');
  status.id = 'deck-live-message';
  status.setAttribute('aria-live', 'polite');
  const requirements = app.el('div', 'deck-requirements');
  const apply = app.el('button', 'btn btn-primary deck-apply', 'Go to Battle');
  apply.type = 'button';
  const clear = app.el('button', 'btn btn-ghost deck-clear', 'Clear');
  clear.type = 'button';
  const actions = app.el('div', 'deck-actions');
  actions.append(apply, clear);
  sidebar.append(
    sidebarHeader,
    selectedList,
    budgetWrap,
    total,
    requirements,
    status,
    actions,
  );
  layout.append(library, sidebar);

  const buildsSection = app.el('section', 'deck-builds panel');
  const buildsHeader = app.el('div', 'deck-builds-header');
  const buildsTitle = app.el('h2', '', 'Save & Compare');
  buildsTitle.id = 'deck-builds-title';
  buildsSection.setAttribute('aria-labelledby', buildsTitle.id);
  const buildCount = app.el('span', 'deck-build-count');
  buildsHeader.append(buildsTitle, buildCount);
  const saveForm = app.el('form', 'deck-save-form');
  const nameLabel = app.el('label', 'sr-only', 'Build name');
  nameLabel.htmlFor = 'deck-build-name';
  const nameInput = app.el('input');
  nameInput.id = 'deck-build-name';
  nameInput.type = 'text';
  nameInput.maxLength = 30;
  nameInput.placeholder = 'Build name';
  nameInput.autocomplete = 'off';
  const saveButton = app.el('button', 'deck-save-button btn btn-secondary', 'Save');
  saveButton.type = 'submit';
  saveButton.setAttribute('aria-describedby', 'deck-build-status');
  saveForm.append(nameLabel, nameInput, saveButton);
  const buildStatus = app.el('p', 'deck-build-status');
  buildStatus.id = 'deck-build-status';
  buildStatus.setAttribute('role', 'status');
  buildStatus.setAttribute('aria-live', 'polite');
  const buildGrid = app.el('div', 'deck-build-grid');
  buildGrid.setAttribute('aria-label', 'Saved build comparison');
  buildsSection.append(buildsHeader, saveForm, buildStatus, buildGrid);
  mount.append(heading, layout, buildsSection);

  function missingRequirements() {
    const missing = [];
    const counts = typeCounts();
    for (const type of TYPES) {
      if (counts[type] !== 1)
        missing.push(`Choose a card: ${TYPE_NAMES[type].toLocaleLowerCase('en-US')}.`);
    }
    const conflict = config.getConflict(state.selected);
    if (conflict) missing.push(conflict);
    if (!state.budgetValid)
      missing.push(
        `Budget must be a whole number from ${config.minBudget} to ${config.maxBudget}.`,
      );
    else if (config.getTotal(state.selected) > state.budget)
      missing.push(shortageMessage(config.getTotal(state.selected) - state.budget));
    return missing;
  }

  function announce(message, tone = 'neutral') {
    state.message = message;
    state.messageTone = tone;
  }

  function replacingCategory(card) {
    const chosen = new Map(state.selected.map((id) => [byId.get(id).type, id]));
    chosen.set(card.type, card.id);
    return TYPES.map((type) => chosen.get(type)).filter(Boolean);
  }

  function blockedReason(card) {
    if (state.selected.includes(card.id)) return '';
    if (!state.budgetValid) return 'Enter a valid budget.';
    const candidate = replacingCategory(card);
    const conflict = config.getConflict(candidate);
    if (conflict) return conflict;
    const shortage = config.getTotal(candidate) - state.budget;
    return shortage > 0 ? shortageMessage(shortage) : '';
  }

  function createCard(card) {
    const selected = state.selected.includes(card.id);
    const reason = blockedReason(card);
    const article = app.el(
      'article',
      `deck-card deck-card--${card.type}${selected ? ' is-selected' : ''}${
        reason ? ' is-blocked' : ''
      }`,
    );
    const button = app.el('button', 'deck-card-button');
    button.type = 'button';
    button.dataset.cardId = card.id;
    button.disabled = Boolean(reason);
    button.setAttribute('aria-label', `${selected ? 'Remove' : 'Choose'}: ${card.name}`);
    button.setAttribute('aria-pressed', String(selected));
    button.title =
      reason || `${app.battle.describeCard(card)} Cost: ${coins(card.cost)}.`;
    const top = app.el('span', 'deck-card-top');
    const cost = app.el('span', 'deck-card-cost', coins(card.cost));
    cost.setAttribute('aria-label', `Cost: ${coins(card.cost)}`);
    const mark = app.el('span', 'deck-card-check', selected ? '✓' : '+');
    mark.setAttribute('aria-hidden', 'true');
    top.append(cost, mark);
    const title = app.el('span', 'deck-card-name', card.name);
    const type = app.el(
      'span',
      'deck-card-type',
      `${TYPE_NAMES[card.type]} · ${app.battle.getActionEffect(card.type)}`,
    );
    const note = app.el('span', 'deck-card-note', reason);
    button.append(top, app.icon(card.icon, 'deck-card-icon'), title, type, note);
    article.append(button);
    return article;
  }

  function createSelected(card, type) {
    const row = app.el('div', `deck-selected-row deck-selected-row--${type}`);
    if (!card) {
      row.classList.add('deck-selected-empty');
      row.append(
        app.el('span', 'deck-empty-slot-symbol', '+'),
        app.el('span', '', TYPE_NAMES[type]),
      );
      return row;
    }
    row.append(app.icon(card.icon, 'deck-selected-icon'));
    const copy = app.el('span', 'deck-selected-copy', card.name);
    copy.title = `${TYPE_NAMES[type]} · ${coins(card.cost)}`;
    const remove = app.el('button', 'deck-remove', '×');
    remove.type = 'button';
    remove.dataset.removeId = card.id;
    remove.setAttribute('aria-label', `Remove from deck: ${card.name}`);
    row.append(copy, remove);
    return row;
  }

  function createBuild(build) {
    const article = app.el('article', 'deck-build');
    const header = app.el('div', 'deck-build-heading');
    const title = app.el('h3', 'deck-build-name', build.name);
    const remove = app.el('button', 'deck-build-delete', '×');
    remove.type = 'button';
    remove.dataset.deleteBuild = build.id;
    remove.setAttribute('aria-label', `Delete build ${build.name}`);
    header.append(title, remove);
    const counts = typeCounts(build.cards);
    const composition = app.el('div', 'deck-build-counts');
    for (const type of TYPES)
      composition.append(
        app.el(
          'span',
          `deck-build-type deck-build-type--${type}`,
          `${TYPE_NAMES[type]} ${counts[type]}`,
        ),
      );
    const buildTotal = app.el(
      'p',
      'deck-build-total',
      `${coins(config.getTotal(build.cards))} · Budget ${build.budget}`,
    );
    const cards = app.el('ul', 'deck-build-cards');
    for (const type of TYPES) {
      const card = byId.get(build.cards.find((id) => byId.get(id).type === type));
      const row = app.el('li', `deck-build-card deck-build-card--${card.type}`);
      row.append(app.icon(card.icon, 'deck-build-icon'), app.el('span', '', card.name));
      cards.append(row);
    }
    const load = app.el('button', 'btn btn-secondary deck-build-load', 'Load');
    load.type = 'button';
    load.dataset.restoreBuild = build.id;
    article.append(header, composition, buildTotal, cards, load);
    return article;
  }

  function renderBuilds() {
    const full = state.builds.length >= config.maxBuilds;
    const incomplete = missingRequirements().length > 0;
    buildCount.textContent = `${state.builds.length}/${config.maxBuilds}`;
    saveButton.disabled = full || incomplete;
    saveButton.title = full
      ? `Limit: ${config.maxBuilds} builds.`
      : incomplete
      ? 'Choose compatible cards within your budget.'
      : 'Save the selected cards and budget';
    const message = full ? 'Delete a build to save another.' : state.buildMessage;
    buildStatus.textContent =
      message ||
      (incomplete
        ? 'Choose one card of each type within budget.'
        : 'Saved in this browser.');
    buildStatus.className = `deck-build-status${
      !full && state.buildMessage ? ` deck-build-status--${state.buildTone}` : ''
    }`;
    buildGrid.replaceChildren();
    for (const build of state.builds) buildGrid.append(createBuild(build));
    if (state.builds.length === 0)
      buildGrid.append(app.el('p', 'deck-build-empty', 'Save a deck to compare builds.'));
  }

  function render() {
    byId.clear();
    for (const card of catalog) byId.set(card.id, card);
    for (const button of filterButtons) {
      const active = button.dataset.filter === state.filter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    const query = state.query.trim().toLocaleLowerCase('en-US');
    const visible = catalog.filter(
      (card) =>
        (state.filter === 'all' || card.type === state.filter) &&
        `${card.name} ${app.battle.describeCard(card)} ${TYPE_NAMES[card.type]}`
          .toLocaleLowerCase('en-US')
          .includes(query),
    );
    results.textContent = `${visible.length} of ${catalog.length} cards found`;
    grid.replaceChildren();
    for (const type of TYPES) {
      const cards = visible.filter((card) => card.type === type);
      if (cards.length === 0) continue;
      grid.append(app.el('h2', 'deck-category-title', TYPE_NAMES[type]));
      for (const card of cards) grid.append(createCard(card));
    }
    if (visible.length === 0) {
      const empty = app.el('div', 'deck-empty');
      empty.append(app.el('p', '', 'No cards found.'));
      const reset = app.el('button', 'btn btn-secondary', 'Reset search');
      reset.type = 'button';
      reset.dataset.resetSearch = 'true';
      empty.append(reset);
      grid.append(empty);
    }

    count.textContent = `${state.selected.length}/${config.size}`;
    selectedList.replaceChildren();
    for (const type of TYPES) {
      const card = state.selected
        .map((id) => byId.get(id))
        .find((item) => item.type === type);
      selectedList.append(createSelected(card, type));
    }
    const price = config.getTotal(state.selected);
    const overBudget = state.budgetValid && price > state.budget;
    totalValue.textContent = `${price} / ${state.budgetValid ? state.budget : '—'} coins`;
    total.classList.toggle('is-over-budget', overBudget);
    budgetInput.setAttribute('aria-invalid', String(!state.budgetValid || overBudget));
    budgetError.textContent = !state.budgetValid
      ? `Enter a whole number from ${config.minBudget} to ${config.maxBudget}.`
      : overBudget
      ? shortageMessage(price - state.budget)
      : '';
    requirements.replaceChildren();
    const counts = typeCounts();
    for (const type of TYPES) {
      const found = counts[type] === 1;
      requirements.append(
        app.el(
          'span',
          `deck-requirement${found ? ' is-met' : ''}`,
          `${found ? '✓' : '○'} ${TYPE_NAMES[type]}`,
        ),
      );
    }
    const missing = missingRequirements();
    const missingTypes = TYPES.filter((type) => counts[type] !== 1);
    const guidance = !state.budgetValid
      ? 'Enter a valid budget.'
      : overBudget
      ? 'Raise your budget or choose cheaper cards.'
      : config.getConflict(state.selected) ||
        (missingTypes.length
          ? `Choose: ${missingTypes
              .map((type) => TYPE_NAMES[type].toLocaleLowerCase('en-US'))
              .join(', ')}.`
          : 'Ready!');
    status.textContent = state.message || guidance;
    status.className = `deck-status deck-status--${
      state.message ? state.messageTone : missing.length ? 'neutral' : 'success'
    }`;
    apply.disabled = missing.length > 0;
    apply.setAttribute('aria-describedby', status.id);
    clear.disabled = state.selected.length === 0;
    renderBuilds();
  }

  function toggleCard(id) {
    const card = byId.get(id);
    if (!card) return;
    if (state.selected.includes(id))
      state.selected = state.selected.filter((item) => item !== id);
    else {
      const reason = blockedReason(card);
      if (reason) {
        announce(reason, 'error');
        render();
        return;
      }

      state.selected = replacingCategory(card);
    }
    announce('');
    state.buildMessage = '';
    state.buildTone = 'neutral';
    render();
  }

  grid.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || !grid.contains(button)) return;
    if (button.dataset.resetSearch) {
      search.value = '';
      state.query = '';
      state.filter = 'all';
      render();
      search.focus();
    } else if (button.dataset.cardId) {
      const id = button.dataset.cardId;
      toggleCard(id);
      const next = [...grid.querySelectorAll('[data-card-id]')].find(
        (item) => item.dataset.cardId === id,
      );
      if (next && !next.disabled) next.focus();
    }
  });

  selectedList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-id]');
    if (!button || !selectedList.contains(button)) return;
    const id = button.dataset.removeId;
    const index = [...selectedList.querySelectorAll('button')].indexOf(button);
    toggleCard(id);
    const remaining = [...selectedList.querySelectorAll('button')];
    const catalogButton = [...grid.querySelectorAll('[data-card-id]')].find(
      (item) => item.dataset.cardId === id && !item.disabled,
    );
    (remaining[Math.min(index, remaining.length - 1)] || catalogButton || search).focus();
  });

  search.addEventListener('input', () => {
    state.query = search.value;
    render();
  });

  budgetInput.addEventListener('input', () => {
    const value = budgetInput.valueAsNumber;
    state.budgetValid = validBudget(value);
    if (state.budgetValid) state.budget = value;
    announce('');
    state.buildMessage = '';
    state.buildTone = 'neutral';
    render();
  });

  clear.addEventListener('click', () => {
    state.selected = [];
    announce('');
    state.buildMessage = '';
    state.buildTone = 'neutral';
    render();
  });

  apply.addEventListener('click', () => {
    if (!state.budgetValid || !config.validate(state.selected, state.budget)) {
      announce('Choose compatible cards within your budget.', 'error');
      render();
      return;
    }
    app.setDeck([...state.selected], state.budget);
    announce('Ready!', 'success');
    document.dispatchEvent(new CustomEvent('obsidian:statschange'));
    render();
    app.battle.restart();
    app.openTab('battle', true);
  });

  saveForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (
      state.builds.length >= config.maxBuilds ||
      !state.budgetValid ||
      !config.validate(state.selected, state.budget)
    ) {
      state.buildMessage =
        state.builds.length >= config.maxBuilds
          ? 'Delete a build to save another.'
          : 'Choose compatible cards within your budget.';
      state.buildTone = 'error';
      render();
      return;
    }
    const key = compositionKey(state.selected);
    if (state.builds.some((build) => compositionKey(build.cards) === key)) {
      state.buildMessage = 'This build is already saved.';
      state.buildTone = 'error';
      render();
      return;
    }
    let number = 1;
    while (
      state.builds.some(
        (build) => build.name.toLocaleLowerCase('en-US') === `build ${number}`,
      )
    )
      number += 1;
    const name =
      nameInput.value.trim().replace(/\s+/g, ' ').slice(0, 30) || `Build ${number}`;
    const baseId = `build-${Date.now()}`;
    let suffix = 1;
    while (state.builds.some((build) => build.id === `${baseId}-${suffix}`)) suffix += 1;
    state.builds.push({
      id: `${baseId}-${suffix}`,
      name,
      cards: [...state.selected],
      budget: state.budget,
    });
    app.writeStore('builds', state.builds);
    nameInput.value = '';
    state.buildMessage = 'Build saved.';
    state.buildTone = 'success';
    render();
    nameInput.focus();
  });

  buildGrid.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || !buildGrid.contains(button)) return;
    if (button.dataset.deleteBuild) {
      const index = [...buildGrid.querySelectorAll('[data-delete-build]')].indexOf(
        button,
      );
      state.builds = state.builds.filter(
        (build) => build.id !== button.dataset.deleteBuild,
      );
      app.writeStore('builds', state.builds);
      state.buildMessage = 'Build deleted.';
      state.buildTone = 'success';
      render();
      const remaining = [...buildGrid.querySelectorAll('[data-delete-build]')];
      (remaining[Math.min(index, remaining.length - 1)] || nameInput).focus();
    } else if (button.dataset.restoreBuild) {
      const build = state.builds.find((item) => item.id === button.dataset.restoreBuild);
      if (!build) return;
      state.selected = [...build.cards];
      state.budget = build.budget;
      state.budgetValid = true;
      budgetInput.value = String(build.budget);
      state.query = '';
      state.filter = 'all';
      search.value = '';
      announce('');
      state.buildMessage = 'Build loaded. Click Go to Battle.';
      state.buildTone = 'success';
      render();
      app.notify(state.buildMessage, 'success');
      apply.focus();
    }
  });

  app.deck = {
    getState: () => ({
      ...state,
      selected: [...state.selected],
      total: config.getTotal(state.selected),
      builds: state.builds.map((build) => ({ ...build, cards: [...build.cards] })),
      requirements: missingRequirements(),
    }),
    render,
  };
  render();
})();
