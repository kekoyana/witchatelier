import React, { useReducer, useEffect, useRef } from 'react';
import './App.css';

const BASE = import.meta.env.BASE_URL;
import { GameState, RoleType, GoodType, TradingTile } from './game/types';
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
import {
  useLanguage,
  interpolate,
  getRoleName,
  getGoodName,
  getCardDisplayName,
} from './i18n';

function App() {
  const { language, setLanguage, t } = useLanguage();
  const [state, dispatch] = useReducer(gameReducer, language, createInitialState);

  const timerRef = useRef<number | null>(null);

  // AI自動進行
  useEffect(() => {
    if (state.phase === 'title' || state.phase === 'game_over') return;

    const isRoleSelection = state.phase === 'role_selection';

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

    const currentPlayer = state.players[state.executingPlayerIndex];
    if (!currentPlayer.isHuman && state.currentRole) {
      timerRef.current = window.setTimeout(() => {
        executeAIAction(state, currentPlayer.id, dispatch);
      }, 300);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }
  }, [state.phase, state.executingPlayerIndex, state.currentRoleSelector, state.currentRole, state.subPhase]);

  const [showRules, setShowRules] = React.useState(false);

  // Language toggle component
  const LanguageToggle = ({ className }: { className?: string }) => (
    <button
      className={`lang-toggle ${className ?? ''}`}
      onClick={() => setLanguage(language === 'ja' ? 'en' : 'ja')}
    >
      {language === 'ja' ? 'EN' : 'JP'}
    </button>
  );

  if (state.phase === 'title') {
    return (
      <div className="title-screen" style={{ backgroundImage: `radial-gradient(ellipse at center, rgba(26,26,46,0.4) 0%, rgba(26,26,46,0.85) 100%), url('${BASE}images/start.jpg')` }}>
        <div className="title-spacer" />
        <LanguageToggle className="title-lang-toggle" />
        <img src={`${BASE}images/title.jpg`} alt={t('title.name')} className="title-logo" />
        <p>{t('title.subtitle')}</p>
        <button onClick={() => dispatch({ type: 'START_GAME', language })}>
          {t('title.start')}
        </button>
        <button className="rules-toggle" onClick={() => setShowRules(true)}>
          {t('title.rules')}
        </button>
        <div className="title-spacer" />
        {showRules && (
          <div className="rules-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowRules(false); }}>
            <div className="rules-panel">
              <button className="rules-close-x" onClick={() => setShowRules(false)}>&times;</button>
              <h2>{t('rules.overview.title')}</h2>
              <p>{t('rules.overview.text')}</p>

              <h2>{t('rules.victory.title')}</h2>
              <p>{t('rules.victory.text')}</p>

              <h2>{t('rules.cards.title')}</h2>
              <p>{t('rules.cards.text')}</p>

              <h2>{t('rules.flow.title')}</h2>
              <p>{t('rules.flow.text')}</p>

              <h2>{t('rules.roles.title')}</h2>
              <div className="rules-roles">
                <div className="rules-role">
                  <span className="rules-role-name">{getRoleName('builder', language)}</span>
                  <span>{t('role.builder.desc')}{language === 'ja' ? '。' : '.'} {language === 'ja' ? '特権' : 'Privilege'}: {t('role.builder.privilege')}</span>
                </div>
                <div className="rules-role">
                  <span className="rules-role-name">{getRoleName('producer', language)}</span>
                  <span>{t('role.producer.desc')}{language === 'ja' ? '。' : '.'} {language === 'ja' ? '特権' : 'Privilege'}: {t('role.producer.privilege')}</span>
                </div>
                <div className="rules-role">
                  <span className="rules-role-name">{getRoleName('trader', language)}</span>
                  <span>{t('role.trader.desc')}{language === 'ja' ? '。' : '.'} {language === 'ja' ? '特権' : 'Privilege'}: {t('role.trader.privilege')}</span>
                </div>
                <div className="rules-role">
                  <span className="rules-role-name">{getRoleName('councillor', language)}</span>
                  <span>{t('role.councillor.desc')}{language === 'ja' ? '。' : '.'} {language === 'ja' ? '特権' : 'Privilege'}: {t('role.councillor.privilege')}</span>
                </div>
                <div className="rules-role">
                  <span className="rules-role-name">{getRoleName('prospector', language)}</span>
                  <span>{t('role.prospector.desc')}</span>
                </div>
              </div>

              <h2>{t('rules.buildings.title')}</h2>
              <div className="rules-building-types">
                <div className="rules-building-sample">
                  <strong>{language === 'ja' ? '採集場' : 'Gathering Sites'}</strong>
                  <p>{t('rules.buildings.production')}</p>
                  <div className="rules-sample-cards">
                    <CardView card={{ instanceId: -1, defId: 'indigo_plant' }} size="normal" />
                    <CardView card={{ instanceId: -2, defId: 'coffee_roaster' }} size="normal" />
                  </div>
                  <p className="rules-circle-legend">
                    <span className="rules-circle production-cost" />{language === 'ja' ? 'コスト' : 'Cost'}
                    <span className="rules-circle production-vp" />{language === 'ja' ? '名声' : 'Fame'}
                  </p>
                </div>
                <div className="rules-building-sample">
                  <strong>{language === 'ja' ? '紫の設備' : 'Purple Facilities'}</strong>
                  <p>{t('rules.buildings.violet')}</p>
                  <div className="rules-sample-cards">
                    <CardView card={{ instanceId: -3, defId: 'smithy' }} size="normal" />
                    <CardView card={{ instanceId: -4, defId: 'chapel' }} size="normal" />
                  </div>
                  <p className="rules-circle-legend">
                    <span className="rules-circle violet-cost" />{language === 'ja' ? 'コスト' : 'Cost'}
                    <span className="rules-circle violet-vp" />{language === 'ja' ? '名声' : 'Fame'}
                  </p>
                </div>
              </div>

              <h2>{t('rules.handlimit.title')}</h2>
              <p>{t('rules.handlimit.text')}</p>

              <button className="rules-close" onClick={() => setShowRules(false)}>
                {t('title.close')}
              </button>
            </div>
          </div>
        )}
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
    <div className="game-board" style={{ backgroundImage: `linear-gradient(rgba(26,26,46,0.3), rgba(26,26,46,0.4)), url('${BASE}images/game.jpg')` }}>
      {/* Phase Indicator */}
      <div className="phase-indicator">
        {state.currentRole && (
          <span key={`role-${state.currentRole}`} className="phase-tag">{getRoleName(state.currentRole, language)}</span>
        )}
        {state.phase === 'role_selection' && (
          <span key="role-selection" className="phase-tag">{t('phase.role_selection')}</span>
        )}
        {state.phase === 'chapel_phase' && (
          <span key="chapel" className="phase-tag">{t('phase.chapel')}</span>
        )}
        <span className="governor-tag">
          {t('label.elder')}: {state.players[state.governorIndex].name}
        </span>
        <span>
          {t('label.turn')}: {state.phase === 'role_selection'
            ? state.players[state.currentRoleSelector].name
            : currentPlayer.name}
        </span>
        <LanguageToggle />
        <span className="deck-info">
          {t('label.deck')}: {state.deck.length}
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
                      {t('label.hand')}{p.hand.length}
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
                  <span className="governor-badge">★ {t('label.elder')}</span>
                )}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {t('label.facilities')}: {humanPlayer.buildings.length}/12
                </span>
              </div>

              <div className="player-buildings-label">{t('label.facilities')}</div>
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

              <div className="player-hand-label">{t('label.hand')} ({humanPlayer.hand.length})</div>
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
          <h4>{t('label.log')}</h4>
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
      dispatch({ type: 'SKIP_BUILD' });
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
  const { t } = useLanguage();

  if (state.phase === 'chapel_phase') {
    const chapelPlayer = state.players[state.executingPlayerIndex];
    if (chapelPlayer.isHuman) {
      return <ChapelPanel state={state} dispatch={dispatch} />;
    }
    return (
      <div className="action-panel">
        <div className="ai-thinking">
          {interpolate(t('ai.chapel'), { name: chapelPlayer.name })}<span className="dots"></span>
        </div>
      </div>
    );
  }

  if (state.phase === 'role_selection') {
    const selector = state.players[state.currentRoleSelector];
    if (selector.isHuman) {
      return <RoleSelectionPanel state={state} dispatch={dispatch} />;
    }
    return (
      <div className="action-panel">
        <div className="ai-thinking">
          {interpolate(t('ai.selectRole'), { name: selector.name })}<span className="dots"></span>
        </div>
      </div>
    );
  }

  if (state.subPhase === 'discard_excess') {
    const discardPlayer = state.players[state.executingPlayerIndex];
    if (discardPlayer.isHuman) {
      return <HandLimitPanel state={state} dispatch={dispatch} />;
    }
  }

  if (state.subPhase === 'archive_select') {
    const archivePlayer = state.players[state.executingPlayerIndex];
    if (archivePlayer.isHuman) {
      return <ArchivePanel state={state} dispatch={dispatch} />;
    }
  }

  const currentPlayer = state.players[state.executingPlayerIndex];
  const isHumanTurn = currentPlayer.isHuman;

  if (!isHumanTurn) {
    return (
      <div className="action-panel">
        <div className="ai-thinking">
          {interpolate(t('ai.thinking'), { name: currentPlayer.name })}<span className="dots"></span>
        </div>
      </div>
    );
  }

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
  const { language, t } = useLanguage();
  const [chosenRole, setChosenRole] = React.useState<RoleType | null>(null);

  const handleSelect = (role: RoleType) => {
    if (chosenRole) return;
    setChosenRole(role);
    setTimeout(() => {
      dispatch({ type: 'SELECT_ROLE', role });
    }, 350);
  };

  const roles: { role: RoleType; descKey: string; privilegeKey: string; icon: string; colorClass: string }[] = [
    { role: 'builder', descKey: 'role.builder.desc', privilegeKey: 'role.builder.privilege', icon: '🧪', colorClass: 'role-builder' },
    { role: 'producer', descKey: 'role.producer.desc', privilegeKey: 'role.producer.privilege', icon: '🌿', colorClass: 'role-producer' },
    { role: 'trader', descKey: 'role.trader.desc', privilegeKey: 'role.trader.privilege', icon: '🧳', colorClass: 'role-trader' },
    { role: 'councillor', descKey: 'role.councillor.desc', privilegeKey: 'role.councillor.privilege', icon: '🔮', colorClass: 'role-councillor' },
    { role: 'prospector', descKey: 'role.prospector.desc', privilegeKey: 'role.prospector.privilege', icon: '🦉', colorClass: 'role-prospector' },
  ];

  return (
    <div className="action-panel">
      <h3>{t('action.selectRole')}</h3>
      <div className="role-card-row">
        {roles.map(({ role, descKey, privilegeKey, icon, colorClass }) => {
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
              <div className="role-card-name">{getRoleName(role, language)}</div>
              <div className="role-card-desc">{t(descKey)}</div>
              <div className="role-card-privilege">{t(privilegeKey)}</div>
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
  const { language, t } = useLanguage();
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

  // Step 1: Select card to build
  if (selectedBuild === null) {
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
        <h3>{t('action.builder.select')}</h3>
        <p>
          {state.roleChooser === 0 ? t('action.builder.privilege') : ''}
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
                    {!normalBuild && craneBuild ? t('action.builder.replace') : `${t('action.builder.cost')}:${cost}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="action-buttons">
          <button className="skip" onClick={() => dispatch({ type: 'SKIP_BUILD' })}>
            {t('btn.pass')}
          </button>
        </div>
      </div>
    );
  }

  const buildCard = player.hand.find((c) => c.instanceId === selectedBuild)!;
  const buildDef = getCardDef(buildCard);
  const buildName = getCardDisplayName(buildDef.id, language, buildDef.name);

  // Step 2: Crane target
  if (hasCrane && !craneDecided) {
    const normalOk = canBuild(state, 0, selectedBuild);
    const craneTargets: number[] = [];
    for (let i = 0; i < player.buildings.length; i++) {
      if (canBuild(state, 0, selectedBuild, i)) {
        craneTargets.push(i);
      }
    }

    if (craneTargets.length === 0) {
      setCraneDecided(true);
    } else {
      return (
        <div className="action-panel">
          <h3>{interpolate(t('action.builder.crane'), { name: buildName })}</h3>
          <p>{t('action.builder.craneDesc')}</p>
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
                    {t('action.builder.diff')}:{craneCost}
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
                {t('action.builder.newBuild')}
              </button>
            )}
            <button onClick={resetAll}>{t('btn.back')}</button>
            <button className="skip" onClick={() => { resetAll(); dispatch({ type: 'SKIP_BUILD' }); }}>
              {t('btn.pass')}
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

  // Step 3: Black market goods
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
          <h3>{interpolate(t('action.blackmarket.title'), { name: buildName, cost: String(baseCost) })}</h3>
          <p>{interpolate(t('action.blackmarket.desc'), { max: String(maxGoods) })}</p>
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
                    {getGoodName(b.good, language)}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="action-buttons">
            {selectedGoods.size > 0 && (
              <button className="primary" onClick={() => setGoodsDecided(true)}>
                {interpolate(t('action.blackmarket.use'), { count: String(selectedGoods.size) })}
              </button>
            )}
            <button onClick={() => { setSelectedGoods(new Set()); setGoodsDecided(true); }}>
              {t('action.blackmarket.skip')}
            </button>
            <button onClick={() => { setSelectedGoods(new Set()); setCraneTarget(undefined); setCraneDecided(false); }}>
              {t('btn.back')}
            </button>
          </div>
        </div>
      );
    }
  }

  // Step 4: Payment
  const goodsCount = selectedGoods.size;
  const cardCost = Math.max(0, baseCost - goodsCount);
  const payableCards = player.hand.filter((c) => c.instanceId !== selectedBuild);

  const togglePayment = (id: number) => {
    const next = new Set(selectedPayment);
    if (next.has(id)) next.delete(id);
    else if (next.size < cardCost) next.add(id);
    setSelectedPayment(next);
  };

  const blackMarketGoods: GoodType[] = [];
  selectedGoods.forEach((idx) => {
    const good = player.buildings[idx].good;
    if (good) blackMarketGoods.push(good);
  });

  // Cost 0 - build immediately
  if (cardCost === 0) {
    const craneTargetName = craneTarget !== undefined
      ? getCardDisplayName(getCardDef(player.buildings[craneTarget].card).id, language, getCardDef(player.buildings[craneTarget].card).name)
      : '';

    return (
      <div className="action-panel">
        <h3>{interpolate(t('action.builder.buildCostZero'), { name: buildName })}</h3>
        {craneTarget !== undefined && <p>{interpolate(t('action.builder.replaceTarget'), { name: craneTargetName })}</p>}
        {goodsCount > 0 && <p>{interpolate(t('action.blackmarket.used'), { count: String(goodsCount) })}</p>}
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
            {t('action.builder.build')}
          </button>
          <button onClick={resetAll}>{t('btn.back')}</button>
          <button className="skip" onClick={() => { resetAll(); dispatch({ type: 'SKIP_BUILD' }); }}>
            {t('btn.pass')}
          </button>
        </div>
      </div>
    );
  }

  const paymentTitle = goodsCount > 0
    ? interpolate(t('action.builder.paymentGoods'), { name: buildName, cost: String(cardCost), goods: String(goodsCount) })
    : interpolate(t('action.builder.payment'), { name: buildName, cost: String(cardCost) });

  const craneTargetName = craneTarget !== undefined
    ? getCardDisplayName(getCardDef(player.buildings[craneTarget].card).id, language, getCardDef(player.buildings[craneTarget].card).name)
    : '';

  return (
    <div className="action-panel">
      <h3>{paymentTitle}</h3>
      <p>{interpolate(t('action.builder.selectPayment'), { cost: String(cardCost) })}</p>
      {craneTarget !== undefined && <p>{interpolate(t('action.builder.replaceTarget'), { name: craneTargetName })}</p>}
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
          {t('action.builder.build')} ({selectedPayment.size}/{cardCost})
        </button>
        <button onClick={resetAll}>{t('btn.back')}</button>
        <button className="skip" onClick={() => { resetAll(); dispatch({ type: 'SKIP_BUILD' }); }}>
          {t('btn.pass')}
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
  const { t } = useLanguage();
  const player = state.players[0];
  const producible = getProducibleBuildings(state, 0);
  const maxSlots = getMaxProductionCount(state, 0);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  if (producible.length === 0) {
    return (
      <div className="action-panel">
        <h3>{t('action.producer.title')}</h3>
        <p>{t('action.producer.empty')}</p>
        <div className="action-buttons">
          <button onClick={() => dispatch({ type: 'PRODUCE', buildingIndices: [] })}>
            {t('btn.ok')}
          </button>
        </div>
      </div>
    );
  }

  if (maxSlots >= producible.length) {
    return (
      <div className="action-panel">
        <h3>{t('action.producer.allProduce')}</h3>
        {state.roleChooser === 0 && <p>{t('action.producer.privilege')}</p>}
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
            {t('action.producer.produce')}
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
      <h3>{interpolate(t('action.producer.select'), { count: String(maxSlots) })}</h3>
      {state.roleChooser === 0 && <p>{t('action.producer.privilege')}</p>}
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
          {t('action.producer.produce')} ({selected.size}/{maxSlots})
        </button>
      </div>
    </div>
  );
}

const GOOD_ICONS: Record<GoodType, string> = {
  indigo: '🌿',
  sugar: '🍄',
  tobacco: '🍯',
  coffee: '💎',
  silver: '🌙',
};

const GOOD_COLORS: Record<GoodType, { bg: string; border: string }> = {
  indigo: { bg: '#c0e0c8', border: '#2a6a3a' },
  sugar: { bg: '#f0ead8', border: '#b8a888' },
  tobacco: { bg: '#e8d4a0', border: '#a88030' },
  coffee: { bg: '#d0b8e0', border: '#6a3a90' },
  silver: { bg: '#c8d0e8', border: '#4050a0' },
};

const GOOD_ORDER: GoodType[] = ['indigo', 'sugar', 'tobacco', 'coffee', 'silver'];

function TradingTileDisplay({ tile }: { tile: TradingTile }) {
  const { language, t } = useLanguage();
  return (
    <div className="trading-tile">
      <div className="trading-tile-label">{t('action.trader.tradingTile')}</div>
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
            <span className="trading-tile-name">{getGoodName(good, language)}</span>
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
  const { t } = useLanguage();
  const player = state.players[0];
  const goods = getSellableGoods(state, 0);
  const maxSell = getMaxSellCount(state, 0);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  if (goods.length === 0) {
    return (
      <div className="action-panel">
        <h3>{t('action.trader.title')}</h3>
        <p>{t('action.trader.empty')}</p>
        <div className="action-buttons">
          <button onClick={() => dispatch({ type: 'SKIP_TRADE' })}>{t('btn.ok')}</button>
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
      <h3>{interpolate(t('action.trader.select'), { count: String(maxSell) })}</h3>
      {state.currentTradingTile && (
        <TradingTileDisplay tile={state.currentTradingTile} />
      )}
      {state.roleChooser === 0 && <p>{t('action.trader.privilege')}</p>}
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
          {t('action.trader.sell')} ({selected.size})
        </button>
        <button className="skip" onClick={() => {
          setSelected(new Set());
          dispatch({ type: 'SKIP_TRADE' });
        }}>
          {t('btn.pass')}
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
  const { t } = useLanguage();
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
        <h3>{t('action.councillor.title')}</h3>
        <p>{t('action.councillor.empty')}</p>
        <div className="action-buttons">
          <button onClick={() => dispatch({ type: 'COUNCILLOR_KEEP', cardInstanceIds: [] })}>
            {t('btn.ok')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="action-panel">
      <h3>
        {interpolate(t('action.councillor.select'), {
          total: String(state.drawnCards.length),
          keep: String(keepCount),
        })}
      </h3>
      {state.roleChooser === 0 && <p>{t('action.councillor.privilege')}</p>}
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
          {t('action.councillor.keep')} ({selected.size}/{keepCount})
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
  const { t } = useLanguage();
  const player = state.players[0];
  const chapelBuilding = player.buildings.find(
    (b) => b.card.defId === 'chapel'
  );
  const storedCount = chapelBuilding ? chapelBuilding.chapelCards : 0;

  return (
    <div className="action-panel">
      <h3>{interpolate(t('action.chapel.title'), { count: String(storedCount) })}</h3>
      <p>{t('action.chapel.desc')}</p>
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
          {t('action.chapel.skip')}
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
  const { t } = useLanguage();
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
      <h3>{interpolate(t('action.handlimit.title'), { count: String(discardCount) })}</h3>
      <p>{interpolate(t('action.handlimit.desc'), { limit: String(limit) })}</p>
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
          {t('action.handlimit.discard')} ({selected.size}/{discardCount})
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
  const { t } = useLanguage();
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
      <h3>{t('action.archive.title')}</h3>
      <p>{t('action.archive.desc')}</p>
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
            {interpolate(t('action.archive.discard'), { count: String(selected.size) })}
          </button>
        )}
        <button
          className="skip"
          onClick={() => {
            dispatch({ type: 'SKIP_ARCHIVE' });
            setSelected(new Set());
          }}
        >
          {t('action.archive.skip')}
        </button>
      </div>
    </div>
  );
}

export default App;
