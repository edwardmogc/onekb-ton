import { NetworkProvider } from "@ton/blueprint";
import { OnekbJetton } from "../wrappers/OnekbJetton";
import { Address, beginCell, toNano } from "@ton/core";
import { JettonDefaultWallet } from "../build/OnekbJetton/tact_JettonDefaultWallet";

export async function run(provider: NetworkProvider) {
    const deployer = provider.sender();
    const deployedJettonAddress = Address.parse("EQAyhEGf6d9cGaOvSosKM30BH5MRvSxxN0f4kUwztye5XGd9");
    const onekbJetton = provider.open(await OnekbJetton.fromAddress(deployedJettonAddress));

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
    //         minter: deployer.address!,
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


    // -------------------------
    // 4. 转移 拥有者 权限
    // -------------------------
    const newOwner = Address.parse("UQDlfyv9kH8HMIrHS2wS6EopSjehixHsdg9SZD9o2NBrxUDc");
    await onekbJetton.send(
        deployer,
        { 
            value: toNano('0.05') 
        },
        {
            $$type: 'TransferOwnership',
            newOwner: newOwner,
        }
    )

    // const isNewMinter = await onekbJetton.getIsMinter(deployer.address!);
    // console.log("isNewMinter:", isNewMinter);

    // const jettonData = await onekbJetton.getGetJettonData();
    // console.log("total supply:", jettonData.totalSupply);

    // const deployerAddress = await onekbJetton.getGetWalletAddress(deployer.address!);
    // console.log("addr:", deployerAddress);

    // // 用包装器打开该钱包合约实例
    // const deployerWallet = provider.open(await JettonDefaultWallet.fromAddress(deployerAddress));

    // // 调用 getter 获取钱包数据（例如余额、owner、master 等）
    // const deployerWalletData = await deployerWallet.getGetWalletData();
    // console.log("Deployer Jetton Wallet Data:", deployerWalletData);
    // const recipient = Address.parse("UQDlfyv9kH8HMIrHS2wS6EopSjehixHsdg9SZD9o2NBrxUDc");
    // const recipientAddress = await onekbJetton.getGetWalletAddress(recipient);
    // const recipientWallet = provider.open(await JettonDefaultWallet.fromAddress(recipientAddress));
    // const recipientWalletData = await recipientWallet.getGetWalletData();
    // console.log("Recipient Jetton Wallet Owner:", recipientWalletData.owner);
    // console.log("Recipient Jetton Wallet Balance:", recipientWalletData.balance);
}