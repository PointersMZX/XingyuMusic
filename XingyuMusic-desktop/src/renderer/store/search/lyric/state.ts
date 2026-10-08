import { reactive, markRaw } from '@common/utils/vueTools'

export interface LyricItem {
  source: string
  id: string
  name: string
  singer?: string
  img?: string | null
  pageUrl?: string
  duration?: string | null
}

export declare interface LyricListInfo {
  list: LyricItem[]
  total: number
  page: number
  maxPage: number
  limit: number
  key: string | null
  noItemLabel: string
}

// 综合（排最前）+ 6 线路（星名对应：星记kw/星芸wy/星腾tx/星犬kg/星谷mg/星宝bili）
export const CHANNELS: LX.OnlineSource[] = markRaw(['kw', 'wy', 'tx', 'kg', 'mg', 'bili'])

export const sources: Array<LX.OnlineSource | 'all'> = markRaw([])

interface ListInfos extends Partial<Record<LX.OnlineSource, LyricListInfo>> {
  'all': LyricListInfo
}

export const listInfos: ListInfos = markRaw({
  all: reactive<LyricListInfo>({
    page: 1,
    maxPage: 0,
    limit: 30,
    total: 0,
    list: [],
    key: null,
    noItemLabel: '',
  }),
})
sources.push('all')
for (const ch of CHANNELS) {
  sources.push(ch)
  listInfos[ch] = reactive<LyricListInfo>({
    page: 1,
    maxPage: 0,
    limit: 30,
    total: 0,
    list: [],
    key: '',
    noItemLabel: '',
  })
}
