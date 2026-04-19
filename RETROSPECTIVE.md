# Twinum MVP 复盘：H5 卡牌游戏从 0 到 1 的经验与坑

> 适用场景：下次再做一款**回合制 / 卡牌 / 棋盘 / 策略类**的 H5 小游戏 MVP 时，直接照搬这张 checklist。

---

## 一、项目总览

| 维度 | 数据 |
|---|---|
| 类型 | H5 卡牌对战（致敬 Oink Games《SCOUT!》） |
| 玩家数 | 4-5 人（1 人类 + N 个 Bot） |
| 技术栈 | Vite + React + TS + Tailwind + framer-motion + Zustand + Vitest |
| 产物大小 | 362 KB (gzip 116 KB) |
| 单测 | 87 条（主要覆盖 game-engine 和 bot） |
| 部署 | GitHub Pages + Actions 自动部署 |
| 周期 | 从规则文档到上线、到 4/5 人可选，共数天 |

---

## 二、总方法论（最重要的 5 条）

### ① 先写规则文档，再动代码
一开始就把《游戏规则》《视觉风格》《Bot 行为规范》写成 `scout/docs/*.md`，所有后续开发都拿它当唯一真相源。好处：
- 规则歧义（Scout 翻面时机、回合结束触发条件）在写文档时就暴露出来
- 后续 AI / 自己重新理解代码时不用翻源码，读文档即可
- 单测 case 直接引用文档条款编号

**下次复用**：立 1-2 天专门写 `docs/`，宁可晚动代码。

### ② 引擎/UI 彻底解耦（核心中的核心）
**规则**：所有游戏逻辑都是纯函数，签名 `(state, action) => newState`，放 `src/game-engine/`；UI 组件禁止写任何判胜/计分/合法性判断。

**落地结构**：
```
src/game-engine/
  rules.ts     # 判断动作是否合法 / 牌组强度比较
  actions.ts   # applyAction(state, action) → newState
  scoring.ts   # 计分
  round.ts     # 开局 / 换轮 / 判游戏结束
  deck.ts      # 生成牌堆 / 洗牌 / 发牌
  rng.ts       # seeded RNG
  bot.ts       # Bot 决策：(state) => Action
```

**收益**：
- 单测只测纯函数，不 mount React，速度快（87 条跑完 < 1s）
- 扩 4/5 人时，引擎一行不改，只改 UI 里的选择控件
- 未来上联机服务端，直接把 `game-engine/` 复制到 Node.js 即可

### ③ 所有状态变化走 Action 派发模式
**签名**：
```ts
type Action =
  | { type: 'show'; handIndexes: number[] }
  | { type: 'scout'; sourceEnd: 'left' | 'right'; flip: boolean; insertAt: number }
  | { type: 'scoutAndShow'; ... }
  | { type: 'flipHand' }
  | { type: 'pass' };

function applyAction(state: GameState, action: Action): GameState
```

Store 里只有一个 `dispatchAction`，所有按钮（人类）和 Bot 决策都派发同一组 Action。

**收益**：
- Bot 接口和"远程玩家"完全同形（`(state) => Action`），未来 WebSocket 广播的就是这个 Action
- 回放 / 撤销 / 日志 天然支持（存 actions 即可）
- 任何"规则 bug"一定是 `applyAction` 里的 bug，排查范围收敛

### ④ Player 抽象，不要把"人类/Bot"写死
```ts
interface Player {
  id: string;
  type: 'human' | 'bot' | 'remote'; // ← 必须留 remote
  name: string;
  hand: Card[];
  ...
  botConfigKey?: BotConfigKey; // 仅 bot 用
}
```

并且 `players` 一定是**数组**不是 `[human, bot1, bot2]` 的 tuple。`currentPlayer` 用 index。

**收益**：4 人 → 5 人只改一个数字；未来插入 "remote" 玩家只是多一个 type。

### ⑤ seeded RNG 贯穿全局
所有随机（洗牌、翻面、Bot 决策里的 tiebreaker）都经过 `rng.next()`，seed 存在 `GameState.seed`。

**收益**：
- bug 可复现：用户截图带着 seed，开发本地一把复现
- 单测不用打桩 Math.random
- 未来服务端权威校验：客户端+seed 能算出同样结果

---

## 三、踩过的坑（按"疼痛排序"）

### 坑 1：Bot 决策先别上贪心
**现象**：早期 Bot 的 `scoreScoutAndShow` 是"先选纯 Scout 视角最优的参数，再判断能不能 Show"。结果出现**"明明翻面后能凑齐一个大组，但 Bot 不翻"**。

