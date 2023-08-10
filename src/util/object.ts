import { merge } from 'lodash';

// https://stackoverflow.com/a/61132308/2523414
export type DeepPartial<T> = T extends object
    ? {
          [P in keyof T]?: DeepPartial<T[P]>;
      }
    : T;

// like lodash merge, but make sure we add keys of the right type
// when they already are typed in the first place
export function typeSafeSet<T>(o: T, n: DeepPartial<T>): T {
    // this merge method mutates the first object
    return merge(o, n);
}
