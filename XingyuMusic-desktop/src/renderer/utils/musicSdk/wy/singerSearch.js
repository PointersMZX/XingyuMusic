import { eapiRequest } from './utils/index'

// 网易云 歌手/专辑 关键词检索（cloudsearch，type: 100=歌手 10=专辑）
const searchType = {
  singer: 100,
  album: 10,
}

export default {
  limit: 30,
  search(text, page = 1, limit = this.limit, type = 'singer') {
    const t = type === 'album' ? searchType.album : searchType.singer
    return eapiRequest('/api/cloudsearch/pc', {
      s: text,
      type: t,
      limit,
      total: page == 1,
      offset: limit * (page - 1),
    }).promise.then(({ body }) => {
      if (body.code != 200) return Promise.reject(new Error('wy ' + type + ' search failed'))
      const result = body.result || {}
      if (type === 'album') {
        const list = (result.albums || []).map(item => ({
          source: 'wy',
          id: String(item.id),
          name: item.name || '',
          author: (item.ar || []).map(a => a.name).filter(Boolean).join('、'),
          img: item.picUrl || null,
          desc: item.desc || '',
          publishDate: item.pubtime ? new Date(item.pubtime).toISOString().slice(0, 10) : null,
          playCount: null,
        }))
        const total = result.albumCount || 0
        return { source: 'wy', list, page, limit, total, allPage: Math.max(1, Math.ceil(total / limit)) }
      }
      const list = (result.artists || []).map(item => ({
        source: 'wy',
        id: String(item.id),
        name: item.name || '',
        country: null,
        avatar: item.picUrl || null,
        desc: item.briefDesc || '',
        songCount: item.musicSize || 0,
        albumCount: item.albumSize || 0,
      }))
      const total = result.artistCount || 0
      return { source: 'wy', list, page, limit, total, allPage: Math.max(1, Math.ceil(total / limit)) }
    })
  },
}
