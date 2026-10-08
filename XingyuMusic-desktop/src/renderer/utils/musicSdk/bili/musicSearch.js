import { httpFetch } from '../../request'
import { decodeName } from '../../index'

export default {
  limit: 30,

  filterItem(item) {
    const pic = item.pic ? item.pic.replace(/^\/\//, 'https://') : null
    return {
      singer: item.author || '',
      name: decodeName((item.title || '').replace(/<[^>]+>/g, '')),
      albumName: null,
      albumId: null,
      songmid: item.bvid || '',
      copyrightId: item.cid || 0,
      source: 'bili',
      interval: item.duration || null,
      img: pic,
      lrc: null,
      otherSource: null,
      types: [{
        type: '128k',
        size: null,
      }],
      _types: {
        '128k': {
          size: null,
        },
      },
      typeUrl: {},
    }
  },

  /**
   * 按关键词搜索哔哩哔哩视频（公开接口，免 WBI）
   * @param {*} str
   * @param {*} page
   * @param {*} limit
   */
  search(str, page = 1, limit = this.limit, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    const url = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(str)}&page=${page}&page_size=${limit}`
    const searchRequest = httpFetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://search.bilibili.com/',
      },
    })
    return searchRequest.promise.then(({ statusCode, body }) => {
      if (statusCode !== 200 || !body || body.code !== 0) return this.search(str, page, limit, retryNum)
      const data = body.data || {}
      const list = (data.result || []).filter(item => item.bvid).map(item => this.filterItem(item))
      const total = data.numResults || 0
      return {
        list,
        page,
        limit,
        total,
        allPage: Math.max(1, Math.ceil(total / limit)),
        source: 'bili',
      }
    })
  },
}
