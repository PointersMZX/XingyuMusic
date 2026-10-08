import { sortInsert, similar } from '@/utils/common'

import type { InitState, SingerItem, Source } from './state'
import state from './state'

export interface SearchResult {
  list: SingerItem[]
  allPage: number
  limit: number
  total: number
  source: LX.OnlineSource
}

/**
 * 按搜索关键词重新排序列表
 * @param list 歌手列表
 * @param keyword 搜索关键词
 * @returns 排序后的列表
 */
const handleSortList = (list: SingerItem[], keyword: string) => {
  let arr: any[] = []
  for (const item of list) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    sortInsert(arr, {
      num: similar(keyword, item.name),
      data: item,
    })
  }
  return arr.map(item => item.data).reverse()
}

const deduplication = (list: SingerItem[]) => {
  const ids = new Set<string>()
  return list.filter(item => {
    const key = `${item.source}__${item.id}`
    if (ids.has(key)) return false
    ids.add(key)
    return true
  })
}

const setLists = (results: SearchResult[], page: number, text: string): SingerItem[] => {
  let pages = []
  let totals = []
  let limit = 0
  let list: SingerItem[] = []
  for (const source of results) {
    state.maxPages[source.source] = source.allPage
    limit = Math.max(source.limit, limit)
    if (source.allPage < page) continue
    list.push(...source.list)
    pages.push(source.allPage)
    totals.push(source.total)
  }
  list = deduplication(list)

  let listInfo = state.listInfos.all
  listInfo.maxPage = Math.max(0, ...pages)
  const total = Math.max(0, ...totals)
  if (page == 1 || (total && list.length)) listInfo.total = total
  else listInfo.total = limit * page
  listInfo.page = page
  listInfo.list = handleSortList(list, text)
  state.source = 'all'
  return listInfo.list
}

const setList = (datas: SearchResult, page: number, text: string): SingerItem[] => {
  let listInfo = state.listInfos[datas.source]!
  listInfo.list = deduplication(datas.list)
  if (page == 1 || (datas.total && datas.list.length)) listInfo.total = datas.total
  else listInfo.total = datas.limit * page
  listInfo.maxPage = datas.allPage
  listInfo.page = page
  listInfo.limit = datas.limit
  state.source = datas.source
  return listInfo.list
}

export default {
  setSource(source: InitState['source']) {
    state.source = source
  },
  setSearchText(searchText: InitState['searchText']) {
    state.searchText = searchText
  },
  setListInfo(result: SearchResult | SearchResult[], page: number, text: string) {
    if (Array.isArray(result)) {
      return setLists(result, page, text)
    } else {
      return setList(result, page, text)
    }
  },
  clearListInfo(sourceId: Source) {
    let listInfo = state.listInfos[sourceId]!
    listInfo.page = 1
    listInfo.limit = 30
    listInfo.total = 0
    listInfo.list = []
    listInfo.key = null
  },
}
