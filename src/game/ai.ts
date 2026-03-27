import {
  GameState,
  RoleType,
  GoodType,
  Card,
} from './types';

// 商館タイルがめくられる前のAI判断用: 5枚のタイルの平均価格
const EXPECTED_TRADE_PRICES: Record<GoodType, number> = {
  indigo: 1,
  sugar: 1.4,
  tobacco: 1.8,
  coffee: 2.2,
  silver: 2.6,
};
import {
  getCardDef,
  hasBuilding,
} from './utils';
import {
  getBuildCost,
  canBuild,
  getProducibleBuildings,
  getSellableGoods,
  getMaxSellCount,
  getCouncillorKeepCount,
  getMaxProductionSlots,
} from './engine';

// ==================== 役職選択 ====================

export function aiSelectRole(
  state: GameState,
  playerId: number
): RoleType {
  const available: RoleType[] = (
    ['builder', 'producer', 'trader', 'councillor', 'prospector'] as RoleType[]
  ).filter((r) => !state.usedRoles.includes(r));

  let bestRole = available[0];
  let bestScore = -Infinity;

  for (const role of available) {
    const score = scoreRole(state, playerId, role);
    if (score > bestScore) {
      bestScore = score;
      bestRole = role;
    }
  }

  return bestRole;
}

function scoreRole(
  state: GameState,
  playerId: number,
  role: RoleType
): number {
  const player = state.players[playerId];
  let score = Math.random() * 2; // ランダム要素

  switch (role) {
    case 'builder': {
      // 建てられるカードがあるか
      const buildable = player.hand.filter((c) => canBuild(state, playerId, c.instanceId));
      if (buildable.length === 0) return score - 5;
      const bestBuild = buildable.reduce((best, c) => {
        const def = getCardDef(c);
        return def.vp > getCardDef(best).vp ? c : best;
      });
      score += getCardDef(bestBuild).vp * 3;
      score += 2; // 特権: コスト-1
      break;
    }
    case 'producer': {
      const producible = getProducibleBuildings(state, playerId);
      score += producible.length * 3;
      if (producible.length === 0) score -= 5;
      break;
    }
    case 'trader': {
      const goods = getSellableGoods(state, playerId);
      if (goods.length === 0) return score - 5;
      for (const g of goods) {
        score += EXPECTED_TRADE_PRICES[g.goodType] * 2;
      }
      score += 2; // 特権: +1カード
      break;
    }
    case 'councillor': {
      score += 4; // 基本的に便利
      if (player.hand.length <= 2) score += 4; // 手札少ない時は特に有用
      score += 3; // 特権: 5枚引ける
      break;
    }
    case 'prospector': {
      score += 2; // 1枚引ける、他者に利益なし
      if (player.hand.length <= 1) score += 3;
      break;
    }
  }

  return score;
}

// ==================== 建築 ====================

export interface AIBuildDecision {
  cardInstanceId: number;
  paymentCardIds: number[];
  craneTargetIndex?: number;
  blackMarketGoods?: GoodType[];
}

