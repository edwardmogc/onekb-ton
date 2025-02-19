import "@stdlib/ownable";
import "@stdlib/deploy";

const JettonTransferGas: Int = ton("0.05");

struct JettonWalletData {
    balance: Int as coins;
    ownerAddress: Address;
    jettonMasterAddress: Address;
    jettonWalletCode: Cell;
}

fun calculateJettonWalletAddress(
    ownerAddress: Address,
    jettonMasterAddress: Address,
    jettonWalletCode: Cell,
): Address {
    let initData = JettonWalletData{
        balance: 0,
        ownerAddress,
        jettonMasterAddress,
        jettonWalletCode,
    };

    return contractAddress(StateInit{
        code: jettonWalletCode,
        data: initData.toCell(),
    });
}

message(0x642b7d07) TokenMint {
    amount: Int;
    receiver: Address;
}

message(0xf8a7ea5) TokenTransfer {
    queryId: Int as uint64;
    amount: Int as coins;
    destination: Address;
    response_destination: Address;
    custom_payload: Cell?;
    forward_ton_amount: Int as coins;
    forward_payload: Slice as remaining; // Comment Text message when Transfer the jetton
}

message TokenDeposit {
    amount: Int;
}

message TokenWithdraw {
    amount: Int;
    staker: Address;
}

message DepositFromPresale {
    buyer: Address;
    uid: String;
    amount: Int;
}

message StakeInfo {
    uid: String?;
    amount: Int;
}

message Transfer {
    amount: Int;
    receiver: Address;
}

message Mint {
    amount: Int;
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
    myJettonWalletInit: StateInit;
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
        self.myJettonWalletInit = StateInit{
            code: jettonWalletCode,
            data: JettonWalletData{
                balance: 0,
                ownerAddress: myAddress(),
                jettonMasterAddress: jettonMasterAddress,
                jettonWalletCode: jettonWalletCode
            }.toCell()
        };
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
            to: self.myJettonWalletAddress,
            value: JettonTransferGas,
            bounce: false,
            mode: SendPayGasSeparately,
            body: TokenTransfer{
                queryId: qid,
                amount: msg.amount,
                destination: self.myJettonWalletAddress,
                response_destination: self.myJettonWalletAddress,
                custom_payload: null,
                forward_ton_amount: 1,
                forward_payload: emptySlice(),
            }.toCell()
        });

        self.myJettonAmount = self.myJettonAmount + msg.amount;
    }

    receive(msg: Transfer) {
        let qid = self.currentWithdrawCounter;
        self.currentWithdrawCounter = qid + 1;

        send(SendParameters{
            to: contractAddress(self.myJettonWalletInit),
            value: JettonTransferGas,
            body: TokenTransfer{
                queryId: qid,
                amount: msg.amount,
                destination: msg.receiver,
                response_destination: msg.receiver,
                custom_payload: null,
                forward_ton_amount: 1,
                forward_payload: emptySlice(),
            }.toCell(),
            code: self.myJettonWalletInit.code,
            data: self.myJettonWalletInit.data
        });
    }

    receive(msg: Mint) {
        send(SendParameters{
            to: self.jettonToken,
            value: JettonTransferGas,
            mode: SendPayGasSeparately,
            body: TokenMint{
                amount: msg.amount,
                receiver: self.myJettonWalletAddress,
            }.toCell()
        });
    }

    receive(msg: TokenWithdraw) {
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
                bounce: false,
                mode: SendPayGasSeparately,
                body: TokenMint{
                    amount: missing,
                    receiver: self.myJettonWalletAddress,
                }.toCell()
            });
            self.mintedToday = self.mintedToday + msg.amount;
            self.totalMinted = self.totalMinted + msg.amount;
            self.myJettonAmount = self.myJettonAmount + missing;
        }
        
        let qid = self.currentWithdrawCounter;
        self.currentWithdrawCounter = qid + 1;

        send(SendParameters{
            to: self.myJettonWalletAddress,
            value: JettonTransferGas,
            body: TokenTransfer{
                queryId: qid,
                amount: msg.amount,
                destination: msg.staker,
                response_destination: msg.staker,
                custom_payload: null,
                forward_ton_amount: 1,
                forward_payload: emptySlice(),
            }.toCell()
        });

        self.myJettonAmount = self.myJettonAmount - msg.amount;
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
        return contractAddress(self.myJettonWalletInit);
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