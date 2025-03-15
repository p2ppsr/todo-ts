import { WalletClient } from '@bsv/sdk'

(async () => {
  const client = new WalletClient('json-api', 'localhost')
  const identityKey = await client.getPublicKey({ identityKey: true })
  console.log(identityKey)
})().catch(e => { console.error(e) })
