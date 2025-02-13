import { NetworkProvider } from "@ton/blueprint";
import { OnekbJetton } from "../wrappers/OnekbJetton";
import { Address, toNano, Sender, beginCell } from "@ton/core";
import { JettonDefaultWallet } from "../build/OnekbJetton/tact_JettonDefaultWallet";

export async function run(provider: NetworkProvider) {
    const deployer = provider.sender();
    const deployedJettonAddress = Address.parse("EQAPLfCW1gC04VrZ_cbQUvtwMcZxyeZqblDW3XIRojdDRR7Z");
    const onekbJetton = provider.open(await OnekbJetton.fromAddress(deployedJettonAddress));

    const newMinter = Address.parse("UQDlfyv9kH8HMIrHS2wS6EopSjehixHsdg9SZD9o2NBrxUDc");
    const targetJettonWalletAddress = Address.parse("EQBbrPNVTJbs90x2r3XbV0MpqQTxnIig3Xhx3Fr6XX3UVP2q");

    // const isNewMinter = await onekbJetton.getIsMinter(newMinter);
    // console.log("isNewMinter:", isNewMinter);

    const jettonData = await onekbJetton.getGetJettonData();
    console.log("total supply:", jettonData.totalSupply);

    const recipientAddress = await onekbJetton.getGetWalletAddress(newMinter);
    console.log("addr:", recipientAddress);
    const recipientWallet = provider.open(
        await JettonDefaultWallet.fromAddress(recipientAddress)
    )
    const walletData = await recipientWallet.getGetWalletData();
    console.log("walletData:", walletData);
}