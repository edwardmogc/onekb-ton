import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { Staking } from '../wrappers/Staking';
import '@ton/test-utils';

describe('Staking', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let staking: SandboxContract<Staking>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        staking = blockchain.openContract(await Staking.fromInit());

        deployer = await blockchain.treasury('deployer');

        const deployResult = await staking.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: staking.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and staking are ready to use
    });
});
