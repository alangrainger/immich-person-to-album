import * as fs from 'fs'
import * as path from 'path'
import { personConfig } from './types'

export class JSONKeyValueStore<T = any> {
  filePath: string
  cache: Map<string, T>

  constructor () {
    this.filePath = path.resolve('./data/store.json')
    this.cache = new Map<string, T>()
    try {
      const data = fs.readFileSync(this.filePath, 'utf8')
      const parsed: Record<string, T> = JSON.parse(data)
      this.cache = new Map(Object.entries(parsed))
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error
      // File doesn't exist, start with empty store
    }
  }

  private async persist (): Promise<void> {
    const obj = Object.fromEntries(this.cache)
    await fs.promises.writeFile(this.filePath, JSON.stringify(obj, null, 2))
  }

  get (key: string): T | undefined {
    return this.cache.get(key)
  }

  async set (key: string, value: T): Promise<void> {
    this.cache.set(key, value)
    await this.persist()
  }

  personKey (param: personConfig) {
    return param.personId + ':' + param.albumId
  }
}

export default new JSONKeyValueStore()
