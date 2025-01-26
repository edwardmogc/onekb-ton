import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, toNano } from '@ton/core';
import { OnekbToken } from '../wrappers/OnekbToken';
import '@ton/test-utils';

describe('OnekbToken', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let onekbToken: SandboxContract<OnekbToken>;
    let ownerAddress: Address;

    beforeEach(async () => {
        // create a new block chain 
        blockchain = await Blockchain.create();

        onekbToken = blockchain.openContract(await OnekbToken.fromInit());

        deployer = await blockchain.treasury('deployer');

        const deployResult = await onekbToken.send(
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
            to: onekbToken.address,
            deploy: true,
            success: true,
        });

        ownerAddress = await onekbToken.getOwner();
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and onekbToken are ready to use
    });

    it('should add new minter by owner and mint tokens correctly by minter', async () => {
        const minter = await blockchain.treasury('minter');
        const addMinterResult = await onekbToken.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'AddMinter',
                minter: minter.address,
            }
        );

        expect(addMinterResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: onekbToken.address,
            success: true,
        });

        const isNewMinter = await onekbToken.getIsMinter(minter.address);
        expect(isNewMinter).toBe(true);

        const recipient = await blockchain.treasury('recipient');

        const mintAmount = BigInt(1000);

        const mintResult = await onekbToken.send(
            minter.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Mint',
                to: recipient.address,
                amount: mintAmount,
            }
        );

        expect(mintResult.transactions).toHaveTransaction({
            from: minter.address,
            to: onekbToken.address,
            success: true,
        });

        const totalSupply = await onekbToken.getTotalSupply();
        expect(totalSupply).toBe(mintAmount);

        const balance = await onekbToken.getBalanceOf(recipient.address);
        expect(balance).toBe(mintAmount);
    });

    it('should remove a minter by owner', async () => {
        const minter = await blockchain.treasury('minter');

        await onekbToken.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'AddMinter',
                minter: minter.address,
            }
        );

        const delMinterResult = await onekbToken.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'DelMinter',
                minter: minter.address,
            }
        );

        expect(delMinterResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: onekbToken.address,
            success: true,
        });

        const isMinter = await onekbToken.getIsMinter(minter.address);
        expect(isMinter).toBe(false);
    })
});
