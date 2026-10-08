import music from '@/utils/musicSdk'
const musicSdk = music as unknown as Record<string, any>

export interface SingerItem {
  source: string
  id: string
  name: string
  country?: string | null
  avatar?: string | null
  desc?: string
  songCount?: number
  albumCount?: number
}

export declare interface ListInfo {
  list: SingerItem[]
  total: number
  page: number
  maxPage: number
  limit: number
  key: string | null
}

interface ListInfos extends Partial<Record<LX.OnlineSource, ListInfo>> {
  'all': ListInfo
}

export type Source = LX.OnlineSource | 'all'

export interface InitState {
  searchText: string
  source: Source
  sources: Source[]
  listInfos: ListInfos
  maxPages: Partial<Record<LX.OnlineSource, number>>
}

const state: InitState = {
  searchText: '',
  source: 'kw',
  sources: [],
  listInfos: {
    all: {
      page: 1,
      maxPage: 0,
      limit: 30,
      total: 0,
      list: [],
      key: null,
    },
  },
  maxPages: {},
}

for (const source of musicSdk.sources) {
  if (!musicSdk[source.id]?.singer) continue
  state.sources.push(source.id as LX.OnlineSource)
  state.listInfos[source.id as LX.OnlineSource] = {
    page: 1,
    maxPage: 0,
    limit: 30,
    total: 0,
    list: [],
    key: '',
  }
  state.maxPages[source.id as LX.OnlineSource] = 0
}
state.sources.push('all')

export const maxPages: Partial<Record<LX.OnlineSource, number>> = state.maxPages

export default state
