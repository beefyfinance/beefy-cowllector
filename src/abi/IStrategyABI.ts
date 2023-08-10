export const IStrategyABI = [
    {
        inputs: [{ internalType: 'address', name: 'callFeeRecipient', type: 'address' }],
        name: 'harvest',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    { inputs: [], name: 'harvest', outputs: [], stateMutability: 'nonpayable', type: 'function' },
] as const;
