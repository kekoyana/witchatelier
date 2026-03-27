# San Juan (サンファン)

ボードゲーム「サンファン」(2004年) の Web 実装です。
1人のプレイヤーが3体のAIと対戦する4人プレイのカードゲームです。

## 技術スタック

- React 18 + TypeScript (strict mode)
- Vite 6
- Vitest (テスト)
- CSS (フレームワーク不使用、レスポンシブ対応)

## セットアップ

```bash
npm install
```

## コマンド

```bash
npm run dev        # 開発サーバー起動
npm run build      # プロダクションビルド (tsc + vite build)
npm run test       # テスト実行
npm run test:watch # テスト (ウォッチモード)
npm run lint       # ESLint
npm run preview    # プロダクションビルドのプレビュー
```

## プロジェクト構成

```
src/
├── game/           # ゲームロジック (React非依存の純粋関数)
│   ├── types.ts    # 型定義・定数
│   ├── cardData.ts # カードデータベース (22種約110枚)
│   ├── utils.ts    # デッキ操作・ヘルパー
│   ├── engine.ts   # コアゲームロジック
│   ├── scoring.ts  # 終了時得点計算
│   ├── ai.ts       # AI意思決定
│   ├── actions.ts  # アクション型定義
│   └── reducer.ts  # useReducer本体
├── components/     # 再利用可能UIコンポーネント
├── App.tsx         # メインUI
└── App.css         # スタイル (レスポンシブ対応)
```

詳細なアーキテクチャは [ARCHITECTURE.md](./ARCHITECTURE.md) を参照してください。

## ゲームルール

- 各ラウンドで4人が順番に5つの役職(建築士・監督・商人・参事会員・金鉱掘り)から1つ選択
- 選んだ役職のアクションを全員が実行(選んだプレイヤーは特権あり)
- 建物を建設してVP(勝利点)を稼ぐ
- 誰かが12個目の建物を建設したラウンドの終了時にゲーム終了
- 最も多くのVPを獲得したプレイヤーが勝利
