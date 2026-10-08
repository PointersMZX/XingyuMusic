import { ref } from '@common/utils/vueTools'
import { addHistoryWord } from '@renderer/store/search/action'
import type { SingerListInfo, SingerItem } from '@renderer/store/search/singer'
import { search as searchSinger, listInfos } from '@renderer/store/search/singer'

export type SearchSource = LX.OnlineSource | 'all'

export default () => {
  const listRef = ref<any>(null)

  const listInfo = ref<SingerListInfo>({
    page: 1,
    maxPage: 0,
    limit: 30,
    total: 0,
    list: [],
    key: null,
    noItemLabel: '',
  })

  const search = (text: string, source: SearchSource, page: number) => {
    listInfo.value = listInfos[source] as SingerListInfo
    if (text.length) void addHistoryWord(text)
    void searchSinger(text, page, source).then((list: SingerItem[]) => {
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
