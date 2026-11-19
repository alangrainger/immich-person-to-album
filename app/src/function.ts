import { Link, LinkConfig, Config } from './types'
import {
  addAssetsToAlbum,
  AssetResponseDto,
  getMyUser,
  IdsFilter,
  removeAssetFromAlbum,
  SearchFilter,
  SearchFilterBranch,
  searchAssets
} from '@immich/sdk'
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
      noOtherPeople: config.noOtherPeople === true,
      removeUnmatched: config.removeUnmatched === true
    }
  }

  async processLink (config: LinkConfig) {
    if (config.description) console.log(`=== ${config.description} ===`)
    const link = this.normaliseLink(config)
    console.log(`Adding ${link.logic} of people ${link.personIds.join(', ')} to album ${link.albumId}`)

    const personIds: IdsFilter = link.logic === 'AND' ? { all: link.personIds } : { any: link.personIds }
    if (link.excludePersonIds.length) personIds.none = link.excludePersonIds

    const assets = await this.searchAll({ personIds, albumIds: { none: [link.albumId] } }, link.noOtherPeople)
    const ids = this.applyNoOtherPeople(link, assets).map(x => x.id)

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
   * Get every asset that matches a search filter.
   *
   * The search cursor is an offset. A change to an album changes the results of a search that
   * filters on that album, so this collects every page before the caller adds or removes assets.
   */
  async searchAll (filter: SearchFilter, withPeople = false) {
    const assets: AssetResponseDto[] = []
    let cursor: string | undefined
    do {
      const res = await searchAssets({
        metadataSearchDto: { filter, withPeople: withPeople || undefined, size: PAGE_SIZE, cursor }
      })
      assets.push(...res.assets.items)
      cursor = res.assets.nextCursor ?? undefined
    } while (cursor)
    return assets
  }

  /**
   * Remove the assets that match none of the links of an album. Only the albums that have
   * a link with `removeUnmatched` are processed.
   *
   * @param configs - All the links of one user
   */
  async removeUnmatched (configs: LinkConfig[]) {
    const albumIds = new Set(configs.filter(x => x.removeUnmatched === true).map(x => x.albumId))
    if (!albumIds.size) return
    // Other users can add assets to a shared album. Those assets are never removed.
    const userId = (await getMyUser()).id

    for (const albumId of albumIds) {
      console.log(`Removing unmatched assets from album ${albumId}`)
      try {
        // An invalid link throws here, and the album is then left as it is
        const links = configs.filter(x => x.albumId === albumId).map(x => this.normaliseLink(x))

        /*
        A person ID stops matching when the person is merged or face recognition is reset.
        The album would then lose all the photos of that person, so do nothing instead.
        */
        const missing = await this.findPeopleWithNoAssets(links.flatMap(x => x.personIds))
        if (missing.length) {
          console.log(` - Skipped: no assets found for people ${missing.join(', ')}. Check the person IDs.`)
          continue
        }

        // An asset is removed only when every link of the album rejects it
        let ids: string[] | undefined
        for (const link of links) {
          const assets = await this.searchAll({ albumIds: { any: [albumId] }, or: this.unmatchedBranches(link) })
          const unmatched = new Set(assets.filter(x => x.ownerId === userId).map(x => x.id))
          ids = ids ? ids.filter(id => unmatched.has(id)) : [...unmatched]
          if (!ids.length) break
        }
        ids = ids ?? []

        for (let i = 0; i < ids.length; i += PAGE_SIZE) {
          await removeAssetFromAlbum({
            id: albumId,
            bulkIdsDto: { ids: ids.slice(i, i + PAGE_SIZE) }
          })
        }
        console.log(` - Removed ${ids.length} assets`)
      } catch (e) {
        console.log(e)
      }
    }
    console.log()
  }

  /**
   * The search branches that find the assets a link rejects. An asset that matches one branch is rejected.
   *
   * `noOtherPeople` has no search filter, so an asset that it rejects is not found here.
   */
  unmatchedBranches (link: Link): SearchFilterBranch[] {
    const branches: SearchFilterBranch[] = link.logic === 'AND'
      ? link.personIds.map(id => ({ personIds: { none: [id] } }))
      : [{ personIds: { none: link.personIds } }]
    if (link.excludePersonIds.length) branches.push({ personIds: { any: link.excludePersonIds } })
    return branches
  }

  /**
   * Get the person IDs from a list that have no assets in Immich
   */
  async findPeopleWithNoAssets (personIds: string[]) {
    const missing: string[] = []
    for (const id of new Set(personIds)) {
      const res = await searchAssets({
        metadataSearchDto: { filter: { personIds: { any: [id] } }, size: 1 }
      })
      if (!res.assets.items.length) missing.push(id)
    }
    return missing
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
