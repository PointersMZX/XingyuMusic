import musicSearch from './musicSearch'
import musicInfo from './musicInfo'
import mvSearch from './mvSearch'

const bili = {
  musicSearch,
  musicInfo,
  mv: mvSearch,
  getMusicDetailPageUrl(songInfo) {
    return `https://www.bilibili.com/video/${songInfo.songmid}`
  },
}

export default bili
