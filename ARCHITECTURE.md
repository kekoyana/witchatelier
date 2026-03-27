# San Juan (サンファン) - アーキテクチャドキュメント

## 概要

ボードゲーム「サンファン」(2004年初版) の Web 実装。
1人のプレイヤーが3体のAIと対戦する4人プレイ。
React 18 + TypeScript + Vite で構築。PC/スマホ両対応。

## 技術スタック

- **React 18** (useReducer でステート管理、追加ライブラリなし)
- **TypeScript** (strict mode)
- **Vite 6** (ビルドツール)
- **CSS** (CSS変数 + flexbox/grid + media queries、CSSフレームワーク不使用)

## 起動方法

```bash
npm run dev    # 開発サーバー起動
npm run build  # プロダクションビルド
```

---

## ファイル構成と役割

```
src/
├── main.tsx                 # エントリーポイント (10行)
├── index.css                # CSSリセット・CSS変数定義
├── App.css                  # 全スタイル (レスポンシブ含む)
├── App.tsx                  # メインコンポーネント + フェーズUI (~780行)
│
├── game/                    # ゲームロジック層 (React非依存の純粋関数)
│   ├── types.ts             # 全型定義・定数 (125行)
│   ├── cardData.ts          # カードデータベース: 22種約110枚 (302行)
│   ├── utils.ts             # デッキ操作・ヘルパー関数 (86行)
│   ├── engine.ts            # コアゲームロジック (~835行) ★最重要
│   ├── scoring.ts           # 終了時得点計算 (65行)
│   ├── ai.ts                # AI意思決定 (248行)
│   ├── actions.ts           # Reducer用アクション型 (16行)
│   ├── reducer.ts           # useReducer本体 (~141行)
│   ├── utils.test.ts        # utilsテスト
│   ├── scoring.test.ts      # scoringテスト
│   ├── engine.test.ts       # engineテスト
│   └── reducer.test.ts      # reducerテスト
│
└── components/              # 再利用可能UIコンポーネント
    ├── CardView.tsx          # カード表示 (56行)
    └── ScoreBoard.tsx        # スコアボード (59行)
```

合計: 約2,720行 (テスト含む)

---

## 依存関係 (下から上に依存)

```
Level 0: types.ts, actions.ts, cardData.ts
Level 1: utils.ts (→ types, cardData), scoring.ts (→ types, utils)
Level 2: engine.ts (→ types, cardData, utils, scoring)
         ai.ts (→ types, utils, engine)
Level 3: reducer.ts (→ types, actions, engine)
         CardView.tsx (→ types, utils)
Level 4: App.tsx (→ 全game/ + components/)
Level 5: main.tsx (→ App.tsx)
```

---

## ゲームフロー

### 状態管理

`useReducer` による単方向データフロー:

```
ユーザー操作 → dispatch(GameAction) → gameReducer → 新しいGameState → React再描画
```

AIは `useEffect` でフェーズ・プレイヤーを監視し、自動で `dispatch` する。

### GameState の主要フィールド

```typescript
interface GameState {
  phase: GamePhase;          // 'title' | 'role_selection' | '*_phase' | 'game_over'
  subPhase: SubPhase;        // UI操作の段階 (null | 'select_building' | ...)

  players: PlayerState[];    // 4人分 (index 0 = 人間, 1-3 = AI)
  deck: Card[];              // 山札
  discard: Card[];           // 捨て札

  governorIndex: number;     // 現在の総督 (0-3, 毎ラウンド+1)
  currentRoleSelector: number; // 役職選択中のプレイヤー
  usedRoles: RoleType[];     // このラウンドで使用済みの役職
  rolesSelectedThisRound: number; // このラウンドで選ばれた役職数 (4で新ラウンド)

  currentRole: RoleType | null; // 実行中の役職
  roleChooser: number;       // 役職を選んだプレイヤー (特権保持者)
  executingPlayerIndex: number; // 現在アクション実行中のプレイヤー

  drawnCards: Card[];        // 参事会員フェーズで引いたカード
  gameEndTriggered: boolean; // 12建物到達フラグ
  log: string[];             // ゲームログ
  finalScores: ...;          // ゲーム終了時の得点内訳
}
```

