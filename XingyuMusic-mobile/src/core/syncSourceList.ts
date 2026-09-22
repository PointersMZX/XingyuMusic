// import { dateFormat } from '@/utils/common'
import { setListUpdateTime } from '@/utils/data'
import { overwriteListMusics, setFetchingListStatus } from './list'
import { getListDetailAll } from '@/core/songlist'

const fetchList = async(id: string, source: LX.OnlineSource, sourceListId: string) => {
  setFetchingListStatus(id, true)

  let promise = getListDetailAll(source, sourceListId, true)
  return promise.finally(() => {
    setFetchingListStatus(id, false)
  })
}

export default async(targetListInfo: LX.List.UserListInfo) => {
  // console.log(targetListInfo)
  if (!targetListInfo.source || !targetListInfo.sourceListId) return
  const list = await fetchList(targetListInfo.id, targetListInfo.source, targetListInfo.sourceListId)
  // console.log(list)
  void overwriteListMusics(targetListInfo.id, list)
  const now = Date.now()
  void setListUpdateTime(targetListInfo.id, now)
  // TODO
  // setUpdateTime(targetListInfo.id, dateFormat(now))
}
