const { addressBook } = require('blockchain-addressbook');

// Get each chain.
// Review if it has a treasury multisig. Log if it should be deployed.
console.log(addressBook['bsc'].platforms.beefyfinance);

// get each relevant timelock.
// review which accounts are proposers, executors or superadmins.
// create the relevant transactions for each one.
