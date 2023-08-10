import { serializeReport } from './harvest-report';

describe('harvest report', () => {
    it('should serialize a report to JSON without crashing', () => {
        const serialized = serializeReport(
            {
                chain: 'bsc',
                timing: {
                    startedAt: new Date('2021-01-01T00:00:00.000Z'),
                    endedAt: new Date('2021-01-01T00:00:00.000Z'),
                    durationMs: 0,
                },
                details: [
                    {
                        vault: {
                            id: 'test',
                        },
                        summary: {
                            error: false,
                            profitWei: 12356610n,
                        },
                        harvestDecision: null,
                    },
                ],
            },
            true
        );
        expect(JSON.parse(serialized)).toEqual({
            chain: 'bsc',
            timing: {
                startedAt: '2021-01-01T00:00:00.000Z',
                endedAt: '2021-01-01T00:00:00.000Z',
                durationMs: 0,
            },
            details: [
                {
                    vault: {
                        id: 'test',
                    },
                    summary: {
                        error: false,
                        profitWei: '12356610',
                    },
                    harvestDecision: null,
                },
            ],
        });
    });
});
