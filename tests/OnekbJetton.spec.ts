import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, toNano } from '@ton/core';
import { OnekbJetton } from '../wrappers/OnekbJetton';
import { Staking } from '../wrappers/Staking';
import '@ton/test-utils';
import { JettonDefaultWallet } from '../build/OnekbJetton/tact_JettonDefaultWallet';
import logger from './utils/logger';

describe('OnekbJetton', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let stakingDeployer: SandboxContract<TreasuryContract>;
    let onekbJetton: SandboxContract<OnekbJetton>;
    let wallet: SandboxContract<JettonDefaultWallet>;
    let staking: SandboxContract<Staking>;
    let operator: SandboxContract<TreasuryContract>;
    let tester: SandboxContract<TreasuryContract>;

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

        console.log("onekb jetton master:", onekbJetton.address);

        stakingDeployer = await blockchain.treasury('deployer');
        operator = await blockchain.treasury('operator');
        const totalMintLimit = 100000000000000000n;
        const dailyMintLimit = 10000000000000n;
        const jettonData = await onekbJetton.getGetJettonData();
        const jettonWalletCode = jettonData.walletCode;

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
                value: toNano("1000"),
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

        const addMinter1Result = await onekbJetton.send(
            deployer.getSender(),
            {
                value: jettonTransferGas,
            },
            {
                $$type: "AddMinter",
                minter: deployer.address,
            }
        );
        expect(addMinter1Result.transactions).toHaveTransaction({
            from: deployer.address,
            to: onekbJetton.address,
            success: true,
        });

        const mintAmount = 50000000000n;
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

        tester = await blockchain.treasury('tester');
        const mint1Amount = 30000000000n;
        const mint1Result = await onekbJetton.send(
            deployer.getSender(),
            {
                value: toNano("0.1"),
            },
            {
                $$type: "TokenMint",
                amount: mint1Amount,
                receiver: tester.address,
            }
        );
        expect(mint1Result.transactions).toHaveTransaction({
            from: deployer.address,
            to: onekbJetton.address,
            success: true,
        });

        // const mint2Amount = 40000000000n;
        // const mint2Result = await onekbJetton.send(
        //     deployer.getSender(),
        //     {
        //         value: toNano("0.1"),
        //     },
        //     {
        //         $$type: "TokenMint",
        //         amount: mint2Amount,
        //         receiver: staking.address,
        //     }
        // );
        // expect(mint2Result.transactions).toHaveTransaction({
        //     from: deployer.address,
        //     to: onekbJetton.address,
        //     success: true,
        // });
    });

    it('should mint from other contract', async () => {
        
        const jettonData = await onekbJetton.getGetJettonData();
        console.log("totalSupply:", jettonData.totalSupply);

        console.log("staking address:", staking.address);
        const stakingWalletAddress = await onekbJetton.getGetWalletAddress(staking.address);
        console.log("staking wallet address:", stakingWalletAddress);
        const stakingWallet = blockchain.openContract(
            await JettonDefaultWallet.fromAddress(stakingWalletAddress)
        );
        const stakingJettonWalletData = await stakingWallet.getGetWalletData();
        console.log("staking 1 jetton balance:", stakingJettonWalletData.balance);
        console.log("staking 1 jetton owner:", stakingJettonWalletData.owner);
        console.log("staking 1 jetton master:", stakingJettonWalletData.master);

        const myAddress = await staking.getMyAddress();
        console.log("my address:", myAddress);

        const testerWalletAddress = await onekbJetton.getGetWalletAddress(tester.address);
        const testerWallet = blockchain.openContract(
            await JettonDefaultWallet.fromAddress(testerWalletAddress)
        );
        const testerWalletData = await testerWallet.getGetWalletData();
        console.log("tester1 balance:", testerWalletData.balance);

        const transfer2Amount = 3000000000n;
        const transfer2Result = await staking.send(
            stakingDeployer.getSender(),
            {
                value: toNano("0.1"),
            },
            {
                $$type: "Transfer",
                amount: transfer2Amount,
                receiver: tester.address,
            }
        );

        expect(transfer2Result.transactions).toHaveTransaction({
            from: stakingDeployer.address,
            to: staking.address,
            success: true,
        });

        const tester2Wallet = blockchain.openContract(
            await JettonDefaultWallet.fromAddress(testerWalletAddress)
        );
        const tester2WalletData = await tester2Wallet.getGetWalletData();
        console.log("tester3 balance:", tester2WalletData.balance);

        const stakingWallet1Address = await onekbJetton.getGetWalletAddress(staking.address);
        console.log("staking wallet 2 address:", stakingWallet1Address);
        const stakingWallet1 = blockchain.openContract(
            await JettonDefaultWallet.fromAddress(stakingWallet1Address)
        );
        const stakingJettonWallet1Data = await stakingWallet1.getGetWalletData();
        console.log("staking 2 jetton balance:", stakingJettonWallet1Data.balance);
        console.log("staking 2 jetton owner:", stakingJettonWallet1Data.owner);
        console.log("staking 2 jetton master:", stakingJettonWallet1Data.master);


        const transfer3Amount = 55000000000n;
        const transfer3Result = await staking.send(
            operator.getSender(),
            {
                value: toNano("0.1"),
            },
            {
                $$type: "TokenWithdraw",
                amount: transfer3Amount,
                staker: tester.address,
            }
        );

        expect(transfer3Result.transactions).toHaveTransaction({
            from: operator.address,
            to: staking.address,
            success: true,
        });

        const tester3Wallet = blockchain.openContract(
            await JettonDefaultWallet.fromAddress(testerWalletAddress)
        );
        const tester3WalletData = await tester3Wallet.getGetWalletData();
        console.log("tester3 balance:", tester3WalletData.balance);

        const stakingWallet2 = blockchain.openContract(
            await JettonDefaultWallet.fromAddress(stakingWalletAddress)
        );
        const stakingJettonWallet2Data = await stakingWallet2.getGetWalletData();
        console.log("staking 3 jetton balance:", stakingJettonWallet2Data.balance);
        console.log("staking 3 jetton owner:", stakingJettonWallet2Data.owner);
        console.log("staking 3 jetton master:", stakingJettonWallet2Data.master);
        const mintedToday = await staking.getMintedToday();
        console.log("minted today:", mintedToday);
        const jettonBalance = await staking.getJettonBalance();
        console.log("jetton balance:", jettonBalance);
    });
});