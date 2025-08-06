import { PersonToAlbum } from './function'
import { init } from '@immich/sdk'
import cron from 'node-cron'

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

// Send the correct process error code for any uncaught exceptions
// so that Docker can gracefully restart the container
process.on('uncaughtException', (err) => {
  console.error('There was an uncaught error', err)
  process.exit(1)
})
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Gracefully shutting down...')
  process.exit(0)
})

cron.schedule(pta.config.schedule || '0,30 * * * *', main)
