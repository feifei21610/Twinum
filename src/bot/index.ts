/**
 * Bot 统一导出
 *
 * createBot 工厂函数返回一个签名与"未来远程玩家"同形的接口：
 *   (state, playerIndex) => Action
 * 这样上线联机时，用 `type: 'remote'` 的玩家只需实现同样的接口即可无缝替换。
 */
import type { Action, BotConfig, GameState } from '../types/game';
import type { RNG } from '../game-engine/rng';
import { decide } from './decide';
import { getBotConfig } from './botConfig';

export { STEADY_CONFIG, RUSH_CONFIG, BOT_CONFIGS, getBotConfig } from './botConfig';
export { decide } from './decide';

export interface BotAgent {
  config: BotConfig;
  /** 决策函数：返回一个合法的 Action */
  act: (state: GameState, playerIndex: number, rng?: RNG) => Action;
  /** UI 层用：返回本次"假思考"要等多少毫秒 */
  thinkingTimeMs: (rng?: RNG) => number;
}

export function createBot(configKey: BotConfig['key']): BotAgent {
  const config = getBotConfig(configKey);
  return {
    config,
    act: (state, playerIndex, rng) => decide(state, playerIndex, config, rng),
    thinkingTimeMs: (rng) => {
      const [min, max] = config.thinkingTimeMs;
      const r = rng ? rng.next() : Math.random();
      return Math.floor(min + r * (max - min));
    },
  };
}
