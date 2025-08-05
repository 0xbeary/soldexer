import assert from 'assert';
import { Codec, GetCodecType, Src } from '@subsquid/borsh';
import { getInstructionData } from '@subsquid/solana-stream';

export type Bytes = string;
export type Base58Bytes = string;

export function instruction<D extends Discriminator, A extends Record<string, number>, DataCodec extends Codec<any>>(
  d: D,
  accounts: A,
  data: DataCodec,
): DeriveInstruction<D, A, DataCodec> {
  const ins = new Instruction(accounts, data);
  Object.assign(ins, d);
  return ins as any;
}

type DeriveInstruction<D, A, DataCodec> = Simplify<
  RemoveUndefined<D> & Instruction<{ [K in keyof A]: Base58Bytes }, GetCodecType<DataCodec>>
>;

export type Simplify<T> = {
  [K in keyof T]: T[K];
} & {};

type RemoveUndefined<T> = {
  [K in keyof T as undefined extends T[K] ? never : K]: T[K];
};

interface Discriminator {
  d8?: string;
  d4?: string;
  d1?: string;
}

interface DecodedInstruction<A, D> {
  accounts: A;
  data: D;
}

class Instruction<A, D> {
  constructor(
    private accounts: { [K in keyof A]: number },
    private data: Codec<D>,
  ) {}

  decode(ins: {
    accounts: Base58Bytes[];
    data: Bytes;
  }): DecodedInstruction<A, D> {
    return {
      accounts: this.decodeAccounts(ins.accounts),
      data: this.decodeData(getInstructionData(ins)),
    };
  }

  decodeAccounts(accounts: Base58Bytes[]): A {
    const result: any = {};
    for (const key in this.accounts) {
      result[key] = accounts[this.accounts[key]];
    }
    return result;
  }

  decodeData(data: Uint8Array): D {
    const src = new Src(data);
    this.assertDiscriminator(src);
    return this.data.decode(src);
  }

  private _assertDiscriminator?: (src: Src) => void;

  private assertDiscriminator(src: Src): void {
    if (this._assertDiscriminator == null) {
      this._assertDiscriminator = this.createDiscriminatorAssertion();
    }
    this._assertDiscriminator(src);
  }

  private createDiscriminatorAssertion(): (src: Src) => void {
    const self: Discriminator = this as any;
    if (self.d8 != null) {
      const d = new Src(decodeHex(self.d8)).u64();
      return (src) => {
        assert(d === src.u64());
      };
    } else if (self.d4 != null) {
      const d = new Src(decodeHex(self.d4)).u32();
      return (src) => {
        assert(d === src.u32());
      };
    } else if (self.d1 != null) {
      const d = new Src(decodeHex(self.d1)).u8();
      return (src) => {
        assert(d === src.u8());
      };
    } else {
      return () => {};
    }
  }
}

function decodeHex(hex: string): Uint8Array {
  hex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
