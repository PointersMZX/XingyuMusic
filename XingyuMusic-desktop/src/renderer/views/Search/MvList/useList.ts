import { ref } from '@common/utils/vueTools'
import { addHistoryWord } from '@renderer/store/search/action'
import type { MvListInfo, MvItem } from '@renderer/store/search/mv'
import { search as searchMv, listInfos } from '@renderer/store/search/mv'

export type SearchSource = LX.OnlineSource | 'all'

export default () => {
  const listRef = ref<any>(null)

  const listInfo = ref<MvListInfo>({
    page: 1,
    maxPage: 0,
    limit: 30,
    total: 0,
    list: [],
    key: null,
    noItemLabel: '',
  })

  const search = (text: string, source: SearchSource, page: number) => {
    listInfo.value = listInfos[source] as MvListInfo
    if (text.length) void addHistoryWord(text)
    void searchMv(text, page, source).then((list: MvItem[]) => {
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
