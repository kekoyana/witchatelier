import { describe, it, expect, beforeEach } from 'vitest';
import { gameReducer, createInitialState } from './reducer';
import { Building, Card } from './types';
import { resetInstanceIdCounter } from './utils';

beforeEach(() => {
  resetInstanceIdCounter();
});

function makeCard(defId: string, instanceId?: number): Card {
  return { instanceId: instanceId ?? Math.floor(Math.random() * 100000), defId };
}

function makeBuilding(defId: string, good: Building['good'] = null, chapelCards = 0): Building {
  return { card: makeCard(defId), good, chapelCards };
}

describe('createInitialState', () => {
  it('starts in title phase', () => {
    const state = createInitialState();
    expect(state.phase).toBe('title');
  });

  it('has 4 players', () => {
    const state = createInitialState();
    expect(state.players.length).toBe(4);
  });
});

describe('gameReducer', () => {
  describe('START_GAME', () => {
    it('transitions from title to role_selection', () => {
      const state = createInitialState();
      const result = gameReducer(state, { type: 'START_GAME' });
      expect(result.phase).toBe('role_selection');
    });
  });

  describe('RESTART_GAME', () => {
    it('creates a fresh game state', () => {
      const state = createInitialState();
      const started = gameReducer(state, { type: 'START_GAME' });
      const restarted = gameReducer(started, { type: 'RESTART_GAME' });
      expect(restarted.phase).toBe('role_selection');
      expect(restarted.log).toContain('ゲーム開始！');
    });
  });

  describe('SELECT_ROLE', () => {
    it('transitions to the appropriate phase', () => {
      const state = gameReducer(createInitialState(), { type: 'START_GAME' });
      const result = gameReducer(state, { type: 'SELECT_ROLE', role: 'builder' });
      expect(result.phase).toBe('builder_phase');
      expect(result.currentRole).toBe('builder');
    });
  });

  describe('SKIP_BUILD', () => {
    it('marks player completed and advances', () => {
      let state = gameReducer(createInitialState(), { type: 'START_GAME' });
      state = gameReducer(state, { type: 'SELECT_ROLE', role: 'builder' });
      const beforeIdx = state.executingPlayerIndex;
      const result = gameReducer(state, { type: 'SKIP_BUILD' });
      // Should advance to next player
      expect(result.executingPlayerIndex).not.toBe(beforeIdx);
    });
  });

  describe('SKIP_TRADE', () => {
    it('adds skip log message', () => {
      let state = gameReducer(createInitialState(), { type: 'START_GAME' });
      state = gameReducer(state, { type: 'SELECT_ROLE', role: 'trader' });
      const result = gameReducer(state, { type: 'SKIP_TRADE' });
      expect(result.log.some((l) => l.includes('パス'))).toBe(true);
    });
  });

  describe('USE_CHAPEL', () => {
    it('stores card and advances chapel phase', () => {
      let state = gameReducer(createInitialState(), { type: 'START_GAME' });
      // Manually set up chapel phase state
      const cardToTuck = makeCard('sugar_mill', 9999);
      state = {
        ...state,
        phase: 'chapel_phase',
        subPhase: 'chapel_tuck',
        executingPlayerIndex: 0,
        players: state.players.map((p, i) =>
          i === 0
            ? {
                ...p,
                hand: [cardToTuck, makeCard('indigo_plant', 9998)],
                buildings: [...p.buildings, makeBuilding('chapel')],
              }
            : p
        ),
      };

      const result = gameReducer(state, {
        type: 'USE_CHAPEL',
        cardInstanceId: 9999,
      });
      // Card should be removed from hand
      expect(result.players[0].hand.length).toBe(1);
      // Chapel should have 1 stored card
      const chapel = result.players[0].buildings.find(
        (b) => b.card.defId === 'chapel'
      );
      expect(chapel?.chapelCards).toBe(1);
    });
  });

  describe('SKIP_CHAPEL', () => {
    it('advances chapel phase without storing', () => {
      let state = gameReducer(createInitialState(), { type: 'START_GAME' });
      state = {
        ...state,
        phase: 'chapel_phase',
        subPhase: 'chapel_tuck',
        executingPlayerIndex: 0,
        players: state.players.map((p, i) =>
          i === 0
            ? {
                ...p,
                hand: [makeCard('sugar_mill', 9999)],
                buildings: [...p.buildings, makeBuilding('chapel')],
              }
            : p
        ),
      };

      const result = gameReducer(state, { type: 'SKIP_CHAPEL' });
      // Hand should remain unchanged
      expect(result.players[0].hand.length).toBe(1);
      // Since player 0 was the only one with chapel, it should advance to new round,
      // which resets chapelUsedThisRound to [false, false, false, false]
      expect(result.chapelUsedThisRound[0]).toBe(false);
      expect(result.phase).toBe('role_selection');
      // Check if skip log exists
      expect(result.log.some(l => l.includes('スキップ'))).toBe(true);
    });
  });

  describe('ADVANCE', () => {
    it('returns state unchanged', () => {
      const state = createInitialState();
      const result = gameReducer(state, { type: 'ADVANCE' });
      expect(result).toBe(state);
    });
  });

  describe('DISCARD_EXCESS', () => {
    it('discards selected cards and advances', () => {
      let state = gameReducer(createInitialState(), { type: 'START_GAME' });
      // Set up a state where human has too many cards after trade
      const hand = Array.from({ length: 9 }, (_, i) => makeCard('indigo_plant', 7000 + i));
      state = {
        ...state,
        phase: 'trader_phase',
        currentRole: 'trader',
        subPhase: 'discard_excess',
        executingPlayerIndex: 0,
        players: state.players.map((p, i) =>
          i === 0 ? { ...p, hand } : p
        ),
      };
      const result = gameReducer(state, {
        type: 'DISCARD_EXCESS',
        cardInstanceIds: [7000, 7001],
      });
      expect(result.players[0].hand.length).toBe(7);
      expect(result.subPhase).toBe(null);
    });
  });

  describe('ARCHIVE_DISCARD', () => {
    it('discards selected cards after councillor', () => {
      let state = gameReducer(createInitialState(), { type: 'START_GAME' });
      const hand = Array.from({ length: 5 }, (_, i) => makeCard('indigo_plant', 8000 + i));
      state = {
        ...state,
        phase: 'councillor_phase',
        currentRole: 'councillor',
        subPhase: 'archive_select',
        executingPlayerIndex: 0,
        players: state.players.map((p, i) =>
          i === 0
            ? { ...p, hand, buildings: [...p.buildings, makeBuilding('archive')] }
            : p
        ),
      };
      const result = gameReducer(state, {
        type: 'ARCHIVE_DISCARD',
        cardInstanceIds: [8000, 8001],
      });
      expect(result.players[0].hand.length).toBe(3);
      expect(result.subPhase).toBe(null);
    });
  });

  describe('SKIP_ARCHIVE', () => {
    it('advances without discarding', () => {
      let state = gameReducer(createInitialState(), { type: 'START_GAME' });
      const hand = Array.from({ length: 5 }, (_, i) => makeCard('indigo_plant', 8000 + i));
      state = {
        ...state,
        phase: 'councillor_phase',
        currentRole: 'councillor',
        subPhase: 'archive_select',
        executingPlayerIndex: 0,
        players: state.players.map((p, i) =>
          i === 0
            ? { ...p, hand, buildings: [...p.buildings, makeBuilding('archive')] }
            : p
        ),
      };
      const result = gameReducer(state, { type: 'SKIP_ARCHIVE' });
      expect(result.players[0].hand.length).toBe(5);
      expect(result.subPhase).toBe(null);
    });
  });

  describe('COUNCILLOR_KEEP with archive', () => {
    it('transitions to archive_select for human with archive', () => {
      let state = gameReducer(createInitialState(), { type: 'START_GAME' });
      const drawnCards = [makeCard('chapel', 9000), makeCard('smithy', 9001)];
      state = {
        ...state,
        phase: 'councillor_phase',
        currentRole: 'councillor',
        roleChooser: 0,
        executingPlayerIndex: 0,
        drawnCards,
        players: state.players.map((p, i) =>
          i === 0
            ? { ...p, buildings: [...p.buildings, makeBuilding('archive')] }
            : p
        ),
      };
      const result = gameReducer(state, {
        type: 'COUNCILLOR_KEEP',
        cardInstanceIds: [9000],
      });
      expect(result.subPhase).toBe('archive_select');
    });
  });

  describe('BUILD with hand limit', () => {
    it('transitions to discard_excess when human exceeds hand limit after build', () => {
      let state = gameReducer(createInitialState(), { type: 'START_GAME' });
      // Player has 8 cards (will have 6 after paying 1 for cost 0 building, then carpenter draws)
      // Actually, let's set up: build cost 0 card, have carpenter → draw 1 → still have many cards
      // Simpler: have a lot of cards, build a card that costs 0 (with builder privilege)
      // and get carpenter bonus draw, ending up over 7
      const buildCard = makeCard('smithy', 10000);
      const paymentCards = Array.from({ length: 0 }, (_, i) => makeCard('indigo_plant', 10001 + i));
      const extraCards = Array.from({ length: 7 }, (_, i) => makeCard('tobacco_storage', 10100 + i));
      state = {
        ...state,
        phase: 'builder_phase',
        currentRole: 'builder',
        roleChooser: 0,
        executingPlayerIndex: 0,
        players: state.players.map((p, i) =>
          i === 0
            ? {
                ...p,
                hand: [buildCard, ...paymentCards, ...extraCards],
                buildings: [makeBuilding('indigo_plant'), makeBuilding('carpenter')],
              }
            : p
        ),
      };
      // Cost of smithy = 1, builder privilege -1 = 0
      const result = gameReducer(state, {
        type: 'BUILD',
        cardInstanceId: 10000,
        paymentCardIds: [],
      });
      // After building: hand = 7 (removed buildCard) + 1 (carpenter draw) = 8 → exceeds 7
      expect(result.subPhase).toBe('discard_excess');
      expect(result.players[0].hand.length).toBe(8);
    });
  });

  describe('default', () => {
    it('returns state for unknown action', () => {
      const state = createInitialState();
      // @ts-expect-error testing unknown action
      const result = gameReducer(state, { type: 'UNKNOWN' });
      expect(result).toBe(state);
    });
  });
});
