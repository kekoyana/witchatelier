# CLAUDE.md - サンファン開発ガイド

## プロジェクト概要

ボードゲーム「サンファン」(2004年) の Web 実装。1人 vs 3 AI の4人プレイ。
React 18 + TypeScript + Vite で構築。

## コマンド

```bash
npm run dev       # 開発サーバー起動
npm run build     # tsc + vite build (本番ビルド)
npm run test      # vitest run (全テスト実行)
npm test          # 同上
npm run test:watch # vitest (ウォッチモード)
npm run lint      # eslint
```

## アーキテクチャ

### ファイル構成

```
src/
├── game/           # ゲームロジック層 (React非依存の純粋関数)
│   ├── types.ts    # 型定義・定数
│   ├── cardData.ts # カードデータ (22種)
│   ├── utils.ts    # デッキ操作・ヘルパー
│   ├── engine.ts   # コアゲームロジック ★最重要
│   ├── scoring.ts  # 終了時得点計算
│   ├── ai.ts       # AI意思決定
│   ├── actions.ts  # アクション型定義
│   └── reducer.ts  # useReducer本体
├── components/     # 再利用可能UIコンポーネント
│   ├── CardView.tsx
│   └── ScoreBoard.tsx
├── App.tsx         # メインUI
├── App.css         # 全スタイル
└── main.tsx        # エントリーポイント
```

### 依存関係 (下→上に依存)

```
Level 0: types.ts, actions.ts, cardData.ts
Level 1: utils.ts, scoring.ts
Level 2: engine.ts, ai.ts
Level 3: reducer.ts, CardView.tsx
Level 4: App.tsx
```

### 状態管理パターン

- `useReducer` による単方向データフロー
- ステート変更は全て `engine.ts` の純粋関数で実行
- AI は `useEffect` + `setTimeout` で自動 dispatch

## 開発ルール

### コーディング規約

- **TypeScript strict mode**: `noUnusedLocals`, `noUnusedParameters` 有効
- **不変更新**: spread operator でコピー。直接 mutation 禁止
- **ヘルパー関数**: `updatePlayer()`, `addLog()`, `drawCardsForPlayer()`, `discardCards()`, `enforceHandLimit()` を使う
- **日本語**: UI テキスト・ログは日本語。コメントも日本語可

### ゲームロジック変更時

1. `engine.ts` に純粋関数を追加/修正
2. 必要なら `actions.ts` にアクション型追加
3. `reducer.ts` で dispatch ハンドリング
4. `ai.ts` で AI の決定ロジック追加
5. `App.tsx` の該当フェーズ UI を更新
6. **テストを書く** (`src/game/*.test.ts`)

### 新しい建物能力を追加する場合

1. `cardData.ts` に CardDef 追加 (ability キー設定)
2. `engine.ts` の該当フェーズで `hasBuilding(buildings, 'ability_key')` チェック
3. `libraryMultiplier` を掛けて図書館対応
4. `ai.ts` の該当決定関数で能力を考慮
5. テストを追加

### テスト

- テストフレームワーク: **Vitest**
- テストファイル: `src/game/*.test.ts` (ソースと同じディレクトリ)
- ゲームロジック (`game/` 以下) は React 非依存なので単体テスト容易
- テスト用ヘルパー: `makeCard()`, `makeBuilding()`, `makePlayer()`, `makeGameState()` を各テストファイルで定義
- `beforeEach` で `resetInstanceIdCounter()` を呼ぶ
- 変更後は必ず `npm test` を実行

### ビルド確認

- コード変更後は `npm run build` でビルドが通ることを確認
- TypeScript のコンパイルエラーに注意 (`noUnusedLocals` で未使用インポートはエラー)

## 既知の未実装機能

(現時点でなし)
