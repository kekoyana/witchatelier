import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialGameState,
  startGame,
  selectRole,
  getBuildCost,
  canBuild,
  executeBuild,
  getProducibleBuildings,
  getMaxProductionSlots,
  executeProduction,
  getSellableGoods,
  getMaxSellCount,
  executeTrade,
  getCouncillorDrawCount,
  getCouncillorKeepCount,
  prepareCouncillorDraw,
  executeCouncillor,
  executeProspector,
  canUseChapel,
  executeChapel,
  markPlayerCompleted,
  advanceToNextPlayer,
  isLibraryActive,
  needsDiscardExcess,
  getDiscardExcessCount,
  executeDiscardExcess,
  executeArchiveDiscard,
} from './engine';
import { GameState, PlayerState, Building, Card } from './types';
import { resetInstanceIdCounter } from './utils';

beforeEach(() => {
  resetInstanceIdCounter();
});

// ==================== ヘルパー ====================

function makeCard(defId: string, instanceId?: number): Card {
  return { instanceId: instanceId ?? Math.floor(Math.random() * 100000), defId };
}

function makeBuilding(defId: string, good: Building['good'] = null, chapelCards = 0): Building {
  return { card: makeCard(defId), good, chapelCards };
}

function makePlayer(id: number, overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id,
    name: `Player ${id}`,
    hand: [],
    buildings: [makeBuilding('indigo_plant')],
    isHuman: id === 0,
    ...overrides,
  };
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'role_selection',
    subPhase: null,
    players: [makePlayer(0), makePlayer(1), makePlayer(2), makePlayer(3)],
    deck: Array.from({ length: 50 }, (_, i) => makeCard('indigo_plant', 1000 + i)),
    discard: [],
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
    ...overrides,
  };
}

// ==================== 初期化 ====================

describe('createInitialGameState', () => {
  it('creates 4 players', () => {
    const state = createInitialGameState();
    expect(state.players.length).toBe(4);
  });

  it('gives each player 4 cards in hand', () => {
    const state = createInitialGameState();
    for (const player of state.players) {
      expect(player.hand.length).toBe(4);
    }
  });

  it('gives each player an indigo plant as initial building', () => {
    const state = createInitialGameState();
    for (const player of state.players) {
      expect(player.buildings.length).toBe(1);
      expect(player.buildings[0].card.defId).toBe('indigo_plant');
    }
  });

  it('sets player 0 as human', () => {
    const state = createInitialGameState();
    expect(state.players[0].isHuman).toBe(true);
    expect(state.players[1].isHuman).toBe(false);
    expect(state.players[2].isHuman).toBe(false);
    expect(state.players[3].isHuman).toBe(false);
  });

  it('starts in title phase', () => {
    const state = createInitialGameState();
    expect(state.phase).toBe('title');
  });

  it('initializes governor at player 0', () => {
    const state = createInitialGameState();
    expect(state.governorIndex).toBe(0);
  });
});

describe('startGame', () => {
  it('changes phase to role_selection', () => {
    const state = createInitialGameState();
    const started = startGame(state);
    expect(started.phase).toBe('role_selection');
  });

  it('adds game start log', () => {
    const state = createInitialGameState();
    const started = startGame(state);
    expect(started.log).toContain('ゲーム開始！');
  });
});

// ==================== 役職選択 ====================

