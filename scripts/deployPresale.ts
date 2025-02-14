import { toNano } from '@ton/core';
import { Presale } from '../wrappers/Presale';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const presale = provider.open(await Presale.fromInit(BigInt(Math.floor(Math.random() * 10000))));

    await presale.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(presale.address);

    console.log('ID', await presale.getId());
}
