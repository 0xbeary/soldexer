import { address, string, struct, u64, unit } from '@subsquid/borsh';
import { instruction } from './abi-support.js';

export const programId = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

/**
 * Creates a new coin and bonding curve.
 */
export interface Create {
  name: string;
  symbol: string;
  uri: string;
}

/**
 * Creates a new coin and bonding curve.
 */
export const create = instruction(
  {
    d8: '0x181ec828051c0777',
  },
  {
    mint: 0,
    mintAuthority: 1,
    bondingCurve: 2,
    associatedBondingCurve: 3,
    global: 4,
    mplTokenMetadata: 5,
    metadata: 6,
    user: 7,
    systemProgram: 8,
    tokenProgram: 9,
    associatedTokenProgram: 10,
    rent: 11,
    eventAuthority: 12,
    program: 13,
  },
  struct({
    name: string,
    symbol: string,
    uri: string,
  }),
);

export const instructions = {
  create,
};
