import { typeSafeSet } from './object';

describe('object', () => {
    it('should set an object fields', () => {
        type T = { a: number; b: string };
        const o: T = { a: 1, b: '2' };
        typeSafeSet(o, { a: 2 });
        expect(o).toEqual({
            a: 2,
            b: '2',
        });
    });

    it('should set an object fields with a nested object', () => {
        type T = { a: number; b: { c: number; d: string } };
        const o: T = { a: 1, b: { c: 2, d: '3' } };
        typeSafeSet(o, { b: { c: 3 } });
        expect(o).toEqual({
            a: 1,
            b: {
                c: 3,
                d: '3',
            },
        });
    });
});
