import { LIST_IDS } from '@common/constants'
import { ref } from '@common/utils/vueTools'
import { playList } from '@renderer/core/player/action'
import { addListMusics, setTempList } from '@renderer/store/list/action'
import { addHistoryWord } from '@renderer/store/search/action'
// import { useI18n } from '@renderer/plugins/i18n'
// import { } from '@renderer/store/search/state'
import { search as searchMusic, listInfos, type ListInfo } from '@renderer/store/search/music'
import { assertApiSupport } from '@renderer/store/utils'

export type SearchSource = LX.OnlineSource | 'all'

export default () => {
  const listRef = ref<any>(null)

  const listInfo = ref<ListInfo>({
    page: 1,
    maxPage: 0,
    limit: 30,
    total: 0,
    list: [],
    key: null,
    noItemLabel: '',
  })

  const search = (text: string, source: SearchSource, page: number) => {
    listInfo.value = listInfos[source] as ListInfo
    if (text.length) void addHistoryWord(text)
    void searchMusic(text, page, source).then((list: LX.Music.MusicInfo[]) => {
      if (list.length) {
        setTimeout(() => {
          if (listRef.value) listRef.value.scrollToTop()
        })
      }
    })
  }

  const handlePlayList = (index: number) => {
    const targetSong = listInfo.value.list[index]

    if (!assertApiSupport(targetSong.source)) return

    // 「我的列表」后台写入，不阻塞播放（治"每次点开要缓存"导致的停顿）
    void addListMusics(LIST_IDS.DEFAULT, [targetSong])
    // 立即以当前搜索结果列表为队列播放，不等待 DB 写库完成
    void setTempList('search_play', listInfo.value.list as LX.Music.MusicInfoOnline[]).then(() => {
      playList(LIST_IDS.TEMP, index)
    })
  }

  return {
    listRef,
    listInfo,
    search,
    handlePlayList,
  }
}
