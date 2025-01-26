import { toNano } from '@ton/core';
import { OnekbToken } from '../wrappers/OnekbToken';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const onekbToken = provider.open(await OnekbToken.fromInit());

    await onekbToken.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(onekbToken.address);
}
