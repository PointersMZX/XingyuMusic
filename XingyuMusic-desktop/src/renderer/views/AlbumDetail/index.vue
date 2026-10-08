<template>
  <div :class="$style.container">
    <div :class="$style.header">
      <div :class="$style.headerLeft" :style="{ backgroundImage: 'url(' + (info.img ?? '') + ')' }">
        <img v-if="!info.img" :class="$style.logo" src="@renderer/assets/images/xingyu-logo.png" alt="" />
      </div>
      <div :class="$style.headerMiddle">
        <h3 :title="info.name">{{ info.name }}</h3>
        <p v-if="info.author" :class="$style.author">{{ info.author }}</p>
        <p v-if="info.desc" :title="info.desc">{{ info.desc }}</p>
        <p :class="$style.counts">
          <span :class="$style.sourceTag">{{ sourceLabel }}</span>
        </p>
      </div>
      <div :class="$style.headerRight">
        <base-btn :class="$style.headerBtn" :disabled="!list.length" @click="handlePlayAll">{{ $t('list__play') }}</base-btn>
        <base-btn :class="$style.headerBtn" @click="handleBack">{{ $t('back') }}</base-btn>
      </div>
    </div>
    <div :class="$style.listHeader">
      <span :class="$style.listTitle" v-text="albumListLabel" />
    </div>
    <div :class="$style.list">
      <material-online-list
        ref="listRef"
        :page="page"
        :limit="limit"
        :total="total"
        :list="list"
        :no-item="noItemLabel"
        @play-list="handlePlayList"
        @toggle-page="togglePage"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { ref, computed, watch } from '@common/utils/vueTools'
import { useRouter, useRoute } from '@common/utils/vueRouter'
import musicSdk from '@renderer/utils/musicSdk'
import { sourceNames } from '@renderer/store'
import { setTempList } from '@renderer/store/list/action'
import { playList } from '@renderer/core/player/action'
import { LIST_IDS } from '@common/constants'

interface Query {
  source?: string
  id?: string
  name?: string
  img?: string
  author?: string
  desc?: string
  page?: string
}

const source = ref<LX.OnlineSource>('mg')
const albumId = ref<string>('')
const page = ref<number>(1)
const limit = ref<number>(20)

const list = ref<LX.Music.MusicInfoOnline[]>([])
const total = ref<number>(0)
const noItemLabel = ref<string>('')
const listRef = ref<any>(null)
const isFallback = ref(false)
const albumListLabel = computed(() => (isFallback.value ? window.i18n.t('album_detail__related') : window.i18n.t('album_detail__tracks')))
const info = ref<{ name: string, img: string, desc: string, author: string }>({ name: '', img: '', desc: '', author: '' })

const getListData = async() => {
  noItemLabel.value = ''
  const sdk = musicSdk[source.value as keyof typeof musicSdk] as any
  const getAlbumDetail = sdk?.album?.getAlbumDetail
  let listArr: LX.Music.MusicInfoOnline[] = []
  let resultInfo: any = null
  let fallback = false
  if (getAlbumDetail) {
    try {
      const result = await getAlbumDetail.call(sdk.album, albumId.value, page.value)
      listArr = result.list ?? []
      resultInfo = result.info ?? null
      total.value = result.total ?? 0
      limit.value = result.limit ?? limit.value
    } catch (err) {
      listArr = []
    }
  }
  if (!listArr.length) {
    // 无可靠专辑曲目（如星芸）：退化为按专辑名关键词检索，保证可播放
    fallback = true
    const getKeyword = sdk?.musicSearch?.search
    if (getKeyword) {
      try {
        const result = await getKeyword.call(sdk.musicSearch, info.value.name, page.value, limit.value)
        listArr = result.list ?? []
        total.value = result.total ?? 0
      } catch (err) {
        listArr = []
      }
    }
  }
  isFallback.value = fallback
  list.value = listArr
  if (resultInfo) {
    info.value = {
      name: resultInfo.name || info.value.name,
      img: resultInfo.img || info.value.img,
      desc: resultInfo.desc || info.value.desc,
      author: resultInfo.author || info.value.author,
    }
  }
  if (!list.value.length) noItemLabel.value = window.i18n.t('no_item')
  setTimeout(() => { if (listRef.value) listRef.value.scrollToTop() })
}

export default {
  beforeRouteEnter(to: { query: Query }, from: any, next: (r?: { path: string, query: Query }) => void) {
    const _source = to.query.source
    const _id = to.query.id
    if (_source == null || _id == null) {
      next({ path: '/search' })
      return
    }
    next()
  },
  setup() {
    const router = useRouter()
    const route = useRoute() as any

    const sourceLabel = computed(() => sourceNames.value[source.value as LX.OnlineSource] ?? source.value)

    const syncFromQuery = (query: Query) => {
      source.value = (query.source as LX.OnlineSource) ?? 'mg'
      albumId.value = query.id ?? ''
      page.value = query.page ? parseInt(query.page) : 1
      info.value = {
        name: query.name ?? '',
        img: query.img ?? '',
        desc: query.desc ?? '',
        author: query.author ?? '',
      }
    }

    syncFromQuery(route.query)
    void getListData()

    watch(() => route.query, (q: Query) => {
      syncFromQuery(q)
      void getListData()
    })

    const togglePage = (p: number) => {
      page.value = p
      void router.replace({ path: route.path, query: { ...route.query, page: String(p) } })
      void getListData()
    }

    const handlePlayAll = () => {
      if (!list.value.length) return
      void setTempList(`album__${albumId.value}`, [...list.value]).then(() => {
        playList(LIST_IDS.TEMP, 0)
      })
    }

    const handlePlayList = (index: number) => {
      if (!list.value.length) return
      void setTempList(`album__${albumId.value}`, [...list.value]).then(() => {
        playList(LIST_IDS.TEMP, index)
      })
    }

    const handleBack = () => { router.back() }

    return {
      source,
      info,
      list,
      page,
      limit,
      total,
      noItemLabel,
      listRef,
      sourceLabel,
      albumListLabel,
      togglePage,
      handlePlayAll,
      handlePlayList,
      handleBack,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  display: flex;
  flex-flow: column nowrap;
  height: 100%;
}

.header {
  flex: none;
  display: flex;
  flex-flow: row nowrap;
  height: 80px;
}

.headerLeft {
  flex: none;
  margin-left: 15px;
  height: 100%;
  aspect-ratio: 1 / 1;
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  background-position: center;
  background-size: cover;
  background-color: var(--color-button-background);
  opacity: .9;
  box-shadow: 0 0 2px 0 rgba(0,0,0,.2);
}

.logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: .6;
}

.headerMiddle {
  flex: auto;
  padding: 2px 7px;
  min-width: 0;
  h3 {
    .mixin-ellipsis-1();
    line-height: 1.2;
    padding-bottom: 5px;
    color: var(--color-font);
  }
  p {
    .mixin-ellipsis(3);
    font-size: 12px;
    line-height: 1.2;
    color: var(--color-font-label);
  }
  .author {
    margin-top: 6px;
    .mixin-ellipsis-1();
  }
  .counts {
    display: flex;
    flex-flow: row nowrap;
    gap: 15px;
    margin-top: 8px;
    font-size: 12px;
    color: var(--color-font-label);
    .sourceTag {
      padding: 0 6px;
      border-radius: 8px;
      background-color: var(--color-primary);
      color: var(--color-primary-font);
    }
  }
}

.headerRight {
  flex: none;
  display: flex;
  align-items: center;
  padding-right: 15px;
  .headerBtn {
    border-radius: 0;
    &:first-child {
      border-top-left-radius: 4px;
      border-bottom-left-radius: 4px;
    }
    &:last-child {
      border-top-right-radius: 4px;
      border-bottom-right-radius: 4px;
    }
  }
}

.list {
  position: relative;
  width: 100%;
  min-height: 0;
  flex: auto;
  height: 100%;
}

.listHeader {
  flex: none;
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  padding: 6px 15px 2px;
}

.listTitle {
  font-size: 12px;
  color: var(--color-font-label);
}
</style>
