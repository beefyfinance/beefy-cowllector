<div align="center">
  <br>
  <img alt="Open Sauced" src="https://beefy.com/img/COW.svg" width="100px">
  <br>
  <h1>🧑‍🌾 Cowllector 🌾</h1>
  <strong>The path to your next Open Source cowtribution</strong>
</div>
<br>
<p align="center">
  <img src="https://img.shields.io/github/languages/code-size/beefyfinance/beefy-cowllector" alt="GitHub code size in bytes">
  <img src="https://img.shields.io/github/commit-activity/w/beefyfinance/beefy-cowllector" alt="GitHub commit activity">
  <a href="https://https://github.com/beefyfinance/beefy-cowllector/issues">
    <img src="https://img.shields.io/github/issues/beefyfinance/beefy-cowllector" alt="GitHub issues">
  </a>
  <a href="https://beefy.finance">
    <img alt="website" src="https://img.shields.io/badge/Website-231d9b?logo=google%20chrome&logoColor=ffffff">
  </a>
  <a href="https://discord.gg/yq8wfHd">
    <img src="https://img.shields.io/discord/755231190134554696.svg?label=&logo=discord&logoColor=ffffff&color=7389D8&labelColor=6A7EC2" alt="Discord">
  </a>
    <a href="https://t.me/beefyfinance">
    <img alt="telegram" src="https://img.shields.io/badge/Telegram-2CA5E0?logo=telegram&logoColor=white">
  </a>
  <a href="https://twitter.com/beefyfinance">
    <img alt="twitter" src="https://img.shields.io/twitter/follow/beefyfinance?&color=%231d9bf0&label=%40beefyfinance&logo=twitter&logoColor=23fff">
  </a>
</p>

The bot to harvest all vaults and notify the BIFI rewards pool.

## 🔄 Auto sync

if you are a **Beefy Strategist**, you DON'T need anymore push or sync your strat here.

This repo auto sync every 4 hours thanks to our beauty [Cowbot](https://github.com/beefybot).

## 📖 Prerequisites

In order to run the project we need `node>=16.13`, `yarn>=1.22` installed on our development machines

## 🖥️ Local development

To install the application:

```shell
yarn
```

To start harvest all chains in parallel:

```shell
yarn harvest
```

To start harvest one chain:

```shell
node ./script/harvest_child.js <chain id>
```

## 🔑 Enviroment

See [enviroment variable example](./.env.example) file for ENV required to run cowllector

## 🤝 Contributing

We encourage you to contribute to Cowllector!

We recommend to use [this commit convention](https://github.com/conventional-commits/conventionalcommits.org) that helps you write your commits in a way that is easy to understand and process by others.

In case you want to contribute, please follow next steps:ç

- fork this repo
- create a new branch and named using conventional commit reference
- commit your changes using conventional commit
- push your change in your forked repo
- createa a PR from your new branch directly to our `master` branch

## 🍕 Community

- Got Questions? Join the conversation in our [Discord](https://discord.gg/yq8wfHd).
- Want to up to date with Beefy? Follow us in [Twitter](https://twitter.com/beefyfinance).
- We also have community chat in [Telegram](https://t.me/beefyfinance).
- Announcement channel in [Telegram](https://t.me/bifinews).

## 👷‍♀️👷 Maintainers

[@0xww](https://github.com/0xww)

### Cowtributors

[@beefybot](https://github.com/beefybot)