export function aiDecideBuild(
  state: GameState,
  playerId: number
): AIBuildDecision | null {
  const player = state.players[playerId];
  const hasCrane = hasBuilding(player.buildings, 'crane');
  const hasBlackMarketBuilding = hasBuilding(player.buildings, 'black_market');

  interface BuildOption {
    card: Card;
    score: number;
    craneTargetIndex?: number;
  }

  const options: BuildOption[] = [];

  for (const card of player.hand) {
    const def = getCardDef(card);

    // 通常建設
    if (canBuild(state, playerId, card.instanceId)) {
      if (def.type === 'production' || !hasBuilding(player.buildings, def.id)) {
        let score = def.vp * 10 + def.cost * 2;
        if (def.cost === 6) score += 20;
        if (def.type === 'production') {
          const hasGoods = player.buildings.some((b) => b.good !== null);
          if (!hasGoods) score += 5;
          // 同じ生産施設の2つ目以降はスコアを下げる
          const sameCount = player.buildings.filter((b) => b.card.defId === def.id).length;
          if (sameCount > 0) score -= sameCount * 3;
        }
        options.push({ card, score });
      }
    }

    // クレーン建て替え
    if (hasCrane) {
      for (let i = 0; i < player.buildings.length; i++) {
        if (canBuild(state, playerId, card.instanceId, i)) {
          const targetDef = getCardDef(player.buildings[i].card);
          const craneCost = getBuildCost(state, playerId, def.id, targetDef.id);
          // 建て替えのスコア: 新建物の価値 - 旧建物の価値 + コスト削減ボーナス
          let score = (def.vp - targetDef.vp) * 10 + def.cost * 2;
          if (def.cost === 6) score += 20;
          // 同じ建物への建て替えは低評価
          if (def.id === targetDef.id) score -= 20;
          // コストが安いほどボーナス
          score += (def.cost - craneCost) * 2;
          options.push({ card, score, craneTargetIndex: i });
        }
      }
    }
  }

  if (options.length === 0) return null;

  options.sort((a, b) => b.score - a.score);
  const best = options[0];
  const def = getCardDef(best.card);
  const craneTargetDefId = best.craneTargetIndex !== undefined
    ? player.buildings[best.craneTargetIndex].card.defId
    : undefined;
  let cost = getBuildCost(state, playerId, def.id, craneTargetDefId);

  // 闇市場: 手札が足りない場合に商品を使用
  let blackMarketGoods: GoodType[] | undefined;
  if (hasBlackMarketBuilding && cost > 0) {
    const handPayable = player.hand.length - 1; // 建設カード自体を除く
    if (handPayable < cost) {
      // 手札だけでは足りない → 商品を使う
      const goodBuildings = player.buildings
        .filter((b) => b.good !== null)
        .sort((a, b) => {
          const priceA = a.good ? EXPECTED_TRADE_PRICES[a.good] : 0;
          const priceB = b.good ? EXPECTED_TRADE_PRICES[b.good] : 0;
          return priceA - priceB; // 安い商品から使う
        });
      const needed = Math.min(2, cost - handPayable, goodBuildings.length);
      if (needed > 0) {
        blackMarketGoods = goodBuildings
          .slice(0, needed)
          .map((b) => b.good!);
        cost -= needed;
      }
    }
  }

  // 支払いカードを選択（最もVP/コストの低いカードから）
  const payableCards = player.hand
    .filter((c) => c.instanceId !== best.card.instanceId)
    .sort((a, b) => getCardDef(a).vp - getCardDef(b).vp);

  const paymentCardIds = payableCards
    .slice(0, cost)
    .map((c) => c.instanceId);

  return {
    cardInstanceId: best.card.instanceId,
    paymentCardIds,
    craneTargetIndex: best.craneTargetIndex,
    blackMarketGoods,
  };
}

// ==================== 生産 ====================

export function aiDecideProduction(
  state: GameState,
  playerId: number
): number[] {
  const producible = getProducibleBuildings(state, playerId);
  if (producible.length === 0) return [];

  const maxSlots = getMaxProductionSlots(state, playerId);

  // 高価値の商品を優先
  const player = state.players[playerId];
  const sorted = [...producible].sort((a, b) => {
    const defA = getCardDef(player.buildings[a].card);
    const defB = getCardDef(player.buildings[b].card);
    const priceA = defA.goodType ? EXPECTED_TRADE_PRICES[defA.goodType] : 0;
    const priceB = defB.goodType ? EXPECTED_TRADE_PRICES[defB.goodType] : 0;
    return priceB - priceA;
  });

  return sorted.slice(0, maxSlots);
}

// ==================== 売却 ====================

export function aiDecideTrade(
  state: GameState,
  playerId: number
): number[] {
  const goods = getSellableGoods(state, playerId);
  if (goods.length === 0) return [];

  const maxSell = getMaxSellCount(state, playerId);

  // 高価値順にソート（商館タイルの実際の価格を使用）
  const tile = state.currentTradingTile!;
  const sorted = [...goods].sort(
    (a, b) => tile[b.goodType] - tile[a.goodType]
  );

  return sorted.slice(0, maxSell).map((g) => g.buildingIndex);
}

// ==================== 参事会員 ====================

export function aiDecideCouncillor(
  state: GameState,
  playerId: number
): number[] {
  const keepCount = getCouncillorKeepCount(state, playerId);
  const drawn = state.drawnCards;

  if (drawn.length === 0) return [];

  // スコアリング: VP重視 + 建てられるかどうか
  const player = state.players[playerId];
  const scored = drawn.map((card) => {
    const def = getCardDef(card);
    let score = def.vp * 5 + def.cost;
    // 既に持っている建物は低評価（生産施設は軽減）
    if (hasBuilding(player.buildings, def.id)) {
      score -= def.type === 'production' ? 3 : 10;
    }
    // コスト6は高評価
    if (def.cost === 6) score += 8;
    return { card, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const actualKeep = Math.min(keepCount, drawn.length);
  return scored.slice(0, actualKeep).map((s) => s.card.instanceId);
}

// ==================== 礼拝堂 ====================

export function aiDecideChapel(
  state: GameState,
  playerId: number
): number | null {
  const player = state.players[playerId];
  if (!hasBuilding(player.buildings, 'chapel')) return null;
  if (player.hand.length <= 2) return null; // 手札が少なすぎる

  // 最もVPの低いカードを格納
  const sorted = [...player.hand].sort(
    (a, b) => getCardDef(a).vp - getCardDef(b).vp
  );
  return sorted[0].instanceId;
}