**根因**：翻面会改变数字，Scout 视角的"好参数"和 Show 视角的"好参数"不是同一组。

**解法**：**独立枚举**所有 Scout 参数组合（左/右 × 翻/不翻 × 所有插入位置），对每一个组合独立评分，全局取 max。

**复用启示**：**凡是"复合动作"（A+B），绝对不能用"先 A 最优再 B"的贪心，必须完整枚举 (A, B) 组合空间。** 一条锁定测试保护这条规则。

### 坑 2：Bot 决策"贪心加分"堆不出好决策
**现象**：最早 Bot 用"出牌分 + 手牌减少分 + 长度分 + minValue×0.3 + 终局冲刺分 + ..."一堆加分项相加，结果 Bot 行为像喝醉了。

**解法**：改成**规划驱动的 5 级决策优先级**（L0 强制 Show / L1 构建防御 / L2 消孤 / L3 Show / L4 兜底）。每一级有**明确触发条件**和**独立加分池**，上一级有动作时下一级不参与。

**复用启示**：
- Bot 不是神经网络，不要"加分混池"
- 先分析：玩家在这个游戏里的**高层目标**是什么（防御组 / 清手牌 / 破坏对手）
- 为每个高层目标独立建模（独立分数段 100 / 300 / 500 / 800），不同段用分数"隔断"而不是比大小

### 坑 3：`mistakeRate` 不能覆盖强制局面
**现象**：Bot 有 `mistakeRate` 偶尔出次优解增加可玩性。但在 `nextPlayer === lastShower` 的**强制 Show 时刻**，若不 Show 整轮结束、Show 者免扣分——这时 Bot 不能犯错。

**解法**：**L0 强制 Show 时禁用 mistakeRate**，其他层级允许。

**复用启示**：任何"随机犯错"机制，**必须识别出"致命局面"白名单**，在白名单里关掉随机。

### 坑 4：跨浏览器 localStorage schema 版本问题
**现象**：改了 `GameState` 字段后，老用户刷新直接白屏。

**解法**：Zustand persist 的 `onRehydrateStorage` 里捕获错误，字段缺失时回落到初始状态；并在 store key 里带版本号（日后改大 schema 就递增）。

**复用启示**：凡是会持久化的数据，**从 day 1 就带 schema version**，不要等挨过一次再加。

### 坑 5：GitHub Pages 的 `base` 路径
**现象**：本地跑没事，部署到 `https://xxx.github.io/Twinum/` 后所有资源 404。

**解法**：`vite.config.ts`：
```ts
base: isProd ? '/Twinum/' : '/'
```
仓库名大小写要和 `base` 严格一致。

**复用启示**：
- 本地目录可以小写，但 `base` 必须和 **GitHub 仓库实际名字** 完全一致（大小写）
- 早上就建 Pages + Actions，先让一个 `<h1>Hello</h1>` 能部署上去，再写业务

### 坑 6：framer-motion 的 `height: 'auto'` 动画
**现象**：直接 `animate={{ height: 'auto' }}` 没有丝滑动画。

**解法**：外层 `div className="overflow-hidden"`，`initial={{ height: 0, opacity: 0 }}` → `animate={{ height: 'auto', opacity: 1 }}`，配 `AnimatePresence`。

**复用启示**：这个 pattern 在站内（ActionBar 的 SourcePanel、RulesPage 的摘要卡）复用了 3 次以上，**第一次调通后把它抽成一段 snippet 留着**。

### 坑 7：UI 图标 ≠ 信息
**现象**：对手区用 `🃏 11 🎖 3 ⚡ ✓` 展示手牌数/credits/S&S，用户问："这些都是什么？"

**解法**：所有数值旁边都要有**中文 label**（"手牌 11"、"Credits 3"、"S&S 已用"）。

**复用启示**：游戏 UI 里，图标永远是装饰，文字才是信息。对新手来说"一眼看懂"压倒"视觉纯粹"。

### 坑 8：日志抽屉做成遮罩阻塞交互
**现象**：第一版日志抽屉是 Modal 式，点开盖住牌局，用户要反复开关。

**解法**：改成右侧 260px 非阻塞窄抽屉，无遮罩，牌局可以同时操作。日志只保留最近 2 轮，避免长局越积越多。

**复用启示**：游戏里任何"辅助信息面板"都优先做**侧栏非阻塞**，不做 Modal。

