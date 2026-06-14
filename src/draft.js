const EMPTY_DRAFT = Object.freeze([null, null, null, null, null]);

function normalizeHeroId(value) {
  const heroId = Number(value);
  return Number.isFinite(heroId) && heroId > 0 ? heroId : null;
}

function normalizeTeamPicks(values) {
  const picks = Array.isArray(values) ? values.map(normalizeHeroId) : [];

  while (picks.length < 5) {
    picks.push(null);
  }

  return picks.slice(0, 5);
}

function objectValuesByNumericSuffix(source, prefix, suffix = '') {
  if (!source || typeof source !== 'object') {
    return [];
  }

  return Object.entries(source)
    .map(([key, value]) => {
      const match = key.match(new RegExp(`^${prefix}(\\d+)${suffix}$`));
      return match ? { index: Number(match[1]), value } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index)
    .map(entry => entry.value);
}

function extractDraftTeam(draftTeam) {
  if (!draftTeam || typeof draftTeam !== 'object') {
    return [...EMPTY_DRAFT];
  }

  const directPicks = Array.from({ length: 5 }, (_, index) => draftTeam[`pick${index}_id`]);
  const suffixedPicks = objectValuesByNumericSuffix(draftTeam, 'pick', '_id');
  const nestedPicks = objectValuesByNumericSuffix(draftTeam, 'pick').map(pick => pick?.id ?? pick?.hero_id ?? pick);
  const candidates = [directPicks, suffixedPicks, nestedPicks];
  const bestCandidate = candidates.find(values => normalizeTeamPicks(values).some(heroId => heroId > 0));

  return normalizeTeamPicks(bestCandidate || directPicks);
}

function extractHeroTeam(heroTeam) {
  if (!heroTeam || typeof heroTeam !== 'object') {
    return [...EMPTY_DRAFT];
  }

  const directPlayers = Array.from({ length: 5 }, (_, index) => heroTeam[`player${index}`]?.id);
  const nestedPlayers = objectValuesByNumericSuffix(heroTeam, 'player').map(player => player?.id ?? player?.hero_id ?? player);
  const candidates = [directPlayers, nestedPlayers];
  const bestCandidate = candidates.find(values => normalizeTeamPicks(values).some(heroId => heroId > 0));

  return normalizeTeamPicks(bestCandidate || directPlayers);
}

function extractFlatDraft(gameState, teamName) {
  const draft = gameState?.draft;
  if (!draft || typeof draft !== 'object') {
    return [...EMPTY_DRAFT];
  }

  const values = Array.from({ length: 5 }, (_, index) => (
    draft[`${teamName}_pick${index}_id`]
    ?? draft[`${teamName}_pick_${index}_id`]
    ?? draft[`${teamName}_hero${index + 1}`]
  ));

  return normalizeTeamPicks(values);
}

function hasAnyPick(heroIds) {
  return heroIds.some(heroId => Number(heroId) > 0);
}

function diagnosticReason(gameState, radiantHeroIds, direHeroIds) {
  const safeGameState = gameState && typeof gameState === 'object' ? gameState : {};
  const hasDraft = safeGameState.draft && Object.keys(safeGameState.draft).length > 0;
  const hasHeroTeams = Boolean(safeGameState.hero?.team2 || safeGameState.hero?.team3 || safeGameState.hero?.radiant || safeGameState.hero?.dire);
  const gameStateName = safeGameState.map?.game_state || '';

  if (hasAnyPick(radiantHeroIds) || hasAnyPick(direHeroIds)) {
    return '';
  }

  if (gameStateName === 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS' && !hasDraft && !hasHeroTeams) {
    return 'Dota GSI is connected, but this in-progress game is not exposing draft or team hero data. Try connecting during draft, or use spectator/observer mode for full team data.';
  }

  if (!hasDraft && !hasHeroTeams) {
    return 'Dota GSI is connected, but no draft or team hero data is present in the payload.';
  }

  return 'Dota GSI is connected, but no hero IDs were found in the current payload shape.';
}

function preferFirstNonEmpty(...candidateSets) {
  return candidateSets.find(hasAnyPick) || [...EMPTY_DRAFT];
}

export function normalizeGameStateDraft(gameState) {
  const safeGameState = gameState && typeof gameState === 'object' ? gameState : {};
  const draft = safeGameState.draft || {};
  const hero = safeGameState.hero || {};
  const radiantHeroIds = preferFirstNonEmpty(
    extractDraftTeam(draft.team2),
    extractDraftTeam(draft.radiant),
    extractFlatDraft(safeGameState, 'radiant'),
    extractHeroTeam(hero.team2),
    extractHeroTeam(hero.radiant),
  );
  const direHeroIds = preferFirstNonEmpty(
    extractDraftTeam(draft.team3),
    extractDraftTeam(draft.dire),
    extractFlatDraft(safeGameState, 'dire'),
    extractHeroTeam(hero.team3),
    extractHeroTeam(hero.dire),
  );
  const matchId = safeGameState.map?.matchid || safeGameState.map?.match_id || '';
  const winTeam = safeGameState.map?.win_team;

  return {
    connected: hasAnyPick(radiantHeroIds) || hasAnyPick(direHeroIds) || Boolean(matchId),
    source: 'dota-gsi',
    matchId: matchId ? String(matchId) : '',
    radiantHeroIds,
    direHeroIds,
    radiantWin: winTeam === 'radiant' ? true : winTeam === 'dire' ? false : null,
    diagnostic: diagnosticReason(safeGameState, radiantHeroIds, direHeroIds),
    gameState: safeGameState.map?.game_state || '',
    updatedAt: new Date().toISOString(),
  };
}

export function summarizeGameState(gameState) {
  const safeGameState = gameState && typeof gameState === 'object' ? gameState : {};
  const draft = safeGameState.draft && typeof safeGameState.draft === 'object' ? safeGameState.draft : null;
  const hero = safeGameState.hero && typeof safeGameState.hero === 'object' ? safeGameState.hero : null;

  return {
    topLevelKeys: Object.keys(safeGameState),
    map: safeGameState.map || null,
    draftKeys: draft ? Object.keys(draft) : [],
    draftTeam2Keys: draft?.team2 ? Object.keys(draft.team2) : [],
    draftTeam3Keys: draft?.team3 ? Object.keys(draft.team3) : [],
    draftRadiantKeys: draft?.radiant ? Object.keys(draft.radiant) : [],
    draftDireKeys: draft?.dire ? Object.keys(draft.dire) : [],
    heroKeys: hero ? Object.keys(hero) : [],
    heroTeam2Keys: hero?.team2 ? Object.keys(hero.team2) : [],
    heroTeam3Keys: hero?.team3 ? Object.keys(hero.team3) : [],
    heroRadiantKeys: hero?.radiant ? Object.keys(hero.radiant) : [],
    heroDireKeys: hero?.dire ? Object.keys(hero.dire) : [],
  };
}

export function emptyDraft() {
  return {
    connected: false,
    source: 'dota-gsi',
    matchId: '',
    radiantHeroIds: [...EMPTY_DRAFT],
    direHeroIds: [...EMPTY_DRAFT],
    radiantWin: null,
    diagnostic: '',
    gameState: '',
    updatedAt: null,
  };
}


