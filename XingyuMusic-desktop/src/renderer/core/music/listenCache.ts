import { appSetting } from '@renderer/store/setting'
import { encodePath } from '@common/utils/common'
import { listenCacheExists, listenCacheDownload } from '@renderer/utils/ipc'

/** 由 URL 路径推导音频扩展名，回退到按档位猜 */
export const extForAudio = (url: string, quality?: LX.Quality): string => {
  const m = (url.split('?')[0].match(/\.(mp3|m4a|flac|ogg|wav|aac|mp4)$/i) || [])[1]
  if (m) return m.toLowerCase()
  switch (quality) {
    case 'flac':
    case 'flac24bit':
      return 'flac'
    case '192k':
      return 'm4a'
    default:
      return 'mp3'
  }
}

/**
 * 边听边缓存 —— 读盘短路。
 * 若该曲已有缓存文件，返回 `file://` 本地路径（下次播放秒开、可离线）；否则返回 null。
 */
export const getListenCacheUrl = async(musicInfo: LX.Music.MusicInfoOnline): Promise<string | null> => {
  if (!appSetting['player.listenCacheEnabled']) return null
  try {
    const res = await listenCacheExists(musicInfo.source, musicInfo.id, '')
    if (!res.exists || !res.path) return null
    return encodePath(res.path)
  } catch {
    return null
  }
}

/**
 * 边听边缓存 —— 后台落盘（fire-and-forget，不阻塞播放）。
 * 播放某在线歌曲时调用：把当前 URL 的完整文件下载到缓存目录，受体积上限约束。
 */
export const startListenCache = (musicInfo: LX.Music.MusicInfoOnline, url: string, quality?: LX.Quality) => {
  if (!appSetting['player.listenCacheEnabled']) return
  if (!url || !url.startsWith('http')) return
  const ext = extForAudio(url, quality)
  void listenCacheDownload(musicInfo.source, musicInfo.id, url, ext, appSetting['player.listenCacheLimitMB']).catch(() => {})
}