### 坑 9：卡牌翻面动画性能
（前期没有，但值得注意）如果卡牌数 > 20 张同时动画，手机端会掉帧。

**预防**：
- `will-change: transform` 慎用，用完记得摘
- 翻面只动画"正在翻的那张"，其他卡牌只改 transform 不改重绘层

### 坑 10：Plan 和实际实现漂移
**现象**：写 plan 时选 A，实际问答中用户改主意为 C，但 plan 文件没同步，下次复盘糊涂。

**解法**：
- 每次用户澄清后，**立即 `plan_update`** 再动代码
- 归档里只留一份"最终决策"，不要保留中间讨论的分支

---

## 四、复用 Checklist（下次直接抄）

### 开工 Day 0-1（纯文档）
- [ ] `docs/01-project-name.md`：项目名 / 定位 / 一句话描述
- [ ] `docs/02-game-rules.md`：完整规则，带示例
- [ ] `docs/03-visual-style.md`：色板 / 字号 / 动效基调
- [ ] `docs/04-bot-behavior.md`：Bot 决策层级（哪怕先写骨架）
- [ ] `docs/05-plan-snapshot.md`：MVP 范围 / out of scope
- [ ] 仓库 + GitHub Actions + Pages 跑通 Hello World

### Day 2-5（纯引擎 + 单测）
- [ ] `src/types/game.ts`：Card / Player / GameState / Action 类型
- [ ] `src/game-engine/rng.ts`：seeded RNG
- [ ] `src/game-engine/deck.ts`：牌堆 / 洗牌 / 发牌（**支持 2-N 人参数化**）
- [ ] `src/game-engine/rules.ts`：动作合法性 / 判胜
- [ ] `src/game-engine/actions.ts`：`applyAction`
- [ ] `src/game-engine/scoring.ts`
- [ ] `src/game-engine/round.ts`：开局 / 换轮 / 判结束
- [ ] Vitest 覆盖每条规则的**边界 case**（开局/终局/平手/同时触发）
- [ ] **此时完全不要写 UI**

### Day 6-8（Bot）
- [ ] `src/game-engine/bot.ts`：`(state) => Action`
- [ ] **先用"随机合法动作"跑通**，再逐级加策略
- [ ] 每一级策略加锁定测试（"这种局面必须选这个动作"）
- [ ] `mistakeRate` 最后加，并且识别致命白名单

### Day 9-12（UI）
- [ ] Zustand store，只有 `dispatchAction` 一个入口
- [ ] StartPage：人数选择 + CTA
- [ ] GamePage：核心对局 UI
- [ ] ResultPage：结算 + 再来一局
- [ ] RulesPage：规则说明（可选摘要+详细二段式）

### Day 13（发布 + 反馈）
- [ ] localStorage 持久化（带 schema version）
- [ ] GitHub Actions 一次 push 自动部署
- [ ] 邀请 3-5 个朋友玩 → 拿反馈 → 逐条修（用户描述一条改一条，改完立即发布）

---

## 五、"联机兼容三原则"（这次留下的最值钱遗产）

再强调一次，下次做任何**未来可能上联机**的游戏，从第一行代码就遵守：

1. **不在 store/UI 写规则**，规则全部在 `game-engine/` 纯函数
2. **所有状态变化走 `dispatchAction(action)`**，未来 WebSocket 广播的就是这个 Action
3. **Bot 接口与远程玩家同形**（都是 `(state) => Action`），store 不关心对面是 Bot 还是人

遵守这三条的成本 = 近期**零成本**；不遵守的代价 = 上联机时**推倒重做**。

---

## 六、工具与流程

- **AI 辅助**：CodeBuddy 全流程 pair programming，每个决策都要求"先给 2-3 个方案让我选"而不是直接写
- **单测**：改引擎立即跑单测，不让 bug 漂到 UI 层
- **发布按钮**：`git add . && git commit -m "..." && git push` 三连，2 分钟上线
- **debug 套路**：seed + 轮次 + 回合数 三元组能精确复现任何现场

---

## 七、下次想更快的话

1. **建一个 game-template 仓库**：把 `game-engine/` 的骨架、Zustand store 骨架、GitHub Actions 配置、tailwind 配置全部固化成模板，新项目直接 fork
2. **Bot 决策框架抽象成库**：5 级优先级 + 加分池的模式是通用的
3. **文档 → 单测生成器**：规则文档里每条"MUST / MUST NOT"直接变单测名字，避免漏测

---

_复盘时间：2026-04-19 · MVP 完成日_
