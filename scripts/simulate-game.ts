/**
 * Twinum 对局模拟脚本（命令行跑完整 3 轮对局）—— 可读性优化版
 *
 * 运行：
 *   cd twinum && npx tsx scripts/simulate-game.ts [seed] [--verbose]
 *
 * 日志格式说明：
 *   [5/3↑]  = 正反面 5 和 3，当前 5 朝上（未翻）
 *   [3/5↓]  = 正反面 3 和 5，当前 3 朝上（已翻，3 原本是背面）
 *
 * 选项：
 *   --verbose   也显示 Bot 内部的决策评分日志（默认关闭）
 */
import { applyAction, isGameOver, startNewGame, startNextRound } from '../src/game-engine';
import { rebuildRng } from '../src/game-engine/round';
import { createBot } from '../src/bot';
import { faceValue, type Action, type Card, type GameState } from '../src/types/game';

const VERBOSE = process.argv.includes('--verbose');
if (!VERBOSE) {
  // 屏蔽 Bot 内部的 console.debug，只保留本脚本的 console.log
  console.debug = () => {};
}

// ANSI 颜色
const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * 格式化一张牌：显示"当前朝上面/另一面"，以及当前朝向
 * [5/3↑]  朝上 5、背面 3、未翻面
 * [3/5↓]  朝上 3（原 bottom）、另一面 5、已翻面
 */
function formatCard(card: Card): string {
  const face = faceValue(card);
  const other = card.flipped ? card.top : card.bottom;
  const arrow = card.flipped ? '↓' : '↑';
  const color = card.flipped ? c.yellow : c.cyan;
  return `${color}[${face}/${other}${arrow}]${c.reset}`;
}

function formatHandWithIndex(hand: Card[]): string {
  return hand
    .map((card, i) => `${c.gray}${String(i).padStart(2, ' ')}${c.reset}${formatCard(card)}`)
    .join(' ');
}

function formatHand(hand: Card[]): string {
  return hand.map(formatCard).join(' ');
}

function formatAction(a: Action, state: GameState): string {
  const p = state.players[state.currentPlayerIndex];
  switch (a.type) {
    case 'SHOW': {
      const cards = a.cardIndexes.map((i) => p.hand[i]);
      const values = cards.map(faceValue).join(',');
      return `${c.green}${c.bold}SHOW${c.reset} 出 ${cards.length} 张 [${values}]（手牌 index ${a.cardIndexes.join(',')}）`;
    }
    case 'SCOUT': {
      if (!state.activeSet) return 'SCOUT ???';
      const pickedIdx = a.from === 'left' ? 0 : state.activeSet.cards.length - 1;
      const pickedCard = state.activeSet.cards[pickedIdx];
      const pickedFace = faceValue(pickedCard);
      const afterFace = a.flip ? (pickedCard.flipped ? pickedCard.top : pickedCard.bottom) : pickedFace;
      return `${c.yellow}${c.bold}SCOUT${c.reset} 从场上${a.from === 'left' ? '左端' : '右端'}抽走 ${c.cyan}[${pickedFace}]${c.reset}${a.flip ? `（翻面变 ${c.magenta}${afterFace}${c.reset}）` : ''}，插入手牌 index ${a.insertAt}`;
    }
    case 'SCOUT_AND_SHOW': {
      if (!state.activeSet) return 'SCOUT&SHOW ???';
      const pickedIdx = a.scout.from === 'left' ? 0 : state.activeSet.cards.length - 1;
      const pickedCard = state.activeSet.cards[pickedIdx];
      const pickedFace = faceValue(pickedCard);
      const afterFace = a.scout.flip
        ? pickedCard.flipped
          ? pickedCard.top
          : pickedCard.bottom
        : pickedFace;
      return `${c.magenta}${c.bold}SCOUT&SHOW${c.reset} 先抽${a.scout.from === 'left' ? '左' : '右'}端 ${c.cyan}[${pickedFace}]${c.reset}${a.scout.flip ? `→${afterFace}` : ''} 插入 index ${a.scout.insertAt}，再 Show ${a.show.length} 张 [index ${a.show.join(',')}]`;
    }
    case 'FLIP_HAND':
      return `${c.blue}${c.bold}FLIP_HAND${c.reset} 整副翻面`;
  }
}

function formatActiveSet(state: GameState): string {
  if (!state.activeSet) return `${c.dim}(场上无牌)${c.reset}`;
  const cards = state.activeSet.cards.map(formatCard).join(' ');
  return `${state.activeSet.kind === 'same' ? '同数组' : '连续组'}|min=${state.activeSet.minValue}| ${cards} ${c.dim}(by P${state.activeSetOwnerIndex})${c.reset}`;
}

