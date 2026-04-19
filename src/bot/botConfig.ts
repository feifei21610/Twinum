/**
 * Bot 配置（v2 规划驱动版）
 *
 * MVP 阶段 Steady 和 Rush 使用**完全相同**的参数值，行为差异仅在 UI 层。
 * 后续若需要人设差异化，在此处调整对应字段即可。
 *
 * 参数含义参见 scout/docs/06-bot-behavior.md。
 */
import type { BotConfig, BotConfigKey } from '../types/game';

export const STEADY_CONFIG: BotConfig = {
  key: 'STEADY',
  showPriority: 1.0,
  scoutPriority: 1.0,
  mistakeRate: 0.15,
  thinkingTimeMs: [1000, 2000],
};

export const RUSH_CONFIG: BotConfig = {
  key: 'RUSH',
  showPriority: 1.0,
  scoutPriority: 1.0,
  mistakeRate: 0.15,
  thinkingTimeMs: [1000, 2000],
};

export const BOT_CONFIGS: Record<BotConfigKey, BotConfig> = {
  STEADY: STEADY_CONFIG,
  RUSH: RUSH_CONFIG,
};

export function getBotConfig(key: BotConfigKey): BotConfig {
  return BOT_CONFIGS[key];
}
