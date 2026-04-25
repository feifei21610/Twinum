/**
 * Twinum 游戏服务器入口
 *
 * 启动方式：
 *   开发：npm run dev   (tsx watch)
 *   生产：npm run build && npm start
 *
 * 端口：2567（Colyseus 默认）
 */
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GameRoom } from './rooms/GameRoom.js';

const PORT = Number(process.env.PORT ?? 2567);

// CORS origins：从环境变量读取（逗号分隔），兜底允许本地开发
const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://feifei21610.github.io',
];
const allowedOrigins: string[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : DEFAULT_ORIGINS;

const app = express();

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json());

// 健康检查端点
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 创建 HTTP 服务器
const httpServer = createServer(app);

// Colyseus 游戏服务器
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

// 注册房间类型
gameServer.define('game', GameRoom)
  .filterBy(['targetPlayerCount']);

gameServer.listen(PORT).then(() => {
  console.log(`✅ Twinum server listening on 0.0.0.0:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Allowed origins: ${allowedOrigins.join(', ')}`);
});

// 优雅关闭（Fly.io 滚动更新时发 SIGTERM，给房间 30s 结束）
async function gracefulShutdown(signal: string) {
  console.log(`[Server] Received ${signal}, shutting down gracefully...`);
  try {
    await gameServer.gracefullyShutdown();
    console.log('[Server] Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    console.error('[Server] Graceful shutdown failed:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
