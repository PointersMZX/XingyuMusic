import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'
import { mainHandle } from '@common/mainIpc'
import { joinPath, checkAndCreateDir, getFileStats, removeFile } from '@common/utils/nodejs'
import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'

/**
 * 边听边缓存（listen-cache）
 * 播放中的在线歌曲后台落盘到 `dataPath/listen_cache/{source}_{id}.{ext}`，
 * 再次播放直接读盘（绕过取 URL）；受体积上限约束，超量按最老文件 LRU 驱逐。
 */

const cacheDir = () => joinPath(global.lxDataPath, 'listen_cache')
const safe = (s: string) => String(s).replace(/[^\w.-]/g, '_')
const pathOf = (source: string, id: string, ext: string) => joinPath(cacheDir(), `${safe(source)}_${safe(id)}.${ext}`)

/** 流式下载到文件（跟随最多 3 次重定向） */
const downloadToFile = (url: string, dest: string, redirect = 0): Promise<void> => {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    lib.get(url, (res) => {
      const status = res.statusCode ?? 0
      if ((status === 301 || status === 302 || status === 303 || status === 307 || status === 308) && res.headers.location && redirect < 3) {
        res.destroy()
        return resolve(downloadToFile(res.headers.location, dest, redirect + 1))
      }
      if (status !== 200) {
        res.destroy()
        return reject(new Error(`download status ${status}`))
      }
      const out = fs.createWriteStream(dest)
      res.pipe(out)
      out.on('finish', () => { out.close(); resolve() })
      out.on('error', reject)
      res.on('error', reject)
    }).on('error', reject)
  })
}

/** 超量驱逐：按 mtime 从旧到新删除，直到总量 ≤ limitMB */
const enforceCap = async(limitMB: number) => {
  const files = await fs.promises.readdir(cacheDir()).catch(() => [] as string[])
  const items: { path: string, size: number, mtime: number }[] = []
  for (const name of files) {
    const p = joinPath(cacheDir(), name)
    const st = await getFileStats(p)
    if (st) items.push({ path: p, size: st.size, mtime: st.mtimeMs })
  }
  let total = items.reduce((s, i) => s + i.size, 0)
  if (total <= limitMB * 1024 * 1024) return
  items.sort((a, b) => a.mtime - b.mtime) // 最老在前
  for (const item of items) {
    if (total <= limitMB * 1024 * 1024) break
    await removeFile(item.path)
    total -= item.size
  }
}

export default () => {
  mainHandle<{ source: string, id: string, ext: string }, { exists: boolean, path: string, ext: string }>(
    WIN_MAIN_RENDERER_EVENT_NAME.listen_cache_exists,
    async({ params: { source, id, ext } }) => {
      const tryExts = [ext, 'mp3', 'm4a', 'flac', 'ogg', 'wav', 'aac', 'mp4']
      for (const e of tryExts) {
        if (!e || e === '.bin') continue
        const p = pathOf(source, id, e)
        if (await getFileStats(p)) return { exists: true, path: p, ext: e }
      }
      return { exists: false, path: '', ext: '' }
    },
  )

  mainHandle<{ source: string, id: string, url: string, ext: string, limitMB?: number }, boolean>(
    WIN_MAIN_RENDERER_EVENT_NAME.listen_cache_download,
    async({ params: { source, id, url, ext, limitMB } }) => {
      if (!url || !url.startsWith('http')) return false
      try {
        await checkAndCreateDir(cacheDir())
        await downloadToFile(url, pathOf(source, id, ext))
        await enforceCap(limitMB ?? 512)
        return true
      } catch {
        return false
      }
    },
  )

  mainHandle<{ limitMB?: number }, boolean>(
    WIN_MAIN_RENDERER_EVENT_NAME.listen_cache_clean,
    async({ params: { limitMB } }) => {
      try {
        await enforceCap(limitMB ?? 512)
        return true
      } catch {
        return false
      }
    },
  )
}
