/**
 * @twinum/shared — 前端和服务端共享的游戏核心逻辑
 *
 * 包含：
 * - types/game.ts    游戏类型定义
 * - constants/game.ts 游戏常量
 * - game-engine/     游戏规则纯函数
 * - bot/             Bot 决策逻辑
 * - utils/game-log.ts 日志格式化
 */
export * from './types/game';
export * from './constants/game';
export * from './game-engine/index';
export * from './bot/index';
export * from './utils/game-log';
