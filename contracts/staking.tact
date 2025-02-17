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

message(0x47d54391) TokenDeposit {
    amount: Int;
}

message(0x319b0cdc) TokenWithdraw {
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

message UpdatePresaleContract {
    presaleContract: Address;
}

message UpdateJettonWallet {
    newWallet: Address;
}

message Mint {
    amount: Int;
}

contract Staking with Deployable, Ownable {
    jettonToken: Address;
    myJettonWalletAddress: Address;
    myJettonAmount: Int as coins = 0;
    presaleContract: Address?;
    owner: Address;
    operator: Address;
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
        dailyMintLimit: Int
    ) {
        self.owner = owner;
        self.operator = operator;
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

    // presale already mint onekb token to staking contract address, just need to save the purchase info
    receive(msg: DepositFromPresale) {
        self.requirePresaleContract();
        self.staked.set(msg.buyer, StakeInfo{
            uid: msg.uid,
            amount: msg.amount,
        });

        self.myJettonAmount = self.myJettonAmount + msg.amount;
    }

    receive(msg: TokenDeposit) {
        let ctx: Context = context();
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
            mode: SendIgnoreErrors,
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

    receive(msg: TokenWithdraw) {
        self.requireOperator();
        let ctx: Context = context();
        
        if (msg.amount > self.myJettonAmount) {
            let missing: Int = msg.amount - self.myJettonAmount;

            require(self.mintedToday + msg.amount <= self.dailyMintLimit, "Daily mint limit exceeded");

            send(SendParameters{
                to: self.jettonToken,
                value: JettonTransferGas,
                bounce: false,
                mode: SendRemainingValue + SendIgnoreErrors,
                body: TokenMint{
                    amount: missing,
                    receiver: myAddress(),
                }.toCell()
            });
            self.mintedToday = self.mintedToday + msg.amount;
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

    receive(msg: UpdatePresaleContract) {
        self.requireOwner();
        if (msg.presaleContract != newAddress(0, 0)) {
            self.presaleContract = msg.presaleContract;
        }
    }

    get fun get_minted_today(): Int {
        return self.mintedToday;
    }

    get fun get_jetton_balance(): Int {
        return self.myJettonAmount;
    }
}