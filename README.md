# Witch's Atelier (魔女の工房)

A card game where you develop your witch's workshop deep in the forest.
Play as a witch against 3 AI opponents in this strategic card game.

深い森の奥で魔女として工房を発展させるカードゲームです。
1人のプレイヤーが3体のAIと対戦する4人プレイです。

## Play

[Play on itch.io](#) (coming soon)

## Tech Stack

- React 18 + TypeScript (strict mode)
- Vite 8
- Vitest (testing)
- CSS (no framework, responsive)
- Bilingual support (English / Japanese)

## Setup

```bash
npm install
```

## Commands

```bash
npm run dev        # Dev server
npm run build      # Production build (tsc + vite build)
npm run test       # Run tests
npm run test:watch # Tests (watch mode)
npm run lint       # ESLint
npm run preview    # Preview production build
```

## Project Structure

```
src/
├── game/           # Game logic (pure functions, React-independent)
│   ├── types.ts    # Type definitions & constants
│   ├── cardData.ts # Card database (22 types, ~110 cards)
│   ├── utils.ts    # Deck operations & helpers
│   ├── engine.ts   # Core game logic
│   ├── scoring.ts  # End-game scoring
│   ├── ai.ts       # AI decision-making
│   ├── actions.ts  # Action type definitions
│   └── reducer.ts  # useReducer
├── components/     # Reusable UI components
├── i18n.tsx        # Internationalization (EN/JA)
├── App.tsx         # Main UI
└── App.css         # Styles (responsive)
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture.

## Game Rules

- Each round, 4 players take turns choosing one of 5 jobs: Crafting, Gathering, Trading, Divination, Exploration
- Everyone performs the chosen job's action, but the chooser gets a privilege
- Build facilities by paying cards from your hand to earn fame (victory points)
- The game ends when any player builds their 12th facility
- The player with the most fame wins

## License

All rights reserved.
