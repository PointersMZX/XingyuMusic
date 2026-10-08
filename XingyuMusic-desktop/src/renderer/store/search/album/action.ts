import { markRawList } from '@common/utils/vueTools'
import music from '@renderer/utils/musicSdk'
import { sortInsert, similar } from '@common/utils/common'

import { sources, listInfos, type AlbumItem, type AlbumListInfo } from './state'

const musicSdk = music as unknown as Record<string, any>

interface SearchResult {
  list: AlbumItem[]
  allPage: number
  limit: number
  total: number
  source: LX.OnlineSource
}

const deduplication = (list: AlbumItem[]) => {
  const ids = new Set<string>()
  return list.filter(item => {
    const key = `${item.source}__${item.id}`
    if (ids.has(key)) return false
    ids.add(key)
    return true
  })
}

/**
 * 按搜索关键词重新排序列表
 * @param list 专辑列表
 * @param keyword 搜索关键词
 * @returns 排序后的列表
 */
const handleSortList = (list: AlbumItem[], keyword: string) => {
  let arr: any[] = []
  for (const item of list) {
    sortInsert(arr, {
      num: similar(keyword, item.name),
      data: item,
    })
  }
  return arr.map(item => item.data).reverse()
}

const setLists = (results: SearchResult[], page: number, text: string): AlbumItem[] => {
  let pages = []
  let totals = []
  let limit = 0
  let list: AlbumItem[] = []
  for (const source of results) {
    if (source.allPage < page) continue
    list.push(...source.list)
    pages.push(source.allPage)
    totals.push(source.total)
    limit = Math.max(source.limit, limit)
  }
  list = deduplication(markRawList(list))

  const listInfo = listInfos.all
  listInfo.maxPage = Math.max(0, ...pages)
  const total = Math.max(0, ...totals)
  if (page == 1 || (total && list.length)) listInfo.total = total
  else listInfo.total = limit * page
  listInfo.page = page
  listInfo.list = handleSortList(list, text)
  if (text && !list.length && page == 1) listInfo.noItemLabel = window.i18n.t('no_item')
  else listInfo.noItemLabel = ''
  return listInfo.list
}

const setList = (datas: SearchResult, page: number, text: string): AlbumItem[] => {
  const listInfo = listInfos[datas.source]!
  listInfo.list = deduplication(markRawList(datas.list))
  if (page == 1 || (datas.total && datas.list.length)) listInfo.total = datas.total
  else listInfo.total = datas.limit * page
  listInfo.maxPage = datas.allPage
  listInfo.page = page
  listInfo.limit = datas.limit
  if (text && !datas.list.length && page == 1) listInfo.noItemLabel = window.i18n.t('no_item')
  else listInfo.noItemLabel = ''
  return listInfo.list
}

export const resetListInfo = (sourceId: LX.OnlineSource | 'all'): [] => {
  let listInfo = listInfos[sourceId]
  if (!listInfo) return []
  listInfo.list = []
  listInfo.page = 0
  listInfo.maxPage = 0
  listInfo.total = 0
  listInfo.noItemLabel = ''
  return []
}

export const search = async(text: string, page: number, sourceId: LX.OnlineSource | 'all'): Promise<AlbumItem[]> => {
  const listInfo = listInfos[sourceId]
  if (!text) return resetListInfo(sourceId)
  const key = `${page}__${text}`
  if (sourceId == 'all') {
    listInfo!.noItemLabel = window.i18n.t('list__loading')
    listInfo!.key = key
    let task = []
    for (const source of sources) {
      if (source == 'all') continue
      task.push((musicSdk[source]?.album?.search(text, page, listInfos.all.limit) ?? Promise.reject(new Error('source not found: ' + source))).catch((error: any) => {
        console.log(error)
        return {
          allPage: 1,
          limit: 30,
          list: [],
          source,
          total: 0,
        }
      }))
    }
    return Promise.all(task).then((results: SearchResult[]) => {
      if (key != listInfo!.key) return []
      return setLists(results, page, text)
    })
  } else {
    if (listInfo?.key == key && listInfo?.list.length) return listInfo?.list
    const fn = musicSdk[sourceId]?.album?.search
    if (!fn) {
      // 该线路不支持专辑检索 → 显示「无」
      resetListInfo(sourceId)
      listInfo!.noItemLabel = window.i18n.t('search__none')
      return []
    }
    listInfo!.noItemLabel = window.i18n.t('list__loading')
    listInfo!.key = key
    return fn(text, page, listInfo!.limit).then((data: SearchResult) => {
      if (key != listInfo!.key) return []
      return setList(data, page, text)
    }).catch((error: any) => {
      resetListInfo(sourceId)
      listInfo!.noItemLabel = window.i18n.t('list__load_failed')
      console.log(error)
      throw error
    })
  }
}
