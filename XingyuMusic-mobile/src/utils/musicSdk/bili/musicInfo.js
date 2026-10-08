import { httpFetch } from '../../request'

const stripHtml = str => String(str || '').replace(/<[^>]+>/g, '')

const formatDuration = (seconds) => {
  if (!seconds && seconds !== 0) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

export default {
  /**
   * 通过 bvid 获取视频信息
   * @param {*} songmid bvid
   */
  getMusicInfo(songmid) {
    const request = httpFetch(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(songmid)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://www.bilibili.com/',
      },
    })
    return request.promise.then(({ statusCode, body }) => {
      if (statusCode !== 200 || !body || body.code !== 0 || !body.data) return Promise.reject(new Error('bili getMusicInfo failed'))
      const data = body.data
      const pic = data.pic ? data.pic.replace(/^\/\//, 'https://') : null
      return {
        name: stripHtml(data.title),
        artist: data.owner && data.owner.name ? data.owner.name : '',
        album: null,
        pic,
        cid: data.cid,
        duration: formatDuration(data.duration),
        description: data.desc || '',
      }
    })
  },
}
