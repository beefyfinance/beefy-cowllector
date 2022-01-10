require('dotenv').config();
const fs = require('fs');
const path = require('path');
const ethers = require('ethers');
const IStrategy = require('../abis/IStrategy.json');
const IWrappedNative = require('../abis/WrappedNative.json');
const harvestHelpers = require('../utils/harvestHelpers');
const chains = require('../data/chains');
let strats = require('../data/strats.json');
const { default: Axios } = require('axios');
const { addressBook } = require('blockchain-addressbook');
const CHAIN_ID = parseInt(process.argv[2]);
const CHAIN = chains[CHAIN_ID];

require('../utils/logger')(CHAIN_ID);

const JSONRPC_ERRORS = {
  'code=INSUFFICIENT_FUNDS': 'INSUFFICIENT_FUNDS',
  'insufficient funds': 'INSUFFICIENT_FUNDS',
  'code=REPLACEMENT_UNDERPRICED': 'REPLACEMENT_UNDERPRICED',
  'code=GAS_LIMIT_REACHED': 'GAS_LIMIT_REACHED',
  'gas limit reached': 'GAS_LIMIT_REACHED',
  'code=SERVER_ERROR': 'SERVER_ERROR',
};

const getGasPrice = async provider => {
  let gas = 0;
  try {
    if (CHAIN.gas.price) gas = CHAIN.gas.price;
    let gasPrice = await provider.getGasPrice();
    if (gasPrice > gas) {
      gas = Number(gasPrice.toString()).toFixed();
    }
    return gas;
  } catch (error) {}

  try {
    if (CHAIN.gas.info) {
      if (CHAIN.gas.info.type === 'rest') {
        let res = await Axios.get(
          `${CHAIN.gas.info.url}?module=proxy&action=eth_gasPrice&apikey=${CHAIN.gas.info.apikey}`
        );
        if (res.data && res.data.status !== '0' && res.data.result)
          gas.gasPrice = parseInt(BigInt(res.data.result).toString());
        return gas;
      }
      if (CHAIN.gas.info.type === 'rpc') {
        let data = { jsonrpc: '2.0', method: 'eth_gasPrice', id: 1 };
        if (CHAIN.gas.info.method) data.method = CHAIN.gas.info.method;
        let res = await Axios.post(`${CHAIN.gas.info.url}`, data);
        if (res.data && res.data.status !== '0' && res.data.result)
          gas.gasPrice = parseInt(BigInt(res.data.result).toString());
        return gas;
      }
    }
    console.log(`=> Gas Info API not recognized`);
    return gas;
  } catch (error) {
    console.log('=> Can not get Gas price from Block Explorer');
    return gas;
  }
};

const unwrap = async (harvesterPK, minBalance = 1e17) => {
  const NOT_UNWRAPPEABLES = ['celo'];

  try {
    if (NOT_UNWRAPPEABLES.includes(CHAIN.id)) throw new Error('Not unwrappeable chain');

    let wNative = new ethers.Contract(
      addressBook[CHAIN.id].tokens.WNATIVE.address,
      IWrappedNative,
      harvesterPK
    );
    let wNativeBalance = await wNative.balanceOf(harvesterPK.address);
    if (wNativeBalance < minBalance) throw new Error('Not has the minimum to unwrap');
    console.log(`unwrapping ${wNativeBalance / 1e18}`);
    let tx = await wNative.withdraw(wNativeBalance);
    tx = await tx.wait();
  } catch (error) {
    console.log(error.message);
  }
};

const addGasLimit = async (strats, provider) => {
  let gasLimits = require('../data/gasLimits.json');
  let filtered = gasLimits.filter(s => s.chainId === Number(CHAIN_ID));

  //check when gaslimit already exists and only strats that are not in gasLimits
  let gasLimitWanted = filtered.filter(s =>
    strats.every(strat => s.address.toLowerCase() !== strat.address.toLowerCase())
  );

  let responses = await Promise.allSettled(
    gasLimitWanted.map(strat => harvestHelpers.estimateGas(strat, CHAIN_ID, provider))
  );
  responses = responses.filter(s => s.status === 'fulfilled').map(s => s.value);
  gasLimits.push(...responses);
  fs.writeFileSync(
    path.join(__dirname, '../data/gasLimits.json'),
    JSON.stringify(gasLimits, null, 2)
  );

  // get strats with gaslimit
  strats = gasLimits
    .filter(s => s.chainId === CHAIN_ID)
    .filter(g => strats.some(s => g.address === s.address));
  return strats;
};

const shouldHarvest = async (strat, harvesterPK) => {
  try {
    if (strat.depositsPaused) throw new Error(`deposits paused`);
    if (strat.harvestPaused) throw new Error(`harvest paused`);
    const stratContract = new ethers.Contract(strat.address, IStrategy, harvesterPK);
    let hasStakers = await harvestHelpers.hasStakers(stratContract);
    if (!hasStakers) throw new Error(`has not stakers`);
    let lastHarvest = 0;
    try {
      lastHarvest = await stratContract.lastHarvest();
    } catch (err) {}
    if (lastHarvest !== 0) {
      let now = Math.floor(new Date().getTime() / 1000);
      let secondsSinceHarvest = now - lastHarvest;
      if (!(secondsSinceHarvest >= strat.interval * 3600))
        throw new Error(`lower than the interval`);
    } else if (strat.noHarvestEvent) {
      let noHarvestEvent = harvestHelpers.isNewPeriodNaive(strat.interval);
      if (!noHarvestEvent) throw new Error(`is not new period naive`);
    } else {
      let isNewHarvestPeriod = await harvestHelpers.isNewHarvestPeriod(strat, harvesterPK);
      if (!isNewHarvestPeriod) throw new Error(`is not new harvest period`);
    }

    try {
      let callStaticPassed = await stratContract.callStatic.harvest();
    } catch (error) {
      throw new Error(`Start did not passed callStatic => ${error}`);
    }

    return strat;
  } catch (error) {
    throw error;
  }
};

