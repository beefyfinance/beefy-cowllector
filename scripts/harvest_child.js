require('dotenv').config();
const ethers = require('ethers');
const fleekStorage = require('@fleekhq/fleek-storage-js');
const IStrategy = require('../abis/IStrategy.json');
const IWrappedNative = require('../abis/WrappedNative.json');
const harvestHelpers = require('../utils/harvestHelpers');
const broadcast = require('../utils/broadcast');
const chains = require('../data/chains');
let strats = require('../data/strats.json');
const CHAIN_ID = parseInt(process.argv[2]);
const CHAIN = chains[CHAIN_ID];
const TRICKY_CHAINS = ['fantom', 'polygon', 'avax'];
const GASLESS_CHAINS = ['celo', 'aurora'];

require('../utils/logger')(CHAIN_ID);

const JSONRPC_ERRORS = {
  'code=INSUFFICIENT_FUNDS': 'INSUFFICIENT_FUNDS',
  'PancakeLibrary: INSUFFICIENT_INPUT_AMOUNT': 'PancakeLibrary: INSUFFICIENT_INPUT_AMOUNT',
  'code=INSUFFICIENT_INPUT_AMOUNT': 'INSUFFICIENT_INPUT_AMOUNT',
  INSUFFICIENT_INPUT_AMOUNT: 'INSUFFICIENT_INPUT_AMOUNT',
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

/**
 * Get wnative balance
 * @param {Object} signer Ethers Signer class
 * @returns BigNumber
 */
const getWnativeBalance = async signer => {
  if (!CHAIN.wnative) return ethers.BigNumber.from(0);
  let wNative = new ethers.Contract(CHAIN.wnative, IWrappedNative, signer);
  let wNativeBalance = await wNative.balanceOf(signer.address);
  return wNativeBalance;
};

const unwrap = async (harvesterPK, provider, options, minBalance = 1e17) => {
  try {
    if (!CHAIN.wnative) return false;
    let wNativeBalance = await getWnativeBalance(harvesterPK);
    if (wNativeBalance < minBalance) return false;
    let tx;
    try {
      tx = await wNative.withdraw(wNativeBalance, options);
      if (TRICKY_CHAINS.includes(CHAIN.id)) {
        let receipt = null;
        while (receipt === null) {
          try {
            await harvestHelpers.sleep(500);
            receipt = await provider.getTransactionReceipt(tx.hash);
            if (receipt === null) continue;
            console.log(`unwrapped ${ethers.utils.formatUnits(wNativeBalance)}`);
          } catch (error) {}
        }
      } else {
        tx = await tx.wait();
        console.log(`unwrapped ${ethers.utils.formatUnits(wNativeBalance)}`);
      }
    } catch (error) {}
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
  filtered.push(...responses);

  // get strats with gaslimit
  strats = filtered.filter(g => strats.some(s => g.address === s.address));
  return strats;
};

/**
 * Check if Strat should be harvest
 * @dev this func will always return a fulfilled promise, filter results based on strat.shouldHarvest Boolean
 * @description check if strats is in range of time that should be harvested and if harvest can be runned without problem
 * @param {object} strat
 * @returns strat
 */
const shouldHarvest = async (strat, harvesterPK) => {
  const STRAT_INTERVALS_MARGIN_OF_ERROR =
    Number(process.env.STRAT_INTERVALS_MARGIN_OF_ERROR) || 1440;
  try {
    if (strat.lastHarvest !== 0) {
      let now = Math.floor(new Date().getTime() / 1000);
      let secondsSinceHarvest = now - strat.lastHarvest;
      let interval = CHAIN.harvestHourInterval || strat.interval;
      if (!(secondsSinceHarvest >= interval * 3600 + STRAT_INTERVALS_MARGIN_OF_ERROR)) {
        strat.shouldHarvest = false;
        strat.notHarvestReason = 'lastHarvest is lower than interval';
        return strat;
      }
    } else if (strat.noHarvestEvent) {
      let noHarvestEvent = harvestHelpers.isNewPeriodNaive(strat.interval);
      if (!noHarvestEvent) {
        strat.shouldHarvest = false;
        strat.notHarvestReason = 'is not new period naive';
        return strat;
      }
    } else {
      let isNewHarvestPeriod = await harvestHelpers.isNewHarvestPeriod(strat, harvesterPK);
      if (!isNewHarvestPeriod) {
        strat.shouldHarvest = false;
        strat.notHarvestReason = 'is not new harvest period';
        return strat;
      }
    }
    try {
      const contract = new ethers.Contract(strat.address, IStrategy, harvesterPK);
      let callStaticPassed = await contract.callStatic.harvest();
    } catch (error) {
      for (const key of Object.keys(JSONRPC_ERRORS)) {
        if (error.message.includes(key)) {
          strat.shouldHarvest = false;
          strat.notHarvestReason = `Strat did't passed callStatic: ${JSONRPC_ERRORS[key]}`;
          return strat;
        }
      }
      strat.shouldHarvest = false;
      strat.notHarvestReason = `Strat did't passed callStatic: ${error}`;
      return strat;
    }
    return strat;
  } catch (error) {
    strat.shouldHarvest = false;
    strat.notHarvestReason = `unexpected error in shouldHarvest(): ${error}`;
    return strat;
  }
};

const harvest = async (strat, harvesterPK, provider, options, nonce = null) => {
  const tryTX = async (stratContract, max = 5) => {
    if (nonce) options.nonce = nonce;
    let tries = 0;
    while (tries <= max) {
      tries++;
      let tx;
      try {
        // aurora patch
        if (CHAIN.id === 'aurora') {
          try {
            tx = await stratContract.harvest(options);
          } catch (error) {
            console.log(`${strat.name}: ${error}`);
            return {
              contract: strat.address,
              status: 'failed',
              message: `${strat.name}: fail in 1/3 harvest() - Charges Fees`,
              data: error.message,
            };
          }
          try {
            tx = await stratContract.harvest(options);
          } catch (error) {
            console.log(`${strat.name}: ${error}`);
            return {
              contract: strat.address,
              status: 'failed',
              message: `${strat.name}: fail in 2/3 harvest() - swaps to tokens needed`,
              data: error.message,
            };
          }
          try {
            tx = await stratContract.harvest(options);
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
          } catch (error) {
            console.log(`${strat.name}: ${error}`);
            return {
              contract: strat.address,
              status: 'failed',
              message: `${strat.name}: fail in 3/3 harvest() - Adds liquidity and deposits`,
              data: error.message,
            };
          }
        } else {
          tx = await stratContract.harvest(options);
          if (TRICKY_CHAINS.includes(CHAIN.id)) {
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
                      let res = await broadcast.send({
                        type: 'error',
                        title: `Error trying to harvest ${strat.name}`,
                        message: `- error code: ${JSONRPC_ERRORS[key]}\n- address: ${strat.address}`,
                      });
                    } catch (error) {
                      console.log(`Error trying to send message to broadcast: ${error.message}`);
                    }
                    return {
                      contract: strat.address,
                      status: 'failed',
                      message: `${strat.name}: ${JSONRPC_ERRORS[key]}`,
                    };
                  }
                }
                try {
                  let res = await broadcast.send({
                    type: 'error',
                    title: `Error trying to harvest ${strat.name}`,
                    message: `- error code: unknown\n- address: ${strat.address}\n- tx hash: ${tx.hash}`,
                  });
                } catch (error) {
                  console.log(`Error trying to send message to broadcast: ${error.message}`);
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
                data: tx,
              };
            }
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
    if (balance < options.gasPrice * options.gasLimit) {
      try {
        let res = await broadcast.send({
          type: 'warning',
          title: `INSUFFICIENT_FUNDS to harvest ${strat.name.toUpperCase()} in ${CHAIN.id.toUpperCase()}`,
          message: `- Gas required **${
            (options.gasPrice * options.gasLimit) / 1e18
          }** and Cowllector has **${ethers.utils.formatUnits(balance)}** \n- Contract Address: ${
            strat.address
          } \n- Please feed me with more coins 🪙 🐮 \n`,
        });
      } catch (error) {
        console.log(`Error trying to send message to broadcast: ${error.message}`);
      }
      throw new Error(
        `${strat.name}: INSUFFICIENT_FUNDS - gas required ${
          (options.gasPrice * options.gasLimit) / 1e18
        } and you has ${ethers.utils.formatUnits(balance)}`
      );
    }

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
    /**
     * Check hour interval if harvest_child should run for this chain
     * @dev on file data/chain.js you can find, for every chain, a prop harvestHourInterval that explain when hourly harvest should be run for it
     */
    let hour = new Date().getUTCHours();
    if (hour % CHAIN.harvestHourInterval) {
      console.log(
        `Is not Harvest time for ${CHAIN.id.toUpperCase()} [hour_interval=${
          CHAIN.harvestHourInterval
        }]`
      );
      return false;
    }

    console.log(
      `Harvest time for ${CHAIN.id.toUpperCase()} [id=${CHAIN_ID}] [rpc=${CHAIN.rpc}] [explorer=${
        CHAIN.blockExplorer
      }] [hour_interval=${CHAIN.harvestHourInterval}]`
    );

    try {
      const provider = new ethers.providers.JsonRpcProvider(CHAIN.rpc);
      // patch for GASLESS chains
      if (GASLESS_CHAINS.includes(CHAIN.id)) {
        const originalBlockFormatter = provider.formatter._block;
        provider.formatter._block = (value, format) => {
          return originalBlockFormatter(
            {
              gasLimit: ethers.BigNumber.from(0),
              ...value,
            },
            format
          );
        };
      }

      let gasPrice = await getGasPrice(provider);
      console.log(`Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} GWEI`);
      const harvesterPK = new ethers.Wallet(process.env.HARVESTER_PK, provider);
      const balance = await harvesterPK.getBalance();
      const wNativeBalance = await getWnativeBalance(harvesterPK);

      strats = await addGasLimit(strats, provider);
      strats = strats.map(s => {
        s.shouldHarvest = true;
        s.notHarvestReason = '';
        s.harvest = null;
        return s;
      });
      strats = strats.map(s => {
        if (s.depositsPaused || s.harvestPaused) {
          s.shouldHarvest = false;
          s.notHarvestReason = 'deposits or harvest paused';
        }
        return s;
      });
      strats = await harvestHelpers.multicall(CHAIN, strats, 'balanceOf');
      strats = strats.map(s => {
        if (s.balanceOf === 0) {
          s.shouldHarvest = false;
          s.notHarvestReason = 'balance is zero';
        }
        return s;
      });
      strats = await harvestHelpers.multicall(CHAIN, strats, 'lastHarvest');
      strats = await Promise.allSettled(strats.map(strat => shouldHarvest(strat, harvesterPK)));
      strats = strats.filter(r => r.status === 'fulfilled').map(s => s.value);
      console.table(strats, ['name', 'address', 'shouldHarvest', 'notHarvestReason']);

      stratsToHarvest = strats.filter(s => s.shouldHarvest);
      console.log(`Total Strat to harvest ${stratsToHarvest.length} of ${strats.length}`);

      let totalGas =
        stratsToHarvest
          .filter(s => s.shouldHarvest)
          .reduce((total, s) => total + Number(s.gasLimit), 0) / 1e9;
      console.log(
        `Total gas to use ${(totalGas * gasPrice) / 1e9} GWEI , current balance ${balance.div(
          1e9
        )} GWEI`
      );

      let harvesteds = [];
      for await (const strat of stratsToHarvest) {
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
        await unwrap(harvesterPK, provider, { gasPrice }, CHAIN.wnativeMintoUnwrap);
      }

      strats = strats.map(s => {
        let harvested = harvesteds.find(h => h.contract === s.address);
        if (harvested) s.harvest = harvested;
        return s;
      });

      if (strats.length) {
        let success = strats.filter(s => s.harvest && s.harvest.status === 'success');
        let gasUsed = harvesteds.reduce((total, h) => {
          if (h.data && h.data.gasUsed) return total.add(ethers.BigNumber.from(h.data.gasUsed));
          return total;
        }, ethers.BigNumber.from(0));
        let report = {
          strats,
          gasUsed: gasUsed,
          averageGasUsed: ethers.BigNumber.from(0),
          harvesteds: harvesteds.length,
          success: success.length,
          failed: harvesteds.length - success.length,
        };
        if (gasUsed.gt(0)) {
          report.averageGasUsed = gasUsed.div(ethers.BigNumber.from(success.length));
        }
        let currentWNativeBalance = await getWnativeBalance(harvesterPK);
        let currentBalance = await harvesterPK.getBalance();
        report.balance = currentWNativeBalance.add(currentBalance);
        report.profit = currentBalance.add(currentWNativeBalance).sub(balance.add(wNativeBalance));

        let now = new Date().toISOString();
        try {
          let input = {
            apiKey: process.env.FLEEK_STORAGE_API_KEY,
            apiSecret: process.env.FLEEK_STORAGE_API_SECRET,
            key: `cowllector-reports/${CHAIN.id}-${now}.json`,
            data: JSON.stringify(report, null, 2),
          };
          let uploaded = await fleekStorage.upload(input);
          try {
            let res = await broadcast.send({
              type: 'info',
              title: `New harvest report for ${CHAIN.id.toUpperCase()}`,
              message: `- Total strats: ${strats.length}\n- Harvested: ${
                report.harvesteds
              }\n  + Success: ${report.success}\n  + Failed: ${
                report.failed
              }\n- Total gas used: ${ethers.utils.formatUnits(
                report.gasUsed,
                'gwei'
              )}\n  + Avg per strat: ${ethers.utils.formatUnits(
                report.averageGasUsed,
                'gwei'
              )}\n- Cowllector Balance: ${ethers.utils.formatUnits(
                report.balance
              )}\n- Profit: ${ethers.utils.formatUnits(
                report.profit
              )}\nIPFS link: https://ipfs.fleek.co/ipfs/${uploaded.hash}\n`,
              platforms: ['discord'],
            });
          } catch (error) {
            console.log(`Error trying to send message to broadcast: ${error.message}`);
          }
          console.log(
            `New harvest report for ${CHAIN.id.toUpperCase()} => https://ipfs.fleek.co/ipfs/${
              uploaded.hash
            }`
          );
        } catch (error) {
          console.log(error);
          let res = await broadcast.send({
            type: 'info',
            title: `Error trying to upload report to ipfs.fleek.co - ${CHAIN.id.toUpperCase()}`,
            message: '',
          });
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
