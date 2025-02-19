import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, toNano } from '@ton/core';
import { OnekbJetton } from '../wrappers/OnekbJetton';
import { Staking } from '../wrappers/Staking';
import '@ton/test-utils';
import { JettonDefaultWallet } from '../build/OnekbJetton/tact_JettonDefaultWallet';

describe('OnekbJetton', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let stakingDeployer: SandboxContract<TreasuryContract>;
    let onekbJetton: SandboxContract<OnekbJetton>;
    let staking: SandboxContract<Staking>;
    let operator: SandboxContract<TreasuryContract>;
    const jettonTransferGas = toNano('0.05');

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');


        // 部署OnekbJetton合约
        const content = beginCell()
            .storeUint(1, 8)
            .storeStringTail('OneKB')
            .endCell();

        const maxSupply = 1000000000000000000n;
        
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
                value: jettonTransferGas,
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

        stakingDeployer = await blockchain.treasury('deployer');
        operator = await blockchain.treasury('operator');
        const totalMintLimit = 100000000000000000n;
        const dailyMintLimit = 10000000000000n;
        const jettonData = await onekbJetton.getGetJettonData();
        const jettonWalletCode =jettonData.walletCode;

        staking = blockchain.openContract(
            await Staking.fromInit(
                stakingDeployer.address,
                operator.address,
                jettonWalletCode,
                onekbJetton.address,
                totalMintLimit,
                dailyMintLimit
            )
        );

        const stakingDeployResult = await staking.send(
            stakingDeployer.getSender(),
            {
                value: jettonTransferGas,
            },
            {
                $$type: "Deploy",
                queryId: 0n
            }
        );
        expect(stakingDeployResult.transactions).toHaveTransaction({
            from: stakingDeployer.address,
            to: staking.address,
            deploy: true,
            success: true,
        });

        const addMinterResult = await onekbJetton.send(
            deployer.getSender(),
            {
                value: jettonTransferGas,
            },
            {
                $$type: "AddMinter",
                minter: staking.address,
            }
        );
        expect(addMinterResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: onekbJetton.address,
            success: true,
        });


        const mintAmount = 500000000000n;
        const mintResult = await staking.send(
            stakingDeployer.getSender(),
            {
                value: toNano("0.1"),
            },
            {
                $$type: "Mint",
                amount: mintAmount,
            }
        );
        expect(mintResult.transactions).toHaveTransaction({
            from: stakingDeployer.address,
            to: staking.address,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and onekbJetton are ready to use
    });

    it('should mint from other contract', async () => {
        
        const jettonData = await onekbJetton.getGetJettonData();
        console.log("totalSupply:", jettonData.totalSupply);

        const myAddress = await staking.getMyAddress();
        const stakingWalletAddress = await onekbJetton.getGetWalletAddress(myAddress);
        console.log("wallet:", stakingWalletAddress);
        const stakingWallet = blockchain.openContract(
            await JettonDefaultWallet.fromAddress(stakingWalletAddress)
        );
        const stakingWalletData = await stakingWallet.getGetWalletData();
        console.log("staking contract balance:", stakingWalletData.balance);

        const tester = await blockchain.treasury('tester');
        // const transferAmount = 1500000000n;
        // const transferResult = await staking.send(
        //     stakingDeployer.getSender(),
        //     {
        //         value: toNano("1"),
        //     },
        //     {
        //         $$type: "Transfer",
        //         amount: transferAmount,
        //         receiver: tester.address,
        //     }
        // );

        // expect(transferResult.transactions).toHaveTransaction({
        //     from: stakingDeployer.address,
        //     to: staking.address,
        //     success: true,
        // });
        
        // const staking1WalletAddress = await onekbJetton.getGetWalletAddress(myAddress);
        // console.log("wallet1:", staking1WalletAddress);
        // const staking1Wallet = blockchain.openContract(
        //     await JettonDefaultWallet.fromAddress(staking1WalletAddress)
        // );
        // const staking1WalletData = await staking1Wallet.getGetWalletData();
        // console.log("staking 1 contract balance:", staking1WalletData.balance);

        // const testerWalletAddress = await onekbJetton.getGetWalletAddress(tester.address);
        // console.log("tester:", testerWalletAddress);
        // const testerWallet = blockchain.openContract(
        //     await JettonDefaultWallet.fromAddress(testerWalletAddress)
        // );
        // const testerWalletData = await testerWallet.getGetWalletData();
        // console.log("tester balance:", testerWalletData.balance);
    });
});