const harvest = async (strat, harvesterPK, provider, options, nonce = null) => {
  const trickyChains = [250, 137, 43114];

  const tryTX = async (stratContract, max = 5) => {
    if (nonce) options.nonce = nonce;
    let tries = 0;
    while (tries <= max) {
      tries++;
      let tx;
      try {
        tx = await stratContract.harvest(options);
        if (trickyChains.includes(CHAIN_ID)) {
          let receipt = null;
          while (receipt === null) {
            try {
              await harvestHelpers.sleep(500);
              receipt = await provider.getTransactionReceipt(tx.hash);
              if (receipt === null) continue;
              console.log(`${strat.name}:\tharvested after tried ${tries} with tx: ${tx.hash}`);
              return {
                contract: strat.address,
                status: 'success',
                message: `${strat.name}: harvested after tried ${tries} with tx: ${tx.hash}`,
              };
            } catch (error) {
              for (const key of Object.keys(JSONRPC_ERRORS)) {
                if (error.message.includes(key)) {
                  console.log(`${strat.name}: ${JSONRPC_ERRORS[key]}`);
                  return {
                    contract: strat.address,
                    status: 'failed',
                    message: `${strat.name}: ${JSONRPC_ERRORS[key]}`,
                    data: error.message,
                  };
                }
              }
              return {
                contract: strat.address,
                status: 'failed',
                message: `failed tx: ${tx.hash}`,
                data: error.message,
              };
            }
          }
        } else {
          tx = await tx.wait();
          if (tx.status === 1) {
            console.log(
              `${strat.name}:\tharvested after tried ${tries} with tx: ${tx.transactionHash}`
            );
            return {
              contract: strat.address,
              status: 'success',
              message: `${strat.name}: harvested after tried ${tries} with tx: ${tx.transactionHash}`,
            };
          }
        }
      } catch (error) {
        for (const key of Object.keys(JSONRPC_ERRORS)) {
          if (error.message.includes(key)) {
            console.log(`${strat.name}: ${JSONRPC_ERRORS[key]}`);
            return {
              contract: strat.address,
              status: 'failed',
              message: `${strat.name}: ${JSONRPC_ERRORS[key]}`,
              data: error.message,
            };
          }
        }
        if (tries === max) throw new Error(error);
      }
    }
  };

  try {
    // check if have minimum for gas harvest ( balance > gasPrice * gasLimit)
    let balance = await harvesterPK.getBalance();
    if (balance < options.gasPrice * options.gasLimit)
      throw new Error(
        `${strat.name}: INSUFFICIENT_FUNDS - gas required ${
          (options.gasPrice * options.gasLimit) / 1e18
        } and you has ${balance / 1e18}`
      );

    const stratContract = new ethers.Contract(strat.address, IStrategy, harvesterPK);
    let tx = await tryTX(stratContract);
    return tx;
  } catch (error) {
    console.log(error.message);
    return {
      contract: strat.address,
      status: 'failed',
      message: error.message,
    };
  }
};

const main = async () => {
  if (CHAIN && CHAIN.id) {
    console.log(
      `Starting Harvester on ${CHAIN.id} [id=${CHAIN_ID}] [rpc=${CHAIN.rpc}] [explorer=${CHAIN.blockExplorer}]`
    );
    try {
      const provider = new ethers.providers.JsonRpcProvider(CHAIN.rpc);
      let gasPrice = await getGasPrice(provider);
      console.log(`Gas Price: ${gasPrice}`);
      const harvesterPK = new ethers.Wallet(process.env.HARVESTER_PK, provider);
      let unwrapped = await unwrap(harvesterPK);
      let balance = await harvesterPK.getBalance();
      strats = await addGasLimit(strats, provider);
      strats = await Promise.allSettled(strats.map(strat => shouldHarvest(strat, harvesterPK)));
      strats = strats.filter(r => r.status === 'fulfilled').map(s => s.value);
      console.log(`To Harvest`);
      console.table(strats);
      let totalGas = strats.reduce((total, s) => total + Number(s.gasLimit), 0) / 1e9;
      console.log(
        `Total gas to use ${(totalGas * gasPrice) / 1e9}, current balance ${balance / 1e18}`
      );

      let harvesteds = [];
      for await (const strat of strats) {
        try {
          let options = {
            gasPrice,
            gasLimit: ethers.BigNumber.from(strat.gasLimit),
          };
          let harvested = await harvest(strat, harvesterPK, provider, options);
          harvesteds.push(harvested);
        } catch (error) {
          console.log(error.message);
        }
        await unwrap(harvesterPK);
      }
      console.log('Harvested report');
      console.table(harvesteds);
    } catch (error) {
      console.log(error);
    }
  }
  console.log(`done`);
  process.exit();
};

main();