### ラウンドの流れ

```
1. 役職選択 (phase: 'role_selection')
   - 総督から時計回りに各プレイヤーが未使用の役職を1つ選択
   - 4人が選んだら新ラウンド (5役職のうち1つは使われない)

2. 役職実行 (phase: '*_phase')
   - 総督から時計回りに全プレイヤーがアクション実行
   - 選んだプレイヤーは特権を得る
   - 全員完了 → 次の役職選択へ

3. 礼拝堂フェーズ (phase: 'chapel_phase')
   - 4人全員が役職を選んだ後、新ラウンド開始前に実行
   - 礼拝堂を持つプレイヤーが手札1枚を格納可能 (1枚=1VP)
   - 総督から時計回りに処理

4. ゲーム終了判定
   - いずれかのプレイヤーが12個目の建物を建設 → gameEndTriggered = true
   - 現在のラウンド終了後にゲーム終了 → scoring.ts で得点計算
```

---

## 5つの役職と特権

| 役職 | 基本アクション | 特権 (選択者のみ) |
|------|---------------|------------------|
| 建築士 | 全員が建物を1つ建設可能 | コスト-1 |
| 監督 | 全員が空き生産建物1つに生産 | +1個追加生産 |
| 商人 | 全員が商品を1つ売却可能 | 売却額+1カード |
| 参事会員 | 全員が2枚引いて1枚保持 | 5枚引いて1枚保持 |
| 金鉱掘り | 選択者のみ1枚ドロー | (他プレイヤーは何もしない) |

---

## カードデータ (cardData.ts)

### 生産建物 (5種)

| ID | 名前 | コスト | VP | 商品 | 枚数 |
|----|------|--------|-----|------|------|
| indigo_plant | インディゴ染料工場 | 1 | 1 | インディゴ (売値1) | 10 |
| sugar_mill | 砂糖精製所 | 2 | 1 | 砂糖 (売値1) | 8 |
| tobacco_storage | タバコ保管庫 | 3 | 2 | タバコ (売値2) | 8 |
| coffee_roaster | コーヒー焙煎所 | 4 | 2 | コーヒー (売値2) | 8 |
| silver_smelter | 銀精錬所 | 5 | 3 | 銀 (売値3) | 8 |

### 紫建物 (17種)

| ID | 名前 | コスト | VP | 能力キー | 効果概要 |
|----|------|--------|-----|----------|---------|
| smithy | 鍛冶屋 | 1 | 1 | smithy | 建築コスト-1 |
| goldmine | 金鉱 | 1 | 1 | goldmine | 生産時: 山札4枚公開、全異コストなら1枚獲得 |
| archive | 公文書館 | 1 | 1 | archive | 参事会員時: 手札を任意に捨て可 |
| poor_house | 救貧院 | 2 | 1 | poor_house | 建築後: 手札0-1なら1枚引く |
| black_market | 闇市場 | 2 | 1 | black_market | 建築時: 商品1-2個をコスト支払いに使用可 |
| trading_post | 商館 | 2 | 1 | trading_post | 商人時: 追加1個売却可 |
| well | 井戸 | 2 | 1 | well | 生産時: 2個以上生産なら1枚引く |
| crane | クレーン | 2 | 1 | crane | 建築時: 建て替え可能 (差額支払い) |
| market_stand | 露店 | 2 | 1 | market_stand | 商人時: 売却ごとに+1枚 |
| chapel | 礼拝堂 | 3 | 2 | chapel | 毎ラウンド: 手札1枚格納 (終了時1枚=1VP) |
| aqueduct | 水道橋 | 3 | 2 | aqueduct | 生産時: +1個生産 |
| carpenter | 大工小屋 | 3 | 2 | carpenter | 建築後: 1枚引く |
| prefecture | 知事官邸 | 3 | 2 | prefecture | 参事会員時: +1枚保持 |
| tower | 塔 | 3 | 2 | tower | 手札上限12枚 (通常7枚) |
| statue | 彫像 | 3 | 3 | monument | 記念碑 (凱旋塔用) |
| market_hall | マーケットホール | 4 | 2 | market_hall | 商人時: 売却ごとに+1枚 |
| victory_column | 凱旋門 | 4 | 4 | monument | 記念碑 (凱旋塔用) |
| hero | 英雄 | 5 | 3 | hero | コスト6建設時: 5枚引く |
| library | 図書館 | 5 | 3 | library | 役職選択時: 他の紫建物効果を2倍 |
| city_hall | 市役所 | 6 | 0 | city_hall | 終了時: 紫建物1つにつき+1VP |
| guild_hall | ギルドホール | 6 | 0 | guild_hall | 終了時: 生産建物1つにつき+2VP |
| palace | 宮殿 | 6 | 0 | palace | 終了時: 他の得点4VPにつき+1VP |
| triumphal_arch | 凱旋塔 | 6 | 0 | triumphal_arch | 終了時: 記念碑1=4VP, 2=6VP, 3+=8VP |

