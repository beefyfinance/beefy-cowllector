

function async main() {
  //note the list of active vaults at the time of our last run (and now possibly  
  //  out-of-date))

  //load up current vaults from Beefy's online source

  //for each chain we support...
    //for each current vault...
      //if the vault does not reside on the target chain, loop for the next vault

      //if this vault was unknown at the time of our last run...
        //if the vault is inactive (paused or ended), loop for the next vault

        //add it to our list of active vaults, and note the addition in our log of changes 
        //  made
      //else if the vault has gone inactive...
        //remove it from our list of active vaults, note this in our log of changes made, 
        //  and loop for the next vault
      //else add this vault to a list of still-present vaults encountered

      //if this is a chain on which we use an on-chain harvesting (OCH) service, determine 
      //  whether the vault is excluded from being handled that way

      //if the determined OCH status is not reflected on our current vault descriptor...
        //if the vault is not new, note the switch in our log of changes made

        //reflect the status onto the current vault descriptor
 
      //if the vault is not handled by an OCH...
        //add the vault to a list of non-OCH vaults active on this chain for some 
        //  downstream batch processing

        //estimate the gas required to execute a harvest on the vault (information needed 
        //  by our homegrown bot), and reflect the amount onto the current vault descriptor

    //if any vault on the chain is to be handled by our homegrown bot... 
      //obtain a fresh list of each such vault's strategy contract

      //for each such vault...
        //if the vault is not new and its strategy contract hasn't changed, loop for the 
        //  next vault

        //if the strategy contract changed, note the change in our log of changes made

        //reflect the strategy contract onto the vault descriptor

  //for each active vault at the time of the last run which remains in that list...
    //if the vault was not noted upstream as still active, remove it from our running 
    //  active-vault list, and note the removal in our log of changes made

  //persist our log of significant changes made during this sync to help our overseers keep 
  //  a good eye on us

  //persest our running list of active vaults, including their properties of downstream 
  //  interest
} //function async main(


main();
