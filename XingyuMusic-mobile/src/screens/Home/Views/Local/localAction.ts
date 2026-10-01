import { LIST_IDS } from '@/config/constant'
import { selectManagedFolder, removeManagedFolder, readDir, type FileType } from '@/utils/fs'
import { readMetadata } from '@/utils/localMediaMetadata'
import { getLocalDirs, saveLocalDirs } from '@/utils/data'
import { getListMusics } from '@/utils/listManage'
import { addListMusics, overwriteListMusics, updateListMusics, setFetchingListStatus } from '@/core/list'
import { toast } from '@/utils/tools'
import { buildLocalMusicInfoByFilePath, buildLocalMusicInfo } from '../Mylist/MyList/listAction'

export const LOCAL_LIST_ID = LIST_IDS.LOCAL

type ProgressFn = (scanned: number, total: number) => void

/**
 * 递归收集目录下的音频文件（scanAudioFiles 只扫一层，子目录需要自己递归）
 * @param dir 目录
 * @param files 收集结果
 */
const collectAudioFiles = async(dir: string, files: FileType[] = []): Promise<FileType[]> => {
  let entries: FileType[]
  try {
    entries = await readDir(dir)
  } catch {
    // 目录不可读/授权失效时跳过
    return files
  }
  for (const entry of entries) {
    if (entry.isDirectory) {
      await collectAudioFiles(entry.path, files)
    } else if (entry.isFile && (entry.mimeType?.startsWith('audio/') || (entry.name ?? '').toLowerCase().endsWith('.ogg'))) {
      files.push(entry)
    }
  }
  return files
}

/**
 * 批量补充本地歌曲元数据（占位歌曲 → 完整标签），只持久化真正读到标签的歌曲
 * @param files 需要读元数据的文件
 * @param onProgress 进度回调（可选）
 */
const enrichLocalMusics = async(files: FileType[], onProgress?: ProgressFn): Promise<void> => {
  const existing = await getListMusics(LOCAL_LIST_ID)
  const existingMap = new Map(existing.map(m => [m.id, m]))
  const updates: Array<{ id: string, musicInfo: LX.Music.MusicInfo }> = []
  let i = 0
  for (const file of files) {
    onProgress?.(++i, files.length)
    const cached = existingMap.get(file.path)
    // 已有元数据（interval 非空）的不再重复读
    if (cached?.interval != null) continue
    const metadata = await readMetadata(file.path).catch(() => null)
    if (!metadata) continue
    if (!cached) continue
    // 内存中的对象就是列表里的同一引用，原地替换字段
    Object.assign(cached, buildLocalMusicInfo(file.path, metadata))
    updates.push({ id: LOCAL_LIST_ID, musicInfo: cached })
  }
  if (updates.length) await updateListMusics(updates)
}

/**
 * 启动/进页时调用：把已保存的本地列表注册进内存（播放器连播依赖），不触发扫描
 */
export const registerLocalMusic = async(): Promise<void> => {
  await getListMusics(LOCAL_LIST_ID)
}

/**
 * 重新扫描全部目录（覆盖本地列表），可传进度回调
 * @param onProgress 进度回调（可选）
 * @returns 扫描到的歌曲总数
 */
export const rescanLocalMusic = async(onProgress?: ProgressFn): Promise<number> => {
  const dirs = await getLocalDirs()
  if (!dirs.length) {
    await overwriteListMusics(LOCAL_LIST_ID, [])
    return 0
  }
  setFetchingListStatus(LOCAL_LIST_ID, true)
  const files: FileType[] = []
  for (const dir of dirs) await collectAudioFiles(dir, files)

  // 有缓存元数据的直接复用，其余先占位
  const cached = await getListMusics(LOCAL_LIST_ID)
  const cachedMap = new Map<string, LX.Music.MusicInfo>()
  for (const item of cached) cachedMap.set(item.id, item)
  const needEnrich: FileType[] = []
  const musics: LX.Music.MusicInfoLocal[] = files.map(file => {
    const info = cachedMap.get(file.path)
    if (info?.interval != null) return info as LX.Music.MusicInfoLocal
    needEnrich.push(file)
    return buildLocalMusicInfoByFilePath(file)
  })
  await overwriteListMusics(LOCAL_LIST_ID, musics)
  // 后台补全元数据
  void enrichLocalMusics(needEnrich, onProgress)
    .finally(() => { setFetchingListStatus(LOCAL_LIST_ID, false) })
  return musics.length
}

/**
 * 选择目录并加入（SAF 持久授权），只扫描新目录并追加
 */
export const addLocalDir = async(): Promise<boolean> => {
  const folder = await selectManagedFolder(true)
  if (!folder) return false
  const dirs = await getLocalDirs()
  if (dirs.includes(folder.path)) {
    toast(global.i18n.t('local_dir_tip'))
    return true
  }
  dirs.push(folder.path)
  await saveLocalDirs(dirs)

  setFetchingListStatus(LOCAL_LIST_ID, true)
  const files = await collectAudioFiles(folder.path)
  if (files.length) {
    // addListMusics 自带按 id 去重
    await addListMusics(LOCAL_LIST_ID, files.map(buildLocalMusicInfoByFilePath), 'bottom')
    void enrichLocalMusics(files)
  }
  setFetchingListStatus(LOCAL_LIST_ID, false)
  toast(global.i18n.t(files.length ? 'local_scan_result' : 'list_select_local_file_empty_tip', { count: files.length }), 'long')
  return true
}

/**
 * 移除目录（释放 SAF 持久授权，不删除本地文件），然后重扫剩余目录
 */
export const removeLocalDir = async(index: number): Promise<void> => {
  const dirs = await getLocalDirs()
  if (index < 0 || index >= dirs.length) return
  const removed = dirs.splice(index, 1)[0]
  await saveLocalDirs(dirs)
  await removeManagedFolder(removed).catch(() => { /* 授权已失效时忽略 */ })
  await rescanLocalMusic()
}

/**
 * 调整目录顺序
 */
export const moveLocalDir = async(from: number, to: number): Promise<void> => {
  const dirs = await getLocalDirs()
  if (from < 0 || from >= dirs.length || to < 0 || to >= dirs.length || from == to) return
  const item = dirs.splice(from, 1)[0]
  dirs.splice(to, 0, item)
  await saveLocalDirs(dirs)
}
