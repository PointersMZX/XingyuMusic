import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import type { InitState as SearchState } from '@/store/search/state'
import type { Source as MusicSource } from '@/store/search/music/state'
import type { Source as SongListSource } from '@/store/search/songlist/state'
import type { Source as SingerSource } from '@/store/search/singer/state'
import type { Source as AlbumSource } from '@/store/search/album/state'
import MusicList, { type MusicListType } from './MusicList'
import BlankView, { type BlankViewType } from './BlankView'
import SonglistList from './SonglistList'
import SingerList, { type SingerListType } from './SingerList'
import AlbumList, { type AlbumListType } from './AlbumList'

type AnySource = MusicSource | SongListSource | SingerSource | AlbumSource

interface ListProps {
  onSearch: (keyword: string) => void
}
export interface ListType {
  loadList: (text: string, source: AnySource, type: SearchState['searchType']) => void
}

export default forwardRef<ListType, ListProps>(({ onSearch }, ref) => {
  const [listType, setListType] = useState<SearchState['searchType']>('music')
  const [showBlankView, setShowListView] = useState(true)
  const listRef = useRef<MusicListType & SingerListType & AlbumListType>(null)
  const blankViewRef = useRef<BlankViewType>(null)

  useImperativeHandle(ref, () => ({
    loadList(text, source, type) {
      if (text) {
        setShowListView(false)
        setListType(type)
        // const listDetailInfo = searchMusicState.listDetailInfo
        requestAnimationFrame(() => {
          listRef.current?.loadList(text, source)
        })
      } else {
        setShowListView(true)
        requestAnimationFrame(() => {
          blankViewRef.current?.show(source)
        })
      }
    },
  }), [])

  return (
    showBlankView
      ? <BlankView ref={blankViewRef} onSearch={onSearch} />
      : listType == 'songlist'
        ? <SonglistList ref={listRef} />
        : listType == 'singer'
          ? <SingerList ref={listRef} />
          : listType == 'album'
            ? <AlbumList ref={listRef} />
            : <MusicList ref={listRef} />
  )
})
