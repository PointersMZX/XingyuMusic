import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, TouchableOpacity, FlatList, PanResponder, TextInput } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import Loading from '@/components/common/Loading'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle, confirmDialog, toast } from '@/utils/tools'
import { getLocalDirs } from '@/utils/data'
import { getListMusics } from '@/utils/listManage'
import playerState from '@/store/player/state'
import { playList } from '@/core/player/player'
import { useListFetching } from '@/store/list/hook'
import { useSettingValue } from '@/store/setting/hook'
import settingActions from '@/store/setting/action'
import { removeListMusics, overwriteListMusics } from '@/core/list'
import {
  addLocalDir,
  removeLocalDir,
  moveLocalDir,
  rescanLocalMusic,
  registerLocalMusic,
  applyLocalSort,
  LOCAL_LIST_ID,
  LOCAL_SORT_OPTIONS,
} from './localAction'

const ROW_HEIGHT = 56

// 排序选项 → i18n 键（字面量，保证类型可查）
const SORT_I18N: Record<LX.LocalSortType, 'local_sort_new' | 'local_sort_old' | 'local_sort_az' | 'local_sort_za' | 'local_sort_custom'> = {
  new: 'local_sort_new',
  old: 'local_sort_old',
  az: 'local_sort_az',
  za: 'local_sort_za',
  custom: 'local_sort_custom',
}

type SongItem = LX.Music.MusicInfo

// 三条横线（≡）拖动把手
const DragHandle = ({ color }: { color: string }) => (
  <View style={styles.handleBox}>
    <View style={[styles.handleLine, { backgroundColor: color }]} />
    <View style={[styles.handleLine, { backgroundColor: color }]} />
    <View style={[styles.handleLine, { backgroundColor: color }]} />
  </View>
)

const SongRow = memo(({ item, index, total, manage, selected, active, draggingId, dragOffset, onPlay, onLongPress, onToggle, onDragStart, onDragMove, onDragEnd, onDragOffset }: {
  item: SongItem
  index: number
  total: number
  manage: boolean
  selected: boolean
  active: boolean
  draggingId: string | null
  dragOffset: number
  onPlay: (index: number) => void
  onLongPress: (id: string) => void
  onToggle: (id: string) => void
  onDragStart: (id: string) => void
  onDragMove: (target: number) => void
  onDragEnd: () => void
  onDragOffset: (px: number) => void
}) => {
  const theme = useTheme()
  const indexRef = useRef(index)
  indexRef.current = index
  const anchorRef = useRef(index)

  const pr = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      anchorRef.current = indexRef.current
      onDragStart(item.id)
    },
    onPanResponderMove: (_e, gs) => {
      const dy = gs.dy
      const rows = Math.round(dy / ROW_HEIGHT)
      const target = Math.max(0, Math.min(total - 1, anchorRef.current + rows))
      onDragMove(target)
      onDragOffset(dy - rows * ROW_HEIGHT)
    },
    onPanResponderRelease: () => { onDragEnd() },
    onPanResponderTerminate: () => { onDragEnd() },
  }), [item.id, total, onDragStart, onDragMove, onDragEnd, onDragOffset])

  const isDragging = draggingId == item.id

  return (
    <View
      style={[
        styles.row,
        {
          height: ROW_HEIGHT,
          zIndex: isDragging ? 30 : 1,
          transform: [{ translateY: isDragging ? dragOffset : 0 }],
          ...(isDragging ? styles.rowDragging : {}),
        },
      ]}
    >
      {
        manage ? (
          <TouchableOpacity style={styles.box} activeOpacity={0.6} onPress={() => { onToggle(item.id) }}>
            <Icon name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={selected ? theme['c-primary-font'] : theme['c-500']} />
          </TouchableOpacity>
        ) : (
          active ? <Icon style={styles.box} name="play-outline" size={14} color={theme['c-primary-font']} />
            : <Text style={styles.num} color={theme['c-400']}>{index + 1}</Text>
        )
      }
      <TouchableOpacity
        style={styles.main}
        activeOpacity={manage ? 0.5 : 0.8}
        onPress={() => { manage ? onToggle(item.id) : onPlay(index) }}
        onLongPress={() => { if (!manage) onLongPress(item.id) }}
      >
        <Text style={styles.name} numberOfLines={1} color={active ? theme['c-primary-font'] : theme['c-font']}>{item.name}</Text>
        <Text style={styles.duration} numberOfLines={1} color={theme['c-400']}>{item.interval ?? ''}</Text>
      </TouchableOpacity>
      {
        manage ? (
          <View style={styles.handle} {...pr.panHandlers}>
            <DragHandle color={theme['c-400']} />
          </View>
        ) : null
      }
    </View>
  )
})

