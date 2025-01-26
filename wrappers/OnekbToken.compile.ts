import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tact',
    target: 'contracts/onekb_token.tact',
    options: {
        debug: true,
    },
};
