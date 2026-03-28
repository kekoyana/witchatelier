import { createContext, useContext, useState, ReactNode } from 'react';
import { Language, RoleType, GoodType } from './game/types';

// ==================== Language Context ====================

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'ja',
  setLanguage: () => {},
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('witchAtelier_language');
    return (saved === 'en' || saved === 'ja') ? saved : 'ja';
  });

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('witchAtelier_language', lang);
  };

  const t = (key: string): string => {
    return UI_TEXTS[key]?.[language] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

// ==================== UI Translations ====================

const UI_TEXTS: Record<string, Record<Language, string>> = {
  // Title screen
  'title.name': { ja: "魔女の工房", en: "Witch's Atelier" },
  'title.subtitle': { ja: '魔女の工房 - カードゲーム', en: "Witch's Atelier - Card Game" },
  'title.start': { ja: 'ゲーム開始', en: 'Start Game' },
  'title.rules': { ja: '遊び方', en: 'How to Play' },
  'title.close': { ja: '閉じる', en: 'Close' },

  // Rules
  'rules.overview.title': { ja: 'ゲームの概要', en: 'Overview' },
  'rules.overview.text': {
    ja: '深い森の奥で魔女として工房を発展させるカードゲームです。あなた（1人）とAI（3人）の4人で対戦します。',
    en: "A card game where you develop your witch's workshop deep in the forest. Play against 3 AI opponents.",
  },
  'rules.victory.title': { ja: '勝利条件', en: 'Victory Condition' },
  'rules.victory.text': {
    ja: 'いずれかのプレイヤーが12個の設備を錬成するとゲーム終了。名声の合計が最も高いプレイヤーが勝利します。',
    en: 'The game ends when any player builds 12 facilities. The player with the highest fame total wins.',
  },
  'rules.cards.title': { ja: 'カードの役割', en: 'Card Functions' },
  'rules.cards.text': {
    ja: 'カードは設備であると同時に通貨でもあります。設備を建てるには、手札からカードを支払い（捨て）ます。',
    en: 'Cards serve as both facilities and currency. To build a facility, you pay (discard) cards from your hand.',
  },
  'rules.flow.title': { ja: 'ゲームの流れ', en: 'Game Flow' },
  'rules.flow.text': {
    ja: '各ラウンドでは、長老魔女から順番に仕事を1つ選びます。選んだ仕事のアクションは全員が実行しますが、選んだ人だけ特権を得ます。',
    en: 'Each round, starting from the Elder Witch, players choose a job. Everyone performs the action, but the chooser gets a privilege.',
  },
  'rules.roles.title': { ja: '5つの仕事', en: '5 Jobs' },
  'rules.buildings.title': { ja: '設備の種類', en: 'Facility Types' },
  'rules.buildings.production': {
    ja: '採集場（コスト1〜5）：素材を採集・売却して収入を得る。ハーブ、キノコ、蜜蝋、結晶、月光石の5種類。',
    en: 'Gathering sites (cost 1-5): Gather and sell ingredients for income. 5 types: Herb, Mushroom, Beeswax, Crystal, Moonstone.',
  },
  'rules.buildings.violet': {
    ja: '紫の設備（コスト1〜6）：特殊能力を持ち、ゲームを有利に進められる。名声も高い。',
    en: 'Purple facilities (cost 1-6): Have special abilities that give advantages. Also worth more fame.',
  },
  'rules.handlimit.title': { ja: '手札上限', en: 'Hand Limit' },
  'rules.handlimit.text': {
    ja: '手札の上限は7枚です（魔女の高塔を錬成すると12枚に増加）。',
    en: "Hand limit is 7 cards (increases to 12 with Witch's Tower).",
  },

  // Role descriptions
  'role.builder.desc': { ja: '全員が設備を1つ錬成可能', en: 'Everyone may build 1 facility' },
  'role.builder.privilege': { ja: 'コスト-1', en: 'Cost -1' },
  'role.producer.desc': { ja: '全員が素材を採集', en: 'Everyone gathers ingredients' },
  'role.producer.privilege': { ja: '追加1個採集', en: '+1 gather' },
  'role.trader.desc': { ja: '全員が素材を1つ売却可能', en: 'Everyone may sell 1 ingredient' },
  'role.trader.privilege': { ja: '売却額+1', en: 'Sale +1' },
  'role.councillor.desc': { ja: '全員がカードを引いて選択', en: 'Everyone draws cards and picks' },
  'role.councillor.privilege': { ja: '5枚引いて1枚選択', en: 'Draw 5, keep 1' },
  'role.prospector.desc': { ja: '選択者のみ1枚ドロー', en: 'Chooser only: draw 1' },
  'role.prospector.privilege': { ja: '1枚ドロー', en: 'Draw 1' },

  // Phase labels
  'phase.role_selection': { ja: '仕事選択', en: 'Job Selection' },
  'phase.chapel': { ja: '祈りの祭壇', en: 'Prayer Altar' },

  // Game board
  'label.elder': { ja: '長老魔女', en: 'Elder' },
  'label.turn': { ja: '手番', en: 'Turn' },
  'label.deck': { ja: '山札', en: 'Deck' },
  'label.hand': { ja: '手札', en: 'Hand' },
  'label.facilities': { ja: '設備', en: 'Facilities' },
  'label.log': { ja: 'ログ', en: 'Log' },
  'label.fame': { ja: '名声', en: 'Fame' },

  // Action panel - Role selection
  'action.selectRole': { ja: '仕事を選択してください', en: 'Choose a job' },

  // Action panel - Builder
  'action.builder.select': { ja: '調合 - 錬成するカードを選択', en: 'Crafting - Select a card to build' },
  'action.builder.privilege': { ja: '特権: コスト-1', en: 'Privilege: Cost -1' },
  'action.builder.crane': { ja: '調合 - {name} の建て替え', en: 'Crafting - Replace with {name}' },
  'action.builder.craneDesc': { ja: '建て替える設備を選択するか、新規錬成してください。', en: 'Select a facility to replace, or build new.' },
  'action.builder.newBuild': { ja: '新規錬成', en: 'Build New' },
  'action.builder.replace': { ja: '建替', en: 'Replace' },
  'action.builder.diff': { ja: '差額', en: 'Diff' },
  'action.builder.cost': { ja: 'コスト', en: 'Cost' },
  'action.builder.build': { ja: '錬成', en: 'Build' },
  'action.builder.payment': { ja: '調合 - {name} の支払い (コスト: {cost})', en: 'Crafting - Pay for {name} (Cost: {cost})' },
  'action.builder.paymentGoods': { ja: '調合 - {name} の支払い (コスト: {cost} [素材{goods}個使用])', en: 'Crafting - Pay for {name} (Cost: {cost} [{goods} ingredients used])' },
  'action.builder.selectPayment': { ja: '支払うカードを{cost}枚選択してください', en: 'Select {cost} cards to pay' },
  'action.builder.replaceTarget': { ja: '建て替え: {name}', en: 'Replace: {name}' },
  'action.builder.buildCostZero': { ja: '調合 - {name} を錬成 (コスト: 0)', en: 'Crafting - Build {name} (Cost: 0)' },

  // Action panel - Black market
  'action.blackmarket.title': { ja: '闇の市場 - {name} (コスト: {cost})', en: 'Shadow Bazaar - {name} (Cost: {cost})' },
  'action.blackmarket.desc': { ja: '支払いに使う素材を選択 (最大{max}個)。使わない場合はスキップ。', en: 'Select ingredients to pay with (max {max}). Skip if none.' },
  'action.blackmarket.use': { ja: '{count}個使用する', en: 'Use {count}' },
  'action.blackmarket.skip': { ja: '素材を使わない', en: 'Skip ingredients' },
  'action.blackmarket.used': { ja: '闇の市場: 素材{count}個使用', en: 'Shadow Bazaar: {count} ingredients used' },

  // Action panel - Producer
  'action.producer.title': { ja: '採集 - 採集', en: 'Gathering - Gather' },
  'action.producer.empty': { ja: '採集可能な空き設備がありません。', en: 'No empty gathering sites available.' },
  'action.producer.allProduce': { ja: '採集 - 全ての空き採集場に素材が載ります', en: 'Gathering - All empty sites will produce' },
  'action.producer.privilege': { ja: '特権: 追加1個採集', en: 'Privilege: +1 gather' },
  'action.producer.select': { ja: '採集 - 採集する設備を{count}個選択', en: 'Gathering - Select {count} sites to gather' },
  'action.producer.produce': { ja: '採集する', en: 'Gather' },

  // Action panel - Trader
  'action.trader.title': { ja: '行商 - 売却', en: 'Peddling - Sell' },
  'action.trader.empty': { ja: '売却可能な素材がありません。', en: 'No ingredients to sell.' },
  'action.trader.select': { ja: '行商 - 売却する素材を選択 (最大{count}個)', en: 'Peddling - Select ingredients to sell (max {count})' },
  'action.trader.privilege': { ja: '特権: 売却額+1カード', en: 'Privilege: Sale +1 card' },
  'action.trader.sell': { ja: '売却', en: 'Sell' },
  'action.trader.tradingTile': { ja: '取引タイル', en: 'Trade Tile' },

  // Action panel - Councillor
  'action.councillor.title': { ja: '占い', en: 'Divining' },
  'action.councillor.empty': { ja: '山札がありません。', en: 'No cards in the deck.' },
  'action.councillor.select': { ja: '占い - {total}枚から{keep}枚選択', en: 'Divining - Pick {keep} from {total}' },
  'action.councillor.privilege': { ja: '特権: 5枚引いて選択', en: 'Privilege: Draw 5 and pick' },
  'action.councillor.keep': { ja: '選択', en: 'Select' },

  // Action panel - Chapel
  'action.chapel.title': { ja: '祈りの祭壇 - 手札1枚を奉納 (現在{count}枚奉納済み)', en: 'Prayer Altar - Offer 1 card ({count} already offered)' },
  'action.chapel.desc': { ja: '奉納した1枚につきゲーム終了時+1名声。奉納するカードを選択してください。', en: '+1 fame per offered card at game end. Select a card to offer.' },
  'action.chapel.skip': { ja: '奉納しない', en: 'Skip offering' },

  // Action panel - Hand limit
  'action.handlimit.title': { ja: '手札上限超過 - {count}枚捨ててください', en: 'Over hand limit - Discard {count}' },
  'action.handlimit.desc': { ja: '手札が上限({limit}枚)を超えています。捨てるカードを選択してください。', en: 'Hand exceeds limit ({limit}). Select cards to discard.' },
  'action.handlimit.discard': { ja: '捨てる', en: 'Discard' },

  // Action panel - Archive
  'action.archive.title': { ja: '魔導書庫 - 手札から捨てるカードを選択', en: 'Grimoire Vault - Select cards to discard' },
  'action.archive.desc': { ja: '任意の枚数を捨てられます。捨てない場合はスキップしてください。', en: 'You may discard any number of cards. Skip if none.' },
  'action.archive.discard': { ja: '{count}枚捨てる', en: 'Discard {count}' },
  'action.archive.skip': { ja: '捨てない', en: 'Keep all' },

  // Common buttons
  'btn.pass': { ja: 'パス', en: 'Pass' },
  'btn.ok': { ja: 'OK', en: 'OK' },
  'btn.back': { ja: '戻る', en: 'Back' },

  // AI thinking
  'ai.thinking': { ja: '{name} が考え中', en: '{name} is thinking' },
  'ai.chapel': { ja: '{name} が祈りの祭壇を使用中', en: '{name} is using the Prayer Altar' },
  'ai.selectRole': { ja: '{name} が仕事を選択中', en: '{name} is choosing a job' },

  // Score board
  'score.title': { ja: 'ゲーム終了', en: 'Game Over' },
  'score.winner': { ja: '{name} の勝利！', en: '{name} wins!' },
  'score.player': { ja: 'プレイヤー', en: 'Player' },
  'score.buildingVP': { ja: '設備', en: 'Facilities' },
  'score.chapel': { ja: '祭壇', en: 'Altar' },
  'score.monument': { ja: 'オブジェ', en: 'Objects' },
  'score.guild': { ja: '組合', en: 'Guild' },
  'score.cityHall': { ja: '集会所', en: 'Council' },
  'score.palace': { ja: '城', en: 'Castle' },
  'score.total': { ja: '合計', en: 'Total' },
  'score.restart': { ja: 'もう一度プレイ', en: 'Play Again' },

  // Player
  'player.you': { ja: 'あなた', en: 'You' },

  // Log messages
  'log.gameStart': { ja: 'ゲーム開始！', en: 'Game start!' },
  'log.newRound': { ja: '--- 新しいラウンド ---', en: '--- New Round ---' },
  'log.gameEnd': { ja: '=== ゲーム終了 ===', en: '=== Game Over ===' },
  'log.selectRole': { ja: '{player}が{role}を選択', en: '{player} chose {role}' },
  'log.build': { ja: '{player}が{card}を錬成', en: '{player} built {card}' },
  'log.skipBuild': { ja: '{player}は錬成をパス', en: '{player} passed on building' },
  'log.carpenter': { ja: '{player}: 工房の小妖精で{count}枚引いた', en: '{player}: Workshop Imp drew {count}' },
  'log.hero': { ja: '{player}: 大魔女で{count}枚引いた', en: '{player}: Arch Witch drew {count}' },
  'log.poorHouse': { ja: '{player}: 使い魔の巣で{count}枚引いた', en: "{player}: Familiar's Nest drew {count}" },
  'log.maxBuildings': { ja: '{player}が{count}個の設備を錬成！', en: '{player} built {count} facilities!' },
  'log.produce': { ja: '{player}が{count}個採集', en: '{player} gathered {count}' },
  'log.well': { ja: '{player}: 恵みの泉で{count}枚引いた', en: '{player}: Blessing Spring drew {count}' },
  'log.sell': { ja: '{player}が{good}を売却({count}枚)', en: '{player} sold {good} ({count} cards)' },
  'log.skipTrade': { ja: '{player}は売却をパス', en: '{player} passed on selling' },
  'log.councillor': { ja: '{player}が{kept}枚選択({total}枚から)', en: '{player} kept {kept} (from {total})' },
  'log.archive': { ja: '{player}が魔導書庫で{count}枚捨てた', en: '{player} discarded {count} via Grimoire Vault' },
  'log.prospector': { ja: '{player}が{count}枚引いた(探索)', en: '{player} drew {count} (Exploring)' },
  'log.goldmine': { ja: '{player}: 精霊の導きで{cards}を獲得', en: '{player}: Spirit Guide found {cards}' },
  'log.goldmineFail': { ja: '{player}: 精霊の導き - コストが重複、獲得なし', en: '{player}: Spirit Guide - duplicate costs, nothing found' },
  'log.chapel': { ja: '{player}が祈りの祭壇にカードを奉納', en: '{player} offered a card to the Prayer Altar' },
  'log.chapelSkip': { ja: '{player}が祈りの祭壇をスキップ', en: '{player} skipped the Prayer Altar' },
  'log.discardExcess': { ja: '{player}が{count}枚捨てた(手札上限)', en: '{player} discarded {count} (hand limit)' },
  'log.tradingTile': {
    ja: '取引タイル: ハーブ{indigo}/キノコ{sugar}/蜜蝋{tobacco}/結晶{coffee}/月光石{silver}',
    en: 'Trade tile: Herb {indigo} / Mushroom {sugar} / Beeswax {tobacco} / Crystal {coffee} / Moonstone {silver}',
  },
};

// ==================== Card English Names ====================

export const CARD_NAMES_EN: Record<string, { name: string; abilityText: string }> = {
  indigo_plant: { name: 'Herb Garden', abilityText: 'Gather herbs' },
  sugar_mill: { name: 'Mushroom Cave', abilityText: 'Gather mushrooms' },
  tobacco_storage: { name: 'Apiary', abilityText: 'Gather beeswax' },
  coffee_roaster: { name: 'Crystal Mine', abilityText: 'Gather crystals' },
  silver_smelter: { name: 'Moonlight Spring', abilityText: 'Gather moonstones' },
  smithy: { name: 'Enchanted Mortar', abilityText: 'Crafting: Cost -1' },
  goldmine: { name: 'Spirit Guide', abilityText: 'Explore: Reveal 4, if all different costs take 1' },
  archive: { name: 'Grimoire Vault', abilityText: 'Divining: May discard hand cards' },
  poor_house: { name: "Familiar's Nest", abilityText: 'After craft: Draw 1 if hand 0-1' },
  black_market: { name: 'Shadow Bazaar', abilityText: 'Crafting: Use 1-2 ingredients as payment' },
  trading_post: { name: "Wanderer's Inn", abilityText: 'Peddling: May sell 1 extra' },
  well: { name: 'Blessing Spring', abilityText: 'Gathering: Draw 1 if gathered 2+' },
  crane: { name: 'Transmutation', abilityText: 'Crafting: Replace existing facility (pay diff)' },
  market_stand: { name: 'Potion Stall', abilityText: 'Peddling: Draw 1 extra per sale' },
  chapel: { name: 'Prayer Altar', abilityText: 'Each round: Offer 1 hand card (1 fame each at end)' },
  aqueduct: { name: 'Magic Canal', abilityText: 'Gathering: Gather 1 extra' },
  carpenter: { name: 'Workshop Imp', abilityText: 'After craft: Draw 1' },
  prefecture: { name: 'Clairvoyance Tower', abilityText: 'Divining: Keep 1 extra' },
  tower: { name: "Witch's Tower", abilityText: 'Hand limit becomes 12' },
  statue: { name: 'Magic Statue', abilityText: 'Magic Object (3 fame)' },
  market_hall: { name: 'Grand Bazaar', abilityText: 'Peddling: Draw 1 extra per sale' },
  victory_column: { name: 'Pillar of Power', abilityText: 'Magic Object (4 fame)' },
  hero: { name: 'Arch Witch', abilityText: 'Crafting: Draw 5 if built cost-6' },
  library: { name: 'Forbidden Archive', abilityText: 'When choosing job: Double other purple effects' },
  city_hall: { name: 'Witch Council', abilityText: 'End: +1 fame per purple facility' },
  guild_hall: { name: 'Ingredient Guild', abilityText: 'End: +2 fame per gathering site' },
  palace: { name: "Witch's Castle", abilityText: 'End: +1 fame per 4 other fame' },
  triumphal_arch: { name: 'Gate of Power', abilityText: 'End: Objects 1=4, 2=6, 3+=8 fame' },
};

// ==================== Helper Functions ====================

export function getCardDisplayName(defId: string, lang: Language, jaName: string): string {
  if (lang === 'en') {
    return CARD_NAMES_EN[defId]?.name ?? jaName;
  }
  return jaName;
}

export function getCardDisplayAbility(defId: string, lang: Language, jaText: string): string {
  if (lang === 'en') {
    return CARD_NAMES_EN[defId]?.abilityText ?? jaText;
  }
  return jaText;
}

export function getRoleName(role: RoleType, lang: Language): string {
  const names: Record<RoleType, Record<Language, string>> = {
    builder: { ja: '調合', en: 'Crafting' },
    producer: { ja: '採集', en: 'Gathering' },
    trader: { ja: '行商', en: 'Peddling' },
    councillor: { ja: '占い', en: 'Divining' },
    prospector: { ja: '探索', en: 'Exploring' },
  };
  return names[role]?.[lang] ?? role;
}

export function getGoodName(good: GoodType, lang: Language): string {
  const names: Record<GoodType, Record<Language, string>> = {
    indigo: { ja: 'ハーブ', en: 'Herb' },
    sugar: { ja: 'キノコ', en: 'Mushroom' },
    tobacco: { ja: '蜜蝋', en: 'Beeswax' },
    coffee: { ja: '結晶', en: 'Crystal' },
    silver: { ja: '月光石', en: 'Moonstone' },
  };
  return names[good]?.[lang] ?? good;
}

// Template string interpolation
export function interpolate(template: string, params: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, String(value));
  }
  return result;
}
