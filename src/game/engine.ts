import {
  GameState,
  PlayerState,
  Building,
  Card,
  RoleType,
  GoodType,
  Language,
  TRADING_TILES,
  MAX_BUILDINGS,
} from './types';
import { CARD_DEF_MAP } from './cardData';
import {
  createDeck,
  drawCards,
  getCardDef,
  hasBuilding,
  getHandLimit,
  resetInstanceIdCounter,
} from './utils';
import { calculateFinalScores } from './scoring';
import { getCardDisplayName, getGoodName, getRoleName } from '../i18n';

// ==================== i18n helpers ====================

function lang(state: GameState): Language {
  return state.language;
}

function cardName(state: GameState, defId: string): string {
  const def = CARD_DEF_MAP[defId];
  return getCardDisplayName(defId, lang(state), def?.name ?? defId);
}

function goodName(state: GameState, good: GoodType): string {
  return getGoodName(good, lang(state));
}

function roleName(state: GameState, role: RoleType): string {
  return getRoleName(role, lang(state));
}

function txt(state: GameState, ja: string, en: string): string {
  return lang(state) === 'ja' ? ja : en;
}

// ==================== 初期化 ====================

export function createInitialGameState(language: Language = 'ja'): GameState {
  resetInstanceIdCounter();
  let deck = createDeck();
  const discard: Card[] = [];
  const players: PlayerState[] = [];

  const cpuNamePoolJa = [
    'ルナ', 'セレネ', 'モルガナ', 'メディア', 'キルケ', 'ヘカテ',
    'リリス', 'ノクス', 'アリア', 'フレイヤ', 'イシス', 'カリス',
    'ベラ', 'ステラ', 'ノーラ', 'マーラ', 'ウィロウ', 'セイジ',
  ];
  const cpuNamePoolEn = [
    'Luna', 'Selene', 'Morgana', 'Medea', 'Circe', 'Hecate',
    'Lilith', 'Nox', 'Aria', 'Freya', 'Isis', 'Charis',
    'Bella', 'Stella', 'Nora', 'Mara', 'Willow', 'Sage',
  ];

  const pool = language === 'ja' ? cpuNamePoolJa : cpuNamePoolEn;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const playerName = language === 'ja' ? 'あなた' : 'You';
  const names = [playerName, shuffled[0], shuffled[1], shuffled[2]];

  for (let i = 0; i < 4; i++) {
    const indigoIndex = deck.findIndex((c) => c.defId === 'indigo_plant');
    const indigoCard = deck.splice(indigoIndex, 1)[0];

    const result = drawCards(deck, discard, 4);
    deck = result.deck;

    players.push({
      id: i,
      name: names[i],
      hand: result.drawn,
      buildings: [{ card: indigoCard, good: null, chapelCards: 0 }],
      isHuman: i === 0,
    });
  }

  return {
    phase: 'title',
    subPhase: null,
    players,
    deck,
    discard,
    governorIndex: 0,
    currentRoleSelector: 0,
    usedRoles: [],
    rolesSelectedThisRound: 0,
    currentRole: null,
    roleChooser: 0,
    executingPlayerIndex: 0,
    playersCompletedAction: [false, false, false, false],
    drawnCards: [],
    selectedCards: [],
    chapelUsedThisRound: [false, false, false, false],
    gameEndTriggered: false,
    currentTradingTile: null,
    language,
    log: [],
    finalScores: null,
  };
}

// ==================== ヘルパー ====================

function addLog(state: GameState, message: string): GameState {
  return { ...state, log: [...state.log, message] };
}

function nextPlayer(current: number): number {
  return (current + 1) % 4;
}

function getPlayer(state: GameState, id: number): PlayerState {
  return state.players[id];
}

function updatePlayer(
  state: GameState,
  id: number,
  updates: Partial<PlayerState>
): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === id ? { ...p, ...updates } : p)),
  };
}

function discardCards(state: GameState, cards: Card[]): GameState {
  return { ...state, discard: [...state.discard, ...cards] };
}

