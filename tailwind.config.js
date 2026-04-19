/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // Poppins 主字体，中文回退 PingFang SC / 系统默认
        sans: ['Poppins', 'PingFang SC', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
      },
      colors: {
        // 深夜赛博主题（与 scout/docs/05-visual-style.md 对齐）
        primary: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          400: '#818CF8',
          500: '#6366F1', // 主色 A - 紫
          600: '#4F46E5',
          700: '#4338CA',
        },
        accent: {
          500: '#8B5CF6', // 主色 B - 品红
          600: '#7C3AED',
        },
        neon: {
          400: '#F472B6',
          500: '#EC4899', // 主色 C - 霓虹粉
          600: '#DB2777',
        },
        surface: {
          900: '#0F172A', // 背景主
          800: '#1E293B', // 背景辅
          700: '#334155',
        },
        ink: {
          50: '#F8FAFC', // 前景文字
          300: '#CBD5E1',
          400: '#94A3B8', // 辅助文字
          900: '#0F172A',
        },
        // 功能色
        success: '#22C55E',
        danger: '#EF4444',
        warning: '#F59E0B',
        info: '#3B82F6',
      },
      backgroundImage: {
        'gradient-neon': 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #EC4899 100%)',
        'gradient-dark': 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)',
      },
      boxShadow: {
        'neon-primary': '0 0 20px rgba(99, 102, 241, 0.5)',
        'neon-accent': '0 0 20px rgba(139, 92, 246, 0.5)',
        'neon-pink': '0 0 20px rgba(236, 72, 153, 0.5)',
        glass: '0 8px 32px 0 rgba(15, 23, 42, 0.37)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        float: 'float 4s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      screens: {
        xs: '375px', // iPhone 基准
      },
      maxWidth: {
        app: '420px', // 桌面端居中最大宽度
      },
    },
  },
  plugins: [
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('tailwindcss-animate'),
  ],
};
