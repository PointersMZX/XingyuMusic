import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { FlatList, View, RefreshControl, type FlatListProps } from 'react-native'

import { search } from '@/core/search/singer'
import searchSingerState, { type Source, type SingerItem } from '@/store/search/singer/state'
import { useLayout } from '@/utils/hooks'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'

type Status = 'loading' | 'refreshing' | 'end' | 'error' | 'idle'

export interface SingerListType {
  loadList: (text: string, source: Source) => void
}

export default forwardRef<SingerListType, {}>((props, ref) => {
  const [list, setList] = useState<SingerItem[]>([])
  const [showSource, setShowSource] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const searchInfoRef = useRef<{ text: string, source: Source }>({ text: '', source: 'kw' })
  const isUnmountedRef = useRef(false)
  const flatListRef = useRef<FlatList>(null)
  const { onLayout, width } = useLayout()
  const theme = useTheme()
  const t = useI18n()

  useImperativeHandle(ref, () => ({
    loadList(text, source) {
      setList([])
      setShowSource(source == 'all')
      setStatus('loading')
      const page = 1
      searchInfoRef.current.text = text
      searchInfoRef.current.source = source
      search(text, page, source).then((newList) => {
        if (isUnmountedRef.current) return
        setList(newList)
        setStatus(searchSingerState.listInfos[searchSingerState.source]!.maxPage <= page ? 'end' : 'idle')
      }).catch(() => {
        if (isUnmountedRef.current) return
        setStatus('error')
      })
    },
  }), [])

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  const handleRefresh = () => {
    setStatus('refreshing')
    const page = 1
    search(searchInfoRef.current.text, page, searchInfoRef.current.source).then((newList) => {
      if (isUnmountedRef.current) return
      setList(newList)
      setStatus(searchSingerState.listInfos[searchSingerState.source]!.maxPage <= page ? 'end' : 'idle')
    }).catch(() => {
      setStatus('error')
    })
  }
  const handleLoadMore = () => {
    if (status != 'idle') return
    setStatus('loading')
    const info = searchSingerState.listInfos[searchInfoRef.current.source]!
    const page = info.page + 1
    search(searchInfoRef.current.text, page, searchInfoRef.current.source).then(() => {
      if (isUnmountedRef.current) return
      setList(searchSingerState.listInfos[searchInfoRef.current.source]!.list)
      setStatus(searchSingerState.listInfos[searchInfoRef.current.source]!.maxPage <= page ? 'end' : 'idle')
    }).catch(() => {
      setStatus('error')
    })
  }

  const renderItem: FlatListProps<SingerItem>['renderItem'] = ({ item }) => (
    <View style={styles.item}>
      <View style={styles.image}>
        <Image url={item.avatar ?? undefined} style={styles.imageInner} />
      </View>
      <View style={styles.desc}>
        <Text numberOfLines={2} style={styles.name} color={theme['c-font']}>{item.name}</Text>
        {item.country ? <Text numberOfLines={1} style={styles.sub} color={theme['c-font-label']}>{item.country}</Text> : null}
        <View style={styles.meta}>
          {item.songCount != null ? <Text numberOfLines={1} style={styles.metaItem} color={theme['c-font-label']}>{t('search_singer_songs')}: {item.songCount}</Text> : null}
          {item.albumCount != null ? <Text numberOfLines={1} style={styles.metaItem} color={theme['c-font-label']}>{t('search_singer_albums')}: {item.albumCount}</Text> : null}
          {showSource ? <Text numberOfLines={1} style={styles.metaItem} color={theme['c-font-label']}>{item.source}</Text> : null}
        </View>
      </View>
    </View>
  )

  const getkey: FlatListProps<SingerItem>['keyExtractor'] = item => `${item.source}__${item.id}`

  const refreshControl = useMemo(() => (
    <RefreshControl
      colors={[theme['c-primary']]}
      refreshing={status == 'refreshing'}
      onRefresh={handleRefresh}
    />
  ), [status, theme])

  type FooterLabel = 'list_loading' | 'list_end' | 'list_error' | null
  const footerComponent = useMemo(() => {
    let label: FooterLabel
    switch (status) {
      case 'refreshing': return null
      case 'loading':
        label = 'list_loading'
        break
      case 'end':
        label = 'list_end'
        break
      case 'error':
        label = 'list_error'
        break
      default:
        label = null
        break
    }
    return (
      <View style={{ width: '100%' }}>
        {label
          ? (
              <Text onPress={() => {
                if (label == 'list_error') handleLoadMore()
              }} style={styles.footer} color={theme['c-font-label']}>{t(label)}</Text>
            )
          : null}
      </View>
    )
  }, [status, theme])

  return (
    <View style={styles.container} onLayout={onLayout}>
      {
        width == 0
          ? null
          : (
              <FlatList
                ref={flatListRef}
                style={styles.list}
                data={list}
                renderItem={renderItem}
                keyExtractor={getkey}
                onEndReachedThreshold={0.6}
                onEndReached={handleLoadMore}
                refreshControl={refreshControl}
                ListFooterComponent={footerComponent}
              />
            )
      }
    </View>
  )
})

const AVATAR_SIZE = scaleSizeW(56)

const styles = createStyle({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  list: {
    flex: 1,
    paddingLeft: 10,
    paddingRight: 10,
  },
  item: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  image: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#222',
  },
  imageInner: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  desc: {
    flex: 1,
    marginLeft: 10,
  },
  name: {
    fontSize: 14,
    lineHeight: 19,
  },
  sub: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  metaItem: {
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    textAlign: 'center',
    padding: 10,
  },
})
