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
        const stakingJettonWalletAddress = await onekbJetton.getGetWalletAddress(staking.address);
        console.log("staking:", stakingJettonWalletAddress);
        const setJettonWalletAddressResult = await staking.send(
            stakingDeployer.getSender(),
            {
                value: jettonTransferGas,
            },
            {
                $$type: "SetJettonWalletAddress",
                jettonWalletAddress: stakingJettonWalletAddress,
            }
        );
        expect(setJettonWalletAddressResult.transactions).toHaveTransaction({
            from: stakingDeployer.address,
            to: staking.address,
            success: true,
        });

    });

    it('should mint from other contract', async () => {

        console.log("staking address:", staking.address);
        const myJettonAddress = await staking.getMyAddress();
        console.log("myJettonAddress:", myJettonAddress);

        const stakingWalletAddress = await onekbJetton.getGetWalletAddress(myJettonAddress);
        console.log("staking wallet address:", stakingWalletAddress);
        const stakingWallet = blockchain.openContract(
            await JettonDefaultWallet.fromAddress(stakingWalletAddress)
        );
        const testerWalletAddress = await onekbJetton.getGetWalletAddress(tester.address);
        const testerWallet = blockchain.openContract(
            await JettonDefaultWallet.fromAddress(testerWalletAddress)
        );
        const stakingContract = await blockchain.getContract(myJettonAddress);
        console.log("staking ton balance:", stakingContract.balance);

        await stakingDeployer.send({
            to: myJettonAddress,
            value: toNano("10"),
            bounce: false,
        });

        await stakingDeployer.send({
            to: staking.address,
            value: toNano("10"),
            bounce: false,
        });

        const staking1Contract = await blockchain.getContract(myJettonAddress);
        console.log("staking ton balance 1:", staking1Contract.balance);
        
        tester = await blockchain.treasury('tester');
        const mint1Amount = 35000000000n;
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

        const afterMintTesterBalance = (await testerWallet.getGetWalletData()).balance;
        console.log("afterMintTesterBalance:", afterMintTesterBalance);
        
        const transfer1Amount = 2000000000n;
        const transfer1Result = await testerWallet.send(
            tester.getSender(),
            {
                value: toNano("0.5"),
            },
            {
                $$type: "TokenTransfer",
                queryId: 0n,
                amount: transfer1Amount,
                destination: staking.address,
                response_destination: tester.address,
                custom_payload: null,
                forward_ton_amount: 1n,
                forward_payload: Cell.EMPTY as any
            }
        )

        // console.log("transfer:", transfer1Result);
        const afterDepositStakingBalance = (await stakingWallet.getGetWalletData()).balance;
        console.log("afterDepositStakingBalance:", afterDepositStakingBalance);
        const afterDepositTesterBalance = (await testerWallet.getGetWalletData()).balance;
        console.log("afterDepositTesterBalance:", afterDepositTesterBalance);

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

        const afterMintStakingBalance = (await stakingWallet.getGetWalletData()).balance;
        console.log("afterMintStakingBalance:", afterMintStakingBalance);

        const jettonData = await onekbJetton.getGetJettonData();
        console.log("totalSupply:", jettonData.totalSupply); // 85000000000n

        const transfer2Amount = 4000000000n;
        const transfer2Result = await staking.send(
            stakingDeployer.getSender(),
            {
                value: toNano("0.5"),
            },
            {
                $$type: "Transfer",
                amount: transfer2Amount,
                receiver: tester.address,
            }
        );
        
        // console.log("transfer:", transfer2Result);

        expect(transfer2Result.transactions).toHaveTransaction({
            from: stakingDeployer.address,
            to: staking.address,
            success: true,
        });

        const afterTransferStakingBalance = (await stakingWallet.getGetWalletData()).balance;
        console.log("afterTransferStakingBalance:", afterTransferStakingBalance);
        const afterTransferTesterBalance = (await testerWallet.getGetWalletData()).balance;
        console.log("afterTransferTesterBalance:", afterTransferTesterBalance);

        const isTransferSuccessful = (
            afterTransferTesterBalance === afterDepositTesterBalance - transfer2Amount &&
            afterTransferStakingBalance === afterMintStakingBalance + transfer2Amount
        )
        console.log("Transfer Successful (by balance):", isTransferSuccessful);

        expect(isTransferSuccessful).toBe(true);
    });
});