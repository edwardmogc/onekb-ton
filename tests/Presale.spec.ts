import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { Presale } from '../wrappers/Presale';
import '@ton/test-utils';

describe('Presale', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let presale: SandboxContract<Presale>;

    beforeEach(async () => {
        // blockchain = await Blockchain.create();

        // presale = blockchain.openContract(await Presale.fromInit(0n));

        // deployer = await blockchain.treasury('deployer');

        // const deployResult = await presale.send(
        //     deployer.getSender(),
        //     {
        //         value: toNano('0.05'),
        //     },
        //     {
        //         $$type: 'Deploy',
        //         queryId: 0n,
        //     }
        // );

        // expect(deployResult.transactions).toHaveTransaction({
        //     from: deployer.address,
        //     to: presale.address,
        //     deploy: true,
        //     success: true,
        // });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and presale are ready to use
    });
});
