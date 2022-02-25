export const neverHarvestList = [
  // BIFI maxi is permissioned.
  "mooFantomBIFI",
]

export const gelatoIncompatibleVaultList = [
  // Too much gas
  'mooGeistMIM',
  'mooGeistCRV',
  'mooGeistFTM',
  'mooGeistWBTC',
  'mooGeistETH',
  'mooGeistfUSDT',
  'mooGeistUSDC',
  'mooGeistDAI',
  'mooGeistGEIST-WFTM',
  // PAUSED
  'mooBeetWAGMIIndex',
  'mooBeetMagicTouchDaniele',
  // Not compatible
  'mooCurveTriCrypto',
  'mooJetSwapWINGS-FTM',
  'mooJetSwapWINGS-USDC',
  'mooJetSwapWINGS',
  'mooTombTSHARE-FTM',
  'mooTombTOMB-FTM',
  'mooBooTREEB-FTM',
  'mooScreamCRV',
  'mooScreamLINK',
  'mooBooBOO',
  'mooBooWFTM-FOO',
  'mooBooFTM-SCREAM',
  'mooSteakHouseSCREAM-FTM',
  'mooScreamUSDC',
  'mooScreamWBTC',
  'mooScreamDAI',
  'mooScreamETH',
  'mooScreamfUSDT',
  'mooBooYFI-ETH',
  'mooCurve2Pool',
  'mooCurveRenBTC',
  'mooBooMIM-FTM',
  'mooBooBoo-FTM',
  'mooBooBIFI-FTM',
  'mooBooFTM-ICE',
  'mooBooFTM-SUSHI',
  'mooBooFTM-USDC',
  'mooBooANY-FTM',
  'mooBooDAI-FTM',
  'mooEsterEST-FTM',
  'mooEsterEST',
  'mooBooBNB-FTM',
  'mooFroyo3Pool',
  'mooFroyoFROYO-FTM',
  'mooBooLINK-FTM',
  'mooBooUSDT-FTM',
  'mooBooBTC-FTM',
  'mooBooETH-FTM',
  'mooBooAAVE-FTM',
  'mooBooCRV-FTM',
];


export const gelatoHarvesterDenyList = [
  ...neverHarvestList,
  ...gelatoIncompatibleVaultList
]