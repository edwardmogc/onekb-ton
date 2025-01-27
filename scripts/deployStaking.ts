import { toNano } from '@ton/core';
import { Staking } from '../wrappers/Staking';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const staking = provider.open(await Staking.fromInit());

    await staking.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(staking.address);

    // run methods on `staking`
}
