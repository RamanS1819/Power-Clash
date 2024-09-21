import { UInt64 } from '@proto-kit/library';
import { ArkanoidGameHub } from './arkanoid/ArkanoidGameHub';
import { RandzuLogic } from './randzu/RandzuLogic';
import { ThimblerigLogic } from './thimblerig/ThimblerigLogic';
import { Balances } from './framework';
import { ModulesConfig } from '@proto-kit/common';
import { CheckersLogic } from './checkers';
import { GuessGame } from './number_guessing';
import { SlotMachine } from './TokenTwist';
import { PowerClash } from './PowerClash';

const modules = {
  Balances,
  SlotMachine,
  PowerClash,
};

const config: ModulesConfig<typeof modules> = {
  Balances: {
    totalSupply: UInt64.from(10000),
  },
  SlotMachine: {},
  PowerClash: {},
};

export default {
  modules,
  config,
};
