/**
 * Colyseus Schema：房间状态定义
 *
 * 用于自动同步到所有客户端。
 * 手牌通过 filter 装饰器实现"只发给本人"的保密机制。
 */
import { Schema, MapSchema, ArraySchema, type, filter } from '@colyseus/schema';

// ===== 单张牌 =====
export class CardSchema extends Schema {
  @type('string') id: string = '';
  @type('number') top: number = 0;
  @type('number') bottom: number = 0;
  @type('boolean') flipped: boolean = false;
}

// ===== 牌组（场上 Active Set）=====
export class CardGroupSchema extends Schema {
  @type('string') kind: string = 'same'; // 'same' | 'run'
  @type([CardSchema]) cards = new ArraySchema<CardSchema>();
  @type('number') minValue: number = 0;
}

// ===== 玩家状态（对所有人可见的部分）=====
export class PlayerPublicSchema extends Schema {
  @type('string') id: string = '';
  @type('string') type: string = 'human'; // 'human' | 'bot' | 'remote'
  @type('string') name: string = '';
  @type('string') avatarColor: string = 'primary';
  @type('number') handSize: number = 0;        // 手牌张数（公开）
  @type('number') collectedCount: number = 0;   // 已收集张数（公开）
  @type('number') scoutChips: number = 0;
  @type('boolean') scoutShowChipUsed: boolean = false;
  @type('number') totalScore: number = 0;
  @type('boolean') connected: boolean = true;   // 是否在线
  @type('number') reconnectDeadline: number = 0; // 断线后60秒重连截止时间戳（0=在线）
}

// ===== 房间状态（全局）=====
export class GameRoomState extends Schema {
  // 房间基础
  @type('string') roomPhase: string = 'lobby'; // 'lobby' | 'playing' | 'finished'
  @type('string') hostSessionId: string = '';

  // 玩家列表（公开信息）
  @type({ map: PlayerPublicSchema }) players = new MapSchema<PlayerPublicSchema>();

  // 座位顺序（有序）
  @type(['string']) seatOrder = new ArraySchema<string>(); // sessionId 顺序

  // 游戏配置
  @type('number') targetPlayerCount: number = 4; // 房主设置的目标人数（2-5）

  // 游戏中状态（从权威 GameState 同步过来的公共信息）
  @type('number') currentPlayerIndex: number = 0;
  @type('number') round: number = 1;
  @type('number') totalRounds: number = 4;
  @type('string') gamePhase: string = 'playing'; // GameState.phase

  // 场上牌组（公开）
  @type(CardGroupSchema) activeSet: CardGroupSchema | null = null;
  @type('number') activeSetOwnerIndex: number = -1;
  @type('string') seed: string = '';
}
