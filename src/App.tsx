import React, { useReducer, useEffect, useRef } from 'react';
import './App.css';
import { GameState, RoleType, GoodType, TradingTile, ROLE_NAMES, GOOD_NAMES } from './game/types';
import { GameAction } from './game/actions';
import { gameReducer, createInitialState } from './game/reducer';
import {
  getProducibleBuildings,
  getSellableGoods,
  getCouncillorKeepCount,
  canBuild,
  getBuildCost,
  getMaxSellCount,
  getMaxProductionCount,
  getDiscardExcessCount,
} from './game/engine';
import { getHandLimit, hasBuilding } from './game/utils';
import {
  aiSelectRole,
  aiDecideBuild,
  aiDecideProduction,
  aiDecideTrade,
  aiDecideCouncillor,
  aiDecideChapel,
} from './game/ai';
import { getCardDef } from './game/utils';
import { CardView } from './components/CardView';
import { ScoreBoard } from './components/ScoreBoard';

function App() {
  const [state, dispatch] = useReducer(gameReducer, null, createInitialState);

  const timerRef = useRef<number | null>(null);

  // AI自動進行
  useEffect(() => {
    if (state.phase === 'title' || state.phase === 'game_over') return;

    const isRoleSelection = state.phase === 'role_selection';

    // 役職選択フェーズでAIの番
    if (isRoleSelection) {
      const selector = state.players[state.currentRoleSelector];
      if (!selector.isHuman) {
        timerRef.current = window.setTimeout(() => {
          const role = aiSelectRole(state, selector.id);
          dispatch({ type: 'SELECT_ROLE', role });
        }, 400);
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
      }
      return;
    }

    // 礼拝堂フェーズ
    if (state.phase === 'chapel_phase') {
      const chapelPlayer = state.players[state.executingPlayerIndex];
      if (!chapelPlayer.isHuman) {
        timerRef.current = window.setTimeout(() => {
          const cardId = aiDecideChapel(state, chapelPlayer.id);
          if (cardId !== null) {
            dispatch({ type: 'USE_CHAPEL', cardInstanceId: cardId });
          } else {
            dispatch({ type: 'SKIP_CHAPEL' });
          }
        }, 300);
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
      }
      return;
    }

    // 役職実行フェーズでAIの番
    const currentPlayer = state.players[state.executingPlayerIndex];
    if (!currentPlayer.isHuman && state.currentRole) {
      timerRef.current = window.setTimeout(() => {
        executeAIAction(state, currentPlayer.id, dispatch);
      }, 300);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }
  }, [state.phase, state.executingPlayerIndex, state.currentRoleSelector, state.currentRole, state.subPhase]);

  const [showRules, setShowRules] = React.useState(false);

  if (state.phase === 'title') {
    return (
      <div className={`title-screen${showRules ? ' title-screen--rules-open' : ''}`}>
        <div className="title-spacer" />
        <h1>San Juan</h1>
        <div className="title-divider" />
        <p>サンファン - カードゲーム</p>
        <button onClick={() => dispatch({ type: 'START_GAME' })}>
          ゲーム開始
        </button>
        <button className="rules-toggle" onClick={() => setShowRules(!showRules)}>
          {showRules ? '閉じる' : '遊び方'}
        </button>
        {showRules && (
          <div className="rules-panel">
            <h2>ゲームの概要</h2>
            <p>
              プエルトリコの首都サンファンを舞台に、建物を建設して街を発展させるカードゲームです。
              あなた（1人）とAI（3人）の4人で対戦します。
            </p>

            <h2>勝利条件</h2>
            <p>
              いずれかのプレイヤーが<strong>12棟</strong>の建物を建設するとゲーム終了。
              建物の勝利点の合計が最も高いプレイヤーが勝利します。
            </p>

            <h2>カードの役割</h2>
            <p>
              カードは<strong>建物</strong>であると同時に<strong>通貨</strong>でもあります。
              建物を建てるには、手札からカードを支払い（捨て）ます。
            </p>

            <h2>ゲームの流れ</h2>
            <p>
              各ラウンドでは、総督から順番に<strong>役職</strong>を1つ選びます。
              選んだ役職のアクションは全員が実行しますが、選んだ人だけ特権（ボーナス）を得ます。
            </p>

            <h2>5つの役職</h2>
            <div className="rules-roles">
              <div className="rules-role">
                <span className="rules-role-name">建築士</span>
                <span>手札のカードを支払って建物を建設する。特権：コスト1減。</span>
              </div>
              <div className="rules-role">
                <span className="rules-role-name">監督</span>
                <span>生産施設に商品を1つ生産する。特権：追加で1つ生産。</span>
              </div>
              <div className="rules-role">
                <span className="rules-role-name">商人</span>
                <span>商品を売却してカードを引く。特権：追加で1つ売却。</span>
              </div>
              <div className="rules-role">
                <span className="rules-role-name">参事会員</span>
                <span>山札から5枚引いて1枚を選ぶ。特権：さらに多く選べる。</span>
              </div>
              <div className="rules-role">
                <span className="rules-role-name">金鉱掘り</span>
                <span>特権のみ：カードを1枚引く。他の人は何もできない。</span>
              </div>
            </div>

            <h2>建物の種類</h2>
            <div className="rules-building-types">
              <p>
                <strong>生産施設</strong>（コスト1〜3）：商品を生産・売却して収入を得る。
                インディゴ、砂糖、タバコ、コーヒー、銀の5種類。
              </p>
              <p>
                <strong>紫の建物</strong>（コスト1〜6）：特殊能力を持ち、ゲームを有利に進められる。
                勝利点も高い。
              </p>
            </div>

            <h2>手札上限</h2>
            <p>手札の上限は<strong>7枚</strong>です（塔を建設すると12枚に増加）。</p>
          </div>
        )}
        <div className="title-spacer" />
      </div>
    );
  }

  if (state.phase === 'game_over') {
    return (
      <ScoreBoard
        state={state}
        onRestart={() => dispatch({ type: 'RESTART_GAME' })}
      />
    );
  }

  const humanPlayer = state.players[0];
  const opponents = state.players.slice(1);
  const currentPlayer = state.players[state.executingPlayerIndex];

  return (
    <div className="game-board">
      {/* Phase Indicator */}
      <div className="phase-indicator">
        {state.currentRole && (
          <span key={`role-${state.currentRole}`} className="phase-tag">{ROLE_NAMES[state.currentRole]}</span>
        )}
        {state.phase === 'role_selection' && (
          <span key="role-selection" className="phase-tag">役職選択</span>
        )}
        {state.phase === 'chapel_phase' && (
          <span key="chapel" className="phase-tag">礼拝堂</span>
        )}
        <span className="governor-tag">
          総督: {state.players[state.governorIndex].name}
        </span>
        <span>
          手番: {state.phase === 'role_selection'
            ? state.players[state.currentRoleSelector].name
            : currentPlayer.name}
        </span>
        <span className="deck-info">
          山札: {state.deck.length}
        </span>
      </div>

      <div className="game-main">
        <div className="game-content">
          <div className="board-scroll">
            {/* Opponents */}
            <div className="opponents-row">
              {opponents.map((p) => (
                <div
                  key={p.id}
                  className={`opponent-area ${(state.phase === 'role_selection' ? state.currentRoleSelector : state.executingPlayerIndex) === p.id ? 'is-active' : ''}`}
                >
                  <div className="opponent-header">
                    <span className="name">{p.name}</span>
                    {state.governorIndex === p.id && (
                      <span className="governor-badge">★</span>
                    )}
                    <span className="hand-count">
                      手札{p.hand.length}
                    </span>
                  </div>
                  <div className="opponent-buildings">
                    {p.buildings.map((b) => (
                      <CardView
                        key={b.card.instanceId}
                        card={b.card}
                        size="xs"
                        good={b.good}
                        chapelCards={b.chapelCards}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Player Area */}
            <div className="player-section">
              <div className="player-header">
                <span className="name">{humanPlayer.name}</span>
                {state.governorIndex === 0 && (
                  <span className="governor-badge">★ 総督</span>
                )}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  建物: {humanPlayer.buildings.length}/12
                </span>
              </div>

              <div className="player-buildings-label">建物</div>
              <div className="player-buildings">
                {humanPlayer.buildings.map((b) => (
                  <CardView
                    key={b.card.instanceId}
                    card={b.card}
                    size="small"
                    good={b.good}
                    chapelCards={b.chapelCards}
                  />
                ))}
              </div>

              <div className="player-hand-label">手札 ({humanPlayer.hand.length})</div>
              <div className="player-hand">
                {humanPlayer.hand.map((c) => (
                  <CardView key={c.instanceId} card={c} size="normal" />
                ))}
              </div>
            </div>
          </div>

          {/* Action Panel */}
          <ActionPanel state={state} dispatch={dispatch} />
        </div>

        {/* Game Log */}
        <div className="game-log">
          <h4>ログ</h4>
          {[...state.log].reverse().map((entry, i) => (
            <div
              key={state.log.length - 1 - i}
              className={`log-entry ${entry.startsWith('---') || entry.startsWith('===') ? 'separator' : ''}`}
            >
              {entry}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// AI Action Execution
function executeAIAction(
  state: GameState,
  playerId: number,
  dispatch: React.Dispatch<GameAction>
) {
  const role = state.currentRole;
  if (!role) return;

  switch (role) {
    case 'builder': {
      const decision = aiDecideBuild(state, playerId);
      if (decision) {
        dispatch({
          type: 'BUILD',
          cardInstanceId: decision.cardInstanceId,
          paymentCardIds: decision.paymentCardIds,
          craneTargetIndex: decision.craneTargetIndex,
          blackMarketGoods: decision.blackMarketGoods,
        });
      } else {
        dispatch({ type: 'SKIP_BUILD' });
      }
      break;
    }
    case 'producer': {
      const indices = aiDecideProduction(state, playerId);
      if (indices.length > 0) {
        dispatch({ type: 'PRODUCE', buildingIndices: indices });
      } else {
        dispatch({ type: 'SKIP_PRODUCE' });
      }
      break;
    }
    case 'trader': {
      const indices = aiDecideTrade(state, playerId);
      if (indices.length > 0) {
        dispatch({ type: 'TRADE', buildingIndices: indices });
      } else {
        dispatch({ type: 'SKIP_TRADE' });
      }
      break;
    }
    case 'councillor': {
      const keptIds = aiDecideCouncillor(state, playerId);
      dispatch({ type: 'COUNCILLOR_KEEP', cardInstanceIds: keptIds });
      break;
    }
    case 'prospector': {
      // Prospector is auto-resolved in the reducer via advanceToNextPlayer
      dispatch({ type: 'SKIP_BUILD' }); // Just advance
      break;
    }
  }
}

// Action Panel Component
function ActionPanel({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}) {
  // 礼拝堂フェーズ
  if (state.phase === 'chapel_phase') {
    const chapelPlayer = state.players[state.executingPlayerIndex];
    if (chapelPlayer.isHuman) {
      return <ChapelPanel state={state} dispatch={dispatch} />;
    }
    return (
      <div className="action-panel">
        <div className="ai-thinking">
          {chapelPlayer.name} が礼拝堂を使用中<span className="dots"></span>
        </div>
      </div>
    );
  }

  // 役職選択フェーズ
  if (state.phase === 'role_selection') {
    const selector = state.players[state.currentRoleSelector];
    if (selector.isHuman) {
      return <RoleSelectionPanel state={state} dispatch={dispatch} />;
    }
    return (
      <div className="action-panel">
        <div className="ai-thinking">
          {selector.name} が役職を選択中<span className="dots"></span>
        </div>
      </div>
    );
  }

  // サブフェーズ: 手札上限超過
  if (state.subPhase === 'discard_excess') {
    const discardPlayer = state.players[state.executingPlayerIndex];
    if (discardPlayer.isHuman) {
      return <HandLimitPanel state={state} dispatch={dispatch} />;
    }
  }

  // サブフェーズ: 公文書館
  if (state.subPhase === 'archive_select') {
    const archivePlayer = state.players[state.executingPlayerIndex];
    if (archivePlayer.isHuman) {
      return <ArchivePanel state={state} dispatch={dispatch} />;
    }
  }

  const currentPlayer = state.players[state.executingPlayerIndex];
  const isHumanTurn = currentPlayer.isHuman;

  // AI思考中
  if (!isHumanTurn) {
    return (
      <div className="action-panel">
        <div className="ai-thinking">
          {currentPlayer.name} が考え中<span className="dots"></span>
        </div>
      </div>
    );
  }

  // 各フェーズ (人間の番)
  switch (state.currentRole) {
    case 'builder':
      return <BuilderPanel state={state} dispatch={dispatch} />;
    case 'producer':
      return <ProducerPanel state={state} dispatch={dispatch} />;
    case 'trader':
      return <TraderPanel state={state} dispatch={dispatch} />;
    case 'councillor':
      return <CouncillorPanel state={state} dispatch={dispatch} />;
    default:
      return null;
  }
}

// Role Selection
function RoleSelectionPanel({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}) {
  const [chosenRole, setChosenRole] = React.useState<RoleType | null>(null);

  const handleSelect = (role: RoleType) => {
    if (chosenRole) return;
    setChosenRole(role);
    setTimeout(() => {
      dispatch({ type: 'SELECT_ROLE', role });
    }, 350);
  };

  const roles: { role: RoleType; desc: string; privilege: string; icon: string; colorClass: string }[] = [
    { role: 'builder', desc: '全員が建物を1つ建設可能', privilege: 'コスト-1', icon: '🏛️', colorClass: 'role-builder' },
    { role: 'producer', desc: '全員が商品を生産', privilege: '追加1個生産', icon: '⚒️', colorClass: 'role-producer' },
    { role: 'trader', desc: '全員が商品を1つ売却可能', privilege: '売却額+1', icon: '⚖️', colorClass: 'role-trader' },
    { role: 'councillor', desc: '全員がカードを引いて選択', privilege: '5枚引いて1枚選択', icon: '📜', colorClass: 'role-councillor' },
    { role: 'prospector', desc: '選択者のみ1枚ドロー', privilege: '1枚ドロー', icon: '⛏️', colorClass: 'role-prospector' },
  ];

  return (
    <div className="action-panel">
      <h3>役職を選択してください</h3>
      <div className="role-card-row">
        {roles.map(({ role, desc, privilege, icon, colorClass }) => {
          const isUsed = state.usedRoles.includes(role);
          const isChosen = chosenRole === role;
          return (
            <button
              key={role}
              className={`role-card ${colorClass} ${isUsed ? 'used' : ''} ${isChosen ? 'chosen' : ''}`}
              disabled={isUsed || chosenRole !== null}
              onClick={() => handleSelect(role)}
            >
              <div className="role-card-icon">{icon}</div>
              <div className="role-card-name">{ROLE_NAMES[role]}</div>
              <div className="role-card-desc">{desc}</div>
              <div className="role-card-privilege">{privilege}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Builder Phase
function BuilderPanel({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}) {
  const player = state.players[0];
  const hasCrane = hasBuilding(player.buildings, 'crane');
  const hasBlackMarket = hasBuilding(player.buildings, 'black_market');

  const [selectedBuild, setSelectedBuild] = React.useState<number | null>(null);
  const [craneTarget, setCraneTarget] = React.useState<number | undefined>(undefined);
  const [craneDecided, setCraneDecided] = React.useState(false);
  const [selectedGoods, setSelectedGoods] = React.useState<Set<number>>(new Set());
  const [goodsDecided, setGoodsDecided] = React.useState(false);
  const [selectedPayment, setSelectedPayment] = React.useState<Set<number>>(new Set());

  const resetAll = () => {
    setSelectedBuild(null);
    setCraneTarget(undefined);
    setCraneDecided(false);
    setSelectedGoods(new Set());
    setGoodsDecided(false);
    setSelectedPayment(new Set());
  };

  // Step 1: 建設カード選択
  if (selectedBuild === null) {
    // クレーン有無で建設可能カードを判定
    const buildableInfo = player.hand.map((c) => {
      const def = getCardDef(c);
      const normalBuild = canBuild(state, 0, c.instanceId);
      let craneBuild = false;
      if (hasCrane) {
        for (let i = 0; i < player.buildings.length; i++) {
          if (canBuild(state, 0, c.instanceId, i)) {
            craneBuild = true;
            break;
          }
        }
      }
      return { card: c, def, normalBuild, craneBuild, canBuildAny: normalBuild || craneBuild };
    });

    return (
      <div className="action-panel">
        <h3>建築士 - 建設するカードを選択</h3>
        <p>
          {state.roleChooser === 0 ? '特権: コスト-1' : ''}
        </p>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '6px 0' }}>
          {buildableInfo.map(({ card: c, def, canBuildAny, craneBuild, normalBuild }) => {
            const cost = getBuildCost(state, 0, def.id);
            return (
              <div key={c.instanceId} className="card-with-label">
                <CardView
                  card={c}
                  size="normal"
                  clickable={canBuildAny}
                  disabled={!canBuildAny}
                  onClick={() => canBuildAny && setSelectedBuild(c.instanceId)}
                />
                {canBuildAny && (
                  <div className="card-label">
                    {!normalBuild && craneBuild ? '建替' : `コスト:${cost}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="action-buttons">
          <button className="skip" onClick={() => dispatch({ type: 'SKIP_BUILD' })}>
            パス
          </button>
        </div>
      </div>
    );
  }

  const buildCard = player.hand.find((c) => c.instanceId === selectedBuild)!;
  const buildDef = getCardDef(buildCard);

  // Step 2: クレーン対象選択
  if (hasCrane && !craneDecided) {
    const normalOk = canBuild(state, 0, selectedBuild);
    const craneTargets: number[] = [];
    for (let i = 0; i < player.buildings.length; i++) {
      if (canBuild(state, 0, selectedBuild, i)) {
        craneTargets.push(i);
      }
    }

    // クレーン対象がない場合はスキップ
    if (craneTargets.length === 0) {
      setCraneDecided(true);
    } else {
      return (
        <div className="action-panel">
          <h3>建築士 - {buildDef.name} の建て替え</h3>
          <p>建て替える建物を選択するか、新規建設してください。</p>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '6px 0' }}>
            {craneTargets.map((idx) => {
              const b = player.buildings[idx];
              const targetDef = getCardDef(b.card);
              const craneCost = getBuildCost(state, 0, buildDef.id, targetDef.id);
              return (
                <div key={b.card.instanceId} className="card-with-label">
                  <CardView
                    card={b.card}
                    size="small"
                    good={b.good}
                    clickable
                    onClick={() => {
                      setCraneTarget(idx);
                      setCraneDecided(true);
                    }}
                  />
                  <div className="card-label">
                    差額:{craneCost}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="action-buttons">
            {normalOk && (
              <button onClick={() => {
                setCraneTarget(undefined);
                setCraneDecided(true);
              }}>
                新規建設
              </button>
            )}
            <button onClick={resetAll}>戻る</button>
            <button className="skip" onClick={() => { resetAll(); dispatch({ type: 'SKIP_BUILD' }); }}>
              パス
            </button>
          </div>
        </div>
      );
    }
  }

  const craneTargetDefId = craneTarget !== undefined
    ? player.buildings[craneTarget].card.defId
    : undefined;
  const baseCost = getBuildCost(state, 0, buildDef.id, craneTargetDefId);

  // Step 3: 闇市場 - 商品選択
  if (hasBlackMarket && !goodsDecided) {
    const goodBuildings = player.buildings
      .map((b, i) => ({ building: b, index: i }))
      .filter(({ building }) => building.good !== null);

    if (goodBuildings.length === 0 || baseCost === 0) {
      setGoodsDecided(true);
    } else {
      const maxGoods = Math.min(2, goodBuildings.length, baseCost);

      const toggleGood = (idx: number) => {
        const next = new Set(selectedGoods);
        if (next.has(idx)) next.delete(idx);
        else if (next.size < maxGoods) next.add(idx);
        setSelectedGoods(next);
      };

      return (
        <div className="action-panel">
          <h3>闇市場 - {buildDef.name} (コスト: {baseCost})</h3>
          <p>支払いに使う商品を選択 (最大{maxGoods}個)。使わない場合はスキップ。</p>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '6px 0' }}>
            {goodBuildings.map(({ building: b, index: idx }) => (
              <div key={b.card.instanceId} className="card-with-label">
                <CardView
                  card={b.card}
                  size="small"
                  good={b.good}
                  clickable
                  selected={selectedGoods.has(idx)}
                  onClick={() => toggleGood(idx)}
                />
                {b.good && (
                  <div className="card-label">
                    {GOOD_NAMES[b.good]}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="action-buttons">
            {selectedGoods.size > 0 && (
              <button className="primary" onClick={() => setGoodsDecided(true)}>
                {selectedGoods.size}個使用する
              </button>
            )}
            <button onClick={() => { setSelectedGoods(new Set()); setGoodsDecided(true); }}>
              商品を使わない
            </button>
            <button onClick={() => { setSelectedGoods(new Set()); setCraneTarget(undefined); setCraneDecided(false); }}>
              戻る
            </button>
          </div>
        </div>
      );
    }
  }

  // Step 4: 支払いカード選択
  const goodsCount = selectedGoods.size;
  const cardCost = Math.max(0, baseCost - goodsCount);
  const payableCards = player.hand.filter((c) => c.instanceId !== selectedBuild);

  const togglePayment = (id: number) => {
    const next = new Set(selectedPayment);
    if (next.has(id)) next.delete(id);
    else if (next.size < cardCost) next.add(id);
    setSelectedPayment(next);
  };

  // コスト0なら即建設
  if (cardCost === 0) {
    const blackMarketGoods: GoodType[] = [];
    selectedGoods.forEach((idx) => {
      const good = player.buildings[idx].good;
      if (good) blackMarketGoods.push(good);
    });

    return (
      <div className="action-panel">
        <h3>建築士 - {buildDef.name} を建設 (コスト: 0)</h3>
        {craneTarget !== undefined && <p>建て替え: {getCardDef(player.buildings[craneTarget].card).name}</p>}
        {goodsCount > 0 && <p>闇市場: 商品{goodsCount}個使用</p>}
        <div className="action-buttons">
          <button
            className="primary"
            onClick={() => {
              dispatch({
                type: 'BUILD',
                cardInstanceId: selectedBuild,
                paymentCardIds: [],
                craneTargetIndex: craneTarget,
                blackMarketGoods: blackMarketGoods.length > 0 ? blackMarketGoods : undefined,
              });
              resetAll();
            }}
          >
            建設
          </button>
          <button onClick={resetAll}>戻る</button>
          <button className="skip" onClick={() => { resetAll(); dispatch({ type: 'SKIP_BUILD' }); }}>
            パス
          </button>
        </div>
      </div>
    );
  }

  const blackMarketGoods: GoodType[] = [];
  selectedGoods.forEach((idx) => {
    const good = player.buildings[idx].good;
    if (good) blackMarketGoods.push(good);
  });

  return (
    <div className="action-panel">
      <h3>建築士 - {buildDef.name} の支払い (コスト: {cardCost}{goodsCount > 0 ? ` [商品${goodsCount}個使用]` : ''})</h3>
      <p>支払うカードを{cardCost}枚選択してください</p>
      {craneTarget !== undefined && <p>建て替え: {getCardDef(player.buildings[craneTarget].card).name}</p>}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '6px 0' }}>
        {payableCards.map((c) => (
          <CardView
            key={c.instanceId}
            card={c}
            size="normal"
            clickable
            selected={selectedPayment.has(c.instanceId)}
            onClick={() => togglePayment(c.instanceId)}
          />
        ))}
      </div>
      <div className="action-buttons">
        <button
          className="primary"
          disabled={selectedPayment.size !== cardCost}
          onClick={() => {
            dispatch({
              type: 'BUILD',
              cardInstanceId: selectedBuild,
              paymentCardIds: Array.from(selectedPayment),
              craneTargetIndex: craneTarget,
              blackMarketGoods: blackMarketGoods.length > 0 ? blackMarketGoods : undefined,
            });
            resetAll();
          }}
        >
          建設 ({selectedPayment.size}/{cardCost})
        </button>
        <button onClick={resetAll}>戻る</button>
        <button className="skip" onClick={() => { resetAll(); dispatch({ type: 'SKIP_BUILD' }); }}>
          パス
        </button>
      </div>
    </div>
  );
}

// Producer Phase
function ProducerPanel({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}) {
  const player = state.players[0];
  const producible = getProducibleBuildings(state, 0);
  const maxSlots = getMaxProductionCount(state, 0);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  if (producible.length === 0) {
    return (
      <div className="action-panel">
        <h3>監督 - 生産</h3>
        <p>生産可能な空き建物がありません。</p>
        <div className="action-buttons">
          <button onClick={() => dispatch({ type: 'PRODUCE', buildingIndices: [] })}>
            OK
          </button>
        </div>
      </div>
    );
  }

  // 選択可能数が1で空きスロットも1なら自動選択
  if (maxSlots >= producible.length) {
    return (
      <div className="action-panel">
        <h3>監督 - 全ての空き生産建物に商品が載ります</h3>
        {state.roleChooser === 0 && <p>特権: 追加1個生産</p>}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '6px 0' }}>
          {producible.map((idx) => {
            const b = player.buildings[idx];
            return (
              <CardView key={b.card.instanceId} card={b.card} size="small" selected />
            );
          })}
        </div>
        <div className="action-buttons">
          <button
            className="primary"
            onClick={() => dispatch({ type: 'PRODUCE', buildingIndices: producible })}
          >
            生産する
          </button>
        </div>
      </div>
    );
  }

  const toggleBuilding = (idx: number) => {
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx);
    else if (next.size < maxSlots) next.add(idx);
    setSelected(next);
  };

  return (
    <div className="action-panel">
      <h3>監督 - 生産する建物を{maxSlots}個選択</h3>
      {state.roleChooser === 0 && <p>特権: 追加1個生産</p>}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '6px 0' }}>
        {producible.map((idx) => {
          const b = player.buildings[idx];
          return (
            <CardView
              key={b.card.instanceId}
              card={b.card}
              size="small"
              clickable
              selected={selected.has(idx)}
              onClick={() => toggleBuilding(idx)}
            />
          );
        })}
      </div>
      <div className="action-buttons">
        <button
          className="primary"
          disabled={selected.size === 0}
          onClick={() => {
            dispatch({ type: 'PRODUCE', buildingIndices: Array.from(selected) });
            setSelected(new Set());
          }}
        >
          生産する ({selected.size}/{maxSlots})
        </button>
      </div>
    </div>
  );
}

const GOOD_ICONS: Record<GoodType, string> = {
  indigo: '🟦',
  sugar: '⬜',
  tobacco: '🟨',
  coffee: '🟫',
  silver: '⚪',
};

const GOOD_COLORS: Record<GoodType, { bg: string; border: string }> = {
  indigo: { bg: '#c0d0e8', border: '#2a4a8a' },
  sugar: { bg: '#f0ead8', border: '#b8a888' },
  tobacco: { bg: '#e8d4a0', border: '#a88030' },
  coffee: { bg: '#d8bfa0', border: '#6a3a1a' },
  silver: { bg: '#ccd2d8', border: '#707880' },
};

const GOOD_ORDER: GoodType[] = ['indigo', 'sugar', 'tobacco', 'coffee', 'silver'];

function TradingTileDisplay({ tile }: { tile: TradingTile }) {
  return (
    <div className="trading-tile">
      <div className="trading-tile-label">商館タイル</div>
      <div className="trading-tile-prices">
        {GOOD_ORDER.map((good) => (
          <div
            key={good}
            className="trading-tile-item"
            style={{
              background: GOOD_COLORS[good].bg,
              borderColor: GOOD_COLORS[good].border,
            }}
          >
            <span className="trading-tile-icon">{GOOD_ICONS[good]}</span>
            <span className="trading-tile-name">{GOOD_NAMES[good]}</span>
            <span className="trading-tile-price">{tile[good]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Trader Phase
function TraderPanel({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}) {
  const player = state.players[0];
  const goods = getSellableGoods(state, 0);
  const maxSell = getMaxSellCount(state, 0);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  if (goods.length === 0) {
    return (
      <div className="action-panel">
        <h3>商人 - 売却</h3>
        <p>売却可能な商品がありません。</p>
        <div className="action-buttons">
          <button onClick={() => dispatch({ type: 'SKIP_TRADE' })}>OK</button>
        </div>
      </div>
    );
  }

  const toggleGood = (idx: number) => {
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx);
    else if (next.size < maxSell) next.add(idx);
    setSelected(next);
  };

  return (
    <div className="action-panel">
      <h3>商人 - 売却する商品を選択 (最大{maxSell}個)</h3>
      {state.currentTradingTile && (
        <TradingTileDisplay tile={state.currentTradingTile} />
      )}
      {state.roleChooser === 0 && <p>特権: 売却額+1カード</p>}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '6px 0' }}>
        {goods.map((g) => {
          const b = player.buildings[g.buildingIndex];
          return (
            <CardView
              key={b.card.instanceId}
              card={b.card}
              size="small"
              good={g.goodType}
              clickable
              selected={selected.has(g.buildingIndex)}
              onClick={() => toggleGood(g.buildingIndex)}
            />
          );
        })}
      </div>
      <div className="action-buttons">
        <button
          className="primary"
          disabled={selected.size === 0}
          onClick={() => {
            dispatch({ type: 'TRADE', buildingIndices: Array.from(selected) });
            setSelected(new Set());
          }}
        >
          売却 ({selected.size}個)
        </button>
        <button className="skip" onClick={() => {
          setSelected(new Set());
          dispatch({ type: 'SKIP_TRADE' });
        }}>
          パス
        </button>
      </div>
    </div>
  );
}

// Councillor Phase
function CouncillorPanel({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}) {
  const rawKeepCount = getCouncillorKeepCount(state, 0);
  const keepCount = Math.min(rawKeepCount, state.drawnCards.length);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  const toggleCard = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < keepCount) next.add(id);
    setSelected(next);
  };

  if (state.drawnCards.length === 0) {
    return (
      <div className="action-panel">
        <h3>参事会員</h3>
        <p>山札がありません。</p>
        <div className="action-buttons">
          <button onClick={() => dispatch({ type: 'COUNCILLOR_KEEP', cardInstanceIds: [] })}>
            OK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="action-panel">
      <h3>
        参事会員 - {state.drawnCards.length}枚から{keepCount}枚選択
      </h3>
      {state.roleChooser === 0 && <p>特権: 5枚引いて選択</p>}
      <div className="councillor-cards">
        {state.drawnCards.map((c) => (
          <CardView
            key={c.instanceId}
            card={c}
            size="normal"
            clickable
            selected={selected.has(c.instanceId)}
            onClick={() => toggleCard(c.instanceId)}
          />
        ))}
      </div>
      <div className="action-buttons">
        <button
          className="primary"
          disabled={selected.size !== keepCount}
          onClick={() => {
            dispatch({
              type: 'COUNCILLOR_KEEP',
              cardInstanceIds: Array.from(selected),
            });
            setSelected(new Set());
          }}
        >
          選択 ({selected.size}/{keepCount})
        </button>
      </div>
    </div>
  );
}

// Chapel Phase
function ChapelPanel({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}) {
  const player = state.players[0];
  const chapelBuilding = player.buildings.find(
    (b) => b.card.defId === 'chapel'
  );
  const storedCount = chapelBuilding ? chapelBuilding.chapelCards : 0;

  return (
    <div className="action-panel">
      <h3>礼拝堂 - 手札1枚を格納 (現在{storedCount}枚格納済み)</h3>
      <p>格納した1枚につきゲーム終了時+1VP。格納するカードを選択してください。</p>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '6px 0' }}>
        {player.hand.map((c) => (
          <CardView
            key={c.instanceId}
            card={c}
            size="normal"
            clickable
            onClick={() =>
              dispatch({ type: 'USE_CHAPEL', cardInstanceId: c.instanceId })
            }
          />
        ))}
      </div>
      <div className="action-buttons">
        <button
          className="skip"
          onClick={() => dispatch({ type: 'SKIP_CHAPEL' })}
        >
          格納しない
        </button>
      </div>
    </div>
  );
}

// Hand Limit Panel
function HandLimitPanel({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}) {
  const player = state.players[state.executingPlayerIndex];
  const discardCount = getDiscardExcessCount(state, state.executingPlayerIndex);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  const toggleCard = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < discardCount) next.add(id);
    setSelected(next);
  };

  const limit = getHandLimit(player.buildings);

  return (
    <div className="action-panel">
      <h3>手札上限超過 - {discardCount}枚捨ててください</h3>
      <p>手札が上限({limit}枚)を超えています。捨てるカードを選択してください。</p>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '6px 0' }}>
        {player.hand.map((c) => (
          <CardView
            key={c.instanceId}
            card={c}
            size="normal"
            clickable
            selected={selected.has(c.instanceId)}
            onClick={() => toggleCard(c.instanceId)}
          />
        ))}
      </div>
      <div className="action-buttons">
        <button
          className="primary"
          disabled={selected.size !== discardCount}
          onClick={() => {
            dispatch({
              type: 'DISCARD_EXCESS',
              cardInstanceIds: Array.from(selected),
            });
            setSelected(new Set());
          }}
        >
          捨てる ({selected.size}/{discardCount})
        </button>
      </div>
    </div>
  );
}

// Archive Panel
function ArchivePanel({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}) {
  const player = state.players[state.executingPlayerIndex];
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  const toggleCard = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <div className="action-panel">
      <h3>公文書館 - 手札から捨てるカードを選択</h3>
      <p>任意の枚数を捨てられます。捨てない場合はスキップしてください。</p>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '6px 0' }}>
        {player.hand.map((c) => (
          <CardView
            key={c.instanceId}
            card={c}
            size="normal"
            clickable
            selected={selected.has(c.instanceId)}
            onClick={() => toggleCard(c.instanceId)}
          />
        ))}
      </div>
      <div className="action-buttons">
        {selected.size > 0 && (
          <button
            className="primary"
            onClick={() => {
              dispatch({
                type: 'ARCHIVE_DISCARD',
                cardInstanceIds: Array.from(selected),
              });
              setSelected(new Set());
            }}
          >
            {selected.size}枚捨てる
          </button>
        )}
        <button
          className="skip"
          onClick={() => {
            dispatch({ type: 'SKIP_ARCHIVE' });
            setSelected(new Set());
          }}
        >
          捨てない
        </button>
      </div>
    </div>
  );
}

export default App;
