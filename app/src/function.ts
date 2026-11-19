import { Link, LinkConfig, Config } from './types'
import { addAssetsToAlbum, AssetResponseDto, IdsFilter, searchAssets } from '@immich/sdk'
import path from 'path'

/** Maximum number of assets in one search page, and in one add-to-album request */
const PAGE_SIZE = 1000

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
        const configJson = require(path.resolve('../data/config.json'))
        if (typeof configJson === 'object') this.config = configJson
      }
    } catch (e) {
      console.log(e)
      console.log('Unable to parse config file.')
    }
  }

  /**
   * Apply the defaults to a config link and check its fields. Throws if the link is invalid.
   */
  normaliseLink (config: LinkConfig): Link {
    const personIds = config.personIds ?? (config.personId ? [config.personId] : [])
    const logic = config.logic ?? 'OR'
    const excludePersonIds = config.excludePersonIds ?? []

    if (!config.albumId) throw new Error('Invalid link: albumId is missing')
    if (!personIds.length) throw new Error('Invalid link: personIds is empty')
    if (logic !== 'AND' && logic !== 'OR') throw new Error(`Invalid link: logic must be AND or OR, not ${logic}`)
    const overlap = personIds.filter(id => excludePersonIds.includes(id))
    if (overlap.length) throw new Error(`Invalid link: ${overlap.join(', ')} is in personIds and excludePersonIds`)

    return {
      description: config.description,
      albumId: config.albumId,
      personIds,
      logic,
      excludePersonIds,
      noOtherPeople: config.noOtherPeople === true
    }
  }

  async processLink (config: LinkConfig) {
    if (config.description) console.log(`=== ${config.description} ===`)
    const link = this.normaliseLink(config)
    console.log(`Adding ${link.logic} of people ${link.personIds.join(', ')} to album ${link.albumId}`)

    const personIds: IdsFilter = link.logic === 'AND' ? { all: link.personIds } : { any: link.personIds }
    if (link.excludePersonIds.length) personIds.none = link.excludePersonIds

    /*
    The search cursor is an offset. The album filter removes assets from the results
    as soon as they go into the album, so collect every page before adding any assets.
    */
    const ids: string[] = []
    let cursor: string | undefined
    do {
      const res = await searchAssets({
        metadataSearchDto: {
          filter: {
            personIds,
            albumIds: { none: [link.albumId] }
          },
          withPeople: link.noOtherPeople || undefined,
          size: PAGE_SIZE,
          cursor
        }
      })
      ids.push(...this.applyNoOtherPeople(link, res.assets.items).map(x => x.id))
      cursor = res.assets.nextCursor ?? undefined
    } while (cursor)

    for (let i = 0; i < ids.length; i += PAGE_SIZE) {
      await addAssetsToAlbum({
        id: link.albumId,
        bulkIdsDto: { ids: ids.slice(i, i + PAGE_SIZE) }
      })
    }
    console.log(` - Added ${ids.length} assets`)
    console.log()
  }

  /**
   * When `noOtherPeople` is set, remove the assets that contain a person who is not in `personIds`
   */
  applyNoOtherPeople (link: Link, assets: AssetResponseDto[]) {
    if (!link.noOtherPeople) return assets
    return assets.filter(asset => {
      // Each search result contains a person from the link, so an empty list means Immich did not send the people
      if (!asset.people?.length) throw new Error(`Immich returned no people for asset ${asset.id}. Check the API key permissions.`)
      return asset.people.every(person => link.personIds.includes(person.id))
    })
  }
}
