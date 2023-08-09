export const BeefyHarvestLensABI = [
    { inputs: [], stateMutability: 'nonpayable', type: 'constructor' },
    {
        inputs: [{ internalType: 'contract IStrategyV7', name: '_strategy', type: 'address' }],
        name: 'harvest',
        outputs: [
            { internalType: 'uint256', name: 'callReward', type: 'uint256' },
            { internalType: 'bool', name: 'success', type: 'bool' },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ internalType: 'contract IERC20', name: '_native', type: 'address' }],
        name: 'init',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'native',
        outputs: [{ internalType: 'contract IERC20', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;