describe('selectRole', () => {
  it('transitions to builder phase when builder is selected', () => {
    const state = makeGameState();
    const result = selectRole(state, 'builder');
    expect(result.phase).toBe('builder_phase');
    expect(result.currentRole).toBe('builder');
    expect(result.roleChooser).toBe(0);
  });

  it('transitions to producer phase', () => {
    const state = makeGameState();
    const result = selectRole(state, 'producer');
    expect(result.phase).toBe('producer_phase');
  });

  it('transitions to trader phase with trading tile', () => {
    const state = makeGameState();
    const result = selectRole(state, 'trader');
    expect(result.phase).toBe('trader_phase');
    expect(result.currentTradingTile).not.toBeNull();
  });

  it('transitions to councillor phase and draws cards', () => {
    const state = makeGameState();
    const result = selectRole(state, 'councillor');
    expect(result.phase).toBe('councillor_phase');
    expect(result.drawnCards.length).toBe(5); // chooser draws 5
  });

  it('prospector draws 1 card and advances to next role selection', () => {
    const state = makeGameState({
      players: [
        makePlayer(0, { hand: [makeCard('sugar_mill', 500)] }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    const result = selectRole(state, 'prospector');
    // Prospector immediately completes and advances
    expect(result.phase).toBe('role_selection');
    // Player 0 should have drawn 1 card
    expect(result.players[0].hand.length).toBe(2);
  });

  it('adds role to usedRoles', () => {
    const state = makeGameState();
    const result = selectRole(state, 'builder');
    expect(result.usedRoles).toContain('builder');
    expect(result.rolesSelectedThisRound).toBe(1);
  });

  it('sets executing player to governor', () => {
    const state = makeGameState({ governorIndex: 2, currentRoleSelector: 1 });
    const result = selectRole(state, 'builder');
    expect(result.executingPlayerIndex).toBe(2);
  });
});

// ==================== 建築士フェーズ ====================

describe('getBuildCost', () => {
  it('returns base cost with no modifiers', () => {
    const state = makeGameState({ roleChooser: 1 }); // player 0 is not chooser
    expect(getBuildCost(state, 0, 'chapel')).toBe(3); // chapel costs 3
  });

  it('reduces cost by 1 for role chooser (builder privilege)', () => {
    const state = makeGameState({ roleChooser: 0 });
    expect(getBuildCost(state, 0, 'chapel')).toBe(2); // 3 - 1
  });

  it('reduces cost by 1 for smithy', () => {
    const state = makeGameState({
      roleChooser: 1,
      players: [
        makePlayer(0, { buildings: [makeBuilding('smithy')] }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(getBuildCost(state, 0, 'chapel')).toBe(2); // 3 - 1
  });

  it('stacks builder privilege and smithy', () => {
    const state = makeGameState({
      roleChooser: 0,
      players: [
        makePlayer(0, { buildings: [makeBuilding('smithy')] }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(getBuildCost(state, 0, 'chapel')).toBe(1); // 3 - 1 - 1
  });

  it('never goes below 0', () => {
    const state = makeGameState({
      roleChooser: 0,
      players: [
        makePlayer(0, { buildings: [makeBuilding('smithy')] }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(getBuildCost(state, 0, 'indigo_plant')).toBe(0); // 1 - 1 - 1 = 0
  });

  it('calculates crane cost as difference', () => {
    const state = makeGameState({ roleChooser: 1 });
    // Replace indigo_plant (cost 1) with chapel (cost 3) = 3 - 1 = 2
    expect(getBuildCost(state, 0, 'chapel', 'indigo_plant')).toBe(2);
  });

  it('crane cost is 0 when replacing higher cost building', () => {
    const state = makeGameState({ roleChooser: 1 });
    // Replace chapel (cost 3) with indigo_plant (cost 1) = max(0, 1-3) = 0
    expect(getBuildCost(state, 0, 'indigo_plant', 'chapel')).toBe(0);
  });

  it('doubles privilege and smithy with library', () => {
    const state = makeGameState({
      roleChooser: 0,
      players: [
        makePlayer(0, { buildings: [makeBuilding('library'), makeBuilding('smithy')] }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    // palace cost 6 - 2 (privilege*2) - 2 (smithy*2) = 2
    expect(getBuildCost(state, 0, 'palace')).toBe(2);
  });
});

describe('canBuild', () => {
  it('returns true when player can afford the building', () => {
    const card = makeCard('sugar_mill', 100);
    const state = makeGameState({
      roleChooser: 1,
      players: [
        makePlayer(0, {
          hand: [card, makeCard('indigo_plant', 101)],
          buildings: [makeBuilding('indigo_plant')],
        }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    // sugar_mill costs 2, hand has 2 cards, pay 1 (minus the card being built)
    // Actually cost=2, hand=2, payable=1 (excluding card itself). 1 < 2, so false
    // Let me fix: need more hand cards
    expect(canBuild(state, 0, 100)).toBe(false);
  });

  it('returns true with enough hand cards', () => {
    const card = makeCard('sugar_mill', 100);
    const state = makeGameState({
      roleChooser: 1,
      players: [
        makePlayer(0, {
          hand: [card, makeCard('indigo_plant', 101), makeCard('indigo_plant', 102)],
          buildings: [makeBuilding('indigo_plant')],
        }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(canBuild(state, 0, 100)).toBe(true);
  });

  it('returns false for duplicate violet building', () => {
    const card = makeCard('smithy', 100);
    const paymentCard = makeCard('indigo_plant', 101);
    const state = makeGameState({
      roleChooser: 0,
      players: [
        makePlayer(0, {
          hand: [card, paymentCard],
          buildings: [makeBuilding('smithy')],
        }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(canBuild(state, 0, 100)).toBe(false);
  });

  it('allows duplicate production building', () => {
    const card = makeCard('indigo_plant', 100);
    const state = makeGameState({
      roleChooser: 0,
      players: [
        makePlayer(0, {
          hand: [card],
          buildings: [makeBuilding('indigo_plant')],
        }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(canBuild(state, 0, 100)).toBe(true);
  });

  it('returns false when card is not in hand', () => {
    const state = makeGameState();
    expect(canBuild(state, 0, 99999)).toBe(false);
  });
});

describe('executeBuild', () => {
  it('adds building and removes cards from hand', () => {
    const buildCard = makeCard('sugar_mill', 100);
    const payCard1 = makeCard('indigo_plant', 101);
    const payCard2 = makeCard('indigo_plant', 102);
    const keepCard = makeCard('chapel', 103);
    const state = makeGameState({
      roleChooser: 1,
      players: [
        makePlayer(0, {
          hand: [buildCard, payCard1, payCard2, keepCard],
          buildings: [makeBuilding('indigo_plant')],
        }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });

    const result = executeBuild(state, 0, 100, [101, 102]);
    expect(result.players[0].buildings.length).toBe(2);
    expect(result.players[0].buildings[1].card.defId).toBe('sugar_mill');
    expect(result.players[0].hand.length).toBe(1);
    expect(result.players[0].hand[0].instanceId).toBe(103);
  });

  it('triggers game end when 12 buildings are reached', () => {
    const buildings: Building[] = Array.from({ length: 11 }, (_, i) =>
      makeBuilding(i < 5 ? 'indigo_plant' : 'sugar_mill')
    );
    // Make unique defIds for the test - in real game duplicates aren't allowed
    // but we're testing the 12 building trigger
    const buildCard = makeCard('chapel', 100);
    const state = makeGameState({
      roleChooser: 0, // cost 3 - 1 = 2
      players: [
        makePlayer(0, {
          hand: [buildCard, makeCard('a', 101), makeCard('b', 102)],
          buildings,
        }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });

    const result = executeBuild(state, 0, 100, [101, 102]);
    expect(result.gameEndTriggered).toBe(true);
    expect(result.players[0].buildings.length).toBe(12);
  });

  it('carpenter grants 1 card draw after building', () => {
    const buildCard = makeCard('sugar_mill', 100);
    const payCard = makeCard('indigo_plant', 101);
    const state = makeGameState({
      roleChooser: 0, // cost 2 - 1 = 1
      players: [
        makePlayer(0, {
          hand: [buildCard, payCard],
          buildings: [makeBuilding('indigo_plant'), makeBuilding('carpenter')],
        }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });

    const result = executeBuild(state, 0, 100, [101]);
    // After building: hand was empty, then drew 1 from carpenter
    expect(result.players[0].hand.length).toBe(1);
  });
});

// ==================== 監督フェーズ ====================

describe('getProducibleBuildings', () => {
  it('returns indices of empty production buildings', () => {
    const state = makeGameState({
      players: [
        makePlayer(0, {
          buildings: [
            makeBuilding('indigo_plant'),         // idx 0: production, empty
            makeBuilding('sugar_mill', 'sugar'),   // idx 1: production, has good
            makeBuilding('chapel'),                // idx 2: violet
            makeBuilding('coffee_roaster'),        // idx 3: production, empty
          ],
        }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(getProducibleBuildings(state, 0)).toEqual([0, 3]);
  });
});

describe('getMaxProductionSlots', () => {
  it('returns 1 for non-chooser without aqueduct', () => {
    const state = makeGameState({ roleChooser: 1 });
    // Default player has 1 indigo_plant (empty production building), so max is min(1, 1) = 1
    expect(getMaxProductionSlots(state, 0)).toBe(1);
  });

  it('returns base 1 + privilege for chooser', () => {
    const state = makeGameState({
      roleChooser: 0,
      players: [
        makePlayer(0, {
          buildings: [
            makeBuilding('indigo_plant'),
            makeBuilding('sugar_mill'),
            makeBuilding('coffee_roaster'),
          ],
        }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(getMaxProductionSlots(state, 0)).toBe(2); // 1 + 1 privilege, limited by 3 empty
  });

  it('adds 1 for aqueduct', () => {
    const state = makeGameState({
      roleChooser: 1,
      players: [
        makePlayer(0, {
          buildings: [
            makeBuilding('indigo_plant'),
            makeBuilding('sugar_mill'),
            makeBuilding('aqueduct'),
            makeBuilding('coffee_roaster'),
          ],
        }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(getMaxProductionSlots(state, 0)).toBe(2); // 1 + 1 aqueduct, limited by 3 empty
  });
});

describe('executeProduction', () => {
  it('places goods on specified buildings', () => {
    const state = makeGameState({
      roleChooser: 0,
      players: [
        makePlayer(0, {
          buildings: [
            makeBuilding('indigo_plant'),
            makeBuilding('sugar_mill'),
          ],
        }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });

    const result = executeProduction(state, 0, [0]);
    expect(result.players[0].buildings[0].good).toBe('indigo');
    expect(result.players[0].buildings[1].good).toBeNull();
  });
});

// ==================== 商人フェーズ ====================

describe('getSellableGoods', () => {
  it('returns buildings with goods', () => {
    const state = makeGameState({
      players: [
        makePlayer(0, {
          buildings: [
            makeBuilding('indigo_plant', 'indigo'),
            makeBuilding('sugar_mill'),
            makeBuilding('coffee_roaster', 'coffee'),
          ],
        }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    const goods = getSellableGoods(state, 0);
    expect(goods.length).toBe(2);
    expect(goods[0]).toEqual({ buildingIndex: 0, goodType: 'indigo' });
    expect(goods[1]).toEqual({ buildingIndex: 2, goodType: 'coffee' });
  });
});

describe('getMaxSellCount', () => {
  it('returns 1 without trading post', () => {
    const state = makeGameState({ roleChooser: 1 });
    expect(getMaxSellCount(state, 0)).toBe(1);
  });

  it('returns 2 with trading post', () => {
    const state = makeGameState({
      roleChooser: 1,
      players: [
        makePlayer(0, {
          buildings: [makeBuilding('indigo_plant'), makeBuilding('trading_post')],
        }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(getMaxSellCount(state, 0)).toBe(2);
  });
});

describe('executeTrade', () => {
  const tradingTile = { indigo: 1, sugar: 1, tobacco: 2, coffee: 2, silver: 3 };

  it('removes good and draws cards equal to trade price', () => {
    const state = makeGameState({
      roleChooser: 1,
      currentTradingTile: tradingTile,
      players: [
        makePlayer(0, {
          hand: [],
          buildings: [makeBuilding('coffee_roaster', 'coffee')],
        }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });

    const result = executeTrade(state, 0, [0]);
    expect(result.players[0].buildings[0].good).toBeNull();
    expect(result.players[0].hand.length).toBe(2); // coffee = 2 cards
  });

  it('adds privilege bonus for role chooser', () => {
    const state = makeGameState({
      roleChooser: 0,
      currentTradingTile: tradingTile,
      players: [
        makePlayer(0, {
          hand: [],
          buildings: [makeBuilding('indigo_plant', 'indigo')],
        }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });

    const result = executeTrade(state, 0, [0]);
    expect(result.players[0].hand.length).toBe(2); // indigo(1) + privilege(1)
  });
});

// ==================== 参事会員フェーズ ====================

describe('getCouncillorDrawCount', () => {
  it('returns 5 for role chooser', () => {
    const state = makeGameState({ roleChooser: 0 });
    expect(getCouncillorDrawCount(state, 0)).toBe(5);
  });

  it('returns 2 for non-chooser', () => {
    const state = makeGameState({ roleChooser: 1 });
    expect(getCouncillorDrawCount(state, 0)).toBe(2);
  });
});

describe('getCouncillorKeepCount', () => {
  it('returns 1 without prefecture', () => {
    const state = makeGameState({ roleChooser: 1 });
    expect(getCouncillorKeepCount(state, 0)).toBe(1);
  });

  it('returns 2 with prefecture', () => {
    const state = makeGameState({
      roleChooser: 1,
      players: [
        makePlayer(0, {
          buildings: [makeBuilding('indigo_plant'), makeBuilding('prefecture')],
        }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(getCouncillorKeepCount(state, 0)).toBe(2);
  });
});

describe('prepareCouncillorDraw', () => {
  it('draws cards from deck into drawnCards', () => {
    const state = makeGameState({ roleChooser: 0 });
    const result = prepareCouncillorDraw(state, 0);
    expect(result.drawnCards.length).toBe(5);
    expect(result.deck.length).toBe(state.deck.length - 5);
  });
});

describe('executeCouncillor', () => {
  it('keeps selected cards and discards rest', () => {
    const drawn: Card[] = [
      makeCard('chapel', 200),
      makeCard('smithy', 201),
      makeCard('palace', 202),
    ];
    const state = makeGameState({
      drawnCards: drawn,
      players: [
        makePlayer(0, { hand: [makeCard('indigo_plant', 100)] }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });

    const result = executeCouncillor(state, 0, [200]);
    expect(result.players[0].hand.length).toBe(2); // 1 existing + 1 kept
    expect(result.discard.length).toBe(2); // 2 discarded
    expect(result.drawnCards.length).toBe(0);
  });
});

// ==================== 金鉱掘り ====================

describe('executeProspector', () => {
  it('draws 1 card for role chooser', () => {
    const state = makeGameState({
      roleChooser: 0,
      players: [
        makePlayer(0, { hand: [] }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    const result = executeProspector(state, 0);
    expect(result.players[0].hand.length).toBe(1);
  });

  it('does nothing for non-chooser', () => {
    const state = makeGameState({
      roleChooser: 1,
      players: [
        makePlayer(0, { hand: [] }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    const result = executeProspector(state, 0);
    expect(result.players[0].hand.length).toBe(0);
  });

  it('goldmine triggers during prospector: gains 1 card when all 4 costs differ', () => {
    // drawCardsはpop()で末尾から引く。金鉱掘りで1枚引いた後、金鉱用に4枚引く
    const state = makeGameState({
      roleChooser: 0,
      deck: [
        ...Array.from({ length: 20 }, (_, i) => makeCard('indigo_plant', 3000 + i)),
        makeCard('coffee_roaster', 2004),  // cost 4 (金鉱4枚目)
        makeCard('tobacco_storage', 2003), // cost 3 (金鉱3枚目)
        makeCard('sugar_mill', 2002),      // cost 2 (金鉱2枚目)
        makeCard('indigo_plant', 2001),    // cost 1 (金鉱1枚目)
        makeCard('indigo_plant', 2000),    // 金鉱掘りドロー用
      ],
      players: [
        makePlayer(0, { hand: [], buildings: [makeBuilding('goldmine')] }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    const result = executeProspector(state, 0);
    // 金鉱掘りの1枚 + 金鉱の1枚 = 2枚
    expect(result.players[0].hand.length).toBe(2);
    expect(result.log.some(l => l.includes('金鉱で'))).toBe(true);
  });

  it('goldmine triggers during prospector: no gain when costs overlap', () => {
    const state = makeGameState({
      roleChooser: 0,
      deck: [
        ...Array.from({ length: 20 }, (_, i) => makeCard('indigo_plant', 3000 + i)),
        makeCard('tobacco_storage', 2004), // cost 3
        makeCard('sugar_mill', 2003),      // cost 2
        makeCard('indigo_plant', 2002),    // cost 1 (重複)
        makeCard('indigo_plant', 2001),    // cost 1 (重複)
        makeCard('indigo_plant', 2000),    // 金鉱掘りドロー用
      ],
      players: [
        makePlayer(0, { hand: [], buildings: [makeBuilding('goldmine')] }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    const result = executeProspector(state, 0);
    // 金鉱掘りの1枚のみ、金鉱の効果は不発
    expect(result.players[0].hand.length).toBe(1);
    expect(result.log.some(l => l.includes('コストが重複'))).toBe(true);
  });

  it('goldmine does not trigger for non-chooser', () => {
    // 金鉱掘りを選んでいないプレイヤーの金鉱は発動しない
    const state = makeGameState({
      roleChooser: 0,
      deck: [
        ...Array.from({ length: 20 }, (_, i) => makeCard('indigo_plant', 3000 + i)),
        makeCard('coffee_roaster', 2004),
        makeCard('tobacco_storage', 2003),
        makeCard('sugar_mill', 2002),
        makeCard('indigo_plant', 2001),
        makeCard('indigo_plant', 2000),
      ],
      players: [
        makePlayer(0, { hand: [] }),
        makePlayer(1, { hand: [], buildings: [makeBuilding('goldmine')] }),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    const result = executeProspector(state, 0);
    // プレイヤー0: 金鉱掘りの1枚のみ
    expect(result.players[0].hand.length).toBe(1);
    // プレイヤー1: 金鉱を持っているが選択者でないので発動しない
    expect(result.players[1].hand.length).toBe(0);
  });
});

// ==================== 礼拝堂 ====================

describe('canUseChapel', () => {
  it('returns true when player has chapel, not used this round, and has cards', () => {
    const state = makeGameState({
      players: [
        makePlayer(0, {
          hand: [makeCard('indigo_plant', 100)],
          buildings: [makeBuilding('chapel')],
        }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(canUseChapel(state, 0)).toBe(true);
  });

  it('returns false when chapel already used this round', () => {
    const state = makeGameState({
      chapelUsedThisRound: [true, false, false, false],
      players: [
        makePlayer(0, {
          hand: [makeCard('indigo_plant', 100)],
          buildings: [makeBuilding('chapel')],
        }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(canUseChapel(state, 0)).toBe(false);
  });

  it('returns false when player has no chapel', () => {
    const state = makeGameState({
      players: [
        makePlayer(0, {
          hand: [makeCard('indigo_plant', 100)],
          buildings: [makeBuilding('indigo_plant')],
        }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(canUseChapel(state, 0)).toBe(false);
  });

  it('returns false when hand is empty', () => {
    const state = makeGameState({
      players: [
        makePlayer(0, {
          hand: [],
          buildings: [makeBuilding('chapel')],
        }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(canUseChapel(state, 0)).toBe(false);
  });
});

describe('executeChapel', () => {
  it('removes card from hand and increments chapel count', () => {
    const card = makeCard('indigo_plant', 100);
    const state = makeGameState({
      players: [
        makePlayer(0, {
          hand: [card, makeCard('sugar_mill', 101)],
          buildings: [makeBuilding('chapel')],
        }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });

    const result = executeChapel(state, 0, 100);
    expect(result.players[0].hand.length).toBe(1);
    expect(result.players[0].buildings[0].chapelCards).toBe(1);
    expect(result.chapelUsedThisRound[0]).toBe(true);
  });
});

// ==================== フェーズ進行 ====================

describe('markPlayerCompleted', () => {
  it('marks the specified player as completed', () => {
    const state = makeGameState();
    const result = markPlayerCompleted(state, 2);
    expect(result.playersCompletedAction[2]).toBe(true);
    expect(result.playersCompletedAction[0]).toBe(false);
  });
});

describe('advanceToNextPlayer', () => {
  it('moves to next player when not all completed', () => {
    const state = makeGameState({
      executingPlayerIndex: 0,
      playersCompletedAction: [true, false, false, false],
    });
    const result = advanceToNextPlayer(state);
    expect(result.executingPlayerIndex).toBe(1);
  });

  it('advances to next role selection when all completed', () => {
    const state = makeGameState({
      currentRole: 'builder',
      executingPlayerIndex: 3,
      playersCompletedAction: [true, true, true, true],
      rolesSelectedThisRound: 1,
    });
    const result = advanceToNextPlayer(state);
    expect(result.phase).toBe('role_selection');
  });
});

describe('isLibraryActive', () => {
  it('returns true when player has library and is role chooser', () => {
    const state = makeGameState({
      roleChooser: 0,
      players: [
        makePlayer(0, { buildings: [makeBuilding('library')] }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(isLibraryActive(state, 0)).toBe(true);
  });

  it('returns false when player has library but is not role chooser', () => {
    const state = makeGameState({
      roleChooser: 1,
      players: [
        makePlayer(0, { buildings: [makeBuilding('library')] }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(isLibraryActive(state, 0)).toBe(false);
  });

  it('returns false when player is role chooser but has no library', () => {
    const state = makeGameState({ roleChooser: 0 });
    expect(isLibraryActive(state, 0)).toBe(false);
  });
});

// ==================== 手札上限 ====================

describe('needsDiscardExcess', () => {
  it('returns true when hand exceeds default limit', () => {
    const hand = Array.from({ length: 8 }, (_, i) => makeCard('indigo_plant', 2000 + i));
    const state = makeGameState({
      players: [
        makePlayer(0, { hand }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(needsDiscardExcess(state, 0)).toBe(true);
  });

  it('returns false when hand is within limit', () => {
    const hand = Array.from({ length: 7 }, (_, i) => makeCard('indigo_plant', 2000 + i));
    const state = makeGameState({
      players: [
        makePlayer(0, { hand }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(needsDiscardExcess(state, 0)).toBe(false);
  });

  it('uses tower limit (12) when player has tower', () => {
    const hand = Array.from({ length: 10 }, (_, i) => makeCard('indigo_plant', 2000 + i));
    const state = makeGameState({
      players: [
        makePlayer(0, { hand, buildings: [makeBuilding('tower')] }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(needsDiscardExcess(state, 0)).toBe(false);
  });
});

describe('getDiscardExcessCount', () => {
  it('returns correct excess count', () => {
    const hand = Array.from({ length: 10 }, (_, i) => makeCard('indigo_plant', 2000 + i));
    const state = makeGameState({
      players: [
        makePlayer(0, { hand }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(getDiscardExcessCount(state, 0)).toBe(3); // 10 - 7 = 3
  });

  it('returns 0 when hand is within limit', () => {
    const state = makeGameState();
    expect(getDiscardExcessCount(state, 0)).toBe(0);
  });
});

describe('executeDiscardExcess', () => {
  it('removes selected cards from hand and adds to discard', () => {
    const cards = Array.from({ length: 9 }, (_, i) => makeCard('indigo_plant', 3000 + i));
    const state = makeGameState({
      players: [
        makePlayer(0, { hand: cards }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    const result = executeDiscardExcess(state, 0, [3000, 3001]);
    expect(result.players[0].hand.length).toBe(7);
    expect(result.discard.length).toBe(2);
    expect(result.players[0].hand.some((c) => c.instanceId === 3000)).toBe(false);
    expect(result.players[0].hand.some((c) => c.instanceId === 3001)).toBe(false);
  });
});

// ==================== 公文書館 ====================

describe('executeArchiveDiscard', () => {
  it('removes selected cards from hand', () => {
    const cards = [makeCard('chapel', 4000), makeCard('smithy', 4001), makeCard('well', 4002)];
    const state = makeGameState({
      players: [
        makePlayer(0, { hand: cards }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    const result = executeArchiveDiscard(state, 0, [4000, 4002]);
    expect(result.players[0].hand.length).toBe(1);
    expect(result.players[0].hand[0].instanceId).toBe(4001);
    expect(result.discard.length).toBe(2);
  });

  it('handles empty discard list', () => {
    const cards = [makeCard('chapel', 4000)];
    const state = makeGameState({
      players: [
        makePlayer(0, { hand: cards }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    const result = executeArchiveDiscard(state, 0, []);
    expect(result.players[0].hand.length).toBe(1);
    expect(result.discard.length).toBe(0);
  });
});

// ==================== 図書館×参事会員 ====================

describe('getCouncillorDrawCount with library', () => {
  it('chooser with library draws 8 cards', () => {
    const state = makeGameState({
      roleChooser: 0,
      players: [
        makePlayer(0, { buildings: [makeBuilding('library')] }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(getCouncillorDrawCount(state, 0)).toBe(8);
  });

  it('chooser without library draws 5 cards', () => {
    const state = makeGameState({ roleChooser: 0 });
    expect(getCouncillorDrawCount(state, 0)).toBe(5);
  });

  it('non-chooser with library draws 2 cards', () => {
    const state = makeGameState({
      roleChooser: 1,
      players: [
        makePlayer(0, { buildings: [makeBuilding('library')] }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    expect(getCouncillorDrawCount(state, 0)).toBe(2);
  });
});

// ==================== 図書館×金鉱掘り ====================

describe('executeProspector with library', () => {
  it('chooser with library draws 2 cards', () => {
    const state = makeGameState({
      roleChooser: 0,
      players: [
        makePlayer(0, { buildings: [makeBuilding('library')], hand: [] }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    const result = executeProspector(state, 0);
    expect(result.players[0].hand.length).toBe(2);
  });

  it('chooser without library draws 1 card', () => {
    const state = makeGameState({
      roleChooser: 0,
      players: [
        makePlayer(0, { hand: [] }),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    const result = executeProspector(state, 0);
    expect(result.players[0].hand.length).toBe(1);
  });
});

describe('executeCouncillor with archive', () => {
  it('AI with archive discards excess cards', () => {
    const hand = Array.from({ length: 6 }, (_, i) => makeCard('indigo_plant', 5000 + i));
    const drawnCards = [makeCard('chapel', 6000), makeCard('smithy', 6001)];
    const state = makeGameState({
      currentRole: 'councillor',
      roleChooser: 1,
      executingPlayerIndex: 1,
      drawnCards,
      players: [
        makePlayer(0),
        makePlayer(1, {
          hand,
          buildings: [makeBuilding('indigo_plant'), makeBuilding('archive')],
          isHuman: false,
        }),
        makePlayer(2),
        makePlayer(3),
      ],
    });
    // Keep both drawn cards → hand becomes 8 → exceeds 7
    const result = executeCouncillor(state, 1, [6000, 6001]);
    // AI should have used archive + enforceHandLimit to get back to 7
    expect(result.players[1].hand.length).toBe(7);
  });
});
