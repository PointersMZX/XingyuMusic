import RNFS from 'react-native-fs'
import settingState from '@/store/setting/state'

/**
 * 边听边缓存（listen-cache）
 * 播放中的在线歌曲后台落盘到 Caches/listen_cache/{source}_{id}.{ext}，
 * 再次播放直接读盘（秒开 + 可离线）；超量按最老文件 LRU 驱逐。
 */

const LIMIT_MB = 512
const cacheDir = () => `${RNFS.CachesDirectoryPath}/listen_cache`
const safe = (s: string) => String(s).replace(/[^\w.-]/g, '_')
const keyOf = (source: string, id: string) => `${safe(source)}_${safe(id)}`

const extForAudio = (url: string, quality?: string): string => {
  const m = url.match(/\.([a-z0-9]{2,4})(\?|$)/i)
  if (m) return m[1].toLowerCase()
  switch (quality) {
    case 'flac':
    case 'flac24bit':
      return 'flac'
    case 'wav':
      return 'wav'
    default:
      return 'mp3'
  }
}

const enabled = () => !!settingState.setting['player.listenCacheEnabled']

/** 命中缓存返回本地可播文件路径，否则 null */
export const getListenCacheUrl = async(musicInfo: LX.Music.MusicInfoOnline): Promise<string | null> => {
  if (!enabled()) return null
  try {
    const dir = cacheDir()
    if (!await RNFS.exists(dir)) return null
    const files = await RNFS.readDir(dir)
    const key = keyOf(musicInfo.source, musicInfo.id)
    for (const f of files) {
      if (f.isFile() && f.name.startsWith(`${key}.`)) return f.path
    }
    return null
  } catch {
    return null
  }
}

/** 后台把完整文件落盘（fire-and-forget，不阻塞播放；保留文件供再播，不进媒体库） */
export const startListenCache = (musicInfo: LX.Music.MusicInfoOnline, url: string, quality?: string) => {
  if (!enabled()) return
  if (!url || !url.startsWith('http')) return
  void (async() => {
    try {
      const dir = cacheDir()
      if (!await RNFS.exists(dir)) await RNFS.mkdir(dir)
      const ext = extForAudio(url, quality)
      const toFile = `${dir}/${keyOf(musicInfo.source, musicInfo.id)}.${ext}`
      // 已有则跳过
      if (await RNFS.exists(toFile)) return
      const result = RNFS.downloadFile({
        fromUrl: url,
        toFile,
        headers: {
          Referer: 'https://www.bilibili.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      })
      const res = await result.promise
      if (res.statusCode < 200 || res.statusCode >= 300) return
      await enforceCap()
    } catch {
      /* best-effort */
    }
  })()
}

/** 超量驱逐：按修改时间从旧到新删除，直到总量 ≤ 上限 */
const enforceCap = async() => {
  try {
    const dir = cacheDir()
    if (!await RNFS.exists(dir)) return
    const files = (await RNFS.readDir(dir)).filter((f) => f.isFile())
    let total = files.reduce((s, f) => s + f.size, 0)
    const limit = LIMIT_MB * 1024 * 1024
    if (total <= limit) return
    files.sort((a, b) => (a.mtime?.getTime() ?? 0) - (b.mtime?.getTime() ?? 0))
    for (const f of files) {
      if (total <= limit) break
      await RNFS.unlink(f.path).catch(() => {})
      total -= f.size
    }
  } catch {
    /* best-effort */
  }
}
