import { addressBook } from 'blockchain-addressbook';

export type Chain = keyof typeof addressBook;

export const allChainIds: Chain[] = Object.keys(addressBook) as Chain[];
