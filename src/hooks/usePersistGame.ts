/**
 * usePersistGame：封装游戏持久化细节，UI 层只需知道 "restart/clear"
 *
 * 说明：实际持久化由 Zustand persist middleware 在 gameStore 里完成；
 * 这个 hook 仅提供统一的"清除持久化"接口，便于未来切换到服务端同步时替换实现。
 */
import { useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { STORAGE_PREFIX } from '../constants/game';

export interface UsePersistGameResult {
  /** 是否有进行中的对局（可用于"继续上局"按钮） */
  hasOngoingGame: boolean;
  /** 清除持久化存储（用于"完全重开"或 schema 变更后） */
  clearPersist: () => void;
}

export function usePersistGame(): UsePersistGameResult {
  const game = useGameStore((s) => s.game);

  const hasOngoingGame =
    game !== null && (game.phase === 'playing' || game.phase === 'roundEnd');

  const clearPersist = useCallback(() => {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}game`);
    } catch (err) {
      console.error('[usePersistGame] clearPersist failed', err);
    }
  }, []);

  return { hasOngoingGame, clearPersist };
}
