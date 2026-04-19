# Twinum · 双数

> 一款极简双面数字卡牌对战网页游戏 · 4 人局（1 人 + 3 个 AI 队友） · 致敬 Oink Games《SCOUT!》· 个人学习作品
>
> 🎮 在线试玩：https://feifei21610.github.io/Twinum/ · 📖 [玩法规则](../scout/docs/03-game-rules.md) · ❤️ 强烈推荐购买[原版桌游](https://oinkgames.com/en/games/analog/scout/)

---

## 🚀 快速开始

```bash
npm install
npm run dev       # 开发服务器：http://localhost:5173
npm run build     # 生产构建
npm run test      # 跑单测（Vitest）
npm run test:ui   # 带 UI 的单测
```

## 🏗️ 技术栈

| 层 | 选型 | 版本 |
|---|---|---|
| 构建 | Vite | 5 |
| 语言 | TypeScript | 5 |
| UI | React | 18 |
| 样式 | TailwindCSS | 3.4.17 |
| 状态 | Zustand | 5 |
| 动画 | Framer Motion | 12 |
| 图标 | lucide-react + react-icons | — |
| 单测 | Vitest | 2 |

## 📂 目录结构（MVP 完成后的形态）

```
twinum/
├── src/
│   ├── types/game.ts            # 类型契约（Card/CardGroup/Player/Action/GameState）
│   ├── constants/game.ts        # 魔法数字集中
│   ├── game-engine/             # 纯函数规则引擎（可复制到服务端做权威校验）
│   │   ├── rng.ts               # 种子随机
│   │   ├── deck.ts              # 牌堆生成、洗牌、发牌
│   │   ├── rules.ts             # 合法性与强弱比较
│   │   ├── actions.ts           # 状态转移（Show/Scout/ScoutAndShow/FlipHand）
│   │   ├── scoring.ts           # 计分
│   │   └── round.ts             # 回合/整局流程
│   ├── bot/                     # 统一 decide + BotConfig（MVP 所有 Bot 同一策略，命名 bot1/bot2/bot3）
│   ├── store/gameStore.ts       # Zustand store + persist
│   ├── pages/                   # StartPage / GamePage / ResultPage / RulesPage
│   ├── components/              # Card / HandArea / OpponentArea / BoardArea / ActionBar ...
│   ├── hooks/                   # usePersistGame / useBotTurn
│   └── utils/                   # animation / cn
└── tests/game-engine/           # 规则/动作/计分/Bot 单测
```

## 🙏 致敬声明 · Acknowledgments

本项目是对日本 [Oink Games](https://oinkgames.com/) 发行、由 Kei Kajino 设计的卡牌游戏《SCOUT!》的**个人致敬与学习作品**。

- 🎨 游戏名称、Logo、美术、UI 均为原创，不使用任何原版素材
- 📜 玩法规则基于"思想-表达二分法"独立实现
- 💝 本项目**仅供个人学习和朋友娱乐**，**不用于任何商业用途**（不收费、不内购、不投广告）
- 🛒 如果喜欢这个玩法，**强烈推荐购买原版桌游**支持作者：https://oinkgames.com/en/games/analog/scout/
- 📮 如果版权方认为本项目有任何不妥之处，请联系我，24 小时内下线

Original board game "SCOUT!" © 2019 Oink Games. All rights reserved by original publisher.  
This project is an unofficial, non-commercial fan-made implementation for personal learning purposes.

## 🚀 部署说明

本项目通过 **GitHub Actions** 自动部署到 **GitHub Pages**：

- 推送任何提交到 `main` 分支 → `.github/workflows/deploy.yml` 自动触发
- 流程：checkout → 安装依赖 → 跑单测 → 构建 → 上传 artifact → 发布到 Pages
- 在线地址：https://feifei21610.github.io/Twinum/

**首次启用 Pages**（仓库所有者需要做一次）：
1. GitHub 仓库 → Settings → Pages
2. Source 选择 **GitHub Actions**
3. 下次推 main 自动生效

> 💡 `vite.config.ts` 已配置 `base: '/Twinum/'`（仅生产构建生效，注意仓库名首字母大写），所以部署在子路径下不会资源 404。

## 📄 License

MIT · 仅对本仓库内的代码生效，不涉及 Oink Games 的任何权利。