function enforceHandLimit(state: GameState, playerId: number): GameState {
  const player = getPlayer(state, playerId);
  const limit = getHandLimit(player.buildings);
  if (player.hand.length <= limit) return state;

  if (!player.isHuman) {
    const sorted = [...player.hand].sort(
      (a, b) => getCardDef(a).cost - getCardDef(b).cost
    );
    const keep = sorted.slice(sorted.length - limit);
    const discarded = sorted.slice(0, sorted.length - limit);
    let s = updatePlayer(state, playerId, { hand: keep });
    s = discardCards(s, discarded);
    return s;
  }
  return state;
}

export function needsDiscardExcess(state: GameState, playerId: number): boolean {
  const player = getPlayer(state, playerId);
  const limit = getHandLimit(player.buildings);
  return player.hand.length > limit;
}

export function getDiscardExcessCount(state: GameState, playerId: number): number {
  const player = getPlayer(state, playerId);
  const limit = getHandLimit(player.buildings);
  return Math.max(0, player.hand.length - limit);
}

export function executeDiscardExcess(
  state: GameState,
  playerId: number,
  cardInstanceIds: number[]
): GameState {
  const player = getPlayer(state, playerId);
  const discarded = player.hand.filter((c) => cardInstanceIds.includes(c.instanceId));
  const newHand = player.hand.filter((c) => !cardInstanceIds.includes(c.instanceId));
  let s = updatePlayer(state, playerId, { hand: newHand });
  s = discardCards(s, discarded);
  const msg = txt(s,
    `${player.name}が${discarded.length}枚捨てた(手札上限)`,
    `${player.name} discarded ${discarded.length} (hand limit)`
  );
  s = addLog(s, msg);
  return s;
}

export function executeArchiveDiscard(
  state: GameState,
  playerId: number,
  cardInstanceIds: number[]
): GameState {
  const player = getPlayer(state, playerId);
  const discarded = player.hand.filter((c) => cardInstanceIds.includes(c.instanceId));
  const newHand = player.hand.filter((c) => !cardInstanceIds.includes(c.instanceId));
  let s = updatePlayer(state, playerId, { hand: newHand });
  s = discardCards(s, discarded);
  if (discarded.length > 0) {
    const msg = txt(s,
      `${player.name}が魔導書庫で${discarded.length}枚捨てた`,
      `${player.name} discarded ${discarded.length} via Grimoire Vault`
    );
    s = addLog(s, msg);
  }
  return s;
}

function drawCardsForPlayer(
  state: GameState,
  playerId: number,
  count: number
): GameState {
  const result = drawCards(state.deck, state.discard, count);
  const player = getPlayer(state, playerId);
  let s = {
    ...state,
    deck: result.deck,
    discard: result.discard,
  };
  s = updatePlayer(s, playerId, {
    hand: [...player.hand, ...result.drawn],
  });
  return s;
}

export function isLibraryActive(state: GameState, playerId: number): boolean {
  const player = getPlayer(state, playerId);
  return (
    hasBuilding(player.buildings, 'library') &&
    state.roleChooser === playerId
  );
}

function libraryMultiplier(state: GameState, playerId: number): number {
  return isLibraryActive(state, playerId) ? 2 : 1;
}

// ==================== 役職選択 ====================

export function selectRole(state: GameState, role: RoleType): GameState {
  const playerId = state.currentRoleSelector;
  let s: GameState = {
    ...state,
    currentRole: role,
    roleChooser: playerId,
    usedRoles: [...state.usedRoles, role],
    rolesSelectedThisRound: state.rolesSelectedThisRound + 1,
    executingPlayerIndex: state.governorIndex,
    playersCompletedAction: [false, false, false, false],
  };

  const rName = roleName(s, role);
  const playerName = getPlayer(s, playerId).name;
  s = addLog(s, txt(s,
    `${playerName}が${rName}を選択`,
    `${playerName} chose ${rName}`
  ));

  switch (role) {
    case 'builder':
      s = { ...s, phase: 'builder_phase', subPhase: 'select_building' };
      break;
    case 'producer':
      s = { ...s, phase: 'producer_phase', subPhase: 'select_production' };
      break;
    case 'trader': {
      const tile = TRADING_TILES[Math.floor(Math.random() * TRADING_TILES.length)];
      s = { ...s, phase: 'trader_phase', subPhase: 'select_good', currentTradingTile: tile };
      const gn = (g: GoodType) => goodName(s, g);
      s = addLog(s, txt(s,
        `取引タイル: ${gn('indigo')}${tile.indigo}/${gn('sugar')}${tile.sugar}/${gn('tobacco')}${tile.tobacco}/${gn('coffee')}${tile.coffee}/${gn('silver')}${tile.silver}`,
        `Trade tile: ${gn('indigo')} ${tile.indigo} / ${gn('sugar')} ${tile.sugar} / ${gn('tobacco')} ${tile.tobacco} / ${gn('coffee')} ${tile.coffee} / ${gn('silver')} ${tile.silver}`
      ));
      break;
    }
    case 'councillor':
      s = { ...s, phase: 'councillor_phase', subPhase: 'select_cards' };
      s = prepareCouncillorDraw(s, s.executingPlayerIndex);
      break;
    case 'prospector':
      s = executeProspector(s, playerId);
      s = {
        ...s,
        playersCompletedAction: [true, true, true, true],
      };
      return advanceToNextRoleSelection(s);
  }

  return s;
}