function printRoundHeader(state: GameState): void {
  console.log('\n' + c.bold + '═'.repeat(80) + c.reset);
  console.log(`${c.bold}Round ${state.round}/${state.totalRounds}${c.reset}  ${c.dim}Seed: ${state.seed}${c.reset}`);
  console.log(c.bold + '═'.repeat(80) + c.reset);
  console.log(`${c.dim}卡牌格式：[当前面/另一面 ↑未翻|↓已翻]，未翻=${c.reset}${c.cyan}青色${c.reset}${c.dim} 已翻=${c.reset}${c.yellow}黄色${c.reset}`);
  console.log(`${c.dim}起始玩家（持有 [1,2] 那张牌的人）用 👑 标记${c.reset}\n`);
  state.players.forEach((p, i) => {
    const marker = i === state.startingPlayerIndex ? '👑' : '  ';
    const botTag = p.botConfigKey === 'STEADY' ? c.blue : p.botConfigKey === 'RUSH' ? c.red : c.green;
    console.log(
      `${marker} P${i} ${c.bold}${p.name.padEnd(10)}${c.reset} ${botTag}[${(p.botConfigKey ?? p.type).padEnd(8)}]${c.reset} 手牌=${p.hand.length} 累计=${p.totalScore}`,
    );
    console.log(`     ${formatHandWithIndex(p.hand)}`);
  });
}

function printTurn(state: GameState, action: Action): void {
  const p = state.players[state.currentPlayerIndex];
  const tag = p.botConfigKey === 'STEADY' ? c.blue : c.red;
  console.log(
    `\n${c.bold}🎯 Turn ${String(state.turnInRound).padStart(2)}${c.reset} | ${tag}P${state.currentPlayerIndex} ${p.name}${c.reset}`,
  );
  console.log(`   场上：${formatActiveSet(state)}`);
  console.log(`   我的手牌：${formatHand(p.hand)}`);
  console.log(`   → ${formatAction(action, state)}`);
}

function printRoundEnd(state: GameState): void {
  console.log('\n' + c.yellow + '─'.repeat(80) + c.reset);
  const triggerer = state.players[state.roundEndConditionTriggerer!];
  console.log(
    `${c.yellow}${c.bold}🏁 Round ${state.round} 结束${c.reset}  触发条件: ${state.roundEndCondition}（${state.roundEndCondition === 'i' ? '有人出光' : '其他人全 Scout'}）  触发者: P${state.roundEndConditionTriggerer} ${triggerer?.name}`,
  );
  state.players.forEach((p, i) => {
    const ii = state.roundEndCondition === 'ii' && state.roundEndConditionTriggerer === i;
    const handPenalty = ii ? 0 : p.hand.length;
    const roundScore = p.collectedCards.length + p.scoutChips - handPenalty;
    const totalAfter = p.totalScore + roundScore;
    console.log(
      `  P${i} ${p.name.padEnd(10)} 已收集=${p.collectedCards.length} ScoutChip=${p.scoutChips} 剩余手牌=${p.hand.length}${ii ? c.green + '(免扣)' + c.reset : ''} ${c.bold}本轮 ${roundScore >= 0 ? '+' : ''}${roundScore}${c.reset} 累计=${totalAfter}`,
    );
  });
}

function printGameEnd(state: GameState): void {
  console.log('\n' + c.green + '═'.repeat(80) + c.reset);
  console.log(`${c.green}${c.bold}🏆 整局结束${c.reset}`);
  console.log(c.green + '═'.repeat(80) + c.reset);
  const maxScore = Math.max(...state.players.map((p) => p.totalScore));
  state.players.forEach((p, i) => {
    const winner = p.totalScore === maxScore;
    const emoji = winner ? '🥇' : '  ';
    console.log(`  ${emoji} P${i} ${c.bold}${p.name.padEnd(10)}${c.reset} 总分=${c.bold}${p.totalScore}${c.reset}`);
  });
}

// ========== 主流程 ==========

const seed = process.argv[2] ?? `sim-${Date.now()}`;
console.log(`\n${c.bold}🎮 Twinum 对局模拟（4 人全 Bot）${c.reset} · ${c.dim}seed=${seed}${c.reset}\n`);

const { state: initial } = startNewGame({ seed, playerCount: 4, allBots: true });

// MVP 阶段 4 个 Bot 决策逻辑相同（全用 STEADY_CONFIG），命名 bot1-bot4 由 startNewGame 自动分配
let state: GameState = initial;

printRoundHeader(state);

let step = 0;
const maxSteps = 500;

while (!isGameOver(state) && step < maxSteps) {
  if (state.phase === 'roundEnd') {
    printRoundEnd(state);
    const rng = rebuildRng(`${state.seed}-r${state.round + 1}`);
    state = startNextRound(state, rng);
    if (state.phase !== 'gameEnd') printRoundHeader(state);
    continue;
  }
  const p = state.players[state.currentPlayerIndex];
  const bot = createBot(p.botConfigKey!);
  const action = bot.act(state, state.currentPlayerIndex);
  printTurn(state, action);
  state = applyAction(state, action);
  step++;
}

printGameEnd(state);
console.log(`\n${c.dim}总步数: ${step}${c.reset}\n`);
