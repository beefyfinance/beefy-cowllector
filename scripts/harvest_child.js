require('dotenv').config();
const ethers = require('ethers');
const fleekStorage = require('@fleekhq/fleek-storage-js');
const redis = require('../utility/redisHelper');
const Sentry = require('../utils/sentry.js');
const IStrategy = require('../abis/IStrategy.json');
const IERC20 = require('../abis/ERC20.json');
const IWrappedNative = require('../abis/WrappedNative.json');
const harvestHelpers = require('../utils/harvestHelpers');
const broadcast = require('../utils/broadcast');
const chains = require('../data/chains');
const CHAIN_ID = parseInt(process.argv[2]);
const CHAIN = chains[CHAIN_ID];
const TRICKY_CHAINS = ['fantom', 'polygon', 'avax'];
const GASLESS_CHAINS = ['celo', 'aurora'];
const GAS_THROTTLE_CHAIN = ['bsc', 'arbitrum'];
const GAS_MARGIN = parseInt(process.env.GAS_MARGIN) || 5;
const TVL_MINIMUM_TO_HARVEST = parseInt(process.env.TVL_MINIMUM_TO_HARVEST) || 10e3;

require('../utils/logger')(CHAIN_ID);

const REDIS_KEY = 'STRATS_TO_HARVEST';
let strats;

const KNOWN_RPC_ERRORS = {
  'code=INSUFFICIENT_FUNDS': 'INSUFFICIENT_FUNDS',
  'PancakeLibrary: INSUFFICIENT_INPUT_AMOUNT': 'PancakeLibrary: INSUFFICIENT_INPUT_AMOUNT',
  INSUFFICIENT_INPUT_AMOUNT: 'INSUFFICIENT_INPUT_AMOUNT',
  'insufficient funds': 'INSUFFICIENT_FUNDS',
  'code=REPLACEMENT_UNDERPRICED': 'REPLACEMENT_UNDERPRICED',
  'code=GAS_LIMIT_REACHED': 'GAS_LIMIT_REACHED',
  'gas limit reached': 'GAS_LIMIT_REACHED',
  'code=SERVER_ERROR': 'SERVER_ERROR',
  'code=CALL_EXCEPTION': 'CALL_EXCEPTION', //AT: probably gas-limit hit, so costly
};

const getGasPrice = async provider => {
  let gas = 0;
  //TODO: Rationale of this stanza needs precise explanation. Seems that the chain-specific
  //  gas price set in the environment or the default in the chain-data file is a _minimum_
  //  gas price we'll harvest at, a price possibly a bit above the chain's standard minimum
  //  price (e.g. the Polygon default at 40 GWEI instead of chain's floor of 30 GWEI).
  try {
    if (CHAIN.gas.price) gas = CHAIN.gas.price;
    let gasPrice = await provider.getGasPrice();
    if (GAS_MARGIN && !GAS_THROTTLE_CHAIN.includes(CHAIN.id)) gasPrice *= (100 + GAS_MARGIN) / 100;
    if (gasPrice > gas) gas = Number(gasPrice.toString()).toFixed();
    return gas;
  } catch (error) {
    Sentry.captureException(error);
  } //try

  try {
    //The standard method didn't work. So let's see if the chain supports another method...
    if (CHAIN.gas.info) {
      if (CHAIN.gas.info.type === 'rest') {
        let res = await Axios.get(
          `${CHAIN.gas.info.url}?module=proxy&action=eth_gasPrice&apikey=${CHAIN.gas.info.apikey}`
        );
        if (res.data && res.data.status !== '0' && res.data.result)
          gas = parseInt(BigInt(res.data.result).toString());
        return gas;
      }
      if (CHAIN.gas.info.type === 'rpc') {
        let data = { jsonrpc: '2.0', method: 'eth_gasPrice', id: 1 };
        if (CHAIN.gas.info.method) data.method = CHAIN.gas.info.method;
        let res = await Axios.post(`${CHAIN.gas.info.url}`, data);
        if (res.data && res.data.status !== '0' && res.data.result)
          gas = parseInt(BigInt(res.data.result).toString());
        return gas;
      }
    } //if (CHAIN.gas.info)
    console.log(`=> Gas Info API not recognized`);
    return gas;
  } catch (error) {
    Sentry.captureException(error);
    console.log('=> Could not get Gas price from Block Explorer');
    return gas;
  } //try
}; //const getGasPrice = async

