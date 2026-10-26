(() => {
  'use strict';

  const App = window.Obsidian;
  const mount = document.getElementById('hero-panel');
  if (!App || !mount) return;

  const TOTAL_POINTS = 20;
  const SKILL_MIN = 1;
  const SKILL_MAX = 10;
  const MIN_VITALITY = 3;
  const STRENGTH_PER_VITALITY = 2;
  const NAME_MIN = 2;
  const NAME_MAX = 18;
  const RESERVED_NAMES = [
    'Admin',
    'Obsidian',
    'Dark Knight',
    'Game Master',
    '\u0410\u0434\u043c\u0438\u043d',
    '\u041e\u0431\u0441\u0438\u0434\u0438\u0430\u043d',
    '\u0422\u0451\u043c\u043d\u044b\u0439 \u0440\u044b\u0446\u0430\u0440\u044c',
    '\u041c\u0430\u0441\u0442\u0435\u0440 \u0438\u0433\u0440\u044b',
  ];
  const CLASSES = {
    knight: {
      name: 'Knight',
      portrait: 'knight',
      skill: 'strength',
      minimum: 6,
      skillName: 'Strength',
      description: 'Steel in hand. Resolve in heart.',
      stats: [6, 5, 4, 5],
    },
    mage: {
      name: 'Mage',
      portrait: 'mage',
      skill: 'magic',
      minimum: 6,
      skillName: 'Magic',
      description: 'Where light ends, magic begins.',
      stats: [3, 4, 8, 5],
    },
    rogue: {
      name: 'Rogue',
      portrait: 'rogue',
      skill: 'agility',
      minimum: 6,
      skillName: 'Agility',
      description: 'Fortune favors the swift.',
      stats: [4, 8, 3, 5],
    },
  };
  const SKILLS = [
    { id: 'strength', label: 'Strength', icon: 'sword_iron', hint: 'A steady hand' },
    { id: 'agility', label: 'Agility', icon: 'skill_charge', hint: 'A light step' },
    { id: 'magic', label: 'Magic', icon: 'spell_fireball', hint: 'Arcane knowledge' },
    {
      id: 'vitality',
      label: 'Vitality',
      icon: 'shield_iron',
      hint: 'Unbreakable resolve',
    },
  ];
  const COLORS = { violet: 'Amethyst', teal: 'Emerald', amber: 'Amber' };
  const fields = new Map();
  const touched = new Set();
  let cardMode = 'saved';
  const normaliseName = (value) =>
    value
      .normalize('NFKC')
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('en-US')
      .replace(/\u0451/g, '\u0435');
  const reserved = new Set(RESERVED_NAMES.map(normaliseName));
  const el = App.el;

  const header = el('div', 'section-heading creator-heading');
  const headingText = el('div');
  headingText.append(el('h1', '', 'Create Hero'));
  header.append(headingText);
  mount.append(header);

  const layout = el('div', 'creator-layout');
  const form = el('form', 'panel creator-form');
  form.id = 'character-form';
  form.noValidate = true;
  form.setAttribute('aria-label', 'Create a character');
  const summary = el('div', 'creator-errors');
  summary.id = 'hero-error-summary';
  summary.hidden = true;
  summary.setAttribute('role', 'alert');
  summary.setAttribute('aria-live', 'assertive');
  form.append(summary);

  function addField(id, labelText, input, hintText, wrapperClass = '') {
    const wrapper = el('div', `creator-field ${wrapperClass}`.trim());
    const label = el('label', 'creator-label', labelText);
    label.htmlFor = `hero-${id}`;
    input.id = `hero-${id}`;
    input.name = id;
    input.setAttribute('aria-invalid', 'false');
    const hint = el('p', 'creator-hint', hintText);
    hint.id = `hero-${id}-hint`;
    const error = el('p', 'creator-error');
    error.id = `hero-${id}-error`;
    error.hidden = true;
    input.setAttribute('aria-describedby', `${hint.id} ${error.id}`);
    wrapper.append(label, input, hint, error);
    fields.set(id, { input, error, wrapper });
    return wrapper;
  }

  const identityTitle = el('div', 'creator-step');
  identityTitle.append(
    el('span', 'creator-step-number', '01'),
    el('h2', '', 'Name & Class'),
  );
  form.append(identityTitle);
  const nameInput = el('input');
  nameInput.type = 'text';
  nameInput.required = true;
  nameInput.minLength = NAME_MIN;
  nameInput.maxLength = NAME_MAX;
  nameInput.pattern =
    "[A-Za-z\u0410-\u042f\u0430-\u044f\u0401\u0451][A-Za-z\u0410-\u042f\u0430-\u044f\u0401\u04510-9 '\u2019\\-]*";
  nameInput.autocomplete = 'off';
  nameInput.placeholder = 'What will your legend be called?';
  form.append(
    addField(
      'name',
      'Hero Name',
      nameInput,
      `${NAME_MIN}–${NAME_MAX} characters. Start with a letter. Admin, Obsidian, Dark Knight and Game Master are taken.`,
    ),
  );

  const identityRow = el('div', 'creator-identity-row');
  const classInput = el('select');
  classInput.required = true;
  for (const [id, definition] of Object.entries(CLASSES)) {
    const option = el('option', '', definition.name);
    option.value = id;
    classInput.append(option);
  }
  const colorInput = el('select');
  colorInput.required = true;
  for (const [id, name] of Object.entries(COLORS)) {
    const option = el('option', '', name);
    option.value = id;
    colorInput.append(option);
  }
  const classHint = Object.values(CLASSES)
    .map(
      (definition) =>
        `${definition.name}: ${definition.skillName} ≥ ${definition.minimum}.`,
    )
    .join(' ');
  identityRow.append(
    addField('classId', 'Class', classInput, classHint),
    addField(
      'color',
      'Aura Color',
      colorInput,
      'The accent color of your character card.',
    ),
  );
  form.append(identityRow);

  const skillsHeading = el('div', 'creator-skills-heading');
  const skillsTitle = el('div', 'creator-step');
  skillsTitle.append(
    el('span', 'creator-step-number', '02'),
    el('h2', '', 'Allocate Skills'),
  );
  const distributeButton = el('button', 'btn btn-ghost creator-auto', 'Auto-Assign');
  distributeButton.type = 'button';
  skillsHeading.append(skillsTitle, distributeButton);
  form.append(skillsHeading);
  const points = el('div', 'creator-points');
  const pointsText = el('span');
  points.setAttribute('aria-live', 'polite');
  points.append(App.icon('amulet_moon', 'creator-points-icon'), pointsText);
  form.append(points);

  const skillGrid = el('div', 'creator-skills-grid');
  for (let index = 0; index < SKILLS.length; index += 1) {
    const skill = SKILLS[index];
    const input = el('input');
    input.type = 'number';
    input.required = true;
    input.min = String(SKILL_MIN);
    input.max = String(SKILL_MAX);
    input.step = '1';
    input.inputMode = 'numeric';
    input.defaultValue = String(CLASSES.knight.stats[index]);
    const hint =
      skill.id === 'vitality'
        ? `${MIN_VITALITY}–${SKILL_MAX}; at least half your Strength, rounded up.`
        : `${SKILL_MIN}–${SKILL_MAX}. ${skill.hint}.`;
    const wrapper = addField(skill.id, skill.label, input, hint, 'creator-skill-field');
    wrapper.querySelector('label').prepend(App.icon(skill.icon, 'creator-skill-icon'));
    skillGrid.append(wrapper);
  }
  form.append(skillGrid);
  const totalError = el('p', 'creator-error creator-total-error');
  totalError.id = 'hero-total-error';
  totalError.hidden = true;
  form.append(totalError);
  for (const skill of SKILLS) {
    const input = fields.get(skill.id).input;
    input.setAttribute(
      'aria-describedby',
      `${input.getAttribute('aria-describedby')} ${totalError.id}`,
    );
  }
  const submitRow = el('div', 'creator-submit-row');
  const submit = el('button', 'btn btn-primary', 'Create Hero →');
  submit.type = 'submit';
  submitRow.append(
    submit,
    el(
      'p',
      'creator-hint',
      'Your hero is saved in this browser. Skills describe your character; battle rules are the same for every class.',
    ),
  );
  form.append(submitRow);

  const previewAside = el('aside', 'creator-preview-area');
  const preview = el('article', 'creator-card aura-violet');
  preview.id = 'hero-character-card';
  const cardTop = el('div', 'creator-card-top');
  const classBadge = el('span', 'creator-class-badge');
  cardTop.append(el('span', 'creator-card-edition', 'OBSIDIAN / HERO'), classBadge);
  const portraitStage = el('div', 'creator-portrait-stage');
  const portrait = el('img', 'creator-portrait');
  portrait.width = 400;
  portrait.height = 400;
  portraitStage.append(portrait);
  const previewName = el('h2', 'creator-card-name');
  const previewDescription = el('p', 'creator-card-description');
  const previewStats = el('div', 'creator-card-stats');
  const statValues = new Map();
  for (const skill of SKILLS) {
    const stat = el('div', 'creator-card-stat');
    const value = el('strong');
    stat.append(
      App.icon(skill.icon, 'creator-card-stat-icon'),
      value,
      el('span', '', skill.label),
    );
    statValues.set(skill.id, value);
    previewStats.append(stat);
  }
  const previewFoot = el('div', 'creator-card-foot');
  previewFoot.append(
    el('span', '', `${App.battle.rules.MAX_HP} HP`),
    el('span', '', 'I • SEEKER'),
  );
  preview.append(
    cardTop,
    portraitStage,
    previewName,
    previewDescription,
    previewStats,
    previewFoot,
  );
  const previewNote = el('p', 'creator-preview-note');
  const result = el('section', 'creator-result');
  result.hidden = true;
  result.setAttribute('aria-live', 'polite');
  previewAside.append(preview, previewNote, result);
  layout.append(form, previewAside);
  mount.append(layout);

  function getDraft() {
    const draft = {};
    for (const [id, field] of fields) {
      draft[id] = SKILLS.some((skill) => skill.id === id)
        ? field.input.value === ''
          ? NaN
          : Number(field.input.value)
        : field.input.value;
    }
    draft.name = draft.name.normalize('NFKC').trim().replace(/\s+/g, ' ');
    draft.portrait = CLASSES[draft.classId]?.portrait || 'knight';
    return draft;
  }

  function countPoints(draft) {
    let total = 0;
    for (const skill of SKILLS) {
      if (Number.isFinite(draft[skill.id])) total += draft[skill.id];
    }
    return total;
  }

  function validate(draft) {
    const errors = new Map();
    if (draft.name.length < NAME_MIN || draft.name.length > NAME_MAX) {
      errors.set('name', `Enter a name with ${NAME_MIN}–${NAME_MAX} characters.`);
    } else if (
      !/^[A-Za-z\u0410-\u042f\u0430-\u044f\u0401\u0451][A-Za-z\u0410-\u042f\u0430-\u044f\u0401\u04510-9 '\u2019-]*$/u.test(
        draft.name,
      )
    ) {
      errors.set(
        'name',
        'Start with a letter. Use letters, numbers, spaces, hyphens or apostrophes.',
      );
    } else if (reserved.has(normaliseName(draft.name))) {
      errors.set('name', 'That name is taken. Choose another hero name.');
    }
    if (!Object.hasOwn(CLASSES, draft.classId))
      errors.set('classId', 'Choose one of the available classes.');
    if (!Object.hasOwn(COLORS, draft.color))
      errors.set('color', 'Choose one of the available aura colors.');
    for (const skill of SKILLS) {
      const input = fields.get(skill.id).input;
      if (
        input.value === '' ||
        !input.checkValidity() ||
        !Number.isInteger(draft[skill.id]) ||
        draft[skill.id] < SKILL_MIN ||
        draft[skill.id] > SKILL_MAX
      ) {
        errors.set(skill.id, `Enter a whole number from ${SKILL_MIN} to ${SKILL_MAX}.`);
      }
    }
    if (!errors.has('vitality') && draft.vitality < MIN_VITALITY) {
      errors.set('vitality', `Vitality must be at least ${MIN_VITALITY}.`);
    }

    const vitalityForStrength = Math.ceil(draft.strength / STRENGTH_PER_VITALITY);
    if (
      !errors.has('strength') &&
      !errors.has('vitality') &&
      draft.vitality < vitalityForStrength
    ) {
      errors.set(
        'vitality',
        `Strength ${draft.strength} requires at least ${vitalityForStrength} Vitality: half your Strength, rounded up.`,
      );
    }
    const selectedClass = CLASSES[draft.classId];
    if (
      selectedClass &&
      !errors.has(selectedClass.skill) &&
      draft[selectedClass.skill] < selectedClass.minimum
    ) {
      errors.set(
        selectedClass.skill,
        `${selectedClass.name} requires at least ${selectedClass.minimum} ${selectedClass.skillName}.`,
      );
    }
    if (countPoints(draft) !== TOTAL_POINTS)
      errors.set(
        'total',
        `Allocate exactly ${TOTAL_POINTS} points. Currently used: ${countPoints(draft)}.`,
      );
    return errors;
  }

  function renderErrors(showSummary = false) {
    const errors = validate(getDraft());
    for (const [id, field] of fields) {
      const show = touched.has(id) && errors.has(id);
      field.error.hidden = !show;
      field.error.textContent = show ? errors.get(id) : '';
      const sumInvalid =
        SKILLS.some((skill) => skill.id === id) && touched.has(id) && errors.has('total');
      field.input.setAttribute('aria-invalid', String(show || sumInvalid));
      field.wrapper.classList.toggle('has-error', show || sumInvalid);
    }
    const skillsTouched = SKILLS.some((skill) => touched.has(skill.id));
    totalError.hidden = !(errors.has('total') && skillsTouched);
    totalError.textContent = totalError.hidden ? '' : errors.get('total');
    if (showSummary || !summary.hidden) {
      summary.hidden = errors.size === 0;
      summary.textContent = errors.size
        ? `Hero not created. Errors: ${errors.size}. Check the highlighted fields.`
        : '';
    }
    return errors;
  }

  function renderCard(profile) {
    const definition = CLASSES[profile.classId] || CLASSES.knight;
    preview.className = `creator-card aura-${
      Object.hasOwn(COLORS, profile.color) ? profile.color : 'violet'
    }`;
    preview.dataset.state = cardMode;
    preview.setAttribute(
      'aria-label',
      `${cardMode === 'saved' ? 'Your hero' : 'Hero draft'}: ${
        profile.name || 'New Seeker'
      }`,
    );
    portrait.src = `assets/portraits/${definition.portrait}.png`;
    portrait.alt = `${definition.name} portrait`;
    classBadge.textContent = definition.name;
    previewName.textContent = profile.name || 'New Seeker';
    previewDescription.textContent = definition.description;
    for (const skill of SKILLS)
      statValues.get(skill.id).textContent = Number.isFinite(profile[skill.id])
        ? String(profile[skill.id])
        : '—';
  }

  function renderPoints() {
    const remaining = TOTAL_POINTS - countPoints(getDraft());
    points.classList.toggle('is-complete', remaining === 0);
    points.classList.toggle('is-over', remaining < 0);
    pointsText.textContent =
      remaining === 0
        ? `All ${TOTAL_POINTS} points allocated`
        : remaining > 0
        ? `Points remaining: ${remaining} of ${TOTAL_POINTS}`
        : `${Math.abs(remaining)} points over the ${TOTAL_POINTS}-point limit`;
  }

  function renderPreview() {
    cardMode = 'draft';
    previewNote.textContent =
      'Draft character. Select Create Hero to save it and take it into the arena.';
    result.hidden = true;
    renderCard(getDraft());
    renderPoints();
  }

  function scrollOptions(block = 'nearest') {
    return {
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block,
      inline: 'nearest',
    };
  }

  function showSavedHero(profile = App.getHero(), created = false) {
    cardMode = 'saved';
    previewNote.textContent =
      'Hero saved. Select Enter Arena to start a new battle with this character.';
    renderCard(profile);
    result.replaceChildren();
    result.className = `creator-result aura-${profile.color}`;
    result.append(
      el('p', 'eyebrow', created ? 'HERO CREATED & SAVED' : 'READY FOR ADVENTURE'),
    );
    const playButton = el('button', 'btn btn-primary creator-play', 'Enter Arena →');
    playButton.id = 'hero-enter-arena';
    playButton.type = 'button';
    playButton.addEventListener('click', () => {
      if (typeof App.battle?.restart === 'function') App.battle.restart();
      App.openTab('battle', true);
    });
    const anotherButton = el(
      'button',
      'btn btn-ghost creator-new',
      'Create Another Hero',
    );
    anotherButton.id = 'hero-create-another';
    anotherButton.type = 'button';
    anotherButton.addEventListener('click', () => {
      form.reset();
      touched.clear();
      summary.hidden = true;
      summary.textContent = '';
      renderPreview();
      renderErrors();
      nameInput.focus({ preventScroll: true });
      nameInput.scrollIntoView(scrollOptions());
    });
    result.append(playButton, anotherButton);
    result.hidden = false;
    if (created) {
      playButton.focus({ preventScroll: true });
      playButton.scrollIntoView(scrollOptions());
    }
  }

  function onEdit(event) {
    if (!fields.has(event.target.name)) return;
    renderPreview();

    renderErrors();
  }
  form.addEventListener('input', onEdit);
  form.addEventListener('change', onEdit);
  form.addEventListener(
    'blur',
    (event) => {
      if (!fields.has(event.target.name)) return;
      touched.add(event.target.name);
      renderErrors();
    },
    true,
  );

  distributeButton.addEventListener('click', () => {
    const definition = CLASSES[classInput.value] || CLASSES.knight;
    for (let index = 0; index < SKILLS.length; index += 1)
      fields.get(SKILLS[index].id).input.value = definition.stats[index];
    renderPreview();
    renderErrors();
    App.notify(`Skills assigned for ${definition.name}.`, 'success');
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    for (const id of fields.keys()) touched.add(id);
    const errors = renderErrors(true);
    if (errors.size !== 0) {
      const firstInvalid = [...fields.entries()].find(([id]) => errors.has(id));
      const firstInput = firstInvalid
        ? firstInvalid[1].input
        : fields.get('strength').input;
      firstInput.focus();
      return;
    }
    const hero = getDraft();
    if (App.setHero(hero) === false) {
      summary.textContent = 'Could not save your hero. Check the name and skills.';
      summary.hidden = false;
      nameInput.focus();
      return;
    }

    form.reset();
    touched.clear();
    summary.hidden = true;
    summary.textContent = '';
    renderPoints();
    renderErrors();
    showSavedHero(App.getHero(), true);
    App.notify(`${hero.name} is ready for adventure.`, 'success');
  });

  const saved = App.getHero();
  for (const [id, field] of fields) {
    if (saved[id] !== undefined) field.input.value = String(saved[id]);
  }
  renderPoints();
  showSavedHero(saved);

  document.addEventListener('obsidian:herochange', () => {
    if (cardMode === 'saved') showSavedHero(App.getHero());
  });

  App.creator = {
    getDraft: () => ({ ...getDraft() }),
    getErrors: () => Object.fromEntries(validate(getDraft())),
    getDisplayMode: () => cardMode,
  };
})();
