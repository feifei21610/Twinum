/**
 * 可复现的种子随机数生成器（mulberry32）
 *
 * 用途：
 *   - 洗牌、初始翻面随机、Bot 决策噪声
 *   - 注入同一 seed 可以完全复现一局游戏
 *   - 未来上联机时，服务端喂同一 seed 可做权威校验
 *
 * 算法：mulberry32（比 Math.random 可控，32 位状态，分布均匀）
 *   参考：https://stackoverflow.com/a/47593316
 */

export interface RNG {
  /** 返回 [0, 1) 的浮点数 */
  next(): number;
  /** 返回 [min, max) 的整数 */
  nextInt(min: number, max: number): number;
  /** 当前种子状态（用于持久化/调试） */
  readonly seed: string;
}

/**
 * 将字符串 seed 转换为 32 位整数（简单 hash）
 */
function seedToInt(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * 创建一个 seeded RNG
 */
export function createRNG(seed: string): RNG {
  let state = seedToInt(seed);

  const next = (): number => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const nextInt = (min: number, max: number): number => {
    if (max <= min) return min;
    return Math.floor(next() * (max - min)) + min;
  };

  return {
    next,
    nextInt,
    seed,
  };
}

/**
 * 基于时间 + 随机数生成默认 seed（用于新对局）
 */
export function generateSeed(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Fisher-Yates 洗牌（基于 RNG，保证可复现）
 */
export function shuffle<T>(items: readonly T[], rng: RNG): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
