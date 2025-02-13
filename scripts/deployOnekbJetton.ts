import { toNano } from '@ton/core';
import { OnekbJetton } from '../wrappers/OnekbJetton';
import { NetworkProvider } from '@ton/blueprint';
import { buildOnchainMetadata } from './utils/jettonHelper';

export async function run(provider: NetworkProvider) {
    // -------------------------
    // 1. 部署 Jetton Master 合约
    // -------------------------
    const deployer = provider.sender();
    const jettonParams = {
        name: "OneKB",
        description: "A description of OneKB",
        symbol: "ONEKB",
        image: "https://1000.game/1kb/presell/logo/1kb.png",
        decimals: "9",
    };
    const maxSupply = 1000000000n;
    let content = buildOnchainMetadata(jettonParams);

    const onekbJetton = provider.open(await OnekbJetton.fromInit(
        deployer.address!,
        content,
        maxSupply
    ));

    console.log(`Deploying Jetton master at ${onekbJetton.address}...`);
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
}
