import { LIST_IDS } from '@/config/constant'
import { selectManagedFolder, removeManagedFolder, readDir, type FileType } from '@/utils/fs'
import { readMetadata } from '@/utils/localMediaMetadata'
import { getLocalDirs, saveLocalDirs } from '@/utils/data'
import { getListMusics } from '@/utils/listManage'
import { addListMusics, overwriteListMusics, updateListMusics, setFetchingListStatus } from '@/core/list'
import { toast } from '@/utils/tools'
import { formatPlayTime2 } from '@/utils'
import settingState from '@/store/setting/state'
import { buildLocalMusicInfoByFilePath } from '../Mylist/MyList/listAction'

export const LOCAL_LIST_ID = LIST_IDS.LOCAL
export const LOCAL_SORT_OPTIONS: LX.LocalSortType[] = ['new', 'old', 'az', 'za', 'custom']

type ProgressFn = (scanned: number, total: number) => void

const getLocalSortType = (): LX.LocalSortType => settingState.setting['local.sortType'] ?? 'new'
const mtimeOf = (m: LX.Music.MusicInfo): number => ((m.meta as LX.Music.MusicInfoLocal['meta']).mtime ?? 0)

/**
 * 按默认排序方式对本地歌曲列表排序（custom=保持现状）
 */
const sortLocalSongs = (list: LX.Music.MusicInfo[], sortType: LX.LocalSortType): LX.Music.MusicInfo[] => {
  if (sortType == 'custom' || !list.length) return list
  const arr = [...list]
  switch (sortType) {
    case 'old': arr.sort((a, b) => mtimeOf(a) - mtimeOf(b)); break // 由旧至新
    case 'new': arr.sort((a, b) => mtimeOf(b) - mtimeOf(a)); break // 由新至旧
    case 'az': arr.sort((a, b) => a.name.localeCompare(b.name, 'zh')); break
    case 'za': arr.sort((a, b) => b.name.localeCompare(a.name, 'zh')); break
  }
  return arr
}

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
 * 批量补充本地歌曲「时长 + 文件修改时间」（v1.0.1：只取文件名与时长，不再解析专辑/歌手/歌名标签，也不读封面）
 * @param files 需要补时长的文件
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
    if (!cached) continue
    const meta = cached.meta as LX.Music.MusicInfoLocal['meta']
    // 记录文件修改时间（用于按新旧排序）
    if (file.lastModified) meta.mtime = file.lastModified
    // 仅补时长（歌名=文件名，已在此前占位时写入）
    if (cached.interval == null) {
      const metadata = await readMetadata(file.path).catch(() => null)
      if (metadata?.interval != null) cached.interval = formatPlayTime2(metadata.interval)
    }
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
 * 应用当前默认排序（读取列表 → 排序 → 覆盖持久化）
 */
export const applyLocalSort = async(sortType: LX.LocalSortType = getLocalSortType()): Promise<void> => {
  const list = await getListMusics(LOCAL_LIST_ID)
  if (!list.length) return
  await overwriteListMusics(LOCAL_LIST_ID, sortLocalSongs(list, sortType))
}

/**
 * 重新扫描全部目录（覆盖本地列表），并按当前默认排序整理
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

  // 有缓存时长的直接复用，其余先占位（歌名=文件名，mtime 已随占位写入）
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
  await overwriteListMusics(LOCAL_LIST_ID, sortLocalSongs(musics, getLocalSortType()))
  // 后台补全时长
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
    // 追加后按当前默认排序重排（custom=保持追加顺序）
    if (getLocalSortType() != 'custom') await applyLocalSort()
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
