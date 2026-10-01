import { readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { createLocalMusicInfo } from '@renderer/utils/music'

const AUDIO_EXTS = new Set(['mp3', 'flac', 'ogg', 'oga', 'wav', 'm4a'])

export interface LocalScanProgress {
  /**
   * 当前扫描的目录序号（从0开始）
   */
  dirIndex: number
  /**
   * 目录总数
   */
  totalDirs: number
  /**
   * 当前目录已解析的文件数
   */
  scanned: number
  /**
   * 当前目录音频文件总数
   */
  totalFiles: number
}

/**
 * 递归收集目录下的音频文件
 * @param dir 目录
 * @param files 收集结果
 */
const collectAudioFiles = async(dir: string, files: string[]) => {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    // 目录不可读/不存在时跳过
    return
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      await collectAudioFiles(full, files)
    } else if (entry.isFile() && AUDIO_EXTS.has(extname(entry.name).replace(/^\./, '').toLowerCase())) {
      files.push(full)
    }
  }
}

/**
 * 扫描单个目录，解析元数据
 * @param dir 目录
 * @param onProgress 进度回调（可选）
 * @returns 本地歌曲信息列表
 */
export const scanLocalDir = async(dir: string, onProgress?: (progress: LocalScanProgress) => void): Promise<LX.Music.MusicInfoLocal[]> => {
  const files: string[] = []
  await collectAudioFiles(dir, files)
  const list: LX.Music.MusicInfoLocal[] = []
  for (let i = 0; i < files.length; i++) {
    const musicInfo = await createLocalMusicInfo(files[i])
    if (musicInfo) list.push(musicInfo)
    onProgress?.({
      dirIndex: 0,
      totalDirs: 1,
      scanned: i + 1,
      totalFiles: files.length,
    })
  }
  return list
}

/**
 * 扫描多个目录，结果按目录顺序合并
 * @param dirs 目录列表（顺序即结果顺序）
 * @param onProgress 进度回调（可选）
 * @returns 本地歌曲信息列表
 */
export const scanLocalDirs = async(dirs: string[], onProgress?: (progress: LocalScanProgress) => void): Promise<LX.Music.MusicInfoLocal[]> => {
  const result: LX.Music.MusicInfoLocal[] = []
  const totalDirs = dirs.length
  for (let d = 0; d < totalDirs; d++) {
    const list = await scanLocalDir(dirs[d], progress => {
      onProgress?.({
        dirIndex: d,
        totalDirs,
        scanned: progress.scanned,
        totalFiles: progress.totalFiles,
      })
    })
    result.push(...list)
  }
  return result
}