---

## engine.ts 主要関数リファレンス

### 初期化

```typescript
createInitialGameState(): GameState
// デッキ生成、4人に手札4枚配布、各自インディゴ染料工場を初期建物に

startGame(state): GameState
// phase を 'role_selection' に変更
```

### 役職選択

```typescript
selectRole(state, role: RoleType): GameState
// 1. usedRolesに追加、rolesSelectedThisRound++
// 2. executingPlayerIndex を governorIndex に設定
// 3. role に応じた phase に遷移
// 4. 金鉱掘りの場合は即時処理して次の役職選択へ
```

### 建築関連

```typescript
getBuildCost(state, playerId, defId, craneTargetDefId?): number
// コスト計算: 基本コスト - 特権 - 鍛冶屋 + クレーン差額
// 図書館効果: 特権・鍛冶屋の減額を2倍

canBuild(state, playerId, cardInstanceId, craneTargetIndex?): boolean
// 重複チェック、12建物上限、支払い可能性チェック

executeBuild(state, playerId, cardInstanceId, paymentCardIds, ...): GameState
// 建設実行 + 事後処理: 大工小屋、英雄、救貧院、手札上限
```

### 生産関連

```typescript
getMaxProductionSlots(state, playerId): number
// 基本1 + 特権(+1) + 水道橋(+1)、空きスロット上限

executeProduction(state, playerId, buildingIndices): GameState
// 指定建物に商品載せ + 事後処理: 井戸、金鉱
```

### 売却関連

```typescript
getMaxSellCount(state, playerId): number
// 基本1 + 商館(+1)

executeTrade(state, playerId, buildingIndices): GameState
// 売価計算: 基本価格 + 特権(+1) + マーケットホール(+1) + 露店(+1)
```

### フェーズ進行

```typescript
advanceToNextPlayer(state): GameState
// 次のプレイヤーへ。全員完了なら advanceToNextRoleSelection へ
// 参事会員の場合は次のプレイヤー用ドローを準備
```

### 図書館効果

```typescript
isLibraryActive(state, playerId): boolean
// 図書館所有 && roleChooser == playerId

libraryMultiplier(state, playerId): number
// isLibraryActive ? 2 : 1
// ※ 各能力の計算で * mult として使用
```

---

## AI ロジック (ai.ts)

### 役職選択 (aiSelectRole)

各役職をスコアリング (手札・建物・商品状態から評価) + ランダム要素:

- **建築士**: 建てられるカードのVP × 3 + 特権ボーナス
- **監督**: 空き生産建物数 × 3
- **商人**: 売却可能商品の売値 × 2 + 特権ボーナス
- **参事会員**: 基本4 + 手札少ない時ボーナス + 特権3
- **金鉱掘り**: 基本2 + 手札少ない時ボーナス

### 建築 (aiDecideBuild)

1. 建てられるカードをスコアリング (VP×10 + コスト×2、6コスト+20)
2. 最高スコアのカードを選択
3. 支払い: VPの低いカードから消費

### 生産 (aiDecideProduction)

高価値商品の建物を優先 (銀 > コーヒー > タバコ > 砂糖 > インディゴ)

### 売却 (aiDecideTrade)

高価値商品から順に売却

### 参事会員 (aiDecideCouncillor)

VP×5 + コスト でスコアリング。重複建物は-10、6コストは+8

---

## UI構成 (App.tsx)

### レイアウト