// ==================== 建築士フェーズ ====================

export function getBuildCost(
  state: GameState,
  playerId: number,
  defId: string,
  craneTargetDefId?: string
): number {
  const player = getPlayer(state, playerId);
  const def = CARD_DEF_MAP[defId];
  const isChooser = state.roleChooser === playerId;
  const mult = libraryMultiplier(state, playerId);

  let cost = def.cost;

  if (craneTargetDefId) {
    const targetDef = CARD_DEF_MAP[craneTargetDefId];
    cost = Math.max(0, cost - targetDef.cost);
  }

  if (isChooser) {
    cost -= 1 * mult;
  }

  if (hasBuilding(player.buildings, 'smithy')) {
    cost -= 1 * mult;
  }

  return Math.max(0, cost);
}

export function canBuild(
  state: GameState,
  playerId: number,
  cardInstanceId: number,
  craneTargetIndex?: number
): boolean {
  const player = getPlayer(state, playerId);
  const card = player.hand.find((c) => c.instanceId === cardInstanceId);
  if (!card) return false;

  const def = getCardDef(card);

  if (craneTargetIndex === undefined && def.type !== 'production') {
    if (hasBuilding(player.buildings, def.id)) return false;
  }

  if (
    player.buildings.length >= MAX_BUILDINGS &&
    craneTargetIndex === undefined
  )
    return false;

  const craneTargetDefId =
    craneTargetIndex !== undefined
      ? player.buildings[craneTargetIndex].card.defId
      : undefined;
  const cost = getBuildCost(state, playerId, def.id, craneTargetDefId);

  let payableFromGoods = 0;
  if (hasBuilding(player.buildings, 'black_market')) {
    payableFromGoods = Math.min(
      2,
      player.buildings.filter((b) => b.good !== null).length
    );
  }

  const handPayable = player.hand.length - 1;
  return handPayable + payableFromGoods >= cost;
}

