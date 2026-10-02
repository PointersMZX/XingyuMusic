<template>
  <div :class="$style.local">
    <div :class="$style.header">
      <div :class="$style.title">
        <span>{{ $t('local_music') }}</span>
        <span v-if="scanProgress" :class="$style.progress" :aria-label="scanProgress">{{ scanProgress }}</span>
      </div>
      <div :class="$style.btns">
        <div :class="$style.sortControl">
          <span :class="$style.sortLabel">{{ $t('local_sort') }}</span>
          <select :class="$style.sortSelect" :value="sortType" @change="handleSortSelect">
            <option v-for="opt in LOCAL_SORT_OPTIONS" :key="opt" :value="opt">{{ $t('local_sort_' + opt) }}</option>
          </select>
        </div>
        <base-btn min @click="addDir">{{ $t('local_add_dir') }}</base-btn>
        <base-btn min :disabled="isScanning || !dirs.length" @click="rescan">{{ $t('local_refresh') }}</base-btn>
        <base-btn min :outline="!isShowDirs" @click="isShowDirs = !isShowDirs">{{ $t('local_dirs') }}</base-btn>
      </div>
    </div>
    <div v-show="isShowDirs" :class="$style.dirs">
      <div v-if="!dirs.length" :class="$style.noDirs">{{ $t('local_no_dirs') }}</div>
      <template v-else>
        <div v-for="(dir, index) in dirs" :key="dir" :class="$style.dirRow">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 425.2 425.2" height="16" width="16" space="preserve">
            <use xlink:href="#icon-folder" />
          </svg>
          <span :class="$style.dirPath" :title="dir">{{ dir }}</span>
          <span :class="$style.dirBtns">
            <button class="no-select" :title="$t('local_dir_tip')" :disabled="index == 0" @click="moveDir(index, index - 1)">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 451.847 451.847" height="16" width="16" space="preserve">
                <use xlink:href="#icon-up" />
              </svg>
            </button>
            <button class="no-select" :title="$t('local_dir_tip')" :disabled="index == dirs.length - 1" @click="moveDir(index, index + 1)">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 451.847 451.847" height="16" width="16" space="preserve">
                <use xlink:href="#icon-down" />
              </svg>
            </button>
            <button class="no-select" :title="$t('local_dir_tip')" @click="removeDir(index)">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 212.982 212.982" height="16" width="16" space="preserve">
                <use xlink:href="#icon-delete" />
              </svg>
            </button>
          </span>
        </div>
      </template>
    </div>
    <div :class="$style.content">
      <music-list :list-id="LIST_IDS.LOCAL" />
    </div>
  </div>
</template>

<script>
import { onMounted } from '@common/utils/vueTools'
import { LIST_IDS } from '@common/constants'
import MusicList from '@renderer/views/List/MusicList/index.vue'
import useLocal from './useLocal'

export default {
  name: 'Local',
  components: {
    MusicList,
  },
  setup() {
    const {
      dirs,
      sortType,
      LOCAL_SORT_OPTIONS,
      isScanning,
      scanProgress,
      isShowDirs,
      addDir,
      removeDir,
      moveDir,
      rescan,
      init,
      onSortChange,
    } = useLocal()

    const handleSortSelect = (e) => {
      void onSortChange(e.target.value)
    }

    onMounted(() => {
      void init()
    })

    return {
      LIST_IDS,
      dirs,
      sortType,
      LOCAL_SORT_OPTIONS,
      handleSortSelect,
      isScanning,
      scanProgress,
      isShowDirs,
      addDir,
      removeDir,
      moveDir,
      rescan,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.local {
  position: relative;
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
}

.header {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  justify-content: space-between;
  padding: 10px 15px 0;
  gap: 10px;
}

.title {
  display: flex;
  flex-flow: row nowrap;
  align-items: baseline;
  gap: 10px;
  min-width: 0;

  span:first-child {
    font-size: 16px;
    font-weight: bold;
    color: var(--color-font);
  }
}

.progress {
  font-size: 12px;
  color: var(--color-font-label);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btns {
  display: flex;
  flex-flow: row nowrap;
  gap: 6px;
  flex: none;
  align-items: center;
}

.sortControl {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 6px;
  margin-right: 4px;
}

.sortLabel {
  font-size: 12px;
  color: var(--color-font-label);
}

.sortSelect {
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--color-border-background, var(--color-primary-alpha-300));
  border-radius: 8px;
  background-color: var(--color-button-background);
  color: var(--color-font);
  font-size: 12px;
  cursor: pointer;
  outline: none;
  transition: border-color .2s ease;

  &:hover,
  &:focus {
    border-color: var(--color-primary);
  }

  option {
    background-color: var(--color-main-background, #1a1a2e);
    color: var(--color-font);
  }
}

.dirs {
  padding: 8px 15px;
  display: flex;
  flex-flow: column nowrap;
  gap: 4px;
  max-height: 40%;
  overflow-y: auto;
}

.noDirs {
  font-size: 12px;
  color: var(--color-font-label);
}

.dirRow {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 6px;
  min-height: 26px;
  color: var(--color-font);

  svg {
    flex: none;
    opacity: .7;
  }
}

.dirPath {
  flex: auto;
  min-width: 0;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dirBtns {
  display: flex;
  flex-flow: row nowrap;
  gap: 2px;
  flex: none;

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 6px;
    background-color: transparent;
    color: var(--color-font-label);
    cursor: pointer;
    transition: background-color .2s ease;

    &:hover {
      background-color: var(--color-button-background-hover);
      color: var(--color-font);
    }
    &:disabled {
      opacity: .35;
      cursor: default;
    }
  }
}

.content {
  flex: auto;
  min-height: 0;
  display: flex;
  flex-flow: column nowrap;
  overflow: hidden;
}

</style>
