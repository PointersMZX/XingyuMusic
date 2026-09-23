//! 更新默认主题配置后，需要执行 npm run build:theme 重新构建themes.ts
//! XingyuMusic 主题系统（移动端与桌面端同步）：
//! 1. xingyu  紫金黑（品牌默认，带液态玻璃，c-liquid-glass=true）
//! 2. white   纯白（不做液态玻璃）
//! 3. black   纯黑（不做液态玻璃）
//! 自定义 RGB 主题（桌面端「添加主题」创建，可开关液态玻璃）经设置同步而来

const fs = require('fs')
const path = require('path')
const { createThemeColors } = require('./utils')

const defaultThemes = [
  {
    id: 'xingyu',
    name: '紫金黑',
    isDark: true,
    config: {
      primary: 'rgb(124, 32, 194)',
      font: 'rgb(240, 236, 255)',
      'c-app-background': 'rgba(18, 3, 31, 0.35)',
      'c-main-background': 'rgba(13, 7, 22, 0.88)',
      'bg-image': '',
      'bg-image-position': 'center',
      'bg-image-size': 'cover',
      // 液态玻璃（底栏/侧栏玻璃键）
      'c-glass-edge': 'rgba(232, 208, 158, 0.75)',
      'c-glass-tint': 'rgba(124, 32, 194, 0.36)',
      'c-liquid-glass': 'true',

      'c-badge-primary': 'var(c-primary)',
      'c-badge-secondary': '#D4B06F',
      'c-badge-tertiary': '#F1DDA1',
    },
  },
  {
    id: 'white',
    name: '纯白',
    isDark: false,
    config: {
      primary: 'rgb(124, 32, 194)',
      font: 'rgb(33, 33, 33)',
      'c-app-background': 'rgba(243, 243, 247, 0.9)',
      'c-main-background': 'rgb(255, 255, 255)',
      'bg-image': '',
      'bg-image-position': 'center',
      'bg-image-size': 'cover',
      // 纯白主题：不做液态玻璃，底栏为实色
      'c-glass-edge': 'transparent',
      'c-glass-tint': 'rgb(255, 255, 255)',
      'c-liquid-glass': 'false',

      'c-badge-primary': 'var(c-primary)',
      'c-badge-secondary': '#4baed5',
      'c-badge-tertiary': '#e7aa36',
    },
  },
  {
    id: 'black',
    name: '纯黑',
    isDark: true,
    config: {
      primary: 'rgb(150, 90, 220)',
      font: 'rgb(235, 235, 240)',
      'c-app-background': 'rgba(0, 0, 0, 0.9)',
      'c-main-background': 'rgb(12, 12, 16)',
      'bg-image': '',
      'bg-image-position': 'center',
      'bg-image-size': 'cover',
      // 纯黑主题：不做液态玻璃，底栏为实色
      'c-glass-edge': 'transparent',
      'c-glass-tint': 'rgb(12, 12, 16)',
      'c-liquid-glass': 'false',

      'c-badge-primary': 'var(c-primary)',
      'c-badge-secondary': '#4baed5',
      'c-badge-tertiary': '#e7aa36',
    },
  },
]

defaultThemes.forEach(t => {
  t.config['c-glass-edge'] ??= 'transparent'
  t.config['c-glass-tint'] ??= 'var(c-main-background)'
  t.config['c-liquid-glass'] ??= 'false'
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

fs.writeFileSync(path.join(__dirname, 'themes.ts'), `/* eslint-disable */\n//! 此文件由 createThemes.js 生成\n\nexport default ${JSON.stringify(themes, null, 2)} as const`)
