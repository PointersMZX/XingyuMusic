import RNFS from 'react-native-fs'
import { getMusicUrl } from '@/core/music/online'
import { saveToMediaStore } from '@/utils/nativeModules/mediaStore'

export interface DownloadTask {
  id: string
  name: string
  artist: string
  source: string
  quality: string
  status: 'downloading' | 'success' | 'error' | 'cancelled'
  progress: number
  speed: string
  error?: string
  mediaId?: string
}

interface Task extends DownloadTask {
  musicInfo: LX.Music.MusicInfoOnline
}

const tasks: Task[] = []
const jobs = new Map<string, { jobId: number }>()
let seq = 0

const notify = () => {
  global.state_event.downloadTasksUpdated([...tasks.map(({ musicInfo: _mi, ...task }) => task)])
}

const formatSpeed = (bytesPerSec: number) => {
  if (!bytesPerSec) return ''
  if (bytesPerSec > 1024 * 1024) return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`
  return `${Math.round(bytesPerSec / 1024)} KB/s`
}

const getExtByQuality = (quality: string, url: string) => {
  const extMatch = url.match(/\.([a-z0-9]{2,4})(\?|$)/i)
  if (extMatch) return extMatch[1].toLowerCase()
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

const getMimeByExt = (ext: string) => {
  switch (ext) {
    case 'flac': return 'audio/flac'
    case 'wav': return 'audio/wav'
    case 'm4a':
    case 'aac':
      return 'audio/mp4'
    default: return 'audio/mpeg'
  }
}

/**
 * 取歌曲可用的最高音质（音源 qualityList 与歌曲 _types 的交集）
 */
const getBestQuality = (musicInfo: LX.Music.MusicInfoOnline): LX.Quality => {
  const sourceQualitys: LX.Quality[] = (global.lx.qualityList?.[musicInfo.source] as LX.Quality[] | undefined) ?? []
  const order: LX.Quality[] = ['flac24bit', 'flac', '320k', '128k']
  for (const q of order) {
    if (sourceQualitys.includes(q)) return q
  }
  return '128k'
}

const runDownload = async(task: Task, quality: LX.Quality) => {
  try {
    const url = await getMusicUrl({
      musicInfo: task.musicInfo,
      quality,
      isRefresh: true,
      allowToggleSource: false,
    })
    task.quality = quality
    const ext = getExtByQuality(quality, url)
    const dir = `${RNFS.CachesDirectoryPath}/download`
    if (!await RNFS.exists(dir)) await RNFS.mkdir(dir)
    const toFile = `${dir}/${task.id}.${ext}`

    let lastTime = Date.now()
    let lastBytes = 0
    const result = RNFS.downloadFile({
      fromUrl: url,
      toFile,
      headers: {
        Referer: 'https://www.bilibili.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      progress(res) {
        if (task.status != 'downloading') return
        if (res.contentLength > 0) {
          task.progress = Math.min(99, Math.floor(res.bytesWritten / res.contentLength * 100))
        }
        const now = Date.now()
        if (now - lastTime > 1000) {
          task.speed = formatSpeed((res.bytesWritten - lastBytes) / ((now - lastTime) / 1000))
          lastTime = now
          lastBytes = res.bytesWritten
          notify()
        }
      },
    })
    jobs.set(task.id, { jobId: result.jobId })

    const res = await result.promise
    if (task.status != 'downloading') return
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`download failed: ${res.statusCode}`)
    }

    const mediaId = await saveToMediaStore(toFile, task.name, task.artist, getMimeByExt(ext))
    task.mediaId = mediaId
    task.progress = 100
    task.speed = ''
    task.status = 'success'
    jobs.delete(task.id)
    void RNFS.unlink(toFile).catch(() => {})
    notify()
  } catch (err: any) {
    if (task.status == 'cancelled') return
    task.status = 'error'
    task.error = err?.message ?? 'download failed'
    task.speed = ''
    jobs.delete(task.id)
    notify()
  }
}

/**
 * 下载一首歌（URL 走当前音源的 getMusicUrl 链路）
 * @param musicInfo 歌曲信息
 * @param quality 音质（缺省=音源可用的最高音质）
 */
export const createDownloadTask = (musicInfo: LX.Music.MusicInfoOnline, quality?: LX.Quality) => {
  const id = `dl_${Date.now()}_${seq++}`
  const task: Task = {
    id,
    name: musicInfo.name ?? '',
    artist: musicInfo.singer ?? '',
    source: musicInfo.source,
    quality: quality ?? getBestQuality(musicInfo),
    status: 'downloading',
    progress: 0,
    speed: '',
    musicInfo,
  }
  tasks.unshift(task)
  notify()
  void runDownload(task, quality ?? task.quality as LX.Quality)
}

export const cancelDownloadTask = (id: string) => {
  const task = tasks.find(t => t.id == id)
  if (!task || task.status != 'downloading') return
  task.status = 'cancelled'
  task.speed = ''
  const job = jobs.get(id)
  if (job) RNFS.stopDownload(job.jobId)
  jobs.delete(id)
  notify()
}

export const retryDownloadTask = (id: string) => {
  const task = tasks.find(t => t.id == id)
  if (!task || (task.status != 'error' && task.status != 'cancelled')) return
  task.status = 'downloading'
  task.progress = 0
  task.error = undefined
  notify()
  void runDownload(task, getBestQuality(task.musicInfo))
}

export const removeDownloadTask = (id: string) => {
  const index = tasks.findIndex(t => t.id == id)
  if (index < 0) return
  if (tasks[index].status == 'downloading') cancelDownloadTask(id)
  tasks.splice(index, 1)
  notify()
}

export const clearCompletedTasks = () => {
  for (let i = tasks.length - 1; i > -1; i--) {
    if (tasks[i].status == 'success') tasks.splice(i, 1)
  }
  notify()
}

export const getDownloadTasks = (): DownloadTask[] => {
  return tasks.map(({ musicInfo: _mi, ...task }) => task)
}
