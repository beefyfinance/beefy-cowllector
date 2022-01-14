require('dotenv').config();
const fs = require('fs');
const path = require('path');
const ethers = require('ethers');
const { default: axios } = require('axios');
const fleekStorage = require('@fleekhq/fleek-storage-js');
const { addressBook } = require('blockchain-addressbook');

const IStrategy = require('../abis/IStrategy.json');
const IWrappedNative = require('../abis/WrappedNative.json');
const harvestHelpers = require('../utils/harvestHelpers');
const chains = require('../data/chains');
let strats = require('../data/strats.json');
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
  try {
    if (!CHAIN.wnative) throw new Error('Not unwrappeable chain');

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

/**
 * Check if Strat should be harvest
 * @description check if strats is in range of time that should be harvested and if harvest can be runned without problem
 * @param {object} strat
 * @returns strat
 */
const shouldHarvest = async (strat, harvesterPK) => {
  try {
    if (strat.lastHarvest !== 0) {
      let now = Math.floor(new Date().getTime() / 1000);
      let secondsSinceHarvest = now - strat.lastHarvest;
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
      const contract = new ethers.Contract(strat.address, IStrategy, harvesterPK);
      let callStaticPassed = await contract.callStatic.harvest();
    } catch (error) {
      throw new Error(`Start did not passed callStatic => ${error}`);
    }
    return strat;
  } catch (error) {
    throw error;
  }
};

const broadcastMessage = async ({
  type = 'info',
  title = 'this is a title',
  message = 'this is a message',
  platforms = ['discord'],
}) => {
  try {
    let res = await axios.post(
      `https://beefy-broadcast.herokuapp.com/broadcasts?apikey=${process.env.BEEFY_BROADCAST_API_KEY}`,
      {
        type,
        title,
        message,
        platforms,
      }
    );
    return res;
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
                data: receipt,
              };
            } catch (error) {
              for (const key of Object.keys(JSONRPC_ERRORS)) {
                if (error.message.includes(key)) {
                  console.log(`${strat.name}: ${JSONRPC_ERRORS[key]}`);
                  try {
                    let res = await broadcastMessage({
                      type: 'error',
                      title: `Error trying to harvest ${strat.name}`,
                      message: `- error code: ${JSONRPC_ERRORS[key]}\n- address: ${strat.address}`,
                    });
                  } catch (e) {}
                  return {
                    contract: strat.address,
                    status: 'failed',
                    message: `${strat.name}: ${JSONRPC_ERRORS[key]}`,
                    data: error.message,
                  };
                }
              }
              try {
                let res = await broadcastMessage({
                  type: 'error',
                  title: `Error trying to harvest ${strat.name}`,
                  message: `- error code: unknown\n- address: ${strat.address}\n- tx hash: ${tx.hash}`,
                });
              } catch (e) {}
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
              data: tx,
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
      strats = strats.filter(s => s.depositsPaused === false || s.harvestPaused === false);
      strats = await harvestHelpers.multicall(CHAIN, strats, 'balanceOf');
      strats = strats.filter(s => s.balanceOf > 0);
      strats = await harvestHelpers.multicall(CHAIN, strats, 'lastHarvest');
      strats = await Promise.allSettled(strats.map(strat => shouldHarvest(strat, harvesterPK)));
      strats = strats.filter(r => r.status === 'fulfilled').map(s => s.value);

      console.log(`${strats.length} strats to harvest`);
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
      console.table(harvesteds);

      if (harvesteds.length) {
        let success = harvesteds.filter(h => h.status === 'success');
        let report = {
          harvesteds,
          gasUsed: success.reduce(
            (total, h) => total + ethers.BigNumber.from(h.data.gasUsed) / 1e9,
            0
          ),
          averageGasUsed: 0,
          totalHarvested: success.length,
          totalFailed: harvesteds.length - success.length,
        };
        if (report.gasUsed) report.averageGasUsed = report.gasUsed / success.length;
        report.cowllectorBalance = await harvesterPK.getBalance();

        let now = new Date().toISOString();
        try {
          let input = {
            apiKey: process.env.FLEEK_STORAGE_API_KEY,
            apiSecret: process.env.FLEEK_STORAGE_API_SECRET,
            key: `cowllector-reports/${CHAIN.id}-${now}.json`,
            data: JSON.stringify(report),
          };
          let uploaded = await fleekStorage.upload(input);
          try {
            let broadcast = await broadcastMessage({
              type: 'info',
              title: `New harvest report for ${CHAIN.id.toUpperCase()}`,
              message: `- Total strats to harvest: ${
                harvesteds.length
              }\n- Total successfully harvested: ${
                report.totalHarvested
              } \n- Total harvest failed: ${report.totalFailed} \n- Total gas used: ${
                report.gasUsed
              }\n- Average gas used per strat: ${report.averageGasUsed}\n- Cowllector Balance: ${
                report.cowllectorBalance / 1e18
              }\nIPFS link: https://ipfs.fleek.co/ipfs/${uploaded.hash}\n `,
              platforms: ['discord'],
            });
          } catch (error) {
            console.error(error);
          }
          console.log(
            `New harvest report for ${CHAIN.id.toUpperCase()} => https://ipfs.fleek.co/ipfs/${
              uploaded.hash
            }`
          );
        } catch (error) {
          console.log(error);
        }
      }
    } catch (error) {
      console.log(error);
    }
  }
  console.log(`done`);
  process.exit();
};

main();
