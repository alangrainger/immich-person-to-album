import { PersonToAlbum } from './function'
import { init } from '@immich/sdk'

const pta = new PersonToAlbum()

async function main () {
  for (const user of pta.config.users) {

    // Init Immich SDK with the specified API key
    init({ baseUrl: pta.config.immichServer + '/api', apiKey: user.apiKey })

    // Process each of the person-album linkages
    for (const link of user.personLinks) {
      // Populate a truncated API key which will be used in the store.json key name
      link.apiKeyShort = user.apiKey.slice(0, 6)
      try {
        await pta.processPerson(link)
      } catch (e) {
        console.log(e)
      }
    }
  }
}

main().then()
