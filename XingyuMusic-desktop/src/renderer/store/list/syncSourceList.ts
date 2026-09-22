import { setListUpdateTime } from '@renderer/utils/data'
import { setFetchingListStatus, overwriteListMusics, setUpdateTime } from './action'
import { getListDetailAll } from '@renderer/store/songList/action'
import { dateFormat } from '@common/utils/common'

const fetchList = async(id: string, source: LX.OnlineSource, sourceListId: string) => {
  setFetchingListStatus(id, true)

  let promise
  promise = getListDetailAll(sourceListId, source, true)
  return promise.finally(() => {
    setFetchingListStatus(id, false)
  })
}

export default async(targetListInfo: LX.List.UserListInfo) => {
  // console.log(targetListInfo)
  if (!targetListInfo.source || !targetListInfo.sourceListId) return
  const list = await fetchList(targetListInfo.id, targetListInfo.source, targetListInfo.sourceListId)
  // console.log(list)
  void overwriteListMusics({ listId: targetListInfo.id, musicInfos: list })
  const now = Date.now()
  void setListUpdateTime(targetListInfo.id, now)
  setUpdateTime(targetListInfo.id, dateFormat(now))
}
