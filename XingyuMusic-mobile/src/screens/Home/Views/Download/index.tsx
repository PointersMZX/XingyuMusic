import { useEffect, useMemo, useState } from 'react'
import { FlatList, View, TouchableOpacity, StyleSheet } from 'react-native'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import {
  cancelDownloadTask,
  clearCompletedTasks,
  getDownloadTasks,
  removeDownloadTask,
  retryDownloadTask,
  type DownloadTask,
} from '@/core/download/manager'
export default () => {
  const t = useI18n()
  const theme = useTheme()
  const [tasks, setTasks] = useState<DownloadTask[]>(() => getDownloadTasks())
  useEffect(() => {
    const handleUpdated = (list: unknown[]) => {
      setTasks(list as DownloadTask[])
    }
    global.state_event.on('downloadTasksUpdated', handleUpdated)
    return () => {
      global.state_event.off('downloadTasksUpdated', handleUpdated)
    }
  }, [])
  const renderItem: ((info: { item: DownloadTask }) => JSX.Element) = ({ item }) => {
    const isDownloading = item.status == 'downloading'
    return (
      <View style={styles.item}>
        <View style={styles.itemMain}>
          <Text numberOfLines={1} style={styles.name} color={theme['c-font']}>{item.name}</Text>
          <Text numberOfLines={1} style={styles.sub} color={theme['c-font-label']}>
            {item.artist ? `${item.artist} · ` : ''}{item.quality.toUpperCase()} · {item.source}
          </Text>
          {
            isDownloading
              ? (
                <View style={styles.progressRow}>
                  <View style={styles.progressTrack}>
                    <View style={{ ...styles.progressFill, width: `${item.progress}%` }} />
                  </View>
                  <Text numberOfLines={1} style={styles.progressText} color={theme['c-font-label']}>{item.progress}%</Text>
                </View>
                )
              : (
                <Text numberOfLines={1} style={styles.status} color={item.status == 'success' ? theme['c-primary-font'] : theme['c-font-label']}>
                  {item.status == 'success' ? t('download__success') : item.status == 'error' ? `${t('download__error')}${item.error ? `（${item.error}）` : ''}` : t('download__cancelled')}
                </Text>
                )
          }
          {
            isDownloading && item.speed ? <Text numberOfLines={1} style={styles.sub} color={theme['c-font-label']}>{item.speed}</Text> : null
          }
        </View>
        <View style={styles.itemActions}>
          {
            isDownloading
              ? <TouchableOpacity onPress={() => { cancelDownloadTask(item.id) }} hitSlop={8}>
                  <Text style={styles.action} color={theme['c-font-label']}>{t('download__cancel_btn')}</Text>
                </TouchableOpacity>
              : null
          }
          {
            item.status == 'error' || item.status == 'cancelled'
              ? (
                <>
                  <TouchableOpacity onPress={() => { retryDownloadTask(item.id) }} hitSlop={8}>
                    <Text style={styles.action} color={theme['c-primary-font']}>{t('download__retry_btn')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { removeDownloadTask(item.id) }} hitSlop={8}>
                    <Text style={styles.action} color={theme['c-font-label']}>{t('download__remove')}</Text>
                  </TouchableOpacity>
                </>
                )
              : null
          }
          {
            item.status == 'success'
              ? <TouchableOpacity onPress={() => { removeDownloadTask(item.id) }} hitSlop={8}>
                  <Text style={styles.action} color={theme['c-font-label']}>{t('download__remove')}</Text>
                </TouchableOpacity>
              : null
          }
        </View>
      </View>
    )
  }
  const footer = useMemo(() => {
    if (!tasks.length) {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyText} color={theme['c-font-label']}>{t('download__empty')}</Text>
        </View>
      )
    }
    const hasSuccess = tasks.some(task => task.status == 'success')
    return hasSuccess
      ? (
          <TouchableOpacity onPress={() => { clearCompletedTasks() }} style={styles.footer}>
            <Text style={styles.footerText} color={theme['c-font-label']}>{t('download__clear_btn')}</Text>
          </TouchableOpacity>
        )
      : null
  }, [tasks, theme, t])
  return (
    <View style={styles.container}>
      <FlatList

        style={styles.list}
        data={tasks}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ListFooterComponent={footer}
        contentContainerStyle={tasks.length ? undefined : styles.emptyContainer}
      />
    </View>
  )
}
const styles = createStyle({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
    paddingLeft: 10,
    paddingRight: 10,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  itemMain: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    lineHeight: 19,
  },
  sub: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(128,128,128,0.25)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#7C20C2',
  },
  progressText: {
    fontSize: 11,
    width: 38,
    textAlign: 'right',
  },
  status: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 14,
    paddingLeft: 10,
  },
  action: {
    fontSize: 12,
  },
  footer: {
    padding: 15,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
  },
})
