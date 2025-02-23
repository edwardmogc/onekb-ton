import "@stdlib/ownable";
import "@stdlib/deploy";

const JettonTransferGas: Int = ton("0.05");

fun calculateJettonWalletAddress(
    ownerAddress: Address,
    jettonMasterAddress: Address,
    jettonWalletCode: Cell,
): Address {
    let data: Cell = beginCell()
        .storeAddress(jettonMasterAddress) // master (先存)
        .storeAddress(ownerAddress)  // owner (后存)
        .endCell();

    let init: StateInit = StateInit{
        code: jettonWalletCode,
        data: data
    };
    return contractAddress(init);
}

message(0x642b7d07) TokenMint {
    amount: Int;
    receiver: Address;
}

message JettonTransfer {
    queryId: Int as uint64;
    amount: Int as coins;
    destination: Address;
    response_destination: Address;
    forward_ton_amount: Int as coins;
}

message(0xf8a7ea5) TokenTransfer {
    queryId: Int as uint64;
    amount: Int as coins;
    destination: Address;
    response_destination: Address;
    custom_payload: Cell?;
    forward_ton_amount: Int as coins;
    forward_payload: Slice as remaining;
}

message TokenDeposit {
    amount: Int as coins;
}

message TokenWithdraw {
    amount: Int as coins;
    staker: Address;
}

message DepositFromPresale {
    buyer: Address;
    uid: String;
    amount: Int as coins;
}

message StakeInfo {
    uid: String?;
    amount: Int as coins;
}

message Transfer {
    amount: Int as coins;
    receiver: Address;
}

message Mint {
    amount: Int as coins;
}

message SetJettonWalletAddress {
    jettonWalletAddress: Address;
}

message UpdatePresaleContract {
    presaleContract: Address;
}

message UpdateJettonWallet {
    newWallet: Address;
}

message UpdateOperator {
    newOperator: Address;
}

message UpdateDailyMintLimit {
    dailyMintLimit: Int;
}

message UpdateTotalMintLimit {
    totalMintLimit: Int;
}

message TransferOwnership {
    newOwner: Address;
}

