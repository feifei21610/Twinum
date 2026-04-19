import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并 tailwind 类名的工具函数，处理冲突与条件类名。
 * 示例：cn('p-4', isActive && 'bg-primary-500', 'p-6') -> 'bg-primary-500 p-6'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