export function executeBuild(
  state: GameState,
  playerId: number,
  cardInstanceId: number,
  paymentCardIds: number[],
  craneTargetIndex?: number,
  blackMarketGoods?: GoodType[]
): GameState {
  let s = state;
  const player = getPlayer(s, playerId);
  const card = player.hand.find((c) => c.instanceId === cardInstanceId)!;
  const def = getCardDef(card);

  const removeIds = new Set([cardInstanceId, ...paymentCardIds]);
  const newHand = player.hand.filter((c) => !removeIds.has(c.instanceId));

  const paymentCards = player.hand.filter(
    (c) => paymentCardIds.includes(c.instanceId)
  );
  s = discardCards(s, paymentCards);

  const newBuilding: Building = { card, good: null, chapelCards: 0 };

  let newBuildings = [...player.buildings];

  if (craneTargetIndex !== undefined) {
    const removed = newBuildings[craneTargetIndex];
    s = discardCards(s, [removed.card]);
    newBuildings[craneTargetIndex] = newBuilding;
  } else {
    newBuildings = [...newBuildings, newBuilding];
  }

  if (blackMarketGoods && blackMarketGoods.length > 0) {
    for (const goodType of blackMarketGoods) {
      const idx = newBuildings.findIndex((b) => b.good === goodType);
      if (idx !== -1) {
        newBuildings[idx] = { ...newBuildings[idx], good: null };
      }
    }
  }

  s = updatePlayer(s, playerId, { hand: newHand, buildings: newBuildings });
  const cName = cardName(s, def.id);
  s = addLog(s, txt(s,
    `${player.name}が${cName}を錬成`,
    `${player.name} built ${cName}`
  ));

  if (hasBuilding(newBuildings, 'carpenter')) {
    const drawCount = 1 * libraryMultiplier(s, playerId);
    s = drawCardsForPlayer(s, playerId, drawCount);
    const bName = cardName(s, 'carpenter');
    s = addLog(s, txt(s,
      `${player.name}: ${bName}で${drawCount}枚引いた`,
      `${player.name}: ${bName} drew ${drawCount}`
    ));
  }

  if (hasBuilding(newBuildings, 'hero') && def.cost >= 6) {
    const drawCount = 5;
    s = drawCardsForPlayer(s, playerId, drawCount);
    const bName = cardName(s, 'hero');
    s = addLog(s, txt(s,
      `${player.name}: ${bName}で${drawCount}枚引いた`,
      `${player.name}: ${bName} drew ${drawCount}`
    ));
  }

  if (hasBuilding(newBuildings, 'poor_house')) {
    const currentHand = getPlayer(s, playerId).hand;
    if (currentHand.length <= 1) {
      const drawCount = 1 * libraryMultiplier(s, playerId);
      s = drawCardsForPlayer(s, playerId, drawCount);
      const bName = cardName(s, 'poor_house');
      s = addLog(s, txt(s,
        `${player.name}: ${bName}で${drawCount}枚引いた`,
        `${player.name}: ${bName} drew ${drawCount}`
      ));
    }
  }

  if (getPlayer(s, playerId).buildings.length >= MAX_BUILDINGS) {
    s = { ...s, gameEndTriggered: true };
    s = addLog(s, txt(s,
      `${player.name}が${MAX_BUILDINGS}個の設備を錬成！`,
      `${player.name} built ${MAX_BUILDINGS} facilities!`
    ));
  }

  s = enforceHandLimit(s, playerId);
  return s;
}

// ==================== 監督フェーズ ====================

export function getProducibleBuildings(
  state: GameState,
  playerId: number
): number[] {
  const player = getPlayer(state, playerId);
  const indices: number[] = [];
  for (let i = 0; i < player.buildings.length; i++) {
    const b = player.buildings[i];
    const def = getCardDef(b.card);
    if (def.type === 'production' && b.good === null) {
      indices.push(i);
    }
  }
  return indices;
}

export function getMaxProductionSlots(
  state: GameState,
  playerId: number
): number {
  const player = getPlayer(state, playerId);
  const isChooser = state.roleChooser === playerId;
  const mult = libraryMultiplier(state, playerId);

  const emptySlots = getProducibleBuildings(state, playerId).length;
  let allowed = 1;
  if (isChooser) allowed += 1 * mult;
  if (hasBuilding(player.buildings, 'aqueduct')) allowed += 1 * mult;

  return Math.min(allowed, emptySlots);
}

export function executeProduction(
  state: GameState,
  playerId: number,
  buildingIndices: number[]
): GameState {
  let s = state;
  const player = getPlayer(s, playerId);
  const mult = libraryMultiplier(s, playerId);

  const allowed = getMaxProductionSlots(s, playerId);

  const newBuildings = [...player.buildings];
  let produced = 0;
  for (const idx of buildingIndices) {
    if (produced >= allowed) break;
    const b = newBuildings[idx];
    const def = getCardDef(b.card);
    if (def.type === 'production' && b.good === null && def.goodType) {
      newBuildings[idx] = { ...b, good: def.goodType };
      produced++;
    }
  }

  s = updatePlayer(s, playerId, { buildings: newBuildings });

  if (produced > 0) {
    s = addLog(s, txt(s,
      `${player.name}が${produced}個採集`,
      `${player.name} gathered ${produced}`
    ));
  }

  if (hasBuilding(newBuildings, 'well') && produced >= 2) {
    const drawCount = 1 * mult;
    s = drawCardsForPlayer(s, playerId, drawCount);
    const bName = cardName(s, 'well');
    s = addLog(s, txt(s,
      `${player.name}: ${bName}で${drawCount}枚引いた`,
      `${player.name}: ${bName} drew ${drawCount}`
    ));
  }

  return s;
}

export function getMaxProductionCount(
  state: GameState,
  playerId: number
): number {
  return getMaxProductionSlots(state, playerId);
}

