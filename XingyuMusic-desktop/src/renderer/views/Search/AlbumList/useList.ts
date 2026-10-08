import { ref } from '@common/utils/vueTools'
import { addHistoryWord } from '@renderer/store/search/action'
import type { AlbumListInfo, AlbumItem } from '@renderer/store/search/album'
import { search as searchAlbum, listInfos } from '@renderer/store/search/album'

export type SearchSource = LX.OnlineSource | 'all'

export default () => {
  const listRef = ref<any>(null)

  const listInfo = ref<AlbumListInfo>({
    page: 1,
    maxPage: 0,
    limit: 30,
    total: 0,
    list: [],
    key: null,
    noItemLabel: '',
  })

  const search = (text: string, source: SearchSource, page: number) => {
    listInfo.value = listInfos[source] as AlbumListInfo
    if (text.length) void addHistoryWord(text)
    void searchAlbum(text, page, source).then((list: AlbumItem[]) => {
      if (list.length) {
        setTimeout(() => {
          if (listRef.value) listRef.value.scrollTo(0)
        })
      }
    })
  }

  return {
    listRef,
    listInfo,
    search,
  }
}
