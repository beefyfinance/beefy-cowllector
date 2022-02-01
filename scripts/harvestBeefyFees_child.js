require('dotenv').config();
const ethers = require('ethers');
const chains = require('../data/chains');
const broadcast = require('../utils/broadcast');
const harvestHelpers = require('../utils/harvestHelpers');
const IBeefyFeeBatch = require('../abis/BeefyFeeBatch.json');

const CHAIN_ID = parseInt(process.argv[2]);
const CHAIN = chains[CHAIN_ID];
const TRICKY_CHAINS = ['fantom', 'polygon', 'avax'];

const JSONRPC_ERRORS = {
  'code=INSUFFICIENT_FUNDS': 'INSUFFICIENT_FUNDS',
  'insufficient funds': 'INSUFFICIENT_FUNDS',
  'code=REPLACEMENT_UNDERPRICED': 'REPLACEMENT_UNDERPRICED',
  'code=GAS_LIMIT_REACHED': 'GAS_LIMIT_REACHED',
  'gas limit reached': 'GAS_LIMIT_REACHED',
  'code=SERVER_ERROR': 'SERVER_ERROR',
};

require('../utils/logger')(CHAIN_ID);

const getGasPrice = async provider => {
  let gas = 0;
  if (CHAIN.gas && CHAIN.gas.price) gas = CHAIN.gas.price;
  try {
    let gasPrice = await provider.getGasPrice();
    if (gasPrice > gas) {
      gas = (Number(gasPrice.toString()) * 1.3).toFixed();
    }
  } catch (error) {}
  return gas;
};

const harvest = async (contractAddress, harvesterPK, provider, options, nonce = null) => {
  const tryTX = async (contact, max = 5) => {
    if (nonce) options.nonce = nonce;
    let tries = 0;
    while (tries <= max) {
      tries++;
      let tx;
      try {
        tx = await contact.harvest(options);
        if (TRICKY_CHAINS.includes(CHAIN.id)) {
          let receipt = null;
          while (receipt === null) {
            try {
              await harvestHelpers.sleep(500);
              receipt = await provider.getTransactionReceipt(tx.hash);
              if (receipt === null) continue;
              console.log(`BeefyFeeBatch: harvested after tried ${tries} with tx: ${tx.hash}`);
              return {
                contract: contractAddress,
                status: 'success',
                message: `BeefyFeeBatch: harvested after tried ${tries} with tx: ${tx.hash}`,
                data: receipt,
              };
            } catch (error) {
              for (const key of Object.keys(JSONRPC_ERRORS)) {
                if (error.message.includes(key)) {
                  console.log(`BeefyFeeBatch: ${JSONRPC_ERRORS[key]}`);
                  try {
                    let res = await broadcast.send({
                      type: 'error',
                      title: `Error trying to harvest BeefyFeeBatch`,
                      message: `- error code: ${JSONRPC_ERRORS[key]}\n- address: ${contractAddress}`,
                    });
                  } catch (error) {
                    console.log(`Error trying to send message to broadcast: ${error.message}`);
                  }
                  return {
                    contract: contractAddress,
                    status: 'failed',
                    message: `BeefyFeeBatch: ${JSONRPC_ERRORS[key]}`,
                  };
                }
              }
              try {
                let res = await broadcast.send({
                  type: 'error',
                  title: `Error trying to harvest BeefyFeeBatch`,
                  message: `- error code: unknown\n- address: ${contractAddress}\n- tx hash: ${tx.hash}`,
                });
              } catch (error) {
                console.log(`Error trying to send message to broadcast: ${error.message}`);
              }
              return {
                contract: contractAddress,
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
              `BeefyFeeBatch: harvested after tried ${tries} with tx: ${tx.transactionHash}`
            );
            return {
              contract: contractAddress,
              status: 'success',
              message: `BeefyFeeBatch: harvested after tried ${tries} with tx: ${tx.transactionHash}`,
              data: tx,
            };
          }
        }
      } catch (error) {
        for (const key of Object.keys(JSONRPC_ERRORS)) {
          if (error.message.includes(key)) {
            console.log(`BeefyFeeBatch: ${JSONRPC_ERRORS[key]}`);
            return {
              contract: contractAddress,
              status: 'failed',
              message: `BeefyFeeBatch: ${JSONRPC_ERRORS[key]}`,
              data: error.message,
            };
          }
        }
        console.log(error);
        if (tries === max) throw new Error(error);
      }
    }
  };

  try {
    // check if have minimum for gas harvest
    let balance = await harvesterPK.getBalance();
    if (balance < options.gasPrice * options.gasLimit) {
      try {
        let res = await broadcast.send({
          type: 'warning',
          title: `INSUFFICIENT_FUNDS to harvest BeefyFeeBatch in ${CHAIN.id.toUpperCase()}`,
          message: `- Gas required **${((options.gasPrice * options.gasLimit) / 1e18).toFixed(
            4
          )}** and Cowllector has **${(balance / 1e18).toFixed(
            4
          )}** \n- Contract Address: ${contractAddress} \n- Please feed me with more coins 🪙 🐮 \n`,
        });
      } catch (error) {
        console.log(`Error trying to send message to broadcast: ${error.message}`);
      }
      throw new Error(
        `BeefyFeeBatch: INSUFFICIENT_FUNDS - gas required ${
          (options.gasPrice * options.gasLimit) / 1e18
        } and you has ${balance / 1e18}`
      );
    }

    const batcher = new ethers.Contract(contractAddress, IBeefyFeeBatch, harvesterPK);
    let tx = await tryTX(batcher);
    return tx;
  } catch (error) {
    console.log(error.message);
    return {
      contract: contractAddress,
      status: 'failed',
      message: error.message,
    };
  }
};

const main = async () => {
  if (CHAIN && CHAIN.id) {
    if (!CHAIN.beefyFeeBatcher) {
      console.log(`${CHAIN.id} does not have a fee batcher`);
      return false;
    }

    if (!harvestHelpers.isNewPeriodNaive(CHAIN.beefyFeeHarvestInterval)) {
      console.log(
        `Is not Harvest time for beefyFeeBatch [hour_interval=${CHAIN.beefyFeeHarvestInterval}]`
      );
      return false;
    }

    console.log(
      `Harvest time for beefyFeeBatch [id=${CHAIN_ID}] [rpc=${CHAIN.rpc}] [explorer=${CHAIN.blockExplorer}] [hour_interval=${CHAIN.beefyFeeHarvestInterval}]`
    );

    try {
      const provider = new ethers.providers.JsonRpcProvider(CHAIN.rpc);
      // patch for CELO chain
      if (CHAIN.id === 'celo') {
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

      let options = {};
      options.gasPrice = await getGasPrice(provider);
      if (CHAIN.gas && CHAIN.gas.limit) options.gasLimit = CHAIN.gas.limit;
      console.log(`gasPrice: ${options.gasPrice} - gasLimit: ${options.gasLimit}`);

      const harvesterPK = new ethers.Wallet(process.env.HARVESTER_PK, provider);

      let harvested = await harvest(CHAIN.beefyFeeBatcher, harvesterPK, provider, options);

      if (harvested.status === 'success') {
        try {
          let res = await broadcast.send({
            type: 'info',
            title: `BeefyFeeBatch harvest on ${CHAIN.id.toUpperCase()}`,
            message: harvested.message,
            platforms: ['discord'],
          });
        } catch (error) {
          console.log(`Error trying to send message to broadcast: ${error.message}`);
        }
      }
    } catch (error) {
      console.log(error);
    }
  }
  console.log('done');
  process.exit();
};

main();
