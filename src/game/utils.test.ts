import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetInstanceIdCounter,
  getCardDef,
  createDeck,
  shuffle,
  drawCards,
  hasBuilding,
  countBuildingsByType,
  countMonuments,
  getHandLimit,
} from './utils';
import { Card, Building } from './types';
import { CARD_DEFS } from './cardData';

beforeEach(() => {
  resetInstanceIdCounter();
});

describe('getCardDef', () => {
  it('returns correct definition for a card', () => {
    const card: Card = { instanceId: 1, defId: 'indigo_plant' };
    const def = getCardDef(card);
    expect(def.id).toBe('indigo_plant');
    expect(def.name).toBe('インディゴ染料工場');
    expect(def.cost).toBe(1);
    expect(def.type).toBe('production');
  });
});

describe('createDeck', () => {
  it('creates a deck with the correct total number of cards', () => {
    const deck = createDeck();
    const expectedTotal = CARD_DEFS.reduce((sum, def) => sum + def.count, 0);
    expect(deck.length).toBe(expectedTotal);
  });

  it('assigns unique instanceIds to all cards', () => {
    const deck = createDeck();
    const ids = deck.map((c) => c.instanceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains the correct count of each card type', () => {
    const deck = createDeck();
    for (const def of CARD_DEFS) {
      const count = deck.filter((c) => c.defId === def.id).length;
      expect(count).toBe(def.count);
    }
  });
});

describe('shuffle', () => {
  it('returns an array of the same length', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    expect(shuffled.length).toBe(arr.length);
  });

  it('contains all original elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    expect(shuffled.sort()).toEqual(arr.sort());
  });

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3, 4, 5];
    const copy = [...arr];
    shuffle(arr);
    expect(arr).toEqual(copy);
  });
});

describe('drawCards', () => {
  it('draws the requested number of cards from the deck', () => {
    const deck: Card[] = [
      { instanceId: 1, defId: 'indigo_plant' },
      { instanceId: 2, defId: 'sugar_mill' },
      { instanceId: 3, defId: 'tobacco_storage' },
    ];
    const result = drawCards(deck, [], 2);
    expect(result.drawn.length).toBe(2);
    expect(result.deck.length).toBe(1);
  });

  it('reshuffles discard into deck when deck is empty', () => {
    const deck: Card[] = [];
    const discard: Card[] = [
      { instanceId: 1, defId: 'indigo_plant' },
      { instanceId: 2, defId: 'sugar_mill' },
    ];
    const result = drawCards(deck, discard, 1);
    expect(result.drawn.length).toBe(1);
    expect(result.discard.length).toBe(0);
  });

  it('draws as many as available when requesting more than total cards', () => {
    const deck: Card[] = [{ instanceId: 1, defId: 'indigo_plant' }];
    const result = drawCards(deck, [], 5);
    expect(result.drawn.length).toBe(1);
    expect(result.deck.length).toBe(0);
  });

  it('returns empty drawn when both deck and discard are empty', () => {
    const result = drawCards([], [], 3);
    expect(result.drawn.length).toBe(0);
  });
});

describe('hasBuilding', () => {
  const buildings: Building[] = [
    { card: { instanceId: 1, defId: 'indigo_plant' }, good: null, chapelCards: 0 },
    { card: { instanceId: 2, defId: 'chapel' }, good: null, chapelCards: 0 },
  ];

  it('returns true when building exists', () => {
    expect(hasBuilding(buildings, 'chapel')).toBe(true);
  });

  it('returns false when building does not exist', () => {
    expect(hasBuilding(buildings, 'palace')).toBe(false);
  });
});

describe('countBuildingsByType', () => {
  const buildings: Building[] = [
    { card: { instanceId: 1, defId: 'indigo_plant' }, good: null, chapelCards: 0 },
    { card: { instanceId: 2, defId: 'sugar_mill' }, good: null, chapelCards: 0 },
    { card: { instanceId: 3, defId: 'chapel' }, good: null, chapelCards: 0 },
  ];

  it('counts production buildings', () => {
    expect(countBuildingsByType(buildings, 'production')).toBe(2);
  });

  it('counts violet buildings', () => {
    expect(countBuildingsByType(buildings, 'violet')).toBe(1);
  });
});

describe('countMonuments', () => {
  it('counts buildings with monument ability', () => {
    const buildings: Building[] = [
      { card: { instanceId: 1, defId: 'statue' }, good: null, chapelCards: 0 },
      { card: { instanceId: 2, defId: 'victory_column' }, good: null, chapelCards: 0 },
      { card: { instanceId: 3, defId: 'chapel' }, good: null, chapelCards: 0 },
    ];
    expect(countMonuments(buildings)).toBe(2);
  });

  it('returns 0 when no monuments exist', () => {
    const buildings: Building[] = [
      { card: { instanceId: 1, defId: 'indigo_plant' }, good: null, chapelCards: 0 },
    ];
    expect(countMonuments(buildings)).toBe(0);
  });
});


describe('getHandLimit', () => {
  it('returns 7 without tower', () => {
    const buildings: Building[] = [
      { card: { instanceId: 1, defId: 'indigo_plant' }, good: null, chapelCards: 0 },
    ];
    expect(getHandLimit(buildings)).toBe(7);
  });

  it('returns 12 with tower', () => {
    const buildings: Building[] = [
      { card: { instanceId: 1, defId: 'tower' }, good: null, chapelCards: 0 },
    ];
    expect(getHandLimit(buildings)).toBe(12);
  });
});
