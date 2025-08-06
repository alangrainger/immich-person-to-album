import { Link, Config } from './types'
import { addAssetsToAlbum, searchAssets } from '@immich/sdk'
import store from './store'

// require('dotenv').config()

export class PersonToAlbum {
  config: Config

  constructor () {
    this.initConfig()
  }

  /**
   * Read the config.json file or parse the CONFIG env value to get the configuration
   */
  initConfig () {
    try {
      if (process.env.CONFIG) {
        // Attempt to parse docker-compose config string into JSON (if specified)
        this.config = JSON.parse(process.env.CONFIG)
      } else {
        const configJson = require('../config.json')
        if (typeof configJson === 'object') this.config = configJson
      }
    } catch (e) {
      console.log(e)
      console.log('Unable to parse config file.')
    }
  }

  async processPerson (link: Link) {
    let nextPage: string | null = '1'
    let mostRecent

    if (link.description) console.log(`=== ${link.description} ===`)
    console.log(`Adding person ${link.personId} to album ${link.albumId}`)

    while (nextPage !== null) {
      console.log(` - Processing page ${nextPage}`)
      const res = await searchAssets({
        metadataSearchDto: {
          // I'm using `updated` here because this is documented to be the time when
          // the asset was updated in Immich, and nothing to do with the EXIF data.
          // https://immich.app/docs/api/get-asset-info
          // This may also be the case for `created`, but it doesn't specify that in the docs.
          updatedAfter: store.get(this.getUpdateKeyName(link)),
          page: parseInt(nextPage, 10), // why is `nextPage` a string and `page` a number? ¯\_(ツ)_/¯
          personIds: [link.personId]
        }
      })
      // Track the most recent photo timestamp so we can update the store
      if (!mostRecent) mostRecent = res.assets.items[0].updatedAt

      await addAssetsToAlbum({
        id: link.albumId,
        bulkIdsDto: {
          ids: res.assets.items.map(x => x.id)
        }
      })
      nextPage = res.assets.nextPage
    }

    // Store the most recent asset update value so we can start processing only newer items next time.
    await store.set(this.getUpdateKeyName(link), mostRecent)
    console.log()
  }

  /**
   * Get the correctly formatted key name for most-recent updated value in the store
   */
  getUpdateKeyName (link: Link) {
    return [link.apiKeyShort, link.personId, link.albumId].join(':')
  }
}
