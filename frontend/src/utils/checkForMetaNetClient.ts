import { WalletClient } from '@bsv/sdk'

export default async function checkForMetaNetClient (): Promise<number> {
  try {
    const result = (await new WalletClient().getNetwork()).network
    if (result === 'mainnet' || result === 'testnet') {
      return 1
    } else {
      return -1
    }
  } catch (e) {
    return 0
  }
}