// ==================== 商人フェーズ ====================

export function getSellableGoods(
  state: GameState,
  playerId: number
): { buildingIndex: number; goodType: GoodType }[] {
  const player = getPlayer(state, playerId);
  const goods: { buildingIndex: number; goodType: GoodType }[] = [];
  for (let i = 0; i < player.buildings.length; i++) {
    const b = player.buildings[i];
    if (b.good) {
      goods.push({ buildingIndex: i, goodType: b.good });
    }
  }
  return goods;
}

export function getMaxSellCount(
  state: GameState,
  playerId: number
): number {
  const player = getPlayer(state, playerId);
  const mult = libraryMultiplier(state, playerId);

  let count = 1;
  if (hasBuilding(player.buildings, 'trading_post')) {
    count += 1 * mult;
  }
  return count;
}

export function executeTrade(
  state: GameState,
  playerId: number,
  buildingIndices: number[]
): GameState {
  let s = state;
  const player = getPlayer(s, playerId);
  const isChooser = state.roleChooser === playerId;
  const mult = libraryMultiplier(s, playerId);

  const newBuildings = [...player.buildings];
  let totalCards = 0;

  for (const idx of buildingIndices) {
    const b = newBuildings[idx];
    if (!b.good) continue;

    let price = state.currentTradingTile![b.good];
    if (isChooser) price += 1 * mult;
    if (hasBuilding(newBuildings, 'market_hall')) {
      price += 1 * mult;
    }
    if (hasBuilding(newBuildings, 'market_stand')) {
      price += 1 * mult;
    }

    totalCards += price;
    const gName = goodName(s, b.good);
    newBuildings[idx] = { ...b, good: null };

    s = addLog(s, txt(s,
      `${player.name}が${gName}を売却(${price}枚)`,
      `${player.name} sold ${gName} (${price} cards)`
    ));
  }

  s = updatePlayer(s, playerId, { buildings: newBuildings });

  if (totalCards > 0) {
    s = drawCardsForPlayer(s, playerId, totalCards);
  }

  s = enforceHandLimit(s, playerId);
  return s;
}

// ==================== 参事会員フェーズ ====================

export function getCouncillorDrawCount(
  state: GameState,
  playerId: number
): number {
  const isChooser = state.roleChooser === playerId;
  const mult = libraryMultiplier(state, playerId);
  return isChooser ? 2 + 3 * mult : 2;
}

export function getCouncillorKeepCount(
  state: GameState,
  playerId: number
): number {
  const player = getPlayer(state, playerId);
  const mult = libraryMultiplier(state, playerId);
  let count = 1;
  if (hasBuilding(player.buildings, 'prefecture')) {
    count += 1 * mult;
  }
  return count;
}

export function prepareCouncillorDraw(
  state: GameState,
  playerId: number
): GameState {
  const drawCount = getCouncillorDrawCount(state, playerId);
  const result = drawCards(state.deck, state.discard, drawCount);
  return {
    ...state,
    deck: result.deck,
    discard: result.discard,
    drawnCards: result.drawn,
  };
}

export function executeCouncillor(
  state: GameState,
  playerId: number,
  keptCardIds: number[]
): GameState {
  let s = state;
  const player = getPlayer(s, playerId);

  const kept = s.drawnCards.filter((c) => keptCardIds.includes(c.instanceId));
  const discarded = s.drawnCards.filter(
    (c) => !keptCardIds.includes(c.instanceId)
  );

  const totalDrawn = kept.length + discarded.length;
  s = updatePlayer(s, playerId, {
    hand: [...player.hand, ...kept],
  });
  s = discardCards(s, discarded);
  s = { ...s, drawnCards: [] };
  s = addLog(s, txt(s,
    `${player.name}が${kept.length}枚選択(${totalDrawn}枚から)`,
    `${player.name} kept ${kept.length} (from ${totalDrawn})`
  ));

  if (!getPlayer(s, playerId).isHuman && hasBuilding(getPlayer(s, playerId).buildings, 'archive')) {
    const archivePlayer = getPlayer(s, playerId);
    const limit = getHandLimit(archivePlayer.buildings);
    const scored = archivePlayer.hand.map((c) => {
      const def = getCardDef(c);
      let score = def.vp * 5 + def.cost;
      if (hasBuilding(archivePlayer.buildings, def.id)) score -= 15;
      return { card: c, score };
    });
    scored.sort((a, b) => a.score - b.score);
    const discardCount = Math.max(0, archivePlayer.hand.length - limit);
    if (discardCount > 0) {
      const toDiscard = scored.slice(0, discardCount).map((x) => x.card);
      const keepIds = new Set(archivePlayer.hand.filter((c) => !toDiscard.includes(c)).map((c) => c.instanceId));
      s = updatePlayer(s, playerId, {
        hand: archivePlayer.hand.filter((c) => keepIds.has(c.instanceId)),
      });
      s = discardCards(s, toDiscard);
      const bName = cardName(s, 'archive');
      s = addLog(s, txt(s,
        `${archivePlayer.name}が${bName}で${toDiscard.length}枚捨てた`,
        `${archivePlayer.name} discarded ${toDiscard.length} via ${bName}`
      ));
    }
  }

  s = enforceHandLimit(s, playerId);
  return s;
}

