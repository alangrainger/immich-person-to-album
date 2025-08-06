import { init, addAssetsToAlbum, searchAssets } from '@immich/sdk'
import store from './store'
import { personConfig } from './types'

require('dotenv').config()

// Process the .env people configurations into personId/albumId pairs
const peopleConfigs: personConfig[] = Object.keys(process.env)
  .filter(key => key.startsWith('CONFIG_'))
  .map(key => {
    const vals = (process.env[key] || '').split(':')
    if (vals.length === 2) return { personId: vals[0], albumId: vals[1] }
  }).filter(x => !!x)

init({ baseUrl: process.env.IMMICH_SERVER + '/api', apiKey: process.env.API_KEY || '' })

async function processPerson (param: personConfig) {
  let nextPage: string | null = '1'
  let mostRecent

  while (nextPage !== null) {
    console.log(`Processing page ${nextPage} of person ${param.personId}`)
    const res = await searchAssets({
      metadataSearchDto: {
        // I'm using `updated` here because this is documented to be the time when
        // the asset was updated in Immich, and nothing to do with the EXIF data.
        // https://immich.app/docs/api/get-asset-info
        // This may also be the case for `created`, but it doesn't specify
        // that in the docs.
        updatedAfter: store.get(store.personKey(param)),
        page: parseInt(nextPage, 10), // why is `nextPage` a string and `page` a number? ¯\_(ツ)_/¯
        personIds: [param.personId]
      }
    })
    // Track the most recent photo timestamp so we can update the store
    if (!mostRecent) mostRecent = res.assets.items[0].updatedAt

    await addAssetsToAlbum({
      id: param.albumId,
      bulkIdsDto: {
        ids: res.assets.items.map(x => x.id)
      }
    })
    nextPage = res.assets.nextPage
  }

  // Store the most recent asset update value
  await store.set(store.personKey(param), mostRecent)
}

async function main () {
  for (const config of peopleConfigs) {
    try {
      await processPerson({
        personId: config.personId,
        albumId: config.albumId
      })
    } catch (e) {
      console.log(e)
    }
  }
}

main().then()
