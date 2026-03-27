export type BuildingType = 'production' | 'violet';

export type GoodType = 'indigo' | 'sugar' | 'tobacco' | 'coffee' | 'silver';

export type RoleType = 'builder' | 'producer' | 'trader' | 'councillor' | 'prospector';

export type GamePhase =
  | 'title'
  | 'role_selection'
  | 'builder_phase'
  | 'producer_phase'
  | 'trader_phase'
  | 'councillor_phase'
  | 'prospector_phase'
  | 'chapel_phase'
  | 'round_end'
  | 'game_over';

export type SubPhase =
  | 'select_building'
  | 'select_payment'
  | 'crane_select'
  | 'select_production'
  | 'select_good'
  | 'select_cards'
  | 'chapel_tuck'
  | 'archive_select'
  | 'discard_excess'
  | 'waiting'
  | null;

export interface CardDef {
  id: string;
  name: string;
  type: BuildingType;
  cost: number;
  vp: number;
  goodType?: GoodType;
  count: number;
  ability?: string;
  abilityText: string;
}

export interface Card {
  instanceId: number;
  defId: string;
}

export interface Building {
  card: Card;
  good: GoodType | null;
  chapelCards: number;
}

export interface PlayerState {
  id: number;
  name: string;
  hand: Card[];
  buildings: Building[];
  isHuman: boolean;
}

export interface ScoreBreakdown {
  buildingVP: number;
  chapelVP: number;
  monumentVP: number;
  guildHallVP: number;
  cityHallVP: number;
  palaceVP: number;
  total: number;
}

export interface GameState {
  phase: GamePhase;
  subPhase: SubPhase;

  players: PlayerState[];
  deck: Card[];
  discard: Card[];

  governorIndex: number;
  currentRoleSelector: number;
  usedRoles: RoleType[];
  rolesSelectedThisRound: number;

  currentRole: RoleType | null;
  roleChooser: number;
  executingPlayerIndex: number;
  playersCompletedAction: boolean[];

  drawnCards: Card[];
  selectedCards: number[];

  chapelUsedThisRound: boolean[];
  gameEndTriggered: boolean;
  currentTradingTile: TradingTile | null;

  log: string[];
  finalScores: { playerId: number; breakdown: ScoreBreakdown }[] | null;
}

export const ROLE_NAMES: Record<RoleType, string> = {
  builder: '建築士',
  producer: '監督',
  trader: '商人',
  councillor: '参事会員',
  prospector: '金鉱掘り',
};

export const GOOD_NAMES: Record<GoodType, string> = {
  indigo: 'インディゴ',
  sugar: '砂糖',
  tobacco: 'タバコ',
  coffee: 'コーヒー',
  silver: '銀',
};

export type TradingTile = Record<GoodType, number>;

export const TRADING_TILES: TradingTile[] = [
  { indigo: 1, sugar: 1, tobacco: 2, coffee: 2, silver: 3 },
  { indigo: 1, sugar: 2, tobacco: 2, coffee: 2, silver: 3 },
  { indigo: 1, sugar: 2, tobacco: 2, coffee: 3, silver: 3 },
  { indigo: 1, sugar: 1, tobacco: 2, coffee: 2, silver: 2 },
  { indigo: 1, sugar: 1, tobacco: 1, coffee: 2, silver: 2 },
];

export const MAX_BUILDINGS = 12;
export const DEFAULT_HAND_LIMIT = 7;
export const TOWER_HAND_LIMIT = 12;
