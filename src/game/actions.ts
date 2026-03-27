import { RoleType, GoodType } from './types';

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'RESTART_GAME' }
  | { type: 'SELECT_ROLE'; role: RoleType }
  | { type: 'BUILD'; cardInstanceId: number; paymentCardIds: number[]; craneTargetIndex?: number; blackMarketGoods?: GoodType[] }
  | { type: 'SKIP_BUILD' }
  | { type: 'PRODUCE'; buildingIndices: number[] }
  | { type: 'SKIP_PRODUCE' }
  | { type: 'TRADE'; buildingIndices: number[] }
  | { type: 'SKIP_TRADE' }
  | { type: 'COUNCILLOR_KEEP'; cardInstanceIds: number[] }
  | { type: 'USE_CHAPEL'; cardInstanceId: number }
  | { type: 'SKIP_CHAPEL' }
  | { type: 'ARCHIVE_DISCARD'; cardInstanceIds: number[] }
  | { type: 'SKIP_ARCHIVE' }
  | { type: 'DISCARD_EXCESS'; cardInstanceIds: number[] }
  | { type: 'ADVANCE' };