```
┌─────────────────────────────────┐
│ PhaseIndicator (役職/総督/手番/山札)│
├───────────┬───────────┬─────────┤
│ Opponent1 │ Opponent2 │ Opponent3│  ← opponents-row
├───────────┴───────────┴────┬────┤
│ Player Buildings           │ Log│
│ Player Hand                │    │  ← game-main
│ Action Panel               │    │
└────────────────────────────┴────┘
```

### ActionPanel のフェーズ別表示

| フェーズ | 人間の操作 | コンポーネント |
|---------|-----------|--------------|
| role_selection | 5役職から選択 | RoleSelectionPanel |
| builder_phase | 建設カード選択 → 支払いカード選択 | BuilderPanel |
| producer_phase | 生産建物選択 (または全自動) | ProducerPanel |
| trader_phase | 売却商品選択 | TraderPanel |
| councillor_phase | 引いたカードから保持カード選択 | CouncillorPanel |
| chapel_phase | 礼拝堂にカード格納 (任意) | ChapelPanel |
| AI実行中 | 「考え中...」表示 | (ai-thinking) |

### レスポンシブ対応

- **PC (>=768px)**: ログサイドバー表示、カード通常サイズ
- **モバイル (<768px)**: ログ非表示、カード縮小、role-desc非表示

---

## 既知の未実装・改善点

### 未実装機能

1. **公文書館 (archive)**: 人間プレイヤー用UIが未実装 (AIは自動処理)
2. ~~**礼拝堂 (chapel)**~~: 実装済み (毎ラウンド手札格納UI、AI自動処理)
3. **闇市場 (black_market)**: 人間プレイヤー用の商品支払いUIが未実装
4. **クレーン (crane)**: 人間プレイヤー用の建て替え選択UIが未実装
5. **手札上限超過時の選択UI**: 現在は自動で末尾から削除

### 改善候補

1. ~~**テストなし**~~: Vitest でユニットテスト実装済み (98テスト)
2. **AI強化**: 現在は単純なヒューリスティック。MCTS等の導入余地あり
3. **エラーハンドリング**: 無効な状態遷移のチェックが最低限
4. **セーブ/ロード**: ゲーム状態の永続化なし
5. **アニメーション**: カード移動やフェーズ遷移のトランジションが未実装
6. **ツールチップ**: カードホバー時の詳細表示が title属性のみ
7. **プレイヤー数選択**: 現在は4人固定 (配列長4がハードコード)

---

## テスト

- フレームワーク: **Vitest**
- テストファイルは `src/game/` 内にソースと並置 (`*.test.ts`)
- `npm run test` で全テスト実行、`npm run test:watch` でウォッチモード
- game/ 以下は React 非依存の純粋関数なので単体テストが容易

### テストカバレッジ

| ファイル | テスト内容 |
|---------|-----------|
| utils.test.ts | デッキ操作、カード検索、手札上限、売値計算 |
| scoring.test.ts | 基本VP、礼拝堂VP、ギルドホール、市役所、凱旋塔、宮殿 |
| engine.test.ts | 初期化、役職選択、建築、生産、売却、参事会員、礼拝堂、フェーズ進行 |
| reducer.test.ts | 各アクションの dispatch ハンドリング |

---

## 開発ガイドライン

### 新しい建物能力を追加する場合

1. `cardData.ts` に CardDef を追加 (ability キーを設定)
2. `engine.ts` の該当フェーズ関数内で `hasBuilding(buildings, 'ability_key')` でチェック
3. `libraryMultiplier` を掛けて図書館対応
4. `ai.ts` の該当決定関数で能力を考慮

### 新しいUIコンポーネントを追加する場合

1. `src/components/` にコンポーネント作成
2. `App.css` にスタイル追加 (セクションコメントで区切る)
3. `App.tsx` から import して該当フェーズで表示

### ゲームステートを変更する場合

全てのステート変更は `engine.ts` の純粋関数で行う:
- 直接mutationは禁止 (spread operator でコピー)
- `updatePlayer()` ヘルパーでプレイヤー更新
- `addLog()` でログ追記
- `drawCardsForPlayer()` でカードドロー
- `discardCards()` で捨て札追加
- `enforceHandLimit()` で手札上限強制
