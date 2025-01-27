import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, toNano } from '@ton/core';
import { OnekbJetton } from '../wrappers/OnekbJetton';
import '@ton/test-utils';
import { JettonDefaultWallet } from '../build/OnekbJetton/tact_JettonDefaultWallet';

describe('OnekbJetton', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let onekbJetton: SandboxContract<OnekbJetton>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');

        const content = beginCell()
            .storeUint(1, 8)
            .storeStringTail('OneKB')
            .endCell();

        const maxSupply = 1000000000n;
        
        onekbJetton = blockchain.openContract(
            await OnekbJetton.fromInit(
                deployer.address, 
                content, 
                maxSupply
            )
        );

        const deployResult = await onekbJetton.send(
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
            to: onekbJetton.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and onekbJetton are ready to use
    });

    it('should allow onwer to add a minter and minter to mint tokens', async () => {
        const minter = await blockchain.treasury('minter');

        const result = await onekbJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'AddMinter',
                minter: minter.address,
            }
        );

        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: onekbJetton.address,
            success: true,
        });

        const isNewMinter = await onekbJetton.getIsMinter(minter.address);
        expect(isNewMinter).toBe(true);

        const recipient = await blockchain.treasury('recipient');
        const recipient1 = await blockchain.treasury('recipient1');
        const mintAmount = 1000n;
        
        const mintResult = await onekbJetton.send(
            minter.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Mint',
                amount: mintAmount,
                receiver: recipient.address,
            }
        );

        expect(mintResult.transactions).toHaveTransaction({
            from: minter.address,
            to: onekbJetton.address,
            success: true,
        });

        const jettonData = await onekbJetton.getGetJettonData();
        expect(jettonData.totalSupply).toBe(mintAmount);

        const recipientAddress = await onekbJetton.getGetWalletAddress(recipient.address);
        const recipientWallet = blockchain.openContract(
            await JettonDefaultWallet.fromAddress(recipientAddress)
        );

        const walletData = await recipientWallet.getGetWalletData();
        expect(walletData.balance).toBe(mintAmount);
        expect(walletData.owner.toString()).toBe(recipient.address.toString());
        expect(walletData.master.toString()).toBe(onekbJetton.address.toString());

        const recipient1Address = await onekbJetton.getGetWalletAddress(recipient1.address);
        const recipient1Wallet = blockchain.openContract(
            await JettonDefaultWallet.fromAddress(recipient1Address)
        );
    });

    it('should allow owner to remove a minter', async () => {
        const minter = await blockchain.treasury('minter');

        await onekbJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'AddMinter',
                minter: minter.address,
            }
        );

        const delMinterResult = await onekbJetton.send(
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
            to: onekbJetton.address,
            success: true,
        });

        const isMinter = await onekbJetton.getIsMinter(minter.address);
        expect(isMinter).toBe(false);
    });
});