// ==================== 金鉱掘りフェーズ ====================

export function executeProspector(
  state: GameState,
  playerId: number
): GameState {
  let s = state;
  if (state.roleChooser === playerId) {
    const drawCount = 1 * libraryMultiplier(s, playerId);
    s = drawCardsForPlayer(s, playerId, drawCount);
    const player = getPlayer(s, playerId);
    const rName = roleName(s, 'prospector');
    s = addLog(s, txt(s,
      `${player.name}が${drawCount}枚引いた(${rName})`,
      `${player.name} drew ${drawCount} (${rName})`
    ));
  }

  if (state.roleChooser === playerId) {
    const player2 = getPlayer(s, playerId);
    if (hasBuilding(player2.buildings, 'goldmine')) {
      const mult = libraryMultiplier(s, playerId);
      const result = drawCards(s.deck, s.discard, 4);
      s = { ...s, deck: result.deck, discard: result.discard };
      const costs = new Set(result.drawn.map((c) => getCardDef(c).cost));
      const bName = cardName(s, 'goldmine');
      if (costs.size === result.drawn.length && result.drawn.length === 4) {
        const sorted = [...result.drawn].sort(
          (a, b) => getCardDef(b).cost - getCardDef(a).cost
        );
        const keepCount = Math.min(1 * mult, sorted.length);
        const kept = sorted.slice(0, keepCount);
        const returned = result.drawn.filter(
          (c) => !kept.some((k) => k.instanceId === c.instanceId)
        );
        s = updatePlayer(s, playerId, {
          hand: [...getPlayer(s, playerId).hand, ...kept],
        });
        s = discardCards(s, returned);
        const keptNames = kept.map((c) => cardName(s, getCardDef(c).id)).join('、');
        s = addLog(s, txt(s,
          `${player2.name}: ${bName}で${keptNames}を獲得`,
          `${player2.name}: ${bName} found ${keptNames}`
        ));
      } else {
        s = discardCards(s, result.drawn);
        s = addLog(s, txt(s,
          `${player2.name}: ${bName} - コストが重複、獲得なし`,
          `${player2.name}: ${bName} - duplicate costs, nothing found`
        ));
      }
    }
  }

  return s;
}

// ==================== 礼拝堂 ====================

export function canUseChapel(state: GameState, playerId: number): boolean {
  const player = getPlayer(state, playerId);
  return (
    hasBuilding(player.buildings, 'chapel') &&
    !state.chapelUsedThisRound[playerId] &&
    player.hand.length > 0
  );
}

export function executeChapel(
  state: GameState,
  playerId: number,
  cardInstanceId: number
): GameState {
  let s = state;
  const player = getPlayer(s, playerId);
  const card = player.hand.find((c) => c.instanceId === cardInstanceId);
  if (!card) return s;

  const newHand = player.hand.filter(
    (c) => c.instanceId !== cardInstanceId
  );
  const newBuildings = player.buildings.map((b) =>
    b.card.defId === 'chapel'
      ? { ...b, chapelCards: b.chapelCards + 1 }
      : b
  );

  const chapelUsed = [...s.chapelUsedThisRound];
  chapelUsed[playerId] = true;

  s = updatePlayer(s, playerId, {
    hand: newHand,
    buildings: newBuildings,
  });
  s = { ...s, chapelUsedThisRound: chapelUsed };
  const bName = cardName(s, 'chapel');
  s = addLog(s, txt(s,
    `${player.name}が${bName}にカードを奉納`,
    `${player.name} offered a card to ${bName}`
  ));
  return s;
}

