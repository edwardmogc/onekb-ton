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
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and onekbJetton are ready to use
    });

    it('should mint from other contract', async () => {
        
        const mintBalance = await staking.getJettonBalance();
        console.log("mintBalance:", mintBalance);

        const myAddress = await staking.getMyAddress();
        const myWalletAddress = await onekbJetton.getGetWalletAddress(myAddress);
        console.log("wallet:", myWalletAddress);

        const myJettonAddress = await staking.getMyJettonAddress();
        const myJettonWalletAddress = await onekbJetton.getGetWalletAddress(myJettonAddress);
        console.log("jettonWallet:", myJettonWalletAddress);
        
        const testerWalletAddress = await onekbJetton.getGetWalletAddress(tester.address);
        console.log("tester1:", testerWalletAddress);
        const testerWallet = blockchain.openContract(
            await JettonDefaultWallet.fromAddress(testerWalletAddress)
        );
        const testerWalletData = await testerWallet.getGetWalletData();
        console.log("tester1 balance:", testerWalletData.balance);

        const emptySlice = () => beginCell().endCell().asSlice();   
        const transferAmount = 12000000000n;
        const transfer1Result = await testerWallet.send(
            tester.getSender(),
            {
                value: toNano("0.1"),
            },
            {
                $$type: "TokenTransfer",
                queryId: 1n,
                amount: transferAmount,
                destination: operator.address,         // 目标接收者地址
                response_destination: operator.address,  // 回退地址（一般同目标）
                custom_payload: null,
                forward_ton_amount: toNano("0.01"),         // 附带的TON数量，根据需要设置
                forward_payload: emptySlice(),
            }
        );
        
        // const staking1WalletAddress = await onekbJetton.getGetWalletAddress(myAddress);
        // console.log("wallet1:", staking1WalletAddress);
        // const staking1Wallet = blockchain.openContract(
        //     await JettonDefaultWallet.fromAddress(staking1WalletAddress)
        // );
        // const staking1WalletData = await staking1Wallet.getGetWalletData();
        // console.log("staking 1 contract balance:", staking1WalletData.balance);
        const tester1WalletAddress = await onekbJetton.getGetWalletAddress(tester.address);
        const tester1Wallet = blockchain.openContract(
            await JettonDefaultWallet.fromAddress(tester1WalletAddress)
        );
        const tester1WalletData = await tester1Wallet.getGetWalletData();
        console.log("tester2 balance:", tester1WalletData.balance);

        const operatorWalletAddress = await onekbJetton.getGetWalletAddress(operator.address);
        console.log("operator:", operatorWalletAddress);
        const operatorWallet = blockchain.openContract(
            await JettonDefaultWallet.fromAddress(operatorWalletAddress)
        );
        const operatorWalletData = await operatorWallet.getGetWalletData();
        console.log("operator balance:", operatorWalletData.balance);

        const transfer2Amount = 15000000000n;
        const transfer2Result = await staking.send(
            stakingDeployer.getSender(),
            {
                value: toNano("0.1"),
            },
            {
                $$type: "Transfer2",
                amount: transfer2Amount,
                receiver: tester.address,
            }
        );

        expect(transfer2Result.transactions).toHaveTransaction({
            from: stakingDeployer.address,
            to: staking.address,
            success: true,
        });

        const tester2WalletAddress = await onekbJetton.getGetWalletAddress(tester.address);
        const tester2Wallet = blockchain.openContract(
            await JettonDefaultWallet.fromAddress(tester2WalletAddress)
        );
        const tester2WalletData = await tester2Wallet.getGetWalletData();
        console.log("tester3 balance:", tester2WalletData.balance);

        const currentWithdrawCount = await staking.getCurrentWithdrawCounter();
        console.log("withdraw count:", currentWithdrawCount);
        
        const myJettonBalance = await staking.getJettonBalance();
        console.log("balance:", myJettonBalance);
    });
});