export default memo(() => {
  const theme = useTheme()
  const t = useI18n()
  const [dirs, setDirs] = useState<string[]>([])
  const [songs, setSongs] = useState<SongItem[]>([])
  const [isShowDirs, setIsShowDirs] = useState(true)
  const isScanning = useRef(false)

  // 管理（复选）模式
  const [isManage, setIsManage] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [showSort, setShowSort] = useState(false)
  const sortType = useSettingValue('local.sortType')

  // 拖拽排序
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const draggingIdRef = useRef<string | null>(null)
  const songsRef = useRef<SongItem[]>([])
  useEffect(() => { songsRef.current = songs }, [songs])

  // 列表内搜索：按歌名实时过滤。未搜索时 displaySongs 与 songs 同引用、resolveFullIndex 为恒等，其它逻辑零影响
  const [searchText, setSearchText] = useState('')
  const [isShowSearch, setIsShowSearch] = useState(false)
  const isSearching = searchText.trim() != ''
  const displaySongs = useMemo(() => {
    if (!isSearching) return songs
    const q = searchText.trim().toLowerCase()
    return songs.filter(m => m.name.toLowerCase().includes(q))
  }, [songs, isSearching, searchText])
  const resolveFullIndex = (displayIndex: number) => {
    if (!isSearching) return displayIndex
    const id = displaySongs[displayIndex]?.id
    if (!id) return 0
    const full = songs.findIndex(m => m.id == id)
    return full < 0 ? 0 : full
  }

  const refreshSongs = useCallback(() => {
    void getListMusics(LOCAL_LIST_ID).then(list => { setSongs([...list]) })
  }, [])

  const refreshDirs = useCallback(() => {
    void getLocalDirs().then(setDirs)
  }, [])

  useEffect(() => {
    refreshDirs()
    refreshSongs()
    void registerLocalMusic()
    const handleListUpdate = (ids: string[]) => {
      if (ids.includes(LOCAL_LIST_ID)) refreshSongs()
    }
    global.app_event.on('myListMusicUpdate', handleListUpdate)
    return () => {
      global.app_event.off('myListMusicUpdate', handleListUpdate)
    }
  }, [refreshDirs, refreshSongs])

  const handleRefresh = () => {
    if (isScanning.current || !dirs.length) return
    isScanning.current = true
    void rescanLocalMusic().catch(() => { /* 扫描失败不阻塞 */ }).finally(() => {
      isScanning.current = false
      refreshSongs()
    })
  }

  const handleAddDir = () => {
    void addLocalDir().then(isAdded => {
      if (isAdded) refreshDirs()
    })
  }

  const handleRemoveDir = (index: number) => {
    void removeLocalDir(index).then(() => {
      refreshDirs()
      refreshSongs()
    })
  }

  const handleMoveDir = (index: number, toIndex: number) => {
    void moveLocalDir(index, toIndex).then(refreshDirs)
  }

  const handlePlay = (displayIndex: number) => {
    void playList(LOCAL_LIST_ID, resolveFullIndex(displayIndex))
  }

  const { playMusicInfo, playInfo } = playerState
  const isPlayList = playMusicInfo.listId == LOCAL_LIST_ID
  const playIndex = isPlayList ? playInfo.playIndex : -1
  // 当前正在播放的歌（按 id 匹配，搜索过滤后仍正确高亮）
  const activeId = isPlayList ? songs[playIndex]?.id : undefined
  const fetching = useListFetching(LOCAL_LIST_ID)

  // 搜索输入：改词时退出管理模式（避免管理态 + 过滤态并存）
  const handleSearchChange = (val: string) => {
    setSearchText(val)
    if (isManage) exitManage()
  }

  // ---------- 管理（复选）模式 ----------
  const enterManage = (id?: string) => {
    setIsManage(true)
    setSelected(id ? [id] : [])
  }
  const exitManage = () => {
    setIsManage(false)
    setSelected([])
  }
  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(v => v != id) : [...prev, id])
  }, [])

  const handleDeleteSelected = () => {
    if (!selected.length) return
    void confirmDialog({
      message: t('local_delete_confirm', { count: selected.length }),
      confirmButtonText: t('local_delete'),
    }).then(isOk => {
      if (!isOk) return
      const ids = [...selected]
      void removeListMusics(LOCAL_LIST_ID, ids).then(() => {
        setSelected([])
        toast(t('local_scan_result', { count: ids.length }), 'short', 'top')
        refreshSongs()
      })
    })
  }

  // ---------- 排序 ----------
  const handleSortPick = (type: LX.LocalSortType) => {
    setShowSort(false)
    if (type == sortType) return
    settingActions.updateSetting({ 'local.sortType': type })
    void applyLocalSort(type).then(refreshSongs)
  }

  // ---------- 拖拽排序 ----------
  const onDragStart = useCallback((id: string) => {
    draggingIdRef.current = id
    setDraggingId(id)
  }, [])
  const onDragOffset = useCallback((px: number) => { setDragOffset(px) }, [])
  const onDragMove = useCallback((target: number) => {
    setSongs(prev => {
      const id = draggingIdRef.current
      if (!id) return prev
      const from = prev.findIndex(m => m.id == id)
      if (from < 0) return prev
      const clamped = Math.max(0, Math.min(prev.length - 1, target))
      if (clamped == from) return prev
      const arr = [...prev]
      const [it] = arr.splice(from, 1)
      arr.splice(clamped, 0, it)
      return arr
    })
  }, [])
  const onDragEnd = useCallback(() => {
    if (draggingIdRef.current) {
      void overwriteListMusics(LOCAL_LIST_ID, songsRef.current).then(() => {
        settingActions.updateSetting({ 'local.sortType': 'custom' })
      })
    }
    draggingIdRef.current = null
    setDraggingId(null)
    setDragOffset(0)
  }, [])

  const renderItem = ({ item, index }: { item: SongItem, index: number }) => {
    return (
      <SongRow
        item={item}
        index={index}
        total={displaySongs.length}
        manage={isManage && !isSearching}
        selected={selected.includes(item.id)}
        active={activeId != null && item.id == activeId}
        draggingId={draggingId}
        dragOffset={dragOffset}
        onPlay={handlePlay}
        onLongPress={isSearching ? () => { } : enterManage}
        onToggle={toggleSelect}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragOffset={onDragOffset}
      />
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
      <View style={styles.toolbar}>
        <Text style={styles.title} size={16} color={theme['c-font']}>{t('nav_local')}</Text>
        { fetching ? <Loading style={styles.loading} color={theme['c-primary-font']} /> : null }
        <View style={styles.toolbarBtns}>
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.6} disabled={fetching} onPress={handleRefresh}>
            <Icon name="available_updates" size={18} color={fetching ? theme['c-400'] : theme['c-font']} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.6} disabled={!songs.length || isSearching} onPress={() => { setShowSort(true) }}>
            <Icon name="list-order" size={18} color={!songs.length || isSearching ? theme['c-400'] : theme['c-font']} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.6} disabled={!songs.length || isSearching} onPress={() => { enterManage() }}>
            <Icon name="dots-vertical" size={18} color={!songs.length || isSearching ? theme['c-400'] : theme['c-font']} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: isShowSearch ? theme['c-button-background'] : undefined }]} activeOpacity={0.6} disabled={!songs.length} onPress={() => { setIsShowSearch(v => !v) }}>
            <Icon name="search-2" size={18} color={theme['c-font']} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: isShowDirs ? theme['c-button-background'] : undefined }]} activeOpacity={0.6} onPress={() => { setIsShowDirs(v => !v) }}>
            <Icon name="menu" size={18} color={theme['c-font']} />
          </TouchableOpacity>
        </View>
      </View>
      {
        isShowSearch ? (
          <View style={{ ...styles.searchBar, backgroundColor: theme['c-main-background'], borderColor: theme['c-border-background'] }}>
            <Icon name="search-2" size={16} color={theme['c-400']} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme['c-font'] }]}
              placeholder={t('local_search_placeholder')}
              placeholderTextColor={theme['c-400']}
              value={searchText}
              onChangeText={handleSearchChange}
              autoCorrect={false}
            />
            {
              searchText ? (
                <TouchableOpacity style={styles.searchClearBtn} activeOpacity={0.6} onPress={() => { setSearchText(''); if (isManage) exitManage() }}>
                  <Icon name="close" size={16} color={theme['c-400']} />
                </TouchableOpacity>
              ) : null
            }
          </View>
        ) : null
      }
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
          isSearching && !displaySongs.length ? (
            <View style={styles.searchEmpty}>
              <Text style={styles.searchEmptyText} color={theme['c-400']}>{t('local_search_empty')}</Text>
            </View>
          ) : (
            <FlatList
              data={displaySongs}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            />
          )
        ) : (
          emptyContent
        )
      }
      {
        isManage ? (
          <View style={{ ...styles.manageBar, backgroundColor: theme['c-main-background'], borderColor: theme['c-border-background'] }}>
            <Text style={styles.manageHint} numberOfLines={1} color={theme['c-400']}>{t('local_manage_hint')}</Text>
            <TouchableOpacity
              style={[styles.manageBtn, { opacity: selected.length ? 1 : 0.4 }]}
              activeOpacity={0.7}
              disabled={!selected.length}
              onPress={handleDeleteSelected}
            >
              <Icon name="remove" size={16} color={selected.length ? theme['c-550'] : theme['c-400']} />
              <Text style={[styles.manageBtnText, { color: selected.length ? theme['c-550'] : theme['c-400'] }]}>{t('local_delete')}（{selected.length}）</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.manageBtn} activeOpacity={0.7} onPress={exitManage}>
              <Text style={[styles.manageBtnText, { color: theme['c-primary-font'] }]}>{t('local_done')}</Text>
            </TouchableOpacity>
          </View>
        ) : null
      }
      {
        showSort ? (
          <View style={{ ...styles.sortMask, backgroundColor: theme['c-content-background'] }}>
            <TouchableOpacity style={styles.sortMaskTouch} activeOpacity={1} onPress={() => { setShowSort(false) }} />
            <View style={[styles.sortPanel, { backgroundColor: theme['c-main-background'], borderColor: theme['c-border-background'] }]}>
              <Text style={styles.sortTitle} color={theme['c-font']}>{t('local_sort')}</Text>
              {
                LOCAL_SORT_OPTIONS.map(opt => (
                  <TouchableOpacity key={opt} style={styles.sortOption} activeOpacity={0.7} onPress={() => { handleSortPick(opt) }}>
                    <Text style={styles.sortOptionText} color={opt == sortType ? theme['c-primary-font'] : theme['c-font']}>{t(SORT_I18N[opt])}</Text>
                    { opt == sortType ? <Icon name="checkbox-marked" size={16} color={theme['c-primary-font']} /> : null }
                  </TouchableOpacity>
                ))
              }
            </View>
          </View>
        ) : null
      }
    </View>
  )
})

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

