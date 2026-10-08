import { httpFetch } from '../../request'
import { decodeName } from '../../index'

export default {
  limit: 30,
  /**
   * 哔哩哔哩 MV（视频）检索，点击在浏览器打开视频页
   */
  search(text, page = 1, limit = this.limit) {
    const url = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(text)}&page=${page}&page_size=${limit}`
    return httpFetch(url).promise.then(({ statusCode, body }) => {
      if (statusCode !== 200 || body.code != 0) return Promise.reject(new Error('bili mv search failed'))
      const raw = body.data?.result || []
      const list = raw.map(item => ({
        source: 'bili',
        id: item.bvid || '',
        name: decodeName((item.title || '').replace(/<[^>]+>/g, '')),
        singer: item.author || '',
        img: item.pic ? item.pic.replace(/^\/\//, 'https://') : null,
        pageUrl: item.bvid ? `https://www.bilibili.com/video/${item.bvid}` : '',
        duration: item.duration || null,
      })).filter(item => item.id)
      const total = body.data?.numResults || 0
      return { source: 'bili', list, page, limit, total, allPage: Math.max(1, Math.ceil(total / limit)) }
    })
  },
}
