export const vaultDenyList = new Set([
  // BIFI maxi is permissioned.
  'mooAvalancheBIFI',
  // Not compatible [e.g. no harvest(CallFeeRecipient)]
	'mooCurveAv3CRV', 
	'mooCurveTriCrypto', 
	'mooOliveBUSDe-USDTe'
]);
