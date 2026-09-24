const { afterPack } = require('./deps')

const fs = require('fs').promises
const fssync = require('fs')
const path = require('path')

// 保留的 Chromium 语言包（其余 .pak 会被裁掉，减小安装包体积）
// 缺失的语言会自动回退到 en-US，不影响 app 自身的 i18n（i18n 文案在 asar 内）
const KEEP_LOCALES = new Set(['zh-CN.pak', 'zh-TW.pak', 'en-US.pak', 'ko.pak'])

async function trimChromiumLocales(appOutDir) {
  const localesDir = path.join(appOutDir, 'locales')
  if (!fssync.existsSync(localesDir)) return
  const files = await fs.readdir(localesDir)
  const toRemove = files.filter((f) => f.endsWith('.pak') && !KEEP_LOCALES.has(f))
  await Promise.all(toRemove.map((f) => fs.unlink(path.join(localesDir, f)).catch(() => {})))
  if (toRemove.length) {
    console.log(`[trim-locale] 移除 ${toRemove.length} 个 Chromium 语言包，保留 [${[...KEEP_LOCALES].join(', ')}]`)
  }
}

// https://github.com/electron-userland/electron-builder/issues/4630
// https://github.com/electron-userland/electron-builder/issues/4630#issuecomment-782020139

module.exports = async(context) => {
  await afterPack()
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName === 'win32') {
    await trimChromiumLocales(appOutDir)
  }
  if (electronPlatformName !== 'darwin') return
  const {
    productFilename,
    info: {
      _metadata: { macLanguagesInfoPlistStrings },
    },
  } = context.packager.appInfo

  const resPath = `${appOutDir}/${productFilename}.app/Contents/Resources`

  // 创建APP语言包文件
  return Promise.all(
    Object.entries(macLanguagesInfoPlistStrings).map(([lang, config]) => {
      let infos = Object.entries(config).map(([k, v]) => `"${k}" = "${v}";`).join('\n')
      return fs.writeFile(`${resPath}/${lang}.lproj/InfoPlist.strings`, infos)
    }),
  )
}