const styles = createStyle({
  container: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  title: { flex: 1 },
  loading: { marginRight: 8 },
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
  dirsTitle: { fontSize: 12, marginBottom: 6 },
  dirRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
    gap: 6,
  },
  dirIcon: { width: 16 },
  dirPath: { flex: 1, fontSize: 13 },
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
  addDirRowText: { fontSize: 13 },
  dirTip: { fontSize: 11, marginTop: 4 },

  // 歌曲行
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  rowDragging: {
    backgroundColor: 'rgba(124, 32, 194, 0.18)',
    borderRadius: 8,
    marginVertical: 2,
  },
  box: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: {
    width: 40,
    textAlign: 'center',
    fontSize: 13,
  },
  main: {
    flex: 1,
    gap: 2,
    paddingVertical: 4,
  },
  name: { fontSize: 14 },
  duration: { fontSize: 12 },
  handle: {
    width: 34,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleBox: {
    gap: 4,
    paddingVertical: 6,
  },
  handleLine: {
    width: 18,
    height: 2,
    borderRadius: 1,
  },

  // 管理条
  manageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderTopWidth: 1,
  },
  manageHint: { flex: 1, fontSize: 11 },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  manageBtnText: { fontSize: 14 },

  // 排序面板
  sortMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  sortMaskTouch: { flex: 1 },
  sortPanel: {
    borderRadius: 16,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderWidth: 1,
    padding: 14,
    gap: 2,
  },
  sortTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  sortOptionText: { fontSize: 15 },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: { fontSize: 14, textAlign: 'center' },
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
  addDirText: { fontSize: 14 },

  // 搜索
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  searchIcon: { width: 18 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
    height: 22,
  },
  searchClearBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  searchEmptyText: { fontSize: 14, textAlign: 'center' },
})
