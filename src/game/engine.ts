import {
  GameState,
  PlayerState,
  Building,
  Card,
  RoleType,
  GoodType,
  TRADING_TILES,
  GOOD_NAMES,
  ROLE_NAMES,
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

// ==================== 初期化 ====================

export function createInitialGameState(): GameState {
  resetInstanceIdCounter();
  let deck = createDeck();
  const discard: Card[] = [];
  const players: PlayerState[] = [];

  const cpuNamePool = [
    'ポンセ', 'コロン', 'カサス', 'ディアス', 'ルナ', 'ロペス',
    'カノ', 'レオン', 'トレス', 'ソト', 'リオス', 'クルス',
    'モラ', 'ベガ', 'オルテ', 'シルバ', 'メサ', 'パス',
  ];
  const shuffled = [...cpuNamePool].sort(() => Math.random() - 0.5);
  const names = ['あなた', shuffled[0], shuffled[1], shuffled[2]];

  for (let i = 0; i < 4; i++) {
    // 初期建物: インディゴ染料工場
    const indigoIndex = deck.findIndex((c) => c.defId === 'indigo_plant');
    const indigoCard = deck.splice(indigoIndex, 1)[0];

    // 手札4枚
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

  // AI: 最もコストの低いカード(価値が低い)を捨てる
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
  // Human: UIで選択させるのでここでは何もしない
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
  s = addLog(s, `${player.name}が${discarded.length}枚捨てた(手札上限)`);
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
    s = addLog(s, `${player.name}が公文書館で${discarded.length}枚捨てた`);
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

  const roleName = ROLE_NAMES[role];
  const playerName = getPlayer(s, playerId).name;
  s = addLog(s, `${playerName}が${roleName}を選択`);

  // フェーズに遷移
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
      s = addLog(s, `商館タイル: インディゴ${tile.indigo}/砂糖${tile.sugar}/タバコ${tile.tobacco}/コーヒー${tile.coffee}/銀${tile.silver}`);
      break;
    }
    case 'councillor':
      s = { ...s, phase: 'councillor_phase', subPhase: 'select_cards' };
      // 参事会員フェーズ開始時にカードをドロー
      s = prepareCouncillorDraw(s, s.executingPlayerIndex);
      break;
    case 'prospector':
      // 金鉱掘り: 選択者のみ1枚引いて、即座に次の役職選択へ
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

  // クレーンで建て替え: 差額のみ
  if (craneTargetDefId) {
    const targetDef = CARD_DEF_MAP[craneTargetDefId];
    cost = Math.max(0, cost - targetDef.cost);
  }

  // 建築士特権: -1
  if (isChooser) {
    cost -= 1 * mult;
  }

  // 鍛冶屋: -1
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

  // 同じ建物は建てられない(生産施設とクレーン建て替えを除く)
  if (craneTargetIndex === undefined && def.type !== 'production') {
    if (hasBuilding(player.buildings, def.id)) return false;
  }

  // 12建物上限
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

  // 闇市場: 商品を支払いに使える(最大2個)
  let payableFromGoods = 0;
  if (hasBuilding(player.buildings, 'black_market')) {
    payableFromGoods = Math.min(
      2,
      player.buildings.filter((b) => b.good !== null).length
    );
  }

  // 手札から支払える枚数(建設するカード自体は除く)
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

  // 手札から建設カードと支払いカードを除去
  const removeIds = new Set([cardInstanceId, ...paymentCardIds]);
  const newHand = player.hand.filter((c) => !removeIds.has(c.instanceId));

  // 支払いカードを捨て札に
  const paymentCards = player.hand.filter(
    (c) => paymentCardIds.includes(c.instanceId)
  );
  s = discardCards(s, paymentCards);

  // 新しい建物
  const newBuilding: Building = { card, good: null, chapelCards: 0 };

  let newBuildings = [...player.buildings];

  // クレーンで建て替え
  if (craneTargetIndex !== undefined) {
    const removed = newBuildings[craneTargetIndex];
    s = discardCards(s, [removed.card]);
    newBuildings[craneTargetIndex] = newBuilding;
  } else {
    newBuildings = [...newBuildings, newBuilding];
  }

  // 闇市場: 商品を除去
  if (blackMarketGoods && blackMarketGoods.length > 0) {
    for (const goodType of blackMarketGoods) {
      const idx = newBuildings.findIndex((b) => b.good === goodType);
      if (idx !== -1) {
        newBuildings[idx] = { ...newBuildings[idx], good: null };
      }
    }
  }

  s = updatePlayer(s, playerId, { hand: newHand, buildings: newBuildings });
  s = addLog(s, `${player.name}が${def.name}を建設`);

  // 大工小屋: 建設後1枚ドロー
  if (hasBuilding(newBuildings, 'carpenter')) {
    const drawCount = 1 * libraryMultiplier(s, playerId);
    s = drawCardsForPlayer(s, playerId, drawCount);
    s = addLog(s, `${player.name}: 大工小屋で${drawCount}枚引いた`);
  }

  // 英雄: コスト6を建てたら5枚ドロー
  if (hasBuilding(newBuildings, 'hero') && def.cost >= 6) {
    const drawCount = 5;
    s = drawCardsForPlayer(s, playerId, drawCount);
    s = addLog(s, `${player.name}: 英雄で${drawCount}枚引いた`);
  }

  // 救貧院: 建設後手札0-1枚なら1枚ドロー
  if (hasBuilding(newBuildings, 'poor_house')) {
    const currentHand = getPlayer(s, playerId).hand;
    if (currentHand.length <= 1) {
      const drawCount = 1 * libraryMultiplier(s, playerId);
      s = drawCardsForPlayer(s, playerId, drawCount);
      s = addLog(s, `${player.name}: 救貧院で${drawCount}枚引いた`);
    }
  }

  // 12建物でゲーム終了フラグ
  if (getPlayer(s, playerId).buildings.length >= MAX_BUILDINGS) {
    s = { ...s, gameEndTriggered: true };
    s = addLog(s, `${player.name}が${MAX_BUILDINGS}個の建物を建設！`);
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
  // 基本: 空き生産建物1つに生産
  let allowed = 1;
  // 監督特権: +1
  if (isChooser) allowed += 1 * mult;
  // 水道橋: +1
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

  // 生産可能数 = 基本1 + 特権 + 水道橋 (空きスロット上限)
  const allowed = getMaxProductionSlots(s, playerId);

  // 指定された建物に商品を載せる
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
    s = addLog(s, `${player.name}が${produced}個生産`);
  }

  // 井戸: 2個以上生産したら1枚ドロー
  if (hasBuilding(newBuildings, 'well') && produced >= 2) {
    const drawCount = 1 * mult;
    s = drawCardsForPlayer(s, playerId, drawCount);
    s = addLog(s, `${player.name}: 井戸で${drawCount}枚引いた`);
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
  // 商人特権はない (特権は+1カード)
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
  let soldCount = 0;

  for (const idx of buildingIndices) {
    const b = newBuildings[idx];
    if (!b.good) continue;

    let price = state.currentTradingTile![b.good];
    // 商人特権: +1カード
    if (isChooser) price += 1 * mult;
    // マーケットホール: +1カード per sale
    if (hasBuilding(newBuildings, 'market_hall')) {
      price += 1 * mult;
    }
    // 露店: +1カード
    if (hasBuilding(newBuildings, 'market_stand')) {
      price += 1 * mult;
    }

    totalCards += price;
    newBuildings[idx] = { ...b, good: null };
    soldCount++;

    s = addLog(
      s,
      `${player.name}が${GOOD_NAMES[b.good]}を売却(${price}枚)`
    );
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
  // 基本2枚、特権+3枚(図書館で特権2倍 → +6枚 = 合計8枚)
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
  s = addLog(s, `${player.name}が${kept.length}枚選択(${totalDrawn}枚から)`);

  // 公文書館: 手札を任意に捨てられる
  // AIのみここで処理。人間は別途UIで処理
  if (!getPlayer(s, playerId).isHuman && hasBuilding(getPlayer(s, playerId).buildings, 'archive')) {
    const archivePlayer = getPlayer(s, playerId);
    const limit = getHandLimit(archivePlayer.buildings);
    // AIは手札上限を超えている分と、重複建物カードを捨てる
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
      s = addLog(s, `${archivePlayer.name}が公文書館で${toDiscard.length}枚捨てた`);
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
    s = addLog(s, `${player.name}が${drawCount}枚引いた(金鉱掘り)`);
  }

  // 金鉱: 金鉱掘りを選んだプレイヤーのみ、山札4枚公開、全て異なるコストなら1枚獲得
  if (state.roleChooser === playerId) {
    const player2 = getPlayer(s, playerId);
    if (hasBuilding(player2.buildings, 'goldmine')) {
      const mult = libraryMultiplier(s, playerId);
      const result = drawCards(s.deck, s.discard, 4);
      s = { ...s, deck: result.deck, discard: result.discard };
      const costs = new Set(result.drawn.map((c) => getCardDef(c).cost));
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
        const keptNames = kept.map((c) => getCardDef(c).name).join('、');
        s = addLog(s, `${player2.name}: 金鉱で${keptNames}を獲得`);
      } else {
        s = discardCards(s, result.drawn);
        s = addLog(s, `${player2.name}: 金鉱 - コストが重複、獲得なし`);
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
  s = addLog(s, `${player.name}が礼拝堂にカードを格納`);
  return s;
}

export function skipChapel(state: GameState, playerId: number): GameState {
  const player = getPlayer(state, playerId);
  const chapelUsed = [...state.chapelUsedThisRound];
  chapelUsed[playerId] = true;
  let s = { ...state, chapelUsedThisRound: chapelUsed };
  s = addLog(s, `${player.name}が礼拝堂をスキップ`);
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

  // 全員完了チェック
  const completed = [...s.playersCompletedAction];
  completed[current] = true;

  if (completed.every((c) => c)) {
    // この役職の全プレイヤーが完了 → 次の役職選択へ
    return advanceToNextRoleSelection(s);
  }

  s = { ...s, executingPlayerIndex: next, playersCompletedAction: completed };

  // 参事会員の場合、次のプレイヤー用のドローを準備
  if (s.currentRole === 'councillor') {
    s = prepareCouncillorDraw(s, next);
  }

  return s;
}

function advanceToNextRoleSelection(state: GameState): GameState {
  let s = state;

  // 全員が役職を選んだ？
  if (s.rolesSelectedThisRound >= 4) {
    // ラウンド終了 → 礼拝堂フェーズへ
    return startChapelPhase(s);
  }

  // 次のプレイヤーの役職選択へ
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
    // 誰も礼拝堂を使えない → 新ラウンドへ
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
    // もう誰も使えない → 新ラウンドへ
    return startNewRound(state);
  }

  return {
    ...state,
    executingPlayerIndex: nextChapelPlayer,
  };
}

function startNewRound(state: GameState): GameState {
  // ゲーム終了チェック
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
    log: [...state.log, '--- 新しいラウンド ---'],
  };
}

function endGame(state: GameState): GameState {
  const finalScores = calculateFinalScores(state);
  return {
    ...state,
    phase: 'game_over',
    subPhase: null,
    finalScores,
    log: [...state.log, '=== ゲーム終了 ==='],
  };
}

// ==================== ゲーム開始 ====================

export function startGame(state: GameState): GameState {
  return {
    ...state,
    phase: 'role_selection',
    subPhase: null,
    log: ['ゲーム開始！'],
  };
}