/**
 * Get wnative balance
 * @param {Object} signer Ethers Signer class
 * @returns BigNumber
 */
const getWnativeBalance = async signer => {
  if (!CHAIN.wnative) return ethers.BigNumber.from(0);
  try {
    let wNative = new ethers.Contract(CHAIN.wnative, IWrappedNative, signer);
    let wNativeBalance = await wNative.balanceOf(signer.address);
    return wNativeBalance;
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
};

const unwrap = async (signer, provider, options, minBalance = '0.1') => {
  try {
    if (!CHAIN.wnative) return false;
    minBalance = ethers.utils.parseEther(minBalance, 'ether');
    let wNativeBalance = await getWnativeBalance(signer);
    if (wNativeBalance.lte(minBalance)) return false;
    let wNative = new ethers.Contract(CHAIN.wnative, IWrappedNative, signer);
    let tx;
    try {
      tx = await wNative.withdraw(wNativeBalance, options);
      if (TRICKY_CHAINS.includes(CHAIN.id)) {
        let receipt = null;
        while (receipt === null) {
          try {
            await harvestHelpers.sleep(250);
            receipt = await provider.getTransactionReceipt(tx.hash);
            if (receipt === null)
              //AT: no worry about an infinite loop?
              continue;
            console.log(`unwrapped ${ethers.utils.formatUnits(wNativeBalance)} ethers`);
          } catch (error) {
            Sentry.captureException(error);
          }
        }
      } else {
        tx = await tx.wait();
        console.log(`unwrapped ${ethers.utils.formatUnits(wNativeBalance)} ethers`);
      }
    } catch (error) {
      Sentry.captureException(error);
      console.log(error);
    }
  } catch (error) {
    Sentry.captureException(error);
    console.log(error.message);
  }
};

const uploadToFleek = async report => {
  let input = {
    apiKey: process.env.FLEEK_STORAGE_API_KEY,
    apiSecret: process.env.FLEEK_STORAGE_API_SECRET,
    key: `cowllector-reports/${CHAIN.id}-${new Date().toISOString()}.json`,
    data: JSON.stringify(report, null, 2),
  };

  let tries = 0;
  do {
    try {
      let uploaded = await fleekStorage.upload(input);
      if (uploaded.hash) {
        console.log(
          `New harvest report for ${CHAIN.id.toUpperCase()} => https://ipfs.fleek.co/ipfs/${
            uploaded.hash
          }`
        );
        return uploaded;
      }
      tries++;
      console.log(`fail trying to upload to fleek storage, try n ${tries}/5`);
    } catch (error) {
      Sentry.captureException(error);
      tries++;
      console.log(`fail trying to upload to fleek storage, try n ${tries}/5`);
    }
  } while (tries < 5);
}; //const uploadToFleek = async report =>

const addGasLimit = async (strats, provider) => {
  /*let gasLimits = require('../data/gasLimits.json');
  let filtered = gasLimits.filter( s => s.chainId === Number( CHAIN_ID));

  //0xww: check when gaslimit already exists and only strats that are not in gasLimits
  //AT: get a list of only those strats which have no gas-limit characteristic yet (how 
  //  would this ever happen?)
  let gasLimitWanted = filtered.filter( s =>
    strats.every( strat => s.address.toLowerCase() !== strat.address.toLowerCase())
  );

  let responses = await Promise.allSettled(
    gasLimitWanted.map( strat => harvestHelpers.estimateGas(strat, CHAIN_ID, provider))
  );
  responses = responses.filter( s => s.status === 'fulfilled').map( s => s.value);
  filtered.push( ...responses);

  //0xww: get strats with gaslimit
  strats = filtered.filter( g => strats.some( s => g.address === s.address));
*/
  //AT: in conformance with the new way of syncing strats, to stop harvesting strats
  //  handled by an on-chain harvester, this filter
  strats = strats.filter( strat => CHAIN.id === strat.chain && 
														(!CHAIN.hasOnChainHarvesting || strat.noOnChainHarvest));

  //enforce the gas limit (sometimes an RPC estimates way too high, e.g. Oasis Emerald)
  const max = CHAIN.gas.limit - 1;
  strats.forEach(strat => {
    if (max < strat.gasLimit) strat.gasLimit = max;
  });

  return strats;
}; //const addGasLimit = async (

/**
 * Tell if the given strat should be harvested
 * @dev Function sets the boolean strat.shouldHarvest which can be filtered on to send
 *      only those strats to harvest which have passed all tests.
 * @description Checks if strats is in range of time that should be harvested and if
 *      harvest can be run without issue.
 * @param {object} strat
 * @param
 * @param private key
 * @returns {object} Promise whose value is the updated strat object
 */
const shouldHarvest = async (strat, gasPrice, harvesterPK) => {
  const i_24_MINS = 1440,
    STRAT_INTERVALS_MARGIN_OF_ERROR =
      Number(process.env.STRAT_INTERVALS_MARGIN_OF_ERROR) || i_24_MINS;

  //Compute the maximum seconds allowed before a new harvest should be initiated, measured
  //  from the strat's last-harvest event. If the strat has a special interval specified
  //  that falls between this and the next run, evaluate that it should be executed during
  //  this run, as not exceeding the desired interval can be important, like to deny a
  //  frontrunning bot the illicit gains it seeks.
  let interval = Math.min(
      parseInt(process.env.GLOBAL_MINIMUM_HARVEST_HOUR_INTERVAL) || 24,
      strat?.interval || 24
    ),
    i;
  if (
    strat?.interval == interval &&
    interval > CHAIN.harvestHourInterval * (i = ~~(interval / CHAIN.harvestHourInterval)) &&
    interval < CHAIN.harvestHourInterval * (i + 1)
  )
    interval = CHAIN.harvestHourInterval * i;
  interval = interval * 3600 - STRAT_INTERVALS_MARGIN_OF_ERROR;

  try {
    if (strat.lastHarvest) {
      let now = Math.floor(new Date().getTime() / 1000);
      let secondsSinceHarvest = now - strat.lastHarvest;
      if (secondsSinceHarvest < interval) {
        strat.shouldHarvest = false;
        strat.notHarvestReason = 'lastHarvest within operative interval';
        return strat;
      }
    } else {
      let isNewHarvestPeriod = await harvestHelpers.isNewHarvestPeriod(
        strat,
        harvesterPK,
        interval,
        CHAIN_ID
      );
      if (!isNewHarvestPeriod) {
        strat.shouldHarvest = false;
        strat.notHarvestReason = 'last StratHarvest log within operative interval';
        return strat;
      }
    } //if (strat.lastHarvest)

    //unless the strategy is specially marked to skip the check, if the contract explicitly
    //  contains no rewards, short-circuit with a note that no harvest is necessary
    if (!strat.suppressCallRwrdCheck)
      try {
        const abi = ['function callReward() public view returns(uint256)'];
        const contract = new ethers.Contract(strat.strategy || strat.address, abi, harvesterPK);
        strat.callReward = await contract.callReward();
        if (strat.callReward.lte(0)) {
          strat.shouldHarvest = false;
          strat.notHarvestReason = 'callReward is zero';
          return strat;
        }
      } catch (error) {
        if (error.message.includes('INSUFFICIENT_INPUT_AMOUNT')) {
          strat.shouldHarvest = false;
          strat.notHarvestReason = 'callReward likely zero, INSUFFICIENT_INPUT_AMOUNT thrown';
          return strat;
        }
        console.log(
          `callReward failure on ${strat.id || strat.name} / ${
            strat.strategy || strat.address
          } --> ${error}`
        );
      } //try

    /* AT: seems to be erroneously omitting strats that need closer checking
    try {
      const abi = ['function output() public pure returns(address)'];
      const contract = new ethers.Contract(strat.address, abi, harvesterPK);
      strat.output = await contract.output();
    } catch (error) {}
    if (strat.output) {
      try {
        const ERC20 = new ethers.Contract(strat.output, IERC20, harvesterPK);
        const balance = await ERC20.balanceOf(strat.address);
        if (balance && balance.lte(0)) {
          strat.shouldHarvest = false;
          strat.notHarvestReason = 'strat output is zero';
        }
      } catch (error) {
        Sentry.captureException(error);
        console.log(error.message);
      }
    }  */
    try {
      const contract = new ethers.Contract(strat.strategy || strat.address, IStrategy, harvesterPK);
      let callStaticPassed = await contract.callStatic.harvest({
        gasPrice,
        gasLimit: ethers.BigNumber.from(strat.gasLimit),
      });
    } catch (error) {
      for (const key of Object.keys(KNOWN_RPC_ERRORS)) {
        if (error.message.includes(key)) {
          strat.shouldHarvest = false;
          strat.notHarvestReason = `Strat failed callStatic with a tagged condition --> ${KNOWN_RPC_ERRORS[key]}`;
          return strat;
        }
      }
      strat.shouldHarvest = false;
      strat.notHarvestReason = `Strat failed callStatic unusually --> ${error}`;
    } //try
  } catch (error) {
    strat.shouldHarvest = false;
    strat.notHarvestReason = `unexpected error in shouldHarvest(): ${error}`;
  } //try

  return strat;
}; //const shouldHarvest = async (strat, harvesterPK) =>

const harvest = async (strat, harvesterPK, provider, options, nonce = null) => {
  //nested function to carry out a slated harvest, retrying if necessary though not
  //  excessively so
  const tryTX = async (stratContract, max = 2) => {
    if (nonce) options.nonce = nonce;
    let tries = 0;
    while (tries++ < max) {
      let tx;
      try {
        //if we're working on the transaction-length limited Aurora chain...
        if (CHAIN.id === 'aurora') {
          try {
            tx = await stratContract.harvest(options);
            if (tx.status === 1)
              console.log(
                `${strat.id || strat.name}:\tharvested step 1/3: Charges Fees - with tx: ${
                  tx.transactionHash
                }`
              );
          } catch (error) {
            console.log(`${strat.id || strat.name}: ${error}`);
            return {
              contract: strat.strategy || strat.address,
              status: 'failed',
              message: `${strat.id || strat.name}: fail in step 1/3: Charges Fees`,
              data: error.message,
            };
          }
          try {
            tx = await stratContract.harvest(options);
            if (tx.status === 1)
              console.log(
                `${
                  strat.id || strat.name
                }:\tharvested step 2/3: Swaps to tokens needed step - with tx: ${
                  tx.transactionHash
                }`
              );
          } catch (error) {
            console.log(`${strat.id || strat.name}: ${error}`);
            return {
              contract: strat.strategy || strat.address,
              status: 'failed',
              message: `${strat.id || strat.name}: fail in step 2/3: - Swaps to tokens needed`,
              data: error.message,
            };
          }
          try {
            tx = await stratContract.harvest(options);
            if (tx.status === 1) {
              console.log(
                `${
                  strat.id || strat.name
                }:\tharvested step 3/3: Swaps to tokens needed step - with tx: ${
                  tx.transactionHash
                }`
              );
              return {
                contract: strat.strategy || strat.address,
                status: 'success',
                message: `${strat.id || strat.name}: harvested after try ${tries} - with tx: ${
                  tx.transactionHash
                }`,
                data: tx,
              };
            } //if (tx.status === 1)
          } catch (error) {
            console.log(`${strat.id || strat.name}: ${error}`);
            return {
              contract: strat.strategy || strat.address,
              status: 'failed',
              message: `${strat.id || strat.name}: fail in step 3/3 - Adds liquidity and deposits`,
              data: error.message,
            };
          } //try
          //else on this chain unusual gymnastics aren't needed to execute a harvest, so...
        } else {
          tx = await stratContract.harvest(options);

          //if this is a "tricky" chain... (TODO: improve on what this means)
          if (TRICKY_CHAINS.includes(CHAIN.id)) {
            let receipt = null;
            while (receipt === null) {
              try {
                await harvestHelpers.sleep(500);
                receipt = await provider.getTransactionReceipt(tx.hash);
                //TODO: no concern about an infinite loop here?
                if (receipt === null) continue;
                console.log(
                  `${strat.id || strat.name}:\tharvested after try ${tries} with tx: ${tx.hash}`
                );
                return {
                  contract: strat.strategy || strat.address,
                  status: 'success',
                  message: `${strat.id || strat.name}: harvested after try ${tries} with tx: ${
                    tx.hash
                  }`,
                  data: receipt,
                };
              } catch (error) {
                for (const key of Object.keys(KNOWN_RPC_ERRORS)) {
                  if (error.message.includes(key)) {
                    console.log(`${strat.id || strat.name}: ${KNOWN_RPC_ERRORS[key]}`);
                    try {
                      let res = await broadcast.send({
                        type: 'error',
                        title: `Error trying to harvest ${strat.id || strat.name}`,
                        message: `- error code: ${KNOWN_RPC_ERRORS[key]}\n- address: ${
                          strat.strategy || strat.address
                        }`,
                      });
                    } catch (error) {
                      console.log(`Error trying to send message to broadcast: ${error.message}`);
                    }
                    return {
                      contract: strat.strategy || strat.address,
                      status: 'failed',
                      message: `${strat.id || strat.name}: ${KNOWN_RPC_ERRORS[key]}`,
                    };
                  } //if (error.message.includes( key))
                } //for (const key of Object.keys( KNOWN_RPC_ERRORS))
                try {
                  let res = await broadcast.send({
                    type: 'error',
                    title: `Error trying to harvest ${strat.id || strat.name}`,
                    message: `- error code: unknown\n- address: ${
                      strat.strategy || strat.address
                    }\n- tx hash: ${tx.hash}`,
                  });
                } catch (error) {
                  console.log(`Error trying to send message to broadcast: ${error.message}`);
                }
                return {
                  contract: strat.strategy || strat.address,
                  status: 'failed',
                  message: `failed tx: ${tx.hash}`,
                  data: error.message,
                };
              } //try
            } //while (receipt === null)
            //else this is not a "tricky" chain, so...
          } else {
            tx = await tx.wait();
            if (tx.status === 1) {
              console.log(
                `${strat.id || strat.name}:\tharvested after try ${tries} with tx: ${
                  tx.transactionHash
                }`
              );
              return {
                contract: strat.strategy || strat.address,
                status: 'success',
                message: `${strat.id || strat.name}: harvested after try ${tries} with tx: ${
                  tx.transactionHash
                }`,
                data: tx,
              };
            } //if (tx.status === 1)
          } //if (TRICKY_CHAINS.includes( CHAIN.id))
        } //if (CHAIN.id === 'aurora')
      } catch (error) {
        //TODO: improve error reporting, adding (1) a facility to drill next level into the message
        //  to tease out the real issue (use regex?), like gas-limit hit on a CALL_EXCEPTION, and
        //  (2) //  lay-person-readable error surfacing!
        //Some error has occurred in this context of sending a harvest transaction. For
        //  each error string that we've identified as indicating a known-stop condition,
        //  one where no retry should be attempted...
        for (const key of Object.keys(KNOWN_RPC_ERRORS)) {
          //if this string matches what's occurred, make a note of it and short-circuit,
          //  returning information about the condition to the caller
          if (error.message.includes(key)) {
            const S = `${strat.id || strat.name}: ${KNOWN_RPC_ERRORS[key]}`;
            console.log(S);
            return {
              contract: strat.strategy || strat.address,
              status: 'failed',
              message: `${strat.id || strat.name}: ${KNOWN_RPC_ERRORS[key]}`,
              data: error.message,
            };
          }
        } //for (const key of Object.keys( KNOWN_RPC_ERRORS))

        //An unusual error condition has been encountered. If we haven't maxed out on retry
        //  attempts, fall through for another try, else short-circuit by raising this last
        //  error.
        if (tries === max) throw new Error(error);
      } //try
    } //while (tries < max)
  }; //const tryTX = async (

  try {
    //if our wallet hasn't enough gas to reliably attempt a harvest, inform our overseers
    //  and raise an error condition
    let balance = await harvesterPK.getBalance();
    if (balance < options.gasPrice * options.gasLimit) {
      try {
        let res = await broadcast.send({
          type: 'warning',
          title: `INSUFFICIENT_FUNDS to harvest ${(
            strat.id || strat.name
          ).toUpperCase()} in ${CHAIN.id.toUpperCase()}`,
          message: `- Gas required **${
            (options.gasPrice * options.gasLimit) / 1e18
          }** and Cowllector has **${ethers.utils.formatUnits(balance)}** \n- Contract Address: ${
            strat.strategy || strat.address
          }\n- Please give gas 🪙 🐮\n`,
        });
      } catch (error) {
        Sentry.captureException(error);
        console.log(`Error trying to send message to broadcast: ${error.message}`);
      }
      throw new Error(
        `${strat.id || strat.name}: INSUFFICIENT_FUNDS - gas required ${
          (options.gasPrice * options.gasLimit) / 1e18
        } and wallet holds only ${ethers.utils.formatUnits(balance)}`
      );
    } //if (balance < options.gasPrice *

    //attempt the harvest operation and return the result
    const stratContract = new ethers.Contract(
      strat.strategy || strat.address,
      IStrategy,
      harvesterPK
    );
    let tx = await tryTX(stratContract);
    return tx;
  } catch (error) {
    Sentry.captureException(error);
    console.log(error.message);
    return {
      contract: strat.strategy || strat.address,
      status: 'failed',
      message: error.message,
    };
  } //try
}; //const harvest = async (

const main = async () => {
  try {
    //if the caller gave us a chain to process that seems validly configured and not turned
    //  off.. (TODO: invert this long-block conditional to short-circuit instead)
    if (CHAIN && CHAIN.harvestHourInterval) {
      let hour = new Date().getUTCHours();
      if (hour % CHAIN.harvestHourInterval) {
        console.log( `Not yet time to harvest on ${CHAIN.id.toUpperCase()
													} [hour_interval=${CHAIN.harvestHourInterval}]`);
				await redis.redisDisconnect();
        return false;
      }
      console.log( `Harvesting on ${CHAIN.id.toUpperCase()} [id=${CHAIN_ID
											}] [rpc=${CHAIN.rpc}] [explorer=${CHAIN.blockExplorer}]`);

			let strats = await redis.getKey( REDIS_KEY);
			await redis.redisDisconnect();
			if (!strats)
				throw new Error( 'Strategy data failed to load from Redis');
			strats = Object.values( strats);

      try {
        const provider = new ethers.providers.JsonRpcProvider( CHAIN.rpc);

        //AT: TODO: we can get rid of this because we no longer have any "gasless" chains,
        //  I think
        //0xww: patch for GASLESS chains
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
        } //if (GASLESS_CHAINS.includes( CHAIN.id))

        let gasPrice = await getGasPrice(provider);
        console.log(`Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);

        //if the chain's current price of gas exceeds the cap we've put on the chain, abort
        //  this harvest run
        if (CHAIN.gas.priceCap < gasPrice) {
          console.log(
            `Gas price on ${CHAIN.id.toUpperCase()} currently exceeds our cap of ${
              CHAIN.gas.priceCap / 1e9
            } gwei. Aborting this run.`
          );
          return false;
        }

        const harvesterPK = new ethers.Wallet(process.env.HARVESTER_PK, provider);
        const balance = await harvesterPK.getBalance();
        const wNativeBalance = await getWnativeBalance(harvesterPK);

        //AT: 0xww was here having another go to add in missing gas limits; unclear why he
        //  felt it needed. Before I redeveloped the approach, this was replacing the
        //  original strat objects with their counterpart gasLimit objects. Now I just use
        //  the parts of filtering out other-chain strats and any to be harvested instead
        //  by an on-chain harvester, and to enforce a configured  gas-limit maximum.
        strats = await addGasLimit(strats, provider);
        //AT: TODO: map seems pointless here, should just use a forEach..
        strats = strats.map(s => {
          s.shouldHarvest = true;
          s.notHarvestReason = '';
          s.harvest = null;
          return s;
        });
        let stratsFiltered = [];
        let stratsShouldHarvest = [];
        /*//AT: ditto, indeed, just combine this with the one above
        strats = strats.map( s => {
          if (s.depositsPaused || s.harvestPaused) {
            s.shouldHarvest = false;
            s.notHarvestReason = 'deposits or harvest paused';
          }
          return s;
        });
        stratsFiltered = stratsFiltered.concat( strats.filter( s => !s.shouldHarvest));
        stratsShouldHarvest = strats.filter( s => s.shouldHarvest);
*/
        // strats = stratsShouldHarvest.map(s => {
        //   if (s.tvl < TVL_MINIMUM_TO_HARVEST) {
        //     s.shouldHarvest = false;
        //     s.notHarvestReason = `TVL is lower than min: ${TVL_MINIMUM_TO_HARVEST}`;
        //   }
        //   return s;
        // });
        // stratsFiltered = stratsFiltered.concat(strats.filter(s => !s.shouldHarvest));
        // stratsShouldHarvest = strats.filter(s => s.shouldHarvest);

        //      strats = await harvestHelpers.multicall( CHAIN, stratsShouldHarvest, 'balanceOf');
        strats = await harvestHelpers.multicall(CHAIN, strats, 'balanceOf');
        //AT: TODO: again, forEach
        strats = strats.map(s => {
          if (s.balanceOf === 0) {
            s.shouldHarvest = false;
            s.notHarvestReason = 'balance is zero';
          }
          return s;
        });
        stratsFiltered = stratsFiltered.concat(strats.filter(s => !s.shouldHarvest));
        stratsShouldHarvest = strats.filter(s => s.shouldHarvest);

        //TODO: semi-redundant call as the strat descriptors should already have the
        //  latest-harvest information, so best to remove this once system is solidified
        strats = await harvestHelpers.multicall(CHAIN, stratsShouldHarvest, 'lastHarvest');

        strats = await Promise.allSettled(
          stratsShouldHarvest.map(strat => shouldHarvest(strat, gasPrice, harvesterPK))
        );
        strats = strats.filter(r => r.status === 'fulfilled').map(s => s.value);

        stratsFiltered = stratsFiltered.concat(strats.filter(s => !s.shouldHarvest));
        stratsShouldHarvest = strats.filter(s => s.shouldHarvest);
        console.table(
          [...stratsFiltered, ...stratsShouldHarvest],
          [
            strats[0].id ? 'id' : 'name',
            strats[0].strategy ? 'strategy' : 'address',
            'shouldHarvest',
            'notHarvestReason',
          ]
        );

        console.log(`Strats to harvest: ${stratsShouldHarvest.length} of ${strats.length}`);

        //AT: my read of this is as a note of the maximum that may be spent on this round
        //  of harvesting on this chain
        let totalGas =
          stratsShouldHarvest.reduce((total, s) => total + Number(s.gasLimit), 0) / 1e9;
        console.log(
          `Total gas to use ${(totalGas * gasPrice) / 1e9} gwei. Current balance ${balance.div(
            1e9
          )} gwei`
        );

        //for each strategy tagged to be harvested...
        let harvesteds = [];
        //TODO: AT: Investigation tells me that the await in the 'for await' here is superfluous.
        //  Probably 0xww was intending parallel operation like Promise.all( array.map) would
        //  give..?
        for await (const strat of stratsShouldHarvest) {
          try {
            await unwrap(harvesterPK, provider, { gasPrice }, CHAIN.wnativeMinToUnwrap);
          } catch (error) {
            Sentry.captureException(error);
          }
          try {
            let options = {
              gasPrice,
              gasLimit: ethers.BigNumber.from(strat.gasLimit),
            };
            let harvested = await harvest(strat, harvesterPK, provider, options);
            harvesteds.push(harvested);
          } catch (error) {
            Sentry.captureException(error);
            console.log(error.message);
          }
        } //for await (const strat of stratsShouldHarvest)
        strats = [...stratsFiltered, ...stratsShouldHarvest];
        strats = strats.map(s => {
          let harvested = harvesteds.find(h => h.contract === (s.strategy || s.address));
          if (harvested) s.harvest = harvested;
          return s;
        });

        if (strats.length) {
          let success = strats.filter(s => s.harvest && s.harvest.status === 'success');
          let gasUsed = harvesteds.reduce((total, h) => {
            if (h.data && h.data.gasUsed) total = total.add(ethers.BigNumber.from(h.data.gasUsed));
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
          report.profit = currentBalance
            .add(currentWNativeBalance)
            .sub(balance.add(wNativeBalance));

          try {
            const uploaded = await uploadToFleek(report);
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
              Sentry.captureException(error);
              console.log(`Error trying to send message to broadcast: ${error.message}`);
            }
          } catch (error) {
            Sentry.captureException(error);
            console.log(error);
            let res = await broadcast.send({
              type: 'info',
              title: `Error trying to upload report to ipfs.fleek.co - ${CHAIN.id.toUpperCase()}`,
              message: '',
            });
          } //try
        } //if (strats.length)
      } catch (error) {
        Sentry.captureException(error);
        console.error( error);
      } //try
    } //if (CHAIN && CHAIN.harvestHourInterval)

    console.log(`done`);
  } catch (error) {
    Sentry.captureException( error);
		console.error( error);
  } //try

  process.exit();
}; //const main = async
main();
