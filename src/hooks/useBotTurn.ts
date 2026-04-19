/**
 * useBotTurn：监听当前玩家变化，自动代 Bot 做决策
 *
 * 用法：在 GamePage 里调用一次即可：
 *   useBotTurn();
 *
 * 工作流程：
 *   1. 每次 state 变化后检查：当前玩家是不是 Bot？
 *   2. 如果是：setBotThinking(true)，延时 thinkingTimeMs（1-2s 随机）
 *   3. 调 bot.act() 拿到 Action，dispatchAction
 *   4. setBotThinking(false)
 */
import { useEffect, useRef } from 'react';
import { selectShouldRunBot, useGameStore } from '../store/gameStore';
import { createBot } from '../bot';
import type { BotConfigKey } from '../types/game';

export function useBotTurn(): void {
  const shouldRunBot = useGameStore(selectShouldRunBot);
  const game = useGameStore((s) => s.game);
  const dispatch = useGameStore((s) => s.dispatchAction);
  const setBotThinking = useGameStore((s) => s.setBotThinking);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!shouldRunBot || !game) return;

    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer.type !== 'bot' || !currentPlayer.botConfigKey) return;

    const bot = createBot(currentPlayer.botConfigKey as BotConfigKey);
    const delay = bot.thinkingTimeMs();

    setBotThinking(true);
    timerRef.current = setTimeout(() => {
      // 再次检查状态是否仍然是该 Bot 的回合（防止用户在延时内开了新局）
      const latest = useGameStore.getState().game;
      if (!latest) {
        setBotThinking(false);
        return;
      }
      if (latest.phase !== 'playing') {
        setBotThinking(false);
        return;
      }
      if (latest.currentPlayerIndex !== game.currentPlayerIndex) {
        setBotThinking(false);
        return;
      }

      const action = bot.act(latest, latest.currentPlayerIndex);
      dispatch(action);
      setBotThinking(false);
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // 依赖：每次 currentPlayerIndex 或 phase 变化都重新判断
  }, [shouldRunBot, game?.currentPlayerIndex, game?.phase, dispatch, setBotThinking, game]);
}
