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
    });

    it('should mint from other contract', async () => {

        console.log("staking address:", staking.address);
        const myJettonAddress = await staking.getMyAddress();
        console.log("myJettonAddress:", myJettonAddress);
        
        const stakingContract = await blockchain.getContract(myJettonAddress);
        console.log("staking ton balance:", stakingContract.balance);

        await stakingDeployer.send({
            to: myJettonAddress,
            value: toNano("10"),
            bounce: false,
        });

        const staking1Contract = await blockchain.getContract(myJettonAddress);
        console.log("staking ton balance 1:", staking1Contract.balance);

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

        const stakingWalletAddress = await onekbJetton.getGetWalletAddress(myJettonAddress);
        console.log("staking wallet address:", stakingWalletAddress);
        const stakingWallet = blockchain.openContract(
            await JettonDefaultWallet.fromAddress(stakingWalletAddress)
        );
        const stakingJettonWalletData = await stakingWallet.getGetWalletData();
        console.log("staking 1 jetton balance:", stakingJettonWalletData.balance);
        console.log("staking 1 jetton owner:", stakingJettonWalletData.owner);
        console.log("staking 1 jetton master:", stakingJettonWalletData.master);

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

        console.log("result:", mint1Result);
        expect(mint1Result.transactions).toHaveTransaction({
            from: deployer.address,
            to: onekbJetton.address,
            success: true,
        });

        const jettonData = await onekbJetton.getGetJettonData();
        console.log("totalSupply:", jettonData.totalSupply);

        // const stakingWalletAddress = await onekbJetton.getGetWalletAddress(myJettonAddress);
        // console.log("staking wallet address:", stakingWalletAddress);
        // const stakingWallet = blockchain.openContract(
        //     await JettonDefaultWallet.fromAddress(stakingWalletAddress)
        // );
        // const stakingJettonWalletData = await stakingWallet.getGetWalletData();
        // console.log("staking 1 jetton balance:", stakingJettonWalletData.balance);
        // console.log("staking 1 jetton owner:", stakingJettonWalletData.owner);
        // console.log("staking 1 jetton master:", stakingJettonWalletData.master);

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

        // console.log("transfer:", transfer2Result);

        const tester2Wallet = blockchain.openContract(
            await JettonDefaultWallet.fromAddress(testerWalletAddress)
        );
        const tester2WalletData = await tester2Wallet.getGetWalletData();
        console.log("tester3 balance:", tester2WalletData.balance);

        const stakingWallet1 = blockchain.openContract(
            await JettonDefaultWallet.fromAddress(stakingWalletAddress)
        );
        const stakingJettonWallet1Data = await stakingWallet1.getGetWalletData();
        console.log("staking 2 jetton balance:", stakingJettonWallet1Data.balance);
        console.log("staking 2 jetton owner:", stakingJettonWallet1Data.owner);
        console.log("staking 2 jetton master:", stakingJettonWallet1Data.master);

        // const mintedToday = await staking.getMintedToday();
        // console.log("minted today:", mintedToday);
        // const jettonBalance = await staking.getJettonBalance();
        // console.log("jetton balance:", jettonBalance);
    });
});