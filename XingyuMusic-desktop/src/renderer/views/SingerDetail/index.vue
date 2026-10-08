<template>
  <div :class="$style.container">
    <div :class="$style.header">
      <div :class="$style.headerLeft" :style="{ backgroundImage: 'url(' + (info.avatar ?? '') + ')' }">
        <img v-if="!info.avatar" :class="$style.logo" src="@renderer/assets/images/xingyu-logo.png" alt="" />
      </div>
      <div :class="$style.headerMiddle">
        <h3 :title="info.name">{{ info.name }}</h3>
        <p v-if="info.desc" :title="info.desc">{{ info.desc }}</p>
        <p v-if="info.songCount != null || info.albumCount != null" :class="$style.counts">
          <span v-if="info.songCount != null"><svg-icon name="music" />{{ info.songCount }}</span>
          <span v-if="info.albumCount != null"><svg-icon name="headphones" />{{ info.albumCount }}</span>
          <span :class="$style.sourceTag">{{ sourceLabel }}</span>
        </p>
      </div>
      <div :class="$style.headerRight">
        <base-btn :class="$style.headerBtn" :disabled="!list.length" @click="handlePlayAll">{{ $t('list__play') }}</base-btn>
        <base-btn :class="$style.headerBtn" @click="handleBack">{{ $t('back') }}</base-btn>
      </div>
    </div>
    <div :class="$style.listHeader">
      <span :class="$style.listTitle" v-text="songListLabel" />
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
  avatar?: string
  desc?: string
  songCount?: string
  albumCount?: string
  page?: string
}

const source = ref<LX.OnlineSource>('kw')
const singerId = ref<string>('')
const singerName = ref<string>('')
const page = ref<number>(1)
const limit = 25

const list = ref<LX.Music.MusicInfoOnline[]>([])
const total = ref<number>(0)
const noItemLabel = ref<string>('')
const listRef = ref<any>(null)
const info = ref<{
  name: string
  avatar: string
  desc: string
  songCount: number | null
  albumCount: number | null
}>({ name: '', avatar: '', desc: '', songCount: null, albumCount: null })

const songListLabel = computed(() => window.i18n.t('singer_detail__related'))

const getListData = async() => {
  noItemLabel.value = ''
  const sdk = musicSdk[source.value as keyof typeof musicSdk] as any
  const getKeyword = sdk?.musicSearch?.search
  if (!getKeyword) {
    noItemLabel.value = window.i18n.t('no_item')
    return
  }
  try {
    const result = await getKeyword.call(sdk.musicSearch, singerName.value, page.value, limit)
    list.value = result.list ?? []
    total.value = result.total ?? 0
    if (!list.value.length) noItemLabel.value = window.i18n.t('no_item')
  } catch (err) {
    list.value = []
    total.value = 0
    noItemLabel.value = window.i18n.t('no_item')
  }
  setTimeout(() => { if (listRef.value) listRef.value.scrollToTop() })
}

export default {
  beforeRouteEnter(to: { query: Query }, from: any, next: (r?: { path: string, query: Query }) => void) {
    const _source = to.query.source
    const _id = to.query.id
    const _name = to.query.name
    if (_source == null || _id == null || _name == null) {
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
      source.value = (query.source as LX.OnlineSource) ?? 'kw'
      singerId.value = query.id ?? ''
      singerName.value = query.name ?? ''
      page.value = query.page ? parseInt(query.page) : 1
      info.value = {
        name: query.name ?? '',
        avatar: query.avatar ?? '',
        desc: query.desc ?? '',
        songCount: query.songCount != null ? parseInt(query.songCount) : null,
        albumCount: query.albumCount != null ? parseInt(query.albumCount) : null,
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
      void setTempList(`singer__${singerId.value}`, [...list.value]).then(() => {
        playList(LIST_IDS.TEMP, 0)
      })
    }

    const handlePlayList = (index: number) => {
      if (!list.value.length) return
      void setTempList(`singer__${singerId.value}`, [...list.value]).then(() => {
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
      songListLabel,
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
  .counts {
    display: flex;
    flex-flow: row nowrap;
    gap: 15px;
    margin-top: 8px;
    font-size: 12px;
    color: var(--color-font-label);
    svg { margin-right: 2px; }
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
