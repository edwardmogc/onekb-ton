import { NetworkProvider } from "@ton/blueprint";
import { OnekbJetton } from "../wrappers/OnekbJetton";
import { Address, beginCell, toNano } from "@ton/core";
import { JettonDefaultWallet } from "../build/OnekbJetton/tact_JettonDefaultWallet";
import { Staking } from "../wrappers/Staking";

export async function run(provider: NetworkProvider) {
    const deployer = provider.sender();
    const deployedJettonAddress = Address.parse("EQDD0mQLIpgU97XAfhW3RYeZJ51iz-JnAw5xON9F6kcjUa2E");
    const onekbJetton = provider.open(await OnekbJetton.fromAddress(deployedJettonAddress));

    const deployedStakingAddress = Address.parse("EQCoefEKeVZ1Hh7q9f5xyF8qXmCw2HYF77pmTOORr8RFkURH");
    const staking = provider.open(await Staking.fromAddress(deployedStakingAddress));
    // // -------------------------
    // // 1. 添加 Mint 权限
    // // -------------------------
    // await onekbJetton.send(
    //     deployer,
    //     { 
    //         value: toNano('0.05') 
    //     },
    //     {
    //         $$type: 'AddMinter',
    //         minter: deployedStakingAddress,
    //     }
    // )
    
    // // -------------------------
    // // 2. Mint 代币
    // // -------------------------
    // await onekbJetton.send(
    //     deployer,
    //     { 
    //         value: toNano('0.05') 
    //     },
    //     {
    //         $$type: 'TokenMint',
    //         amount: 1000000000000n,
    //         receiver: deployer.address!,
    //     }
    // )

    // // -------------------------
    // // 3. 删除 Mint 权限
    // // -------------------------
    // await onekbJetton.send(
    //     deployer,
    //     { 
    //         value: toNano('0.05') 
    //     },
    //     {
    //         $$type: 'DelMinter',
    //         minter: deployer.address!,
    //     }
    // )

    // // -------------------------
    // // 4. 转移 拥有者 权限
    // // -------------------------
    // const newOwner = Address.parse("UQDlfyv9kH8HMIrHS2wS6EopSjehixHsdg9SZD9o2NBrxUDc");
    // await onekbJetton.send(
    //     deployer,
    //     { 
    //         value: toNano('0.05') 
    //     },
    //     {
    //         $$type: 'TransferOwnership',
    //         newOwner: newOwner,
    //     }
    // )

    // // Staking
    // // -------------------------
    // // 1. 提现功能
    // // -------------------------
    // const withdrawAmount = 120000000000n;
    // await staking.send(
    //     deployer,
    //     { 
    //         value: toNano('0.05') 
    //     },
    //     {
    //         $$type: 'TokenWithdraw',
    //         amount: withdrawAmount,
    //         staker: deployer.address!,
    //     }
    // );

    // // -------------------------
    // // 2. Staking铸币功能
    // // -------------------------
    // const mintAmount = 120000000000n;
    // await staking.send(
    //     deployer,
    //     { 
    //         value: toNano('0.05') 
    //     },
    //     {
    //         $$type: 'Mint',
    //         amount: mintAmount,
    //     }
    // );

    // -------------------------
    // 3. Staking转账功能
    // -------------------------
    const stakerAddress = Address.parse("EQBHInXNdFL11r-UhMQ6F1EF6OWh-ArIkfnFq1wEfWHZtT-C");
    const transferAmount = 20000000000n;
    await staking.send(
        deployer,
        { 
            value: toNano('1') 
        },
        {
            $$type: 'Transfer',
            amount: transferAmount,
            receiver: stakerAddress,
        }
    );

    // const myJettonAddress = await staking.getMyJettonAddress();
    // const stakingWalletAddress = await onekbJetton.getGetWalletAddress(myJettonAddress);
    // const stakingWallet = provider.open(
    //     await JettonDefaultWallet.fromAddress(stakingWalletAddress)
    // );
    // const stakingWalletData = await stakingWallet.getGetWalletData();
    // console.log("staking wallet balance:", stakingWalletData.balance);

    // const deployerAddress = await onekbJetton.getGetWalletAddress(deployer.address!);
    // const deployerWallet = provider.open(
    //     await JettonDefaultWallet.fromAddress(deployerAddress)
    // );
    // const deployerWalletData = await deployerWallet.getGetWalletData();
    // console.log("deployer wallet balance:", deployerWalletData.balance);

    // const isNewMinter = await onekbJetton.getIsMinter(deployedStakingAddress);
    // console.log("isNewMinter:", isNewMinter);

    // const jettonData = await onekbJetton.getGetJettonData();
    // console.log("total supply:", jettonData.totalSupply);

    // const deployerAddress = Address.parse("EQBRXfwMNg_25BMj9Sh-Ax7cDzbwcsxdB4Hh8nAVBBm-Jx0S");
    // const deployerWalletAddress = await onekbJetton.getGetWalletAddress(deployerAddress);
    // const deployerWallet = provider.open(
    //     await JettonDefaultWallet.fromAddress(deployerWalletAddress)
    // );
    // const deployergWalletData = await deployerWallet.getGetWalletData();
    // console.log("deployer wallet balance:", deployergWalletData.balance);
}