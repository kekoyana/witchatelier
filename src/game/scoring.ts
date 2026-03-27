import { GameState, PlayerState, ScoreBreakdown } from './types';
import { getCardDef, hasBuilding, countBuildingsByType, countMonuments } from './utils';

function calculatePlayerScore(player: PlayerState): ScoreBreakdown {
  let buildingVP = 0;
  let chapelVP = 0;
  let monumentVP = 0;
  let guildHallVP = 0;
  let cityHallVP = 0;
  let palaceVP = 0;

  // 建物の基本VP
  for (const b of player.buildings) {
    const def = getCardDef(b.card);
    buildingVP += def.vp;
    chapelVP += b.chapelCards;
  }

  // ギルドホール: 生産建物1つにつき+2VP
  if (hasBuilding(player.buildings, 'guild_hall')) {
    guildHallVP = countBuildingsByType(player.buildings, 'production') * 2;
  }

  // 市役所: 紫建物1つにつき+1VP
  if (hasBuilding(player.buildings, 'city_hall')) {
    cityHallVP = countBuildingsByType(player.buildings, 'violet');
  }

  // 凱旋塔: 記念碑の数に応じたVP
  if (hasBuilding(player.buildings, 'triumphal_arch')) {
    const monuments = countMonuments(player.buildings);
    if (monuments >= 3) monumentVP = 8;
    else if (monuments === 2) monumentVP = 6;
    else if (monuments === 1) monumentVP = 4;
  }

  // 宮殿: 他の得点4VPにつき+1VP
  if (hasBuilding(player.buildings, 'palace')) {
    const otherTotal =
      buildingVP + chapelVP + monumentVP + guildHallVP + cityHallVP;
    palaceVP = Math.floor(otherTotal / 4);
  }

  const total =
    buildingVP + chapelVP + monumentVP + guildHallVP + cityHallVP + palaceVP;

  return {
    buildingVP,
    chapelVP,
    monumentVP,
    guildHallVP,
    cityHallVP,
    palaceVP,
    total,
  };
}

export function calculateFinalScores(
  state: GameState
): { playerId: number; breakdown: ScoreBreakdown }[] {
  return state.players.map((p) => ({
    playerId: p.id,
    breakdown: calculatePlayerScore(p),
  }));
}
