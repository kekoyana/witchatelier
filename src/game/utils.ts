import { Card, CardDef } from './types';
import { CARD_DEFS, CARD_DEF_MAP } from './cardData';

let nextInstanceId = 1;

export function resetInstanceIdCounter() {
  nextInstanceId = 1;
}

export function getCardDef(card: Card): CardDef {
  return CARD_DEF_MAP[card.defId];
}

export function createDeck(): Card[] {
  const cards: Card[] = [];
  for (const def of CARD_DEFS) {
    for (let i = 0; i < def.count; i++) {
      cards.push({ instanceId: nextInstanceId++, defId: def.id });
    }
  }
  return shuffle(cards);
}

export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function drawCards(
  deck: Card[],
  discard: Card[],
  count: number
): { drawn: Card[]; deck: Card[]; discard: Card[] } {
  let currentDeck = [...deck];
  let currentDiscard = [...discard];
  const drawn: Card[] = [];

  for (let i = 0; i < count; i++) {
    if (currentDeck.length === 0) {
      if (currentDiscard.length === 0) break;
      currentDeck = shuffle(currentDiscard);
      currentDiscard = [];
    }
    drawn.push(currentDeck.pop()!);
  }

  return { drawn, deck: currentDeck, discard: currentDiscard };
}

export function hasBuilding(
  buildings: { card: Card }[],
  defId: string
): boolean {
  return buildings.some((b) => b.card.defId === defId);
}

export function countBuildingsByType(
  buildings: { card: Card }[],
  type: 'production' | 'violet'
): number {
  return buildings.filter((b) => getCardDef(b.card).type === type).length;
}

export function countMonuments(buildings: { card: Card }[]): number {
  return buildings.filter((b) => getCardDef(b.card).ability === 'monument')
    .length;
}


export function getHandLimit(buildings: { card: Card }[]): number {
  return hasBuilding(buildings, 'tower') ? 12 : 7;
}
