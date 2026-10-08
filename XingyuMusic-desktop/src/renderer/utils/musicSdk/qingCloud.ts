/**
 * 官方渠道云解析客户端（钥匙模型）
 *
 * 依据决策：内置解析违法——本模块默认【不启用】。仅当用户在"设置-音源"里
 * 导入官方渠道 JSON 配置（`{lines:[{id,name,levels,enabled,quality,...}]}`，即"钥匙"）后，
 * 才把这里构造的 api 挂载进 `userApi.apis`，解锁对应渠道的播放地址解析。
 *
 * - 5 渠道（wy/kw/qq(=tx)/kg/mg）走官方渠道云 `POST musicserver.haitangw.cc/v1/music/resolve-url`
 * - bili（星宝）走 B 站公开 `x/player/playurl`（非 WBI，客户端直连；官方渠道云无 bili 线路）
 */
import { httpFetch } from '@renderer/utils/request'

/** 渠道音源 id → 我们的 OnlineSource（官方渠道 `qq` = 我们的 `tx`） */
export const QING_TO_LOCAL: Record<string, LX.OnlineSource> = {
  wy: 'wy',
  kw: 'kw',
  qq: 'tx',
  tx: 'tx',
  kg: 'kg',
  mg: 'mg',
  bili: 'bili',
}

export const LOCAL_TO_QING: Record<string, string> = {
  wy: 'wy',
  kw: 'kw',
  tx: 'qq',
  kg: 'kg',
  mg: 'mg',
  bili: 'bili',
}

/** 可解析渠道（本地 OnlineSource） */
export const QING_CHANNELS: LX.OnlineSource[] = ['wy', 'kw', 'tx', 'kg', 'mg', 'bili']

/** 官方渠道音质档 → 洛雪 LX.Quality */
const TIER_TO_QUALITY: Record<string, LX.Quality> = {
  standard: '128k',
  exhigh: '320k',
  lossless: 'flac',
  hires: 'flac24bit',
  sky: 'flac24bit',
  jyeffect: 'flac24bit',
  jymaster: 'flac24bit',
  atmos: 'flac',
  atmos_plus: 'flac24bit',
  clear: 'flac',
  bili192: '192k',
}

/** 洛雪 LX.Quality → 官方渠道音质档（取地址时发哪个 level） */
const QUALITY_TO_TIER: Record<string, string> = {
  '128k': 'standard',
  '192k': 'bili192',
  '320k': 'exhigh',
  flac: 'lossless',
  flac24bit: 'hires',
  ape: 'lossless',
  wav: 'hires',
}

export interface QingLine {
  id: string
  name: string
  levels: string[]
  enabled: boolean
  quality?: string
}

export interface QingValidation {
  ok: boolean
  error?: string
  /** 归一化后的本地渠道配置（只保留可用渠道） */
  lines: { [source: string]: { name: string, levels: string[] }[] }
  /** 各渠道可选 LX.Quality（用于 qualityList） */
  qualityList: LX.QualityList
}

const VALID_IDS = ['wy', 'kw', 'qq', 'kg', 'mg', 'bili']

/**
 * 校验并归一化官方渠道 JSON（`{lines:[...]}`）。
 * 与官方渠道 PC 同款约束：lines 必为数组、每项需 id/name/levels。
 */
export const validateQingLines = (raw: unknown): QingValidation => {
  const result: QingValidation = { ok: false, lines: {}, qualityList: {} }
  let data: any = raw
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch (e: any) {
      result.error = 'JSON 解析失败：' + e.message
      return result
    }
  }
  const lines = Array.isArray(data?.lines) ? data.lines : (Array.isArray(data) ? data : null)
  if (!lines) {
    result.error = '配置格式不正确，请检查 lines 数组及字段'
    return result
  }
  if (!lines.length) {
    result.error = '请至少保留一个可用音源线路'
    return result
  }
  const qualityList: LX.QualityList = {}
  for (const line of lines) {
    const qingId = String(line?.id ?? '')
    const mappedId = QING_TO_LOCAL[qingId]
    if (!mappedId) continue
    if (!Array.isArray(line.levels) || !line.levels.length) continue
    if (line.enabled === false) continue
    result.lines[mappedId] = result.lines[mappedId] ?? []
    result.lines[mappedId].push({
      name: String(line.name ?? qingId),
      levels: line.levels.map((l: unknown) => String(l)),
    })
    const qSet: LX.Quality[] = []
    for (const tier of line.levels) {
      const q = TIER_TO_QUALITY[String(tier)]
      if (q && !qSet.includes(q)) qSet.push(q)
    }
    if (qSet.length) {
      qualityList[mappedId] = (qualityList[mappedId] ?? []).concat(qSet).filter((v, i, a) => a.indexOf(v) === i)
    }
  }
  if (!Object.keys(result.lines).length) {
    result.error = '配置格式不正确，请检查 lines 数组及字段'
    return result
  }
  result.qualityList = qualityList
  result.ok = true
  return result
}

/* ---------------- 客户端请求 ---------------- */

const RESOLVE_URL = 'https://musicserver.haitangw.cc/v1/music/resolve-url'
const CLOUD_TIMEOUT = 12_000
// 客户端 URL 缓存（与官方渠道 PC 同款 45s TTL）
const urlCache = new Map<string, { url: string, expiresAt: number }>()
const getCacheKey = (source: string, rid: string, tier: string) => `${source}|${rid}|${tier}`

