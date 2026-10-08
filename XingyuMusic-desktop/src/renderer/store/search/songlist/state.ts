import { reactive, markRaw } from '@common/utils/vueTools'


// import { deduplicationList } from '@common/utils/renderer'

import { type ListInfo } from '@renderer/store/songList/state'

export type { ListInfoItem } from '@renderer/store/songList/state'

export const sources: Array<LX.OnlineSource | 'all'> = markRaw([])

export type SearchListInfo = Omit<ListInfo, 'source'>


interface ListInfos extends Partial<Record<LX.OnlineSource, SearchListInfo>> {
  'all': SearchListInfo
}


export const listInfos: ListInfos = markRaw({
  all: reactive<SearchListInfo>({
    page: 1,
    limit: 15,
    total: 0,
    list: [],
    key: null,
    noItemLabel: '',
    tagId: '',
    sortId: '',
  }),
})
export const maxPages: Partial<Record<LX.OnlineSource, number>> = {}

// 综合（排最前）+ 6 线路（星名对应：星记kw/星芸wy/星腾tx/星犬kg/星谷mg/星宝bili）
export const CHANNELS: LX.OnlineSource[] = markRaw(['kw', 'wy', 'tx', 'kg', 'mg', 'bili'])

sources.push('all')
for (const ch of CHANNELS) {
  sources.push(ch)
  listInfos[ch] = reactive<SearchListInfo>({
    page: 1,
    limit: 18,
    total: 0,
    list: [],
    key: null,
    noItemLabel: '',
    tagId: '',
    sortId: '',
  })
  maxPages[ch] = 0
}
