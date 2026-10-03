import { addTempPlayList } from '@renderer/store/player/action'
import { playList } from '@renderer/core/player'

export default ({ props, selectedList, list, removeAllSelect, resolveFullIndex = i => i }) => {
  let clickTime = 0
  let clickIndex = -1

  const handlePlayMusic = (index) => {
    // index 为「显示列表」下标；playList 需要「完整列表」下标（搜索过滤时二者不同），用 resolveFullIndex 映射
    playList(props.listId, resolveFullIndex(index))
  }

  const handlePlayMusicLater = (index, single) => {
    if (selectedList.value.length && !single) {
      addTempPlayList(selectedList.value.map(s => ({ listId: props.listId, musicInfo: s })))
      removeAllSelect()
    } else {
      addTempPlayList([{ listId: props.listId, musicInfo: list.value[index] }])
    }
  }

  const doubleClickPlay = index => {
    if (
      window.performance.now() - clickTime > 400 ||
      clickIndex !== index
    ) {
      clickTime = window.performance.now()
      clickIndex = index
      return
    }
    handlePlayMusic(index, true)
    clickTime = 0
    clickIndex = -1
  }

  return {
    handlePlayMusic,
    handlePlayMusicLater,
    doubleClickPlay,
  }
}
