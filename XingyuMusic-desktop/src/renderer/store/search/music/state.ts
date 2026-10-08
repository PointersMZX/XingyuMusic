import { reactive, markRaw } from '@common/utils/vueTools'

// import { deduplicationList } from '@common/utils/renderer'

export declare interface ListInfo {
  list: LX.Music.MusicInfo[]
  total: number
  page: number
  maxPage: number
  limit: number
  key: string | null
  noItemLabel: string
}

interface ListInfos extends Partial<Record<LX.OnlineSource, ListInfo>> {
  'all': ListInfo
}

export const sources: Array<LX.OnlineSource | 'all'> = markRaw([])

export const listInfos: ListInfos = markRaw({
  all: reactive<ListInfo>({
    page: 1,
    maxPage: 0,
    limit: 30,
    total: 0,
    list: [],
    key: null,
    noItemLabel: '',
  }),
})
export const maxPages: Partial<Record<LX.OnlineSource, number>> = {}

// 综合（排最前）+ 6 线路（星名对应：星记kw/星芸wy/星腾tx/星犬kg/星谷mg/星宝bili）
export const CHANNELS: LX.OnlineSource[] = markRaw(['kw', 'wy', 'tx', 'kg', 'mg', 'bili'])

sources.push('all')
for (const ch of CHANNELS) {
  sources.push(ch)
  listInfos[ch] = reactive<ListInfo>({
    page: 1,
    maxPage: 0,
    limit: 30,
    total: 0,
    list: [],
    key: '',
    noItemLabel: '',
  })
  maxPages[ch] = 0
}
