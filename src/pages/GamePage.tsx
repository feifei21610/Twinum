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
import { useBotTurn } from '../hooks/useBotTurn';
import { ScorePanel } from '../components/ScorePanel';
import { OpponentArea } from '../components/OpponentArea';
import { BoardArea } from '../components/BoardArea';
import { HandArea } from '../components/HandArea';
import { ActionBar, type ScoutPendingParams, type SasPendingParams } from '../components/ActionBar';
import { GameLogDrawer } from '../components/GameLogDrawer';
import { computeRoundScores } from '../game-engine/scoring';
import type { Action } from '../types/game';
import { faceValue } from '../types/game';

export function GamePage(): JSX.Element {
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

  // Scout 两步交互的 pending 状态
  const [scoutPending, setScoutPending] = useState<ScoutPendingParams | null>(
    null,
  );

  // S&S 中间态：Scout 完成后等待用户选 Show
  const [sasPending, setSasPending] = useState<SasPendingParams | null>(null);

  // 日志抽屉开关
  const [logDrawerOpen, setLogDrawerOpen] = useState(false);

  // 驱动 Bot 自动决策
  useBotTurn();

  // 如果 game 为 null（异常状态），回首页
  useEffect(() => {
    if (!game) goto('start');
  }, [game, goto]);

  // 切换回合时清理残留的 Scout pending 和 S&S 中间态
  useEffect(() => {
    if (!isHumanTurn) {
      setScoutPending(null);
      setSasPending(null);
    }
  }, [isHumanTurn]);

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
