import { toNano } from '@ton/core';
import { OnekbJetton } from '../wrappers/OnekbJetton';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const onekbJetton = provider.open(await OnekbJetton.fromInit());

    await onekbJetton.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(onekbJetton.address);

    // run methods on `onekbJetton`
}