const resolveCloud = async(qingSource: string, rid: string, tier: string): Promise<{ url: string, type: LX.Quality }> => {
  const key = getCacheKey(qingSource, rid, tier)
  const cached = urlCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return { url: cached.url, type: TIER_TO_QUALITY[tier] ?? '128k' }

  const req: any = httpFetch(RESOLVE_URL, {
    method: 'post',
    json: true,
    timeout: CLOUD_TIMEOUT,
    data: { source: qingSource, rid, level: tier },
  })
  const { body } = await req.promise
  const data = body?.data ?? body
  if (body?.code != 0 || !data?.url) {
    throw new Error(body?.msg || body?.message || '未返回播放地址')
  }
  urlCache.set(key, { url: data.url, expiresAt: Date.now() + 45_000 })
  return { url: data.url, type: TIER_TO_QUALITY[tier] ?? '128k' }
}

/** bili：B 站公开 playurl（非 WBI），按 bvid/cid 取音频 */
const resolveBili = async(bvid: string, cid: string, tier: string): Promise<{ url: string, type: LX.Quality }> => {
  const key = getCacheKey('bili', bvid, tier)
  const cached = urlCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return { url: cached.url, type: TIER_TO_QUALITY[tier] ?? '128k' }
  const url = `https://api.bilibili.com/x/player/playurl?bvid=${encodeURIComponent(bvid)}&cid=${encodeURIComponent(cid)}&fnver=0&fnval=16&fourk=0&qn=0`
  const req: any = httpFetch(url, {
    method: 'get',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: 'https://www.bilibili.com/',
    },
  })
  const { body } = await req.promise
  if (body?.code !== 0 || !body?.data?.dash?.audio?.length) {
    throw new Error('哔哩未返回播放地址（可能被风控或无音频流）')
  }
  const audios: any[] = body.data.dash.audio
  const pick = tier === 'hires' || tier === 'lossless'
    ? audios.find(a => a.id >= 30280) ?? audios[0]
    : audios.find(a => a.id === 30216 || a.id === 8002) ?? audios[0]
  const urlFinal = (pick.baseUrl || pick.base_url || pick.url) + (pick.extra ? `?${pick.extra}` : '')
  urlCache.set(key, { url: urlFinal, expiresAt: Date.now() + 45_000 })
  return { url: urlFinal, type: TIER_TO_QUALITY[tier] ?? '192k' }
}

export interface QingCloudApis {
  [source: string]: {
    getMusicUrl: (songInfo: LX.Music.MusicInfo, type: LX.Quality) => { canceleFn: () => void, promise: Promise<{ url: string, type: LX.Quality }> }
    getLyric: (songInfo: LX.Music.MusicInfo) => { canceleFn: () => void, promise: Promise<LX.Music.LyricInfo> }
    getPic: (songInfo: LX.Music.MusicInfo) => { canceleFn: () => void, promise: Promise<string> }
  }
}

/**
 * 按导入的渠道配置构造 userApi 形态的 apis。
 * `lines` 来自 `validateQingLines` 归一化结果。
 */
export const buildQingCloudApis = (lines: QingValidation['lines']): QingCloudApis => {
  const apis: QingCloudApis = {}
  const emptyLyric: LX.Music.LyricInfo = { lyric: '', tlyric: '', rlyric: '', lxlyric: '' }
  for (const source of Object.keys(lines) as LX.OnlineSource[]) {
    const qingSource = LOCAL_TO_QING[source]
    const isBili = source === 'bili'
    const pickTier = (quality: LX.Quality): string => {
      const avail = (lines[source] ?? []).flatMap(l => l.levels)
      const want = QUALITY_TO_TIER[quality]
      return avail.includes(want) ? want : (avail[0] ?? (isBili ? 'bili192' : 'standard'))
    }

    apis[source] = {
      getMusicUrl(songInfo: LX.Music.MusicInfo, type: LX.Quality) {
        const rid = String(songInfo.id ?? '')
        const tier = pickTier(type)
        let abort: () => void = () => {}
        const promise = new Promise<{ url: string, type: LX.Quality }>(async(resolve, reject) => {
          try {
            let res
            if (isBili) {
              // 非 WBI：bvid + cid（cid 若缺失则用 bvid 查 view 取 cid）
              const bvid = rid
              let cid = (songInfo as any).cid
              if (!cid) {
                const viewReq: any = httpFetch(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`, {
                  method: 'get',
                  headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.bilibili.com/' },
                })
                const view = await viewReq.promise
                cid = String(view.body?.data?.cid ?? '')
              }
              res = await resolveBili(bvid, String(cid), tier)
            } else {
              res = await resolveCloud(qingSource, rid, tier)
            }
            resolve(res)
          } catch (err: any) {
            reject(err)
          }
        })
        abort = () => { /* httpFetch 无统一取消句柄，best-effort */ }
        return { canceleFn: abort, promise }
      },
      getLyric() {
        return {
          canceleFn: () => {},
          promise: Promise.resolve({ ...emptyLyric }),
        }
      },
      getPic() {
        return {
          canceleFn: () => {},
          promise: Promise.reject(new Error('该渠道暂不支持封面解析')),
        }
      },
    }
  }
  return apis
}
