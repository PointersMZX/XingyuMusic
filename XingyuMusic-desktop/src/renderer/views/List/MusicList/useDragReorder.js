import { ref } from '@common/utils/vueTools'
import { LIST_IDS } from '@common/constants'
import { updateListMusicsPosition } from '@renderer/store/list/action'
import { updateSetting } from '@renderer/store/setting'

/**
 * 本地音乐「三条横线」拖动把手：按住把手上下拖动，松手后把该歌曲移到目标位置（自定义排序）
 * 仅对本地列表（listId == LOCAL）生效；松手后把 local.sortType 置为 custom（手动顺序）
 */
export default ({ props, list, listItemHeight }) => {
  const dragId = ref(null)
  const dragIndex = ref(-1) // 当前目标位置
  const isDragging = ref(false)
  const start = { index: 0, clientY: 0 }

  const isLocal = props.listId == LIST_IDS.LOCAL

  const onMove = (event) => {
    const rowH = (typeof listItemHeight.value == 'number' && listItemHeight.value) || 38
    const rows = Math.round((event.clientY - start.clientY) / rowH)
    dragIndex.value = Math.max(0, Math.min(list.value.length - 1, start.index + rows))
  }

  const cleanup = () => {
    isDragging.value = false
    dragId.value = null
    dragIndex.value = -1
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }

  const onUp = () => {
    if (dragId.value && dragIndex.value != start.index) {
      updateListMusicsPosition({
        listId: props.listId,
        position: dragIndex.value,
        ids: [dragId.value],
      }).catch(() => {})
      // 手动重排后，本地默认排序标记为「自定义」
      if (isLocal) updateSetting({ 'local.sortType': 'custom' })
    }
    cleanup()
  }

  const startDrag = (index, item, event) => {
    if (!isLocal || !list.value.length) return
    start.index = index
    start.clientY = event.clientY
    dragId.value = item.id
    dragIndex.value = index
    isDragging.value = true
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    event.preventDefault()
  }

  return {
    dragId,
    dragIndex,
    isDragging,
    startDrag,
  }
}
