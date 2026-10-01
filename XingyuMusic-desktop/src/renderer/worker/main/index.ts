import { exposeWorker } from '../utils/worker'

import * as common from './common'
import * as list from './list'
import * as local from './local'
import * as music from './music'


console.log('hello main worker')


exposeWorker(Object.assign({}, common, list, local, music))

export type workerMainTypes = typeof common
  & typeof list
  & typeof local
  & typeof music
