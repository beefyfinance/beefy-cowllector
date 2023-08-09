import { bigintPercent } from './bigint';

describe('bigint', () => {
    it('should calculate simple percent', () => {
        expect(bigintPercent(100n, 0.1)).toBe(10n);
    });
    it('should calculate more than 100%', () => {
        expect(bigintPercent(100n, 1.1)).toBe(110n);
    });
    it('should round to precision', () => {
        expect(bigintPercent(100n, 0.123456789, 2)).toBe(12n);
    });
    it('should round to more precision', () => {
        console.log(bigintPercent(100n, 0.129876543, 4));
        expect(bigintPercent(100n, 0.123456789, 4)).toBe(12n);
    });
});
