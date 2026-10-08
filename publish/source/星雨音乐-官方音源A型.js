/*
name: 官方音源 A 型
description: 官方提供的多线路音源（星记/星芸/星腾/星犬/星谷/星宝 6 条线路），导入后即可直接播放，无需额外配置。
version: 1.0.0
*/
(function () {
  // 多线路解析服务（导入本音源后由应用代发到该服务取播放地址）
  const RESOLVE_URL = 'https://musicserver.haitangw.cc/v1/music/resolve-url'

  // 音质 → 请求档
  const QUALITY_TO_TIER = {
    '128k': 'standard',
    '320k': 'exhigh',
    'flac': 'lossless',
    flac24bit: 'hires',
  }
  // 本音源渠道 → 解析服务渠道（星腾 对应解析服务的 qq）
  const LOCAL_TO_REMOTE = { kw: 'kw', wy: 'wy', tx: 'qq', kg: 'kg', mg: 'mg' }

  // 播放地址短缓存（45s，避免同曲反复取址）
  const urlCache = new Map()
  const CACHE_TTL = 45 * 1000

  const http = (url, opts) => new Promise((resolve, reject) => {
    lx.request(url, opts, (err, resp, body) => {
      if (err) return reject(err)
      resolve({ status: resp && resp.statusCode, body })
    })
  })

  const getRemoteUrl = (remoteSource, rid, tier) => {
    const key = remoteSource + '|' + rid + '|' + tier
    const cached = urlCache.get(key)
    if (cached && cached.exp > Date.now()) return Promise.resolve(cached.url)
    return http(RESOLVE_URL, {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: remoteSource, rid: rid, level: tier }),
      timeout: 15000,
    }).then(({ body }) => {
      const data = (body && body.data) || body
      if (!body || (body.code != null && body.code !== 0) || !data || !data.url) {
        throw new Error((body && (body.msg || body.message)) || '未返回播放地址')
      }
      urlCache.set(key, { url: data.url, exp: Date.now() + CACHE_TTL })
      return data.url
    })
  }

  // 星宝（哔哩）：直连公开播放接口取音频流
  const getBiliUrl = (bvid) => {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: 'https://www.bilibili.com/',
    }
    return http('https://api.bilibili.com/x/web-interface/view?bvid=' + encodeURIComponent(bvid), {
      method: 'get', headers, timeout: 15000,
    }).then(({ body }) => {
      if (!body || body.code !== 0 || !body.data) throw new Error('哔哩视频信息获取失败')
      const cid = String(body.data.cid || '')
      const playUrl = 'https://api.bilibili.com/x/player/playurl?bvid=' + encodeURIComponent(bvid)
        + '&cid=' + cid + '&fnver=0&fnval=16&fourk=0&qn=0'
      return http(playUrl, { method: 'get', headers, timeout: 15000 }).then(({ body: pb }) => {
        if (!pb || pb.code !== 0 || !pb.data || !pb.data.dash || !pb.data.dash.audio || !pb.data.dash.audio.length) {
          throw new Error('哔哩未返回音频流')
        }
        const audios = pb.data.dash.audio
        const pick = audios.find(a => a.id >= 30280) || audios[0]
        const base = pick.baseUrl || pick.base_url || pick.url || ''
        return base + (pick.extra ? '?' + pick.extra : '')
      })
    })
  }

  const getMusicUrl = (source, musicInfo, type) => {
    const rid = String(musicInfo.id || musicInfo.songmid || '')
    if (!rid) throw new Error('缺少歌曲标识')
    if (source === 'bili') return getBiliUrl(rid)
    const remoteSource = LOCAL_TO_REMOTE[source]
    if (!remoteSource) throw new Error('未支持的线路：' + source)
    const tier = QUALITY_TO_TIER[type] || 'exhigh'
    return getRemoteUrl(remoteSource, rid, tier)
  }

  const SOURCES = {
    kw: ['128k', '320k', 'flac', 'flac24bit'],
    wy: ['128k', '320k', 'flac', 'flac24bit'],
    tx: ['128k', '320k', 'flac', 'flac24bit'],
    kg: ['128k', '320k', 'flac', 'flac24bit'],
    mg: ['128k', '320k', 'flac', 'flac24bit'],
    bili: ['128k'],
  }

  // 注册取址处理
  lx.on('request', (req) => {
    if (req.action !== 'musicUrl') return Promise.reject(new Error('unsupported action'))
    return getMusicUrl(req.source, req.info.musicInfo, req.info.type)
  })

  // 初始化：声明各渠道支持的档位
  const sources = {}
  for (const [id, qualitys] of Object.entries(SOURCES)) {
    sources[id] = { type: 'music', actions: ['musicUrl'], qualitys }
  }
  void lx.send('inited', { sources })
})()
