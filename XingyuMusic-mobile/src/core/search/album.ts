import searchAlbumState, { type Source, type AlbumItem } from '@/store/search/album/state'
import searchAlbumActions, { type SearchResult } from '@/store/search/album/action'
import music from '@/utils/musicSdk'
const musicSdk = music as unknown as Record<string, any>

export const setSource: typeof searchAlbumActions['setSource'] = (source) => {
  searchAlbumActions.setSource(source)
}
export const setSearchText: typeof searchAlbumActions['setSearchText'] = (text) => {
  searchAlbumActions.setSearchText(text)
}

export const setListInfo: typeof searchAlbumActions.setListInfo = (result, page, text) => {
  return searchAlbumActions.setListInfo(result, page, text)
}

export const clearListInfo = (source: Source) => {
  searchAlbumActions.clearListInfo(source)
}

export const search = async(text: string, page: number, sourceId: Source): Promise<AlbumItem[]> => {
  const listInfo = searchAlbumState.listInfos[sourceId]!
  if (!text) return []
  const key = `${page}__${text}`
  if (sourceId == 'all') {
    listInfo.key = key
    let task = []
    for (const source of searchAlbumState.sources) {
      if (source == 'all') continue
      task.push(((musicSdk[source]?.album?.search(text, page, searchAlbumState.listInfos.all.limit) as Promise<SearchResult>) ?? Promise.reject(new Error('source not found: ' + source))).catch((error: any) => {
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
      if (key != listInfo.key) return []
      setSearchText(text)
      setSource(sourceId)
      return setListInfo(results, page, text)
    })
  } else {
    if (listInfo?.key == key && listInfo?.list.length) return listInfo?.list
    listInfo.key = key
    return (musicSdk[sourceId]?.album?.search(text, page, listInfo.limit).then((data: SearchResult) => {
      if (key != listInfo.key) return []
      return setListInfo(data, page, text)
    }) ?? Promise.reject(new Error('source not found: ' + sourceId))).catch((err: any) => {
      if (listInfo.list.length && page == 1) clearListInfo(sourceId)
      throw err
    })
  }
}