export function skipChapel(state: GameState, playerId: number): GameState {
  const player = getPlayer(state, playerId);
  const chapelUsed = [...state.chapelUsedThisRound];
  chapelUsed[playerId] = true;
  let s = { ...state, chapelUsedThisRound: chapelUsed };
  const bName = cardName(s, 'chapel');
  s = addLog(s, txt(s,
    `${player.name}が${bName}をスキップ`,
    `${player.name} skipped ${bName}`
  ));
  return s;
}

// ==================== フェーズ進行 ====================

export function markPlayerCompleted(
  state: GameState,
  playerId: number
): GameState {
  const completed = [...state.playersCompletedAction];
  completed[playerId] = true;
  return { ...state, playersCompletedAction: completed };
}

export function advanceToNextPlayer(state: GameState): GameState {
  let s = state;
  const current = s.executingPlayerIndex;
  const next = nextPlayer(current);

  const completed = [...s.playersCompletedAction];
  completed[current] = true;

  if (completed.every((c) => c)) {
    return advanceToNextRoleSelection(s);
  }

  s = { ...s, executingPlayerIndex: next, playersCompletedAction: completed };

  if (s.currentRole === 'councillor') {
    s = prepareCouncillorDraw(s, next);
  }

  return s;
}

function advanceToNextRoleSelection(state: GameState): GameState {
  let s = state;

  if (s.rolesSelectedThisRound >= 4) {
    return startChapelPhase(s);
  }

  const nextSelector = nextPlayer(s.currentRoleSelector);
  s = {
    ...s,
    phase: 'role_selection',
    subPhase: null,
    currentRole: null,
    currentRoleSelector: nextSelector,
    executingPlayerIndex: nextSelector,
  };

  return s;
}

// ==================== 礼拝堂フェーズ ====================

function findNextChapelPlayer(
  state: GameState,
  startFrom: number
): number | null {
  for (let i = 0; i < 4; i++) {
    const idx = (startFrom + i) % 4;
    if (canUseChapel(state, idx)) {
      return idx;
    }
  }
  return null;
}

function startChapelPhase(state: GameState): GameState {
  const firstPlayer = findNextChapelPlayer(state, state.governorIndex);
  if (firstPlayer === null) {
    return startNewRound(state);
  }

  return {
    ...state,
    phase: 'chapel_phase',
    subPhase: 'chapel_tuck',
    currentRole: null,
    executingPlayerIndex: firstPlayer,
  };
}

export function advanceChapelPhase(state: GameState): GameState {
  const nextIdx = nextPlayer(state.executingPlayerIndex);
  const nextChapelPlayer = findNextChapelPlayer(state, nextIdx);

  if (nextChapelPlayer === null) {
    return startNewRound(state);
  }

  return {
    ...state,
    executingPlayerIndex: nextChapelPlayer,
  };
}

function startNewRound(state: GameState): GameState {
  if (state.gameEndTriggered) {
    return endGame(state);
  }

  const newGovernor = nextPlayer(state.governorIndex);
  return {
    ...state,
    phase: 'role_selection',
    subPhase: null,
    governorIndex: newGovernor,
    currentRoleSelector: newGovernor,
    usedRoles: [],
    rolesSelectedThisRound: 0,
    currentRole: null,
    executingPlayerIndex: newGovernor,
    playersCompletedAction: [false, false, false, false],
    chapelUsedThisRound: [false, false, false, false],
    log: [...state.log, txt(state, '--- 新しいラウンド ---', '--- New Round ---')],
  };
}

function endGame(state: GameState): GameState {
  const finalScores = calculateFinalScores(state);
  return {
    ...state,
    phase: 'game_over',
    subPhase: null,
    finalScores,
    log: [...state.log, txt(state, '=== ゲーム終了 ===', '=== Game Over ===')],
  };
}

// ==================== ゲーム開始 ====================

export function startGame(state: GameState): GameState {
  return {
    ...state,
    phase: 'role_selection',
    subPhase: null,
    log: [txt(state, 'ゲーム開始！', 'Game start!')],
  };
}
