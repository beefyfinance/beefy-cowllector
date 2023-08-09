export function bigintPercent(n: bigint, percent: number, precision: number = 4) {
    // round to precision
    const divisor = 10 ** precision;
    const mult = BigInt(Math.round(percent * divisor));
    return (n * mult) / BigInt(divisor);
}
