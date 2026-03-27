import { describe, it, expect, beforeEach } from 'vitest';
import { calculateFinalScores } from './scoring';
import { GameState, PlayerState, Building } from './types';
import { resetInstanceIdCounter } from './utils';

beforeEach(() => {
  resetInstanceIdCounter();
});

function makeBuilding(defId: string, good: string | null = null, chapelCards = 0): Building {
  return {
    card: { instanceId: Math.random() * 10000 | 0, defId },
    good: good as Building['good'],
    chapelCards,
  };
}

function makePlayer(id: number, buildings: Building[]): PlayerState {
  return {
    id,
    name: `Player ${id}`,
    hand: [],
    buildings,
    isHuman: id === 0,
  };
}

function makeState(players: PlayerState[]): GameState {
  return {
    phase: 'game_over',
    subPhase: null,
    players,
    deck: [],
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
    gameEndTriggered: true,
    currentTradingTile: null,
    log: [],
    finalScores: null,
  };
}

describe('calculateFinalScores', () => {
  it('calculates basic building VP', () => {
    const player = makePlayer(0, [
      makeBuilding('indigo_plant'),  // 1VP
      makeBuilding('sugar_mill'),     // 1VP
      makeBuilding('chapel'),         // 2VP
    ]);
    const state = makeState([player, makePlayer(1, []), makePlayer(2, []), makePlayer(3, [])]);
    const scores = calculateFinalScores(state);
    expect(scores[0].breakdown.buildingVP).toBe(4);
    expect(scores[0].breakdown.total).toBe(4);
  });

  it('calculates chapel VP from stored cards', () => {
    const player = makePlayer(0, [
      makeBuilding('chapel', null, 3),  // 2VP base + 3 chapel cards
    ]);
    const state = makeState([player, makePlayer(1, []), makePlayer(2, []), makePlayer(3, [])]);
    const scores = calculateFinalScores(state);
    expect(scores[0].breakdown.buildingVP).toBe(2);
    expect(scores[0].breakdown.chapelVP).toBe(3);
    expect(scores[0].breakdown.total).toBe(5);
  });

  it('calculates guild hall VP (2 per production building)', () => {
    const player = makePlayer(0, [
      makeBuilding('guild_hall'),       // 0VP base
      makeBuilding('indigo_plant'),     // 1VP, production
      makeBuilding('sugar_mill'),       // 1VP, production
      makeBuilding('coffee_roaster'),   // 2VP, production
    ]);
    const state = makeState([player, makePlayer(1, []), makePlayer(2, []), makePlayer(3, [])]);
    const scores = calculateFinalScores(state);
    expect(scores[0].breakdown.guildHallVP).toBe(6); // 3 production * 2
    expect(scores[0].breakdown.buildingVP).toBe(4);   // 0 + 1 + 1 + 2
    expect(scores[0].breakdown.total).toBe(10);
  });

  it('calculates city hall VP (1 per violet building)', () => {
    const player = makePlayer(0, [
      makeBuilding('city_hall'),     // 0VP base, violet
      makeBuilding('chapel'),        // 2VP, violet
      makeBuilding('smithy'),        // 1VP, violet
      makeBuilding('indigo_plant'),  // 1VP, production (not counted)
    ]);
    const state = makeState([player, makePlayer(1, []), makePlayer(2, []), makePlayer(3, [])]);
    const scores = calculateFinalScores(state);
    expect(scores[0].breakdown.cityHallVP).toBe(3); // 3 violet buildings
  });

  it('calculates triumphal arch VP with monuments', () => {
    // 1 monument = 4VP
    const player1 = makePlayer(0, [
      makeBuilding('triumphal_arch'),
      makeBuilding('statue'),  // monument
    ]);
    const state1 = makeState([player1, makePlayer(1, []), makePlayer(2, []), makePlayer(3, [])]);
    expect(calculateFinalScores(state1)[0].breakdown.monumentVP).toBe(4);

    // 2 monuments = 6VP
    const player2 = makePlayer(0, [
      makeBuilding('triumphal_arch'),
      makeBuilding('statue'),          // monument
      makeBuilding('victory_column'),   // monument
    ]);
    const state2 = makeState([player2, makePlayer(1, []), makePlayer(2, []), makePlayer(3, [])]);
    expect(calculateFinalScores(state2)[0].breakdown.monumentVP).toBe(6);

    // 3 monuments = 8VP
    const player3 = makePlayer(0, [
      makeBuilding('triumphal_arch'),
      makeBuilding('statue'),          // monument
      makeBuilding('victory_column'),   // monument
      makeBuilding('hero'),             // not monument
    ]);
    const state3 = makeState([player3, makePlayer(1, []), makePlayer(2, []), makePlayer(3, [])]);
    // hero is not a monument, so still 6VP
    expect(calculateFinalScores(state3)[0].breakdown.monumentVP).toBe(6);
  });

  it('calculates triumphal arch with 0 monuments as 0VP', () => {
    const player = makePlayer(0, [
      makeBuilding('triumphal_arch'),
    ]);
    const state = makeState([player, makePlayer(1, []), makePlayer(2, []), makePlayer(3, [])]);
    expect(calculateFinalScores(state)[0].breakdown.monumentVP).toBe(0);
  });

  it('calculates palace VP (1 per 4 other VP)', () => {
    const player = makePlayer(0, [
      makeBuilding('palace'),           // 0VP base
      makeBuilding('silver_smelter'),    // 3VP
      makeBuilding('coffee_roaster'),    // 2VP
      makeBuilding('tobacco_storage'),   // 2VP
      makeBuilding('chapel'),            // 2VP
      makeBuilding('indigo_plant'),      // 1VP
    ]);
    const state = makeState([player, makePlayer(1, []), makePlayer(2, []), makePlayer(3, [])]);
    const scores = calculateFinalScores(state);
    // buildingVP = 0+3+2+2+2+1 = 10
    // palaceVP = floor(10/4) = 2
    expect(scores[0].breakdown.buildingVP).toBe(10);
    expect(scores[0].breakdown.palaceVP).toBe(2);
    expect(scores[0].breakdown.total).toBe(12);
  });

  it('calculates scores for all 4 players', () => {
    const players = [
      makePlayer(0, [makeBuilding('indigo_plant')]),
      makePlayer(1, [makeBuilding('silver_smelter')]),
      makePlayer(2, [makeBuilding('chapel')]),
      makePlayer(3, [makeBuilding('palace')]),
    ];
    const state = makeState(players);
    const scores = calculateFinalScores(state);
    expect(scores.length).toBe(4);
    expect(scores[0].playerId).toBe(0);
    expect(scores[1].playerId).toBe(1);
    expect(scores[0].breakdown.total).toBe(1);
    expect(scores[1].breakdown.total).toBe(3);
    expect(scores[2].breakdown.total).toBe(2);
    expect(scores[3].breakdown.total).toBe(0);
  });
});
