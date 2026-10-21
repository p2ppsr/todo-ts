# ToDo List — Get Rewarded!


Create and complete TODO items, with a reward.

A deployment of the master branch of this repository is at [todo.metanet.app](https://todo.metanet.app)

## Overview

This TODO list application goes beyond the classic demo traditionally used to teach people the basics of UI libraries. It showcases Metanet technologies like tokenization, identity, encryption and state management. To learn more, [check out the accompanying tutorial series](https://docs.projectbabbage.com/docs/quickstarts/your-first-bsv-app).

To learn more about building Bitcoin-powered applications for the Metanet with these tools, head over to the [Babbage Docs](https://docs.projectbabbage.com).

## Standard BSV project structure.

Helpful Links:

- [LARS (for local development)](https://github.com/bitcoin-sv/lars)
- [CARS CLI (for cloud deployment)](https://github.com/bitcoin-sv/cars-cli)
- [RUN YOUR OWN CARS NODE](https://github.com/bitcoin-sv/cars-node)
- [Specification for deployment-info.json](https://github.com/bitcoin-sv/BRCs/blob/master/apps/0102.md)

## Getting Started

- Clone this repository
- Run `npm i` to install dependencies
- Run `npm run lars` to configure the local environment according to your needs
- Use `npm run start` to spin up and start writing code
- When you're ready to publish your project, start by running `npm run cars` and configuring one (or, especially for overlays, ideally multiple) hosting provider(s)
- For each of your configurations, execute `npm run build` to create CARS project artifacts
- Deploy with `npm run deploy` and your project will be online
- Use `cars` interactively, or visit your hosting provider(s) web portals, to view logs, configure custom domains, and pay your hosting bills
- Share your new BSV project, it is now online!

## Local TS Stack integration

This branch can run the existing ToDo flows against a built local TS Stack
checkout, including the compatibility changes in
[TS Stack PR #674](https://github.com/bsv-blockchain/ts-stack/pull/674).
Use Node 24. The reviewed starting revision is
`9199ac5784f55e7df13bd2c1839ab0d0017b0303`.

```sh
npm --prefix frontend ci --ignore-scripts
npm run link:ts-stack -- /absolute/path/to/ts-stack
npm run check:local
npm run build:local
npm run start:local
```

Open [http://localhost:8080](http://localhost:8080). The link command uses the
checkout's existing build outputs and prints its actual revision and package
versions. It links the SDK and the browser messaging packages already installed
by ToDo, verifies that ToDo, Babbage Go and the linked packages resolve one SDK,
and clears Vite's dependency cache. Links stay inside this checkout's ignored
`frontend/node_modules`; dependency manifests and lockfiles keep the registry
baseline. Re-run the link command after `npm ci`, and rebuild TS Stack after
editing its sources. To restore registry packages, run `npm --prefix frontend ci`.

The UI keeps its normal wallet transport. Connect a BRC-100 wallet, allow the
ToDo basket and protocol permissions, then test listing existing tasks, creating
a small task, reloading it, completing it and reloading again. These actions use
the connected wallet's configured network and can spend real satoshis. A local
SDK link exercises the application client; testing the changed Wallet Toolbox
storage implementation also requires a wallet/provider running that candidate.
Page-load and build checks alone do not establish successful funded integration.

The earlier linked revision `b6b7a6e8c` passed startup checks but failed a
nonempty binary `listOutputs` request against Metanet Client 0.8.11: SDK4's
extra spendability byte disagreed with the deployed wallet encoding. The
reviewed revision restores the SDK2/3 binary format by default. Frozen SDK3.2.1
frames and actual old/new codec pairings pass in both directions, including
six-output pages and optional metadata. No JSON transport override is needed
for ordinary ToDo inventory calls.

Before funded testing, repeat the original read-only `listOutputs` request with
the same installed wallet, origin and basket, and confirm that all six reported
outputs decode. Then test rendering/decryption of existing tasks. This host's
empty-state reload, typecheck and production build pass, but do not replace that
installed-wallet check or prove funded creation/redemption/internalization.


## Directory Structure

The project structure is roughly as follows, although it can vary by project.

```
| - deployment-info.json
| - package.json
| - local-data/
| - frontend/
  | - package.json
  | - webpack.config.js
  | - src/...
  | - public/...
  | - build/...
| - backend/
  | - package.json
  | - tsconfig.json
  | - mod.ts
  | - src/
    | - contracts/...
    | - lookup-services/...
    | - topic-managers/...
    | - script-templates/...
  | - artifacts/
  | - dist/
```

The one constant is `deployment-info.json`.

## License

[Open BSV License](./LICENSE.txt)
