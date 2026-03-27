import { GameState } from './types';
import { GameAction } from './actions';
import { hasBuilding } from './utils';
import {
  createInitialGameState,
  startGame,
  selectRole,
  executeBuild,
  executeProduction,
  executeTrade,
  executeCouncillor,
  executeChapel,
  skipChapel,
  advanceToNextPlayer,
  markPlayerCompleted,
  advanceChapelPhase,
  needsDiscardExcess,
  executeDiscardExcess,
  executeArchiveDiscard,
} from './engine';

function completeAndAdvance(state: GameState, playerId: number): GameState {
  const player = state.players[playerId];

  // 人間プレイヤーが手札上限超過 → 選択UIへ
  if (player.isHuman && needsDiscardExcess(state, playerId)) {
    return { ...state, subPhase: 'discard_excess' };
  }

  let s = markPlayerCompleted(state, playerId);
  s = advanceToNextPlayer(s);
  return s;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const s = createInitialGameState();
      return startGame(s);
    }

    case 'RESTART_GAME': {
      const s = createInitialGameState();
      return startGame(s);
    }

    case 'SELECT_ROLE': {
      return selectRole(state, action.role);
    }

    case 'BUILD': {
      const s = executeBuild(
        state,
        state.executingPlayerIndex,
        action.cardInstanceId,
        action.paymentCardIds,
        action.craneTargetIndex,
        action.blackMarketGoods
      );
      return completeAndAdvance(s, state.executingPlayerIndex);
    }

    case 'SKIP_BUILD': {
      let s = markPlayerCompleted(state, state.executingPlayerIndex);
      s = {
        ...s,
        log: [
          ...s.log,
          `${s.players[state.executingPlayerIndex].name}は建築をパス`,
        ],
      };
      s = advanceToNextPlayer(s);
      return s;
    }

    case 'PRODUCE': {
      const s = executeProduction(
        state,
        state.executingPlayerIndex,
        action.buildingIndices
      );
      return completeAndAdvance(s, state.executingPlayerIndex);
    }

    case 'SKIP_PRODUCE': {
      let s = markPlayerCompleted(state, state.executingPlayerIndex);
      s = advanceToNextPlayer(s);
      return s;
    }

    case 'TRADE': {
      const s = executeTrade(
        state,
        state.executingPlayerIndex,
        action.buildingIndices
      );
      return completeAndAdvance(s, state.executingPlayerIndex);
    }

    case 'SKIP_TRADE': {
      let s = markPlayerCompleted(state, state.executingPlayerIndex);
      s = {
        ...s,
        log: [
          ...s.log,
          `${s.players[state.executingPlayerIndex].name}は売却をパス`,
        ],
      };
      s = advanceToNextPlayer(s);
      return s;
    }

    case 'COUNCILLOR_KEEP': {
      const s = executeCouncillor(
        state,
        state.executingPlayerIndex,
        action.cardInstanceIds
      );
      const player = s.players[state.executingPlayerIndex];

      // 人間プレイヤーが公文書館を持っている → 公文書館UIへ
      if (player.isHuman && hasBuilding(player.buildings, 'archive')) {
        return { ...s, subPhase: 'archive_select' };
      }

      return completeAndAdvance(s, state.executingPlayerIndex);
    }

    case 'ARCHIVE_DISCARD': {
      let s = state;
      if (action.cardInstanceIds.length > 0) {
        s = executeArchiveDiscard(s, state.executingPlayerIndex, action.cardInstanceIds);
      }
      s = { ...s, subPhase: null };
      return completeAndAdvance(s, state.executingPlayerIndex);
    }

    case 'SKIP_ARCHIVE': {
      const s = { ...state, subPhase: null };
      return completeAndAdvance(s, state.executingPlayerIndex);
    }

    case 'DISCARD_EXCESS': {
      let s = executeDiscardExcess(
        state,
        state.executingPlayerIndex,
        action.cardInstanceIds
      );
      s = { ...s, subPhase: null };
      s = markPlayerCompleted(s, state.executingPlayerIndex);
      s = advanceToNextPlayer(s);
      return s;
    }

    case 'USE_CHAPEL': {
      let s = executeChapel(
        state,
        state.executingPlayerIndex,
        action.cardInstanceId
      );
      s = advanceChapelPhase(s);
      return s;
    }

    case 'SKIP_CHAPEL': {
      let s = skipChapel(state, state.executingPlayerIndex);
      return advanceChapelPhase(s);
    }

    case 'ADVANCE': {
      // AI自動進行用 - 現在のフェーズに応じて処理
      return state;
    }

    default:
      return state;
  }
}

export function createInitialState(): GameState {
  return {
    ...createInitialGameState(),
    phase: 'title',
  };
}
