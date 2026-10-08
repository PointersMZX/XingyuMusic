import { ref } from '@common/utils/vueTools'
import { addHistoryWord } from '@renderer/store/search/action'
import type { LyricListInfo, LyricItem } from '@renderer/store/search/lyric'
import { search as searchLyric, listInfos } from '@renderer/store/search/lyric'

export type SearchSource = LX.OnlineSource | 'all'

export default () => {
  const listRef = ref<any>(null)

  const listInfo = ref<LyricListInfo>({
    page: 1,
    maxPage: 0,
    limit: 30,
    total: 0,
    list: [],
    key: null,
    noItemLabel: '',
  })

  const search = (text: string, source: SearchSource, page: number) => {
    listInfo.value = listInfos[source] as LyricListInfo
    if (text.length) void addHistoryWord(text)
    void searchLyric(text, page, source).then((list: LyricItem[]) => {
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
