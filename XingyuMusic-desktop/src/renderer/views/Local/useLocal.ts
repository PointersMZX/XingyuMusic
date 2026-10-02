import { ref } from '@common/utils/vueTools'
import { LIST_IDS } from '@common/constants'
import { appSetting, updateSetting } from '@renderer/store/setting'
import {
  getListMusics,
  addListMusics,
  overwriteListMusics,
} from '@renderer/store/list/action'
import { showSelectDialog } from '@renderer/utils/ipc'
import { proxyCallback } from '@renderer/worker/utils'

type LocalSortType = 'old' | 'new' | 'az' | 'za' | 'custom'

export const LOCAL_SORT_OPTIONS: LocalSortType[] = ['new', 'old', 'az', 'za', 'custom']

/**
 * 按默认排序方式对本地歌曲列表排序（custom=保持现状，不排序）
 */
const sortLocalList = (list: LX.Music.MusicInfo[], sortType: LocalSortType): LX.Music.MusicInfo[] => {
  if (sortType == 'custom' || !list.length) return list
  const arr = [...list]
  switch (sortType) {
    case 'old':
      // 由旧至新（按文件修改时间升序）
      arr.sort((a, b) => ((a.meta as LX.Music.MusicInfoLocal['meta']).mtime ?? 0) - ((b.meta as LX.Music.MusicInfoLocal['meta']).mtime ?? 0))
      break
    case 'new':
      // 由新至旧（按文件修改时间降序）
      arr.sort((a, b) => ((b.meta as LX.Music.MusicInfoLocal['meta']).mtime ?? 0) - ((a.meta as LX.Music.MusicInfoLocal['meta']).mtime ?? 0))
      break
    case 'az':
      arr.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
      break
    case 'za':
      arr.sort((a, b) => b.name.localeCompare(a.name, 'zh'))
      break
  }
  return arr
}

export default () => {
  const dirs = ref<string[]>([...(appSetting['local.dirs'] ?? [])])
  const sortType = ref<LocalSortType>(appSetting['local.sortType'] ?? 'new')
  const isScanning = ref(false)
  const scanProgress = ref('')
  const isShowDirs = ref(true)

  const setDirs = (list: string[]) => {
    dirs.value = [...list]
    updateSetting({ 'local.dirs': list })
  }

  const setSortType = (type: LocalSortType) => {
    sortType.value = type
    updateSetting({ 'local.sortType': type })
  }

  /**
   * 应用当前默认排序：读取本地列表 → 排序 → 覆盖持久化
   */
  const applySort = async() => {
    const list = await getListMusics(LIST_IDS.LOCAL)
    if (!list.length) return
    await overwriteListMusics({
      listId: LIST_IDS.LOCAL,
      musicInfos: sortLocalList(list, sortType.value),
    })
    window.app_event.myListUpdate([LIST_IDS.LOCAL])
  }

  /**
   * 选择目录并追加扫描（只扫新目录，结果去重后加入本地列表）
   */
  const addDir = async() => {
    const { canceled, filePaths } = await showSelectDialog({
      title: window.i18n.t('local_add_dir'),
      properties: ['openDirectory'],
    })
    if (canceled || !filePaths.length) return
    const dir = filePaths[0]
    if (dirs.value.includes(dir)) return
    setDirs([...dirs.value, dir])
    // 等正在进行的扫描结束再追加扫描，避免新目录被漏扫
    void waitScanIdle().then(() => {
      void scanAndAppend([dir])
    })
  }

  /**
   * 移除目录（不删除本地文件），然后重扫剩余目录；目录清空时同步清空本地列表
   */
  const removeDir = (index: number) => {
    if (index < 0 || index >= dirs.value.length) return
    setDirs(dirs.value.filter((_, i) => i != index))
    if (!dirs.value.length) {
      void waitScanIdle().then(async() => {
        await overwriteListMusics({ listId: LIST_IDS.LOCAL, musicInfos: [] })
        window.app_event.myListUpdate([LIST_IDS.LOCAL])
      })
      return
    }
    void waitScanIdle().then(rescan)
  }

  /**
   * 调整目录顺序
   */
  const moveDir = (index: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= dirs.value.length) return
    const list = [...dirs.value]
    const item = list.splice(index, 1)[0]
    list.splice(toIndex, 0, item)
    setDirs(list)
  }

  const scanAndAppend = async(dirsToScan: string[]) => {
    if (isScanning.value) return
    isScanning.value = true
    try {
      const existing = await getListMusics(LIST_IDS.LOCAL)
      const existingIds = new Set(existing.map(m => m.id))
      let foundCount = 0
      for (let d = 0; d < dirsToScan.length; d++) {
        const list = await window.lx.worker.main.scanLocalDir(dirsToScan[d], proxyCallback((progress) => {
          scanProgress.value = window.i18n.t('local_scanning', { dir: d + 1, total: dirsToScan.length, count: foundCount + progress.scanned })
        }))
        const fresh = list.filter(m => !existingIds.has(m.id))
        foundCount += fresh.length
        if (fresh.length) await addListMusics(LIST_IDS.LOCAL, fresh)
      }
      // 追加后按当前默认排序重排（custom=保持追加顺序）
      if (sortType.value != 'custom') await applySort()
      else window.app_event.myListUpdate([LIST_IDS.LOCAL])
    } finally {
      isScanning.value = false
      scanProgress.value = ''
    }
  }

  /**
   * 重新扫描全部目录（覆盖本地列表），并按当前默认排序整理
   */
  const rescan = async() => {
    if (!dirs.value.length || isScanning.value) return
    isScanning.value = true
    try {
      const list = await window.lx.worker.main.scanLocalDirs(dirs.value, proxyCallback((progress) => {
        scanProgress.value = window.i18n.t('local_scanning', { dir: progress.dirIndex + 1, total: progress.totalDirs, count: progress.scanned })
      }))
      await overwriteListMusics({
        listId: LIST_IDS.LOCAL,
        musicInfos: sortLocalList(list, sortType.value),
      })
      window.app_event.myListUpdate([LIST_IDS.LOCAL])
    } finally {
      isScanning.value = false
      scanProgress.value = ''
    }
  }

  /**
   * 初始化：配置了目录但本地列表为空时自动扫描
   */
  const init = async() => {
    if (!dirs.value.length) return
    const list = await getListMusics(LIST_IDS.LOCAL)
    if (!list.length) await rescan()
  }

  /**
   * 切换默认排序（选择器回调）：持久化并立即应用
   */
  const onSortChange = async(type: LocalSortType) => {
    if (sortType.value == type) return
    setSortType(type)
    if (type == 'custom') return
    await applySort()
  }

  /**
   * 等待正在进行的扫描结束（500ms 轮询）
   */
  const waitScanIdle = async() => new Promise<void>(resolve => {
    const tick = () => {
      if (isScanning.value) setTimeout(tick, 500)
      else resolve()
    }
    tick()
  })

  return {
    dirs,
    sortType,
    LOCAL_SORT_OPTIONS,
    isScanning,
    scanProgress,
    isShowDirs,
    addDir,
    removeDir,
    moveDir,
    rescan,
    init,
    onSortChange,
  }
}
