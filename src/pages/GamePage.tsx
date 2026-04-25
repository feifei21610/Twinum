/**
 * GamePage —— 对局主页面
 *
 * 布局（4 人局，方案 A 顶部横排 3 个对手）：
 *   - 顶部 ScorePanel（轮次/分数/返回按钮）
 *   - 对手区 OpponentArea（3 个对手横排）
 *   - 中部 BoardArea（Active Set + Scout 提示 + 回合指示）
 *   - 玩家信息条 + HandArea（玩家手牌 / Scout 插入模式时显示插槽）
 *   - 底部 ActionBar（4 个动作按钮 + Scout 子面板）
 *
 * Scout / Scout&Show 两步交互：
 *   Step 1: ActionBar 里选 from+flip → scoutPending 被设置
 *   Step 2: HandArea 显示 N+1 个插槽 → 点击某个触发 handlePickSlot
 *
 * Scout&Show 的 index 偏移：
 *   用户 selectedIndexes 基于"原手牌"，插入 Scout 牌后需把 >= insertAt 的 index 都 +1
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { useGameStore, selectIsHumanTurn } from '../store/gameStore';
import { useOnlineStore, selectIsMyTurn } from '../store/onlineStore';
import { useBotTurn } from '../hooks/useBotTurn';
import { ScorePanel } from '../components/ScorePanel';
import { OpponentArea } from '../components/OpponentArea';
import { BoardArea } from '../components/BoardArea';
import { HandArea } from '../components/HandArea';
import { ActionBar, type ScoutPendingParams, type SasPendingParams } from '../components/ActionBar';
import { GameLogDrawer } from '../components/GameLogDrawer';
import { computeRoundScores } from '../game-engine/scoring';
import type { Action, Card as CardType, GameState, Player } from '../types/game';
import { faceValue } from '../types/game';

export function GamePage(): JSX.Element {
  // ──── 单机 store ────
  const game = useGameStore((s) => s.game);
  const log = useGameStore((s) => s.log);
  const selectedIndexes = useGameStore((s) => s.selectedHandIndexes);
  const botThinking = useGameStore((s) => s.botThinking);
  const isHumanTurn = useGameStore(selectIsHumanTurn);
  const dispatchAction = useGameStore((s) => s.dispatchAction);
  const toggleSelectCard = useGameStore((s) => s.toggleSelectCard);
  const clearSelection = useGameStore((s) => s.clearSelection);
  const continueToNextRound = useGameStore((s) => s.continueToNextRound);
  const goto = useGameStore((s) => s.goto);
  const restartGame = useGameStore((s) => s.restartGame);

  // ──── 联机 store ────
  const onlinePhase = useOnlineStore((s) => s.phase);
  const onlineSnapshot = useOnlineStore((s) => s.gameSnapshot);
  const myHand = useOnlineStore((s) => s.myHand);
  const myPlayerIndex = useOnlineStore((s) => s.myPlayerIndex);
  const isMyOnlineTurn = useOnlineStore(selectIsMyTurn);
  const sendOnlineAction = useOnlineStore((s) => s.sendAction);
  const nextRound = useOnlineStore((s) => s.nextRound);
  const lastRoundScores = useOnlineStore((s) => s.lastRoundScores);
  const gameOverResult = useOnlineStore((s) => s.gameOverResult);
  const leaveOnlineRoom = useOnlineStore((s) => s.leaveRoom);

  // 判断是否处于联机模式
  const isOnline = onlinePhase === 'playing' || onlinePhase === 'roundEnd' || onlinePhase === 'gameOver';

  // Scout 两步交互的 pending 状态
  const [scoutPending, setScoutPending] = useState<ScoutPendingParams | null>(null);
  // S&S 中间态：Scout 完成后等待用户选 Show
  const [sasPending, setSasPending] = useState<SasPendingParams | null>(null);
  // 日志抽屉开关
  const [logDrawerOpen, setLogDrawerOpen] = useState(false);

  // 单机模式：驱动 Bot 自动决策
  useBotTurn();

  // 单机模式：game 为 null 时回首页（联机模式不依赖 game）
  useEffect(() => {
    if (!isOnline && !game) goto('start');
  }, [game, goto, isOnline]);

  // 切换回合时清理 pending 状态
  const currentTurnActing = isOnline ? isMyOnlineTurn : isHumanTurn;
  useEffect(() => {
    if (!currentTurnActing) {
      setScoutPending(null);
      setSasPending(null);
    }
  }, [currentTurnActing]);

  // 联机模式：手牌变化后裁剪无效选中索引，避免出现"看起来随机被选中"的残留高亮
  // 注意 S&S 第 2 步使用的是 virtualHand（比 myHand 多 1 张），裁剪必须按当前展示手牌长度。
  useEffect(() => {
    if (!isOnline) return;
    const currentHandLength = sasPending ? sasPending.virtualHand.length : myHand.length;
    const normalized = selectedIndexes.filter((i) => i >= 0 && i < currentHandLength);
    if (normalized.length !== selectedIndexes.length) {
      useGameStore.setState({ selectedHandIndexes: normalized });
    }
  }, [isOnline, myHand.length, selectedIndexes, sasPending]);

  // 联机模式统一动作派发：与单机一致，先清空选牌再发送动作
  const dispatchOnlineAction = (action: Action) => {
    clearSelection();
    sendOnlineAction(action);
  };

  // ──── 联机模式渲染 ────
  if (isOnline) {
    if (!onlineSnapshot) {
      return (
        <div className="flex min-h-screen items-center justify-center text-ink-300">
          载入游戏状态…
        </div>
      );
    }

    const snap = onlineSnapshot;
    const humanIdx = myPlayerIndex ?? 0;
    const myOnlineHand = myHand;

    // 对手顺序（除我之外按座位顺序）
    const opponentGlobalIndexes: number[] = [];
    for (let i = 1; i < snap.players.length; i++) {
      opponentGlobalIndexes.push((humanIdx + i) % snap.players.length);
    }
    const onlineOpponents = opponentGlobalIndexes.map((i) => snap.players[i]);

    // 构造给 HandArea 用的真实手牌 (Card[])
    const myOnlineHandCards = myHand;

    // 把 OnlinePlayerInfo 转成 BoardArea / OpponentArea / ActionBar 需要的 Player 形状
    const makePlaceholderCards = (prefix: string, count: number): CardType[] =>
      Array.from({ length: Math.max(0, count) }, (_, i) => ({
        id: `${prefix}-${i}`,
        top: 0,
        bottom: 0,
        flipped: false,
      }));

    const toPlayerLike = (p: typeof snap.players[0], realHand?: CardType[]): Player => ({
      id: `p-${p.index}`,
      name: p.name,
      type: p.type as 'human' | 'bot' | 'remote',
      hand: Array.isArray(realHand)
        ? [...realHand]
        : makePlaceholderCards(`hand-${p.index}`, p.handSize),
      collectedCards: makePlaceholderCards(`collected-${p.index}`, p.collectedCount),
      scoutChips: p.scoutChips,
      scoutShowChipUsed: p.scoutShowChipUsed,
      totalScore: p.totalScore,
      avatarColor: 'primary',
      botConfigKey: p.type === 'bot' ? 'STEADY' : undefined,
    });

    const onlinePlayersForAction = snap.players.map((p) =>
      toPlayerLike(p, p.index === humanIdx ? myOnlineHandCards : undefined),
    );

    const onlineActiveOwnerName =
      snap.activeSetOwnerIndex != null
        ? snap.players[snap.activeSetOwnerIndex]?.name ?? null
        : null;

    const canScoutLeftOnline =
      snap.activeSet != null &&
      snap.activeSetOwnerIndex !== snap.currentPlayerIndex;
    const canScoutRightOnline =
      snap.activeSet != null &&
      snap.activeSet.cards.length > 1 &&
      snap.activeSetOwnerIndex !== snap.currentPlayerIndex;

    const currentOnlinePlayer = onlinePlayersForAction[snap.currentPlayerIndex] ?? onlinePlayersForAction[0];

    // 构造给 ActionBar 用的 GameState-like 对象（联机模式下仅用于合法动作计算）
    const gameLikeForAction: GameState = {
      players: onlinePlayersForAction,
      currentPlayerIndex: snap.currentPlayerIndex,
      startingPlayerIndex: snap.startingPlayerIndex ?? 0,
      activeSet: snap.activeSet,
      activeSetOwnerIndex: snap.activeSetOwnerIndex,
      lastShowerIndex: snap.lastShowerIndex ?? null,
      scoutedSinceLastShow: snap.scoutedSinceLastShow ?? [],
      roundEndConditionTriggerer: null,
      roundEndCondition: null,
      round: snap.round,
      totalRounds: snap.totalRounds,
      phase: snap.phase as GameState['phase'],
      seed: '',
      history: [],
      turnInRound: snap.turnInRound ?? 0,
      hasActedThisRound: snap.hasActedThisRound ?? Array(snap.players.length).fill(true),
    };

    // S&S pick slot handler（联机版，和单机逻辑一样但用 myOnlineHand）
    const handlePickSlotOnline = (insertAt: number) => {
      if (!scoutPending) return;
      if (scoutPending.mode === 'scout') {
        const action: Action = { type: 'SCOUT', from: scoutPending.from, flip: scoutPending.flip, insertAt };
        setScoutPending(null);
        dispatchOnlineAction(action);
        return;
      }
      const scoutedCard = scoutPending.preview;
      const virtualHand = [
        ...myOnlineHandCards.slice(0, insertAt),
        scoutedCard,
        ...myOnlineHandCards.slice(insertAt),
      ];
      const shiftedSelection = [...selectedIndexes]
        .sort((a, b) => a - b)
        .map((i) => (i >= insertAt ? i + 1 : i));
      let virtualActiveSet: typeof snap.activeSet = null;
      if (snap.activeSet) {
        const remaining = scoutPending.from === 'left'
          ? snap.activeSet.cards.slice(1)
          : snap.activeSet.cards.slice(0, -1);
        if (remaining.length > 0) {
          const vals = remaining.map((c) => (c.flipped ? c.bottom : c.top));
          virtualActiveSet = { ...snap.activeSet, cards: remaining, minValue: Math.min(...vals) };
        }
      }
      setSasPending({
        scout: { from: scoutPending.from, flip: scoutPending.flip, insertAt },
        virtualHand,
        newlyInsertedIndex: insertAt,
        savedSelection: [...selectedIndexes],
        virtualActiveSet,
      });
      setScoutPending(null);
      useGameStore.setState({ selectedHandIndexes: shiftedSelection });
    };

    const handleConfirmSasShowOnline = () => {
      if (!sasPending) return;
      const action: Action = {
        type: 'SCOUT_AND_SHOW',
        scout: sasPending.scout,
        show: [...selectedIndexes].sort((a, b) => a - b),
      };
      setSasPending(null);
      dispatchOnlineAction(action);
    };

    const handleCancelSasOnline = () => {
      if (!sasPending) return;
      const saved = sasPending.savedSelection;
      setSasPending(null);
      useGameStore.setState({ selectedHandIndexes: saved });
    };

    const isOnlineRoundEnd = onlinePhase === 'roundEnd';
    const isOnlineGameOver = onlinePhase === 'gameOver';

    const handleExitOnlineToStart = () => {
      void leaveOnlineRoom().catch(() => {
        // 忽略清理失败，避免阻塞返回首页
      });
      goto('start');
    };

    return (
      <div className="relative flex h-screen w-full max-w-app flex-col overflow-hidden bg-gradient-dark">
        {/* 顶部状态栏（复用 ScorePanel，传 game-like 对象） */}
        <ScorePanel
          game={gameLikeForAction}
          humanPlayerIndex={humanIdx}
          logCount={0}
          logOpen={false}
          onGoHome={handleExitOnlineToStart}
          onRestart={handleExitOnlineToStart}
          onToggleLog={() => {}}
          className="flex-shrink-0"
        />

        {/* 对手区 */}
        <div className="flex-shrink-0 pt-3">
          <OpponentArea
            opponents={onlineOpponents.map((p) => toPlayerLike(p))}
            currentPlayerIndex={snap.currentPlayerIndex}
            lastShowerIndex={null}
            botThinking={false}
            opponentGlobalIndexes={opponentGlobalIndexes}
          />
        </div>

        {/* 场上区 */}
        <div className="flex flex-1 items-center justify-center">
          <BoardArea
            activeSet={snap.activeSet}
            ownerName={onlineActiveOwnerName}
            canScoutLeft={canScoutLeftOnline}
            canScoutRight={canScoutRightOnline}
            currentPlayer={currentOnlinePlayer}
            isHumanTurn={isMyOnlineTurn}
          />
        </div>

        {/* 玩家手牌区 */}
        <div className="flex-shrink-0">
          <div className="flex items-center justify-between border-t border-white/5 px-3 pt-2 text-[11px]">
            <span className="font-semibold text-ink-50">
              {snap.players[humanIdx]?.name} · 手牌 {myOnlineHandCards.length} 张
            </span>
            <span className="text-ink-400">
              credits {(snap.players[humanIdx]?.collectedCount ?? 0) + (snap.players[humanIdx]?.scoutChips ?? 0)}
            </span>
          </div>
          <HandArea
            hand={sasPending ? sasPending.virtualHand : myOnlineHandCards}
            selectedIndexes={selectedIndexes}
            disabled={!isMyOnlineTurn}
            onToggleCard={toggleSelectCard}
            highlightIndex={sasPending ? sasPending.newlyInsertedIndex : undefined}
            insertSlotMode={
              scoutPending
                ? { previewCard: scoutPending.preview, onPickSlot: handlePickSlotOnline }
                : undefined
            }
          />
        </div>

        {/* 动作栏 */}
        <ActionBar
          game={gameLikeForAction}
          playerIndex={humanIdx}
          selectedIndexes={selectedIndexes}
          onAction={dispatchOnlineAction}
          onClearSelection={clearSelection}
          scoutPending={scoutPending}
          setScoutPending={setScoutPending}
          sasPending={sasPending}
          onConfirmSasShow={handleConfirmSasShowOnline}
          onCancelSas={handleCancelSasOnline}
          className="flex-shrink-0"
        />

        {/* 轮末结算覆盖层 */}
        <AnimatePresence>
          {isOnlineRoundEnd && lastRoundScores && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-surface-900/90 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.9, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                className="glass-strong mx-6 w-full max-w-sm rounded-2xl p-6 shadow-lg"
              >
                <div className="mb-4 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-warning" />
                  <h2 className="text-lg font-bold text-ink-50">第 {snap.round} 轮结束</h2>
                </div>
                <div className="mb-5 space-y-2">
                  {snap.players.map((p) => {
                    const rs = lastRoundScores.find((r) => r.playerIndex === p.index);
                    return (
                      <div
                        key={p.index}
                        className="flex items-center justify-between rounded-lg bg-surface-900/40 px-3 py-2 text-xs"
                      >
                        <div className="flex flex-col leading-tight">
                          <span className="font-semibold text-ink-50">{p.name}</span>
                          <span className="text-[10px] text-ink-400">
                            credits {(rs?.collectedPoints ?? 0) + (rs?.scoutChipPoints ?? 0)} · 扣手牌 {rs?.handPenalty ?? 0}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={rs && rs.total > 0 ? 'text-success' : rs && rs.total < 0 ? 'text-danger' : 'text-ink-400'}>
                            {rs && rs.total > 0 ? '+' : ''}{rs?.total ?? 0}
                          </span>
                          <span className="font-bold text-ink-50">累计 {p.totalScore}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={nextRound}
                  className="w-full rounded-xl bg-gradient-neon py-3 text-sm font-bold text-white shadow-neon-primary active:scale-95"
                >
                  {snap.round >= snap.totalRounds ? '查看最终结果' : '进入下一轮'}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 游戏结束覆盖层 */}
        <AnimatePresence>
          {isOnlineGameOver && gameOverResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-surface-900/95 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.9, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                className="glass-strong mx-6 w-full max-w-sm rounded-2xl p-6 shadow-lg"
              >
                <div className="mb-4 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-warning" />
                  <h2 className="text-lg font-bold text-ink-50">游戏结束</h2>
                </div>
                <div className="mb-5 space-y-2">
                  {[...gameOverResult]
                    .sort((a, b) => b.totalScore - a.totalScore)
                    .map((p, rank) => (
                      <div
                        key={p.name}
                        className="flex items-center justify-between rounded-lg bg-surface-900/40 px-3 py-2 text-xs"
                      >
                        <span className="font-semibold text-ink-50">
                          {rank === 0 ? '🏆 ' : ''}{p.name}
                        </span>
                        <span className="font-bold text-ink-50">{p.totalScore} 分</span>
                      </div>
                    ))}
                </div>
                <button
                  type="button"
                  onClick={() => goto('start')}
                  className="w-full rounded-xl bg-gradient-neon py-3 text-sm font-bold text-white shadow-neon-primary active:scale-95"
                >
                  返回首页
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 非法动作 toast（联机版） */}
        <OnlineErrorToast />
      </div>
    );
  }

  // ──── 单机模式（原有逻辑） ────
  if (!game) return <></>;

  // MVP：固定人类为 P0
  const humanIndex = game.players.findIndex((p) => p.type === 'human');
  if (humanIndex < 0) {
    return <></>;
  }
  const me = game.players[humanIndex];

  // 对手 = 除了人类外的玩家；显示顺序 = 按全局 index（下一家→下下家→...）
  const opponentGlobalIndexes: number[] = [];
  for (let i = 1; i < game.players.length; i++) {
    const idx = (humanIndex + i) % game.players.length;
    opponentGlobalIndexes.push(idx);
  }
  const opponents = opponentGlobalIndexes.map((i) => game.players[i]);

  const activeOwnerName =
    game.activeSetOwnerIndex != null
      ? game.players[game.activeSetOwnerIndex].name
      : null;

  const canScoutLeft =
    game.activeSet != null &&
    game.activeSetOwnerIndex !== game.currentPlayerIndex;
  const canScoutRight =
    game.activeSet != null &&
    game.activeSet.cards.length > 1 &&
    game.activeSetOwnerIndex !== game.currentPlayerIndex;

  const currentPlayer = game.players[game.currentPlayerIndex];
  const isRoundEnd = game.phase === 'roundEnd';

  // 轮末结算数据
  const roundScores = isRoundEnd ? computeRoundScores(game) : null;

  // Step 2：玩家点击手牌间插槽，完成 Scout 或进入 S&S 中间态
  const handlePickSlot = (insertAt: number) => {
    if (!scoutPending) return;

    if (scoutPending.mode === 'scout') {
      const action: Action = {
        type: 'SCOUT',
        from: scoutPending.from,
        flip: scoutPending.flip,
        insertAt,
      };
      setScoutPending(null);
      dispatchAction(action);
      return;
    }

    // S&S 模式：Scout 插入后进入中间态，等用户选好 Show 再确认
    // 构造虚拟手牌（把 preview 牌插入 insertAt 位置）
    const scoutedCard = scoutPending.preview;
    const originalHand = me.hand;
    const virtualHand = [
      ...originalHand.slice(0, insertAt),
      scoutedCard,
      ...originalHand.slice(insertAt),
    ];

    // 把原 selectedIndexes 做偏移：>= insertAt 的 +1
    const shiftedSelection = [...selectedIndexes]
      .sort((a, b) => a - b)
      .map((i) => (i >= insertAt ? i + 1 : i));

    // 构造 virtualActiveSet：从 activeSet 中移除 Scout 掉的那端牌
    let virtualActiveSet: typeof game.activeSet = null;
    if (game.activeSet) {
      const remainingCards =
        scoutPending.from === 'left'
          ? game.activeSet.cards.slice(1)
          : game.activeSet.cards.slice(0, -1);
      if (remainingCards.length > 0) {
        const vals = remainingCards.map((c) => (c.flipped ? c.bottom : c.top));
        virtualActiveSet = {
          ...game.activeSet,
          cards: remainingCards,
          minValue: Math.min(...vals),
        };
      }
      // remainingCards.length === 0 时 virtualActiveSet 保持 null（场上清空）
    }

    setSasPending({
      scout: { from: scoutPending.from, flip: scoutPending.flip, insertAt },
      virtualHand,
      newlyInsertedIndex: insertAt,
      savedSelection: [...selectedIndexes],
      virtualActiveSet,
    });
    setScoutPending(null);

    // 更新 selectedIndexes 为偏移后的值（直接写 store）
    useGameStore.setState({ selectedHandIndexes: shiftedSelection });
  };

  // S&S 中间态：用户确认 Show
  const handleConfirmSasShow = () => {
    if (!sasPending) return;
    const action: Action = {
      type: 'SCOUT_AND_SHOW',
      scout: sasPending.scout,
      show: [...selectedIndexes].sort((a, b) => a - b),
    };
    setSasPending(null);
    dispatchAction(action);
  };

  // S&S 中间态：用户取消（回退 UI，不触发引擎）
  const handleCancelSas = () => {
    if (!sasPending) return;
    const saved = sasPending.savedSelection;
    setSasPending(null);
    useGameStore.setState({ selectedHandIndexes: saved });
  };

  return (
    <div className="relative flex h-screen w-full max-w-app flex-col overflow-hidden bg-gradient-dark">
      {/* 顶部状态栏 */}
      <ScorePanel
        game={game}
        humanPlayerIndex={humanIndex}
        logCount={log.length}
        logOpen={logDrawerOpen}
        onGoHome={() => goto('start')}
        onRestart={restartGame}
        onToggleLog={() => setLogDrawerOpen((v) => !v)}
        className="flex-shrink-0"
      />

      {/* 对手区 */}
      <div className="flex-shrink-0 pt-3">
        <OpponentArea
          opponents={opponents}
          currentPlayerIndex={game.currentPlayerIndex}
          lastShowerIndex={game.lastShowerIndex}
          botThinking={botThinking}
          opponentGlobalIndexes={opponentGlobalIndexes}
        />
      </div>

      {/* 场上区（弹性填充） */}
      <div className="flex flex-1 items-center justify-center">
        <BoardArea
          activeSet={game.activeSet}
          ownerName={activeOwnerName}
          canScoutLeft={canScoutLeft}
          canScoutRight={canScoutRight}
          currentPlayer={currentPlayer}
          isHumanTurn={isHumanTurn}
        />
      </div>

      {/* 玩家手牌区 */}
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between border-t border-white/5 px-3 pt-2 text-[11px]">
          <span className="font-semibold text-ink-50">
            {me.name} · 手牌 {me.hand.length} 张
          </span>
          <span className="text-ink-400">
            credits {me.collectedCards.length + me.scoutChips}
          </span>
        </div>
        <HandArea
          hand={sasPending ? sasPending.virtualHand : me.hand}
          selectedIndexes={selectedIndexes}
          disabled={!isHumanTurn}
          onToggleCard={toggleSelectCard}
          highlightIndex={sasPending ? sasPending.newlyInsertedIndex : undefined}
          insertSlotMode={
            scoutPending
              ? {
                  previewCard: scoutPending.preview,
                  onPickSlot: handlePickSlot,
                }
              : undefined
          }
        />
      </div>

      {/* 动作栏 */}
      <ActionBar
        game={game}
        playerIndex={humanIndex}
        selectedIndexes={selectedIndexes}
        onAction={dispatchAction}
        onClearSelection={clearSelection}
        scoutPending={scoutPending}
        setScoutPending={setScoutPending}
        sasPending={sasPending}
        onConfirmSasShow={handleConfirmSasShow}
        onCancelSas={handleCancelSas}
        className="flex-shrink-0"
      />

      {/* 轮末结算覆盖层 */}
      <AnimatePresence>
        {isRoundEnd && roundScores && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-surface-900/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-strong mx-6 w-full max-w-sm rounded-2xl p-6 shadow-lg"
            >
              <div className="mb-4 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-warning" />
                <h2 className="text-lg font-bold text-ink-50">
                  第 {game.round} 轮结束
                </h2>
              </div>

              <div className="mb-5 space-y-2">
                {game.players.map((p, i) => {
                  const rs = roundScores[i];
                  const isTriggerer =
                    game.roundEndCondition === 'ii' &&
                    game.roundEndConditionTriggerer === i;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg bg-surface-900/40 px-3 py-2 text-xs"
                    >
                      <div className="flex flex-col leading-tight">
                        <span className="font-semibold text-ink-50">
                          {p.name}
                          {isTriggerer && (
                            <span className="ml-1 text-[10px] text-success">
                              （免扣手牌）
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-ink-400">
                          credits {rs.collectedPoints + rs.scoutChipPoints} · 扣手牌 {rs.handPenalty}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={
                            rs.total > 0
                              ? 'text-success'
                              : rs.total < 0
                                ? 'text-danger'
                                : 'text-ink-400'
                          }
                        >
                          {rs.total > 0 ? '+' : ''}
                          {rs.total}
                        </span>
                        <span className="font-bold text-ink-50">
                          累计 {p.totalScore + rs.total}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={continueToNextRound}
                className="w-full rounded-xl bg-gradient-neon py-3 text-sm font-bold text-white shadow-neon-primary active:scale-95"
              >
                {game.round >= game.totalRounds ? '查看最终结果' : '进入下一轮'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 非法动作 toast */}
      <LastErrorToast />

      {/* 对局日志抽屉 */}
      <GameLogDrawer
        open={logDrawerOpen}
        log={log}
        currentRound={game.round}
        onClose={() => setLogDrawerOpen(false)}
      />
    </div>
  );
}

function LastErrorToast(): JSX.Element {
  const lastError = useGameStore((s) => s.lastError);
  const clearError = useGameStore((s) => s.clearError);

  useEffect(() => {
    if (!lastError) return;
    const t = setTimeout(clearError, 2500);
    return () => clearTimeout(t);
  }, [lastError, clearError]);

  return (
    <AnimatePresence>
      {lastError && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="absolute left-1/2 top-14 z-30 -translate-x-1/2 rounded-full bg-danger/90 px-4 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm"
        >
          {lastError}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function OnlineErrorToast(): JSX.Element {
  const errorMessage = useOnlineStore((s) => s.errorMessage);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!errorMessage) { setVisible(false); return; }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(t);
  }, [errorMessage]);

  return (
    <AnimatePresence>
      {visible && errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="absolute left-1/2 top-14 z-30 -translate-x-1/2 rounded-full bg-danger/90 px-4 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm"
        >
          {errorMessage}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
