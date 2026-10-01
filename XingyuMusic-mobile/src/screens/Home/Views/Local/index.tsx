import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { View, TouchableOpacity, FlatList } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import Loading from '@/components/common/Loading'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { getLocalDirs } from '@/utils/data'
import { getListMusics } from '@/utils/listManage'
import playerState from '@/store/player/state'
import { playList } from '@/core/player/player'
import { useListFetching } from '@/store/list/hook'
import {
  addLocalDir,
  removeLocalDir,
  moveLocalDir,
  rescanLocalMusic,
  registerLocalMusic,
  LOCAL_LIST_ID,
} from './localAction'

const LocalToolbar = ({ isShowDirs, onToggleDirs, onRefresh }: {
  isShowDirs: boolean
  onToggleDirs: () => void
  onRefresh: () => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const fetching = useListFetching(LOCAL_LIST_ID)
  return (
    <View style={styles.toolbar}>
      <Text style={styles.title} size={16} color={theme['c-font']}>{t('nav_local')}</Text>
      {
        fetching ? <Loading style={styles.loading} color={theme['c-primary-font']} /> : null
      }
      <View style={styles.toolbarBtns}>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.6} disabled={fetching} onPress={onRefresh}>
          <Icon name="available_updates" size={18} color={fetching ? theme['c-400'] : theme['c-font']} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: isShowDirs ? theme['c-button-background'] : undefined }]} activeOpacity={0.6} onPress={onToggleDirs}>
          <Icon name="menu" size={18} color={theme['c-font']} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const DirRow = ({ index, total, path, onMoveUp, onMoveDown, onRemove, removeDisabled }: {
  index: number
  total: number
  path: string
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  removeDisabled?: boolean
}) => {
  const theme = useTheme()
  // SAF 目录 URI 只显示最后一段，完整路径做 title
  const name = path.split('/').filter(Boolean).pop() ?? path
  const iconBtnStyle = { ...styles.dirIconBtn, color: theme['c-font-label'] }
  return (
    <View style={styles.dirRow}>
      <Icon name="sd-card" size={14} color={theme['c-350']} style={styles.dirIcon} />
      <Text style={styles.dirPath} numberOfLines={1} color={theme['c-font']}>{name}</Text>
      <View style={styles.dirBtns}>
        <TouchableOpacity style={iconBtnStyle} disabled={index == 0} onPress={onMoveUp}>
          <Icon name="chevron-right" size={14} color={theme['c-400']} style={{ transform: [{ rotate: '-90deg' }] }} />
        </TouchableOpacity>
        <TouchableOpacity style={iconBtnStyle} disabled={index == total - 1} onPress={onMoveDown}>
          <Icon name="chevron-right" size={14} color={theme['c-400']} style={{ transform: [{ rotate: '90deg' }] }} />
        </TouchableOpacity>
        <TouchableOpacity style={[iconBtnStyle, { opacity: removeDisabled ? 0.4 : 1 }]} disabled={removeDisabled} onPress={onRemove}>
          <Icon name="remove" size={14} color={theme['c-500']} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default memo(() => {
  const theme = useTheme()
  const t = useI18n()
  const [dirs, setDirs] = useState<string[]>([])
  const [songs, setSongs] = useState<LX.Music.MusicInfo[]>([])
  const [isShowDirs, setIsShowDirs] = useState(true)
  const isScanning = useRef(false)

  const refreshSongs = () => {
    void getListMusics(LOCAL_LIST_ID).then(list => {
      setSongs([...list])
    })
  }

  const refreshDirs = () => {
    void getLocalDirs().then(setDirs)
  }

  useEffect(() => {
    refreshDirs()
    refreshSongs()
    // 进页时注册本地列表到内存（播放链路依赖）
    void registerLocalMusic()
    const handleListUpdate = (ids: string[]) => {
      if (ids.includes(LOCAL_LIST_ID)) refreshSongs()
    }
    global.app_event.on('myListMusicUpdate', handleListUpdate)
    return () => {
      global.app_event.off('myListMusicUpdate', handleListUpdate)
    }
  }, [])

  const handleRefresh = () => {
    if (isScanning.current || !dirs.length) return
    isScanning.current = true
    void rescanLocalMusic().catch(() => { /* 扫描失败不阻塞 */ }).finally(() => {
      isScanning.current = false
      refreshSongs()
    })
  }

  const handleAddDir = () => {
    if (fetching) return
    void addLocalDir().then(isAdded => {
      if (isAdded) refreshDirs()
    })
  }

  const handleRemoveDir = (index: number) => {
    if (fetching) return
    void removeLocalDir(index).then(() => {
      refreshDirs()
      refreshSongs()
    })
  }

  const handleMoveDir = (index: number, toIndex: number) => {
    void moveLocalDir(index, toIndex).then(() => {
      refreshDirs()
    })
  }

  const handlePlay = (index: number) => {
    void playList(LOCAL_LIST_ID, index)
  }

  const { playMusicInfo, playInfo } = playerState
  const isPlayList = playMusicInfo.listId == LOCAL_LIST_ID
  const playIndex = isPlayList ? playInfo.playIndex : -1
  const fetching = useListFetching(LOCAL_LIST_ID)

  const renderItem = ({ item, index }: { item: LX.Music.MusicInfo, index: number }) => {
    const active = playIndex == index
    return (
      <TouchableOpacity style={styles.songRow} activeOpacity={0.7} onPress={() => { handlePlay(index) }}>
        {
          active ? <Icon style={styles.songActiveIcon} name="play-outline" size={14} color={theme['c-primary-font']} /> : <Text style={styles.songNum} numberOfLines={1} color={theme['c-400']}>{index + 1}</Text>
        }
        <View style={styles.songInfo}>
          <Text style={styles.songName} numberOfLines={1} color={active ? theme['c-primary-font'] : theme['c-font']}>{item.name}</Text>
          <Text style={styles.songSinger} numberOfLines={1} color={theme['c-400']}>{[item.singer, item.meta?.albumName].filter(Boolean).join(' · ')}</Text>
        </View>
        { item.interval ? <Text style={styles.songTime} color={theme['c-400']}>{item.interval}</Text> : null }
      </TouchableOpacity>
    )
  }

  const emptyContent = useMemo(() => (
    <View style={styles.empty}>
      {
        !dirs.length ? (
          <>
            <Text style={styles.emptyText} color={theme['c-400']}>{t('local_no_dirs')}</Text>
            <TouchableOpacity style={styles.addDirBtn} activeOpacity={0.7} onPress={handleAddDir}>
              <Icon name="add_folder" size={16} color={theme['c-primary-font']} />
              <Text style={styles.addDirText} color={theme['c-primary-font']}>{t('local_add_dir')}</Text>
            </TouchableOpacity>
          </>
        ) : songs.length ? null : (
          <Text style={styles.emptyText} color={theme['c-400']}>{t('local_no_musics')}</Text>
        )
      }
    </View>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [dirs.length, songs.length])

  return (
    <View style={styles.container}>
      <LocalToolbar isShowDirs={isShowDirs} onToggleDirs={() => { setIsShowDirs(v => !v) }} onRefresh={handleRefresh} />
      {
        isShowDirs ? (
          <View style={{ ...styles.dirsPanel, borderColor: theme['c-border-background'], backgroundColor: theme['c-main-background'] }}>
            <Text style={styles.dirsTitle} color={theme['c-400']}>{t('local_dirs')}（{dirs.length}）</Text>
            {
              dirs.map((dir, index) => (
                <DirRow
                  key={dir}
                  index={index}
                  total={dirs.length}
                  path={dir}
                  onMoveUp={() => { handleMoveDir(index, index - 1) }}
                  onMoveDown={() => { handleMoveDir(index, index + 1) }}
                  onRemove={() => { handleRemoveDir(index) }}
                  removeDisabled={fetching}
                />
              ))
            }
            <TouchableOpacity style={[styles.addDirRow, { opacity: fetching ? 0.4 : 1 }]} activeOpacity={0.7} disabled={fetching} onPress={handleAddDir}>
              <Icon name="add_folder" size={14} color={theme['c-primary-font']} />
              <Text style={styles.addDirRowText} color={theme['c-primary-font']}>{t('local_add_dir')}</Text>
            </TouchableOpacity>
            <Text style={styles.dirTip} color={theme['c-400']}>{t('local_dir_tip')}</Text>
          </View>
        ) : null
      }
      {
        songs.length ? (
          <FlatList
            data={songs}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          emptyContent
        )
      }
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  title: {
    flex: 1,
  },
  loading: {
    marginRight: 8,
  },
  toolbarBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dirsPanel: {
    margin: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  dirsTitle: {
    fontSize: 12,
    marginBottom: 6,
  },
  dirRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
    gap: 6,
  },
  dirIcon: {
    width: 16,
  },
  dirPath: {
    flex: 1,
    fontSize: 13,
  },
  dirBtns: {
    flexDirection: 'row',
    gap: 2,
  },
  dirIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDirRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingVertical: 4,
  },
  addDirRowText: {
    fontSize: 13,
  },
  dirTip: {
    fontSize: 11,
    marginTop: 4,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: 12,
    gap: 10,
  },
  songNum: {
    width: 20,
    textAlign: 'center',
    fontSize: 13,
  },
  songActiveIcon: {
    width: 20,
    textAlign: 'center',
  },
  songInfo: {
    flex: 1,
  },
  songName: {
    fontSize: 14,
  },
  songSinger: {
    fontSize: 12,
    marginTop: 2,
  },
  songTime: {
    fontSize: 12,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  addDirBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  addDirText: {
    fontSize: 14,
  },
})
