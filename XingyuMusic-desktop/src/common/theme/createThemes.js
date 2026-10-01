//! 更新默认主题配置后，需要执行 npm run build:theme 重新构建index.json
//! XingyuMusic 主题系统：共 4 个主题
//! 1. xingyu  紫金黑（品牌默认，紫＝logo 主色＋金＋黑，带液态玻璃，默认开）
//! 2. white   纯白（不做液态玻璃）
//! 3. black   纯黑（不做液态玻璃）
//! 4. 自定义  用户通过「添加主题」创建（RGB 取色器任选色），可在编辑器中开关「启用液态玻璃」
//!    （--liquid-glass 键；桌面端由 LiquidGlass WebGL 组件消费，移动端由 c-glass-* 变量消费）

const fs = require('fs')
const path = require('path')
const { createThemeColors } = require('./utils')

const defaultThemes = [
  {
    id: 'xingyu',
    name: '紫金黑',
    isDark: true,
    isDarkFont: false,
    config: {
      primary: 'rgb(124, 32, 194)',
      font: 'rgb(240, 236, 255)',
      '--color-app-background': 'rgba(22, 5, 38, 0.35)',
      '--color-main-background': 'rgba(16, 7, 30, 0.58)',
      '--color-nav-font': 'var(--color-primary-light-300)',
      // 液态玻璃：紫色舞台光 + 金色微光，给玻璃底栏折射提供景深
      // 高 alpha 渐变 + 半透内容底：紫金氛围直接可见，玻璃折射源带色
      '--background-image': 'radial-gradient(1300px 820px at 18% -10%, rgba(124, 32, 194, 0.7), transparent 62%), radial-gradient(1000px 680px at 88% 110%, rgba(212, 176, 111, 0.5), transparent 55%), radial-gradient(800px 560px at 55% 50%, rgba(63, 15, 90, 0.55), transparent 70%)',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#3bc2b2',
      '--color-btn-min': '#85c43b',
      '--color-btn-close': '#fab4a0',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#D4B06F',
      '--color-badge-tertiary': '#F1DDA1',

      // 玻璃边缘高光（金色发丝线），其他主题未定义此变量时走 CSS fallback
      '--color-glass-edge': 'rgba(232, 208, 158, 0.9)',
      // 玻璃底板：紫金黑=半透，磨砂折射才看得见；其他主题=不透明（原样）
      '--color-glass-base': 'rgba(24, 8, 46, 0.5)',
      '--color-glass-tint': 'rgba(124, 32, 194, 0.5)',
      // 舞台底：半透黑紫，让紫金渐变透出，玻璃才有折射景深
      '--color-content-background': 'rgba(16, 7, 30, 0.62)',
      // 进度条填充：紫→金渐变（紫金黑的标志性元素）
      '--color-progress': 'linear-gradient(90deg, #8A2FD6 0%, #B44BC8 45%, #D4B06F 100%)',
      // 主播放按钮：紫金渐变宝石圆
      '--color-progress-ring': 'linear-gradient(135deg, #8A2FD6 0%, #4A1269 55%, #D4B06F 100%)',
      // Logo 金色辉光（紫金黑的品牌点缀）
      '--color-logo-glow': 'drop-shadow(0 0 5px rgba(212, 176, 111, 0.6)) drop-shadow(0 0 10px rgba(124, 32, 194, 0.5))',
      // 液态玻璃（WebGL SDF 折射 + 7 色色散 + 边缘流光 + 指针高光）：招牌效果，默认开
      '--liquid-glass': 'true',
    },
  },
  {
    id: 'white',
    name: '纯白',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(124, 32, 194)',
      font: 'rgb(33, 33, 33)',
      '--color-app-background': 'rgba(243, 243, 247, 0.9)',
      '--color-main-background': 'rgb(255, 255, 255)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#3bc2b2',
      '--color-btn-min': '#85c43b',
      '--color-btn-close': '#fab4a0',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#4baed5',
      '--color-badge-tertiary': '#e7aa36',

      // 纯白主题：不做液态玻璃
      '--color-glass-edge': 'transparent',
      '--color-glass-tint': 'transparent',
      '--color-content-background': '#f5f5f7',
      '--color-glass-base': 'rgb(255, 255, 255)',
      '--liquid-glass': 'false',
    },
  },
  {
    id: 'black',
    name: '纯黑',
    isDark: true,
    isDarkFont: false,
    config: {
      primary: 'rgb(150, 90, 220)',
      font: 'rgb(235, 235, 240)',
      '--color-app-background': 'rgba(0, 0, 0, 0.9)',
      '--color-main-background': 'rgb(12, 12, 16)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#3bc2b2',
      '--color-btn-min': '#85c43b',
      '--color-btn-close': '#fab4a0',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#4baed5',
      '--color-badge-tertiary': '#e7aa36',

      // 纯黑主题：不做液态玻璃
      '--color-glass-edge': 'transparent',
      '--color-glass-tint': 'transparent',
      '--color-content-background': '#0a0a0d',
      '--color-glass-base': 'rgb(12, 12, 16)',
      '--liquid-glass': 'false',
    },
  },
]

// 未显式定义键的占位，保证所有主题类型与运行时键一致
defaultThemes.forEach(t => {
  t.config['--color-glass-edge'] ??= 'transparent'
  t.config['--color-glass-tint'] ??= 'transparent'
  // 非紫金黑主题保持原 less 默认值语义，避免类型 union 断链
  t.config['--color-content-background'] ??= 'var(--color-primary-light-1000)'
  t.config['--color-glass-base'] ??= 'var(--color-main-background)'
  // 进度条填充：非紫金黑主题保持原纯色语义
  t.config['--color-progress'] ??= 'var(--color-primary-light-100-alpha-400)'
  // 主播放按钮宝石圆 / Logo 辉光：非紫金黑主题保持无点缀
  t.config['--color-progress-ring'] ??= 'transparent'
  t.config['--color-logo-glow'] ??= 'none'
  // 液态玻璃默认关（仅 xingyu 显式开启；自定义主题可在编辑器里开）
  t.config['--liquid-glass'] ??= 'false'
})

const themes = defaultThemes.map(({ config: { primary, font, ...extInfo }, ...themeInfo }) => {
  return {
    ...themeInfo,
    isCustom: false,
    config: {
      themeColors: createThemeColors(primary, font, themeInfo.isDark),
      extInfo,
    },
  }
})

fs.writeFileSync(path.join(__dirname, 'index.json'), JSON.stringify(themes, null, 2))