contract Staking with Deployable, Ownable {
    jettonToken: Address;
    myJettonWalletAddress: Address;
    myJettonAmount: Int as coins = 0;
    presaleContract: Address?;
    owner: Address;
    operator: Address;
    totalMintLimit: Int;
    totalMinted: Int;
    dailyMintLimit: Int;
    mintedToday: Int;
    lastMintTime: Int;
    currentDepositCounter: Int;
    currentWithdrawCounter: Int;
    staked: map<Address, StakeInfo>;
    
    init(
        owner: Address, 
        operator: Address, 
        jettonWalletCode: Cell,
        jettonMasterAddress: Address,
        totalMintLimit: Int,
        dailyMintLimit: Int
    ) {
        self.owner = owner;
        self.operator = operator;
        self.totalMintLimit = totalMintLimit;
        self.totalMinted = 0;
        self.dailyMintLimit = dailyMintLimit;
        self.mintedToday = 0;
        self.lastMintTime = 0;
        self.currentDepositCounter = 0;
        self.currentWithdrawCounter = 0;
        self.myJettonWalletAddress = calculateJettonWalletAddress(
            myAddress(), 
            jettonMasterAddress, 
            jettonWalletCode,
        );
        self.jettonToken = jettonMasterAddress;
    }
    
    fun requireOperator() {
        let ctx: Context = context();
        require(ctx.sender == self.operator, "Not operator");
    }

    fun requirePresaleContract() {
        let ctx: Context = context();
        require(ctx.sender == self.presaleContract, "Not presale contract");
    }

    receive(msg: DepositFromPresale) {
        self.requirePresaleContract();
        // 暂时没什么用处    
        self.staked.set(msg.buyer, StakeInfo{
            uid: msg.uid,
            amount: msg.amount,
        });

        self.myJettonAmount = self.myJettonAmount + msg.amount;
    }

    receive(msg: TokenDeposit) {
        let ctx: Context = context();
        // 暂时没什么用处
        let stakeInfo: StakeInfo = self.staked.get(ctx.sender)!!;
        self.staked.set(ctx.sender, StakeInfo{
            uid: null,
            amount: stakeInfo.amount + msg.amount,
        });
        
        let qid = self.currentDepositCounter;
        self.currentDepositCounter = qid + 1;

        send(SendParameters{
            to: self.jettonToken,
            value: ton("0.08"),
            mode: SendPayGasSeparately,
            body: JettonTransfer{
                queryId: qid,
                amount: msg.amount,
                destination: myAddress(),
                response_destination: ctx.sender,
                forward_ton_amount: 1,
            }.toCell()
        });

        self.myJettonAmount = self.myJettonAmount + msg.amount;
    }

    receive(msg: Transfer) {
        dump("Staking Transfer");
        let ctx: Context = context();
        let qid = self.currentWithdrawCounter;
        self.currentWithdrawCounter = qid + 1;

        send(SendParameters{
            to: self.jettonToken,
            value: ton("0.08"),
            mode: SendPayGasSeparately,
            body: JettonTransfer{
                queryId: qid,
                amount: msg.amount,
                destination: myAddress(),
                response_destination: ctx.sender,
                forward_ton_amount: ton("0.001"),
            }.toCell(),
        });
        self.myJettonAmount = self.myJettonAmount - msg.amount;
        dump("End Staking Transfer");
    }

    receive(msg: Mint) {
        dump("Staking Mint");
        send(SendParameters{
            to: self.jettonToken,
            value: JettonTransferGas,
            mode: SendPayGasSeparately,
            body: TokenMint{
                amount: msg.amount,
                receiver: myAddress(),
            }.toCell()
        });
        self.myJettonAmount = self.myJettonAmount + msg.amount;
    }

    receive(msg: TokenWithdraw) {
        dump("Staking Withdraw");
        self.requireOperator();
        let ctx: Context = context();
        
        if ((now() / 86400) > (self.lastMintTime / 86400)) {
            self.mintedToday = 0;
            self.lastMintTime = now();
        }

        if (msg.amount > self.myJettonAmount) {
            let missing: Int = msg.amount - self.myJettonAmount;

            require(self.mintedToday + msg.amount <= self.dailyMintLimit, "Daily mint limit exceeded");
            require(self.totalMinted + msg.amount <= self.totalMintLimit, "Total mint limit exceeded");

            send(SendParameters{
                to: self.jettonToken,
                value: JettonTransferGas,
                mode: SendPayGasSeparately,
                body: TokenMint{
                    amount: missing,
                    receiver: myAddress(),
                }.toCell()
            });
            self.mintedToday = self.mintedToday + missing;
            self.totalMinted = self.totalMinted + missing;
            self.myJettonAmount = self.myJettonAmount + missing;
        }
        
        let qid = self.currentWithdrawCounter;
        self.currentWithdrawCounter = qid + 1;

        send(SendParameters{
            to: self.jettonToken,
            value: ton("0.08"),
            mode: SendPayGasSeparately,
            body: JettonTransfer{
                queryId: qid,
                amount: msg.amount,
                destination: msg.staker,
                response_destination: myAddress(),
                forward_ton_amount: 1,
            }.toCell()
        });

        self.myJettonAmount = self.myJettonAmount - msg.amount;
    }

    receive(msg: SetJettonWalletAddress) {
        self.requireOwner();
        self.myJettonWalletAddress = msg.jettonWalletAddress;
    }

    receive(msg: UpdateOperator) {
        self.requireOwner();
        self.operator = msg.newOperator;
    }

    receive(msg: UpdatePresaleContract) {
        self.requireOwner();
        self.presaleContract = msg.presaleContract;
    }

    receive(msg: UpdateDailyMintLimit) {
        self.requireOwner();
        self.dailyMintLimit = msg.dailyMintLimit;
    }

    receive(msg: UpdateTotalMintLimit) {
        self.requireOwner();
        self.totalMintLimit = msg.totalMintLimit;
    }

    receive(msg: TransferOwnership) {
        self.requireOwner();
        self.owner = msg.newOwner;
    }

    get fun current_deposit_counter(): Int {
        return self.currentDepositCounter;
    }

    get fun current_withdraw_counter(): Int {
        return self.currentWithdrawCounter;
    }

    get fun my_address(): Address {
        return myAddress();
    }

    get fun my_jetton_address(): Address {
        return self.myJettonWalletAddress;
    }

    get fun minted_today(): Int {
        return self.mintedToday;
    }

    get fun jetton_balance(): Int {
        return self.myJettonAmount;
    }

    get fun last_mint_time(): Int {
        return self.lastMintTime;
    }
}