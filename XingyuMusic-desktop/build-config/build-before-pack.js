// const fs = require('fs')
// const fsPromises = require('fs').promises
// const path = require('path')
const { Arch } = require('electron-builder')
// const nodeAbi = require('node-abi')
const { beforePack, copyLib } = require('./deps')

// const better_sqlite3_fileNameMap = {
//   [Arch.x64]: 'linux-x64',
//   [Arch.arm64]: 'linux-arm64',
//   [Arch.armv7l]: 'linux-arm',
// }

// const replaceSqliteLib = async(arch) => {
//   // console.log(await fs.readdir(path.join(context.appOutDir, './resources/')))
//   // if (context.electronPlatformName != 'linux' || context.arch != Arch.arm64) return
//   // https://github.com/lyswhut/lx-music-desktop/issues/1102
//   // https://github.com/lyswhut/lx-music-desktop/issues/1161
//   console.log('replace sqlite lib...')
//   const filePath = path.join(__dirname, `./lib/better_sqlite3_${better_sqlite3_fileNameMap[arch]}.node`)
//   console.log(filePath)
//   const targetPath = path.join(__dirname, '../node_modules/better-sqlite3/build/Release/better_sqlite3.node')
//   await fsPromises.unlink(targetPath).catch(_ => _)
//   await fsPromises.copyFile(filePath, targetPath)
// }

const archMap = {
  [Arch.x64]: 'x64',
  [Arch.ia32]: 'ia32',
  [Arch.arm64]: 'arm64',
  [Arch.armv7l]: 'arm',
}
const fsSync = require('fs')
const pathMod = require('path')
module.exports = async(context) => {
  await beforePack()
  const { arch } = context
  const isWin7 = process.env.BUILD_WIN7 == 'true'
  // Windows 双版本：把「ABI 匹配的 better-sqlite3（JS + 原生 .node）成套」注入 node_modules，使 asar 内 JS 与 .node 版本自洽、
  // 且与 node_modules 当前安装状态解耦（可复现）：win7(E22/Node16/ABI110)=v9.6.0；普通(E42/Node24/ABI146)=v13。
  if (process.platform === 'win32') {
    const libSrc = pathMod.join(__dirname, 'lib', isWin7 ? 'better-sqlite3-win7' : 'better-sqlite3-x64')
    const target = pathMod.join(__dirname, '../node_modules/better-sqlite3')
    if (!fsSync.existsSync(libSrc)) throw new Error(`better-sqlite3 bundle missing: ${libSrc}`)
    console.log(`[sqlite3] inject ${isWin7 ? 'win7 (v9.6.0 / ABI110)' : 'x64 (v13 / ABI146)'} bundle -> node_modules/better-sqlite3`)
    fsSync.rmSync(pathMod.join(target, 'build'), { recursive: true, force: true })
    fsSync.cpSync(libSrc, target, { recursive: true })
    return
  }
  // 其它平台（linux/mac CI）沿用 legacy prebuild/copyLib 流程
  const electronVersion = context.packager?.info?._framework?.version ?? require('../package.json').devDependencies.electron.replace(/^[^\d]*?(\d+)/, '$1')
  await copyLib(archMap[arch], isWin7)
  // const electronNodeAbi = nodeAbi.getAbi(electronVersion, 'electron')
  // if (electronPlatformName !== 'linux' || process.env.FORCE) return
  // // const bindingFilePath = path.join(__dirname, '../node_modules/better-sqlite3/binding.gyp')
  // // const bindingBakFilePath = path.join(__dirname, '../node_modules/better-sqlite3/binding.gyp.bak')
  // switch (arch) {
  //   case Arch.x64:
  //   case Arch.arm64:
  //   case Arch.armv7l:
  //     // if (fs.existsSync(bindingFilePath)) {
  //     //   // console.log('rename binding file...')
  //     //   await fsPromises.rename(bindingFilePath, bindingBakFilePath)
  //     // }
  //     await replaceSqliteLib(arch)
  //     break

  //   default:
  //     // if (fs.existsSync(bindingFilePath)) return
  //     // console.log('restore binding file...')
  //     // await fsPromises.rename(bindingBakFilePath, bindingFilePath)
  //     await copyLib(arch)
  //     break
  // }
}
