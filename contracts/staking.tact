import "@stdlib/ownable";
import "@stdlib/deploy";

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

contract Staking with Deployable, Ownable {
    jettonToken: Address;
    presaleContract: Address?;
    jettonWallet: Address?;
    owner: Address;
    operator: Address;
    dailyMintLimit: Int;
    mintedToday: Int;
    lastMintTime: Int;
    currentDepositCounter: Int;
    staked: map<Address, StakeInfo>;
    
    init(
        owner: Address, 
        operator: Address, 
        jettonToken: Address, 
        dailyMintLimit: Int
    ) {
        self.owner = owner;
        self.operator = operator;
        self.dailyMintLimit = dailyMintLimit;
        self.mintedToday = 0;
        self.lastMintTime = 0;
        self.currentDepositCounter = 0;
        self.jettonToken = jettonToken;
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
    }

    receive(msg: TokenDeposit) {
        let ctx: Context = context();
        let stakeInfo: StakeInfo = self.staked.get(ctx.sender)!!;
        self.staked.set(ctx.sender, StakeInfo{
            uid: null,
            amount: stakeInfo.amount + msg.amount,
        });
        
        require(self.jettonWallet != null && self.jettonWallet != newAddress(0, 0), "No jetton wallet");
        let qid = self.currentDepositCounter;
        self.currentDepositCounter = qid + 1;

        send(SendParameters{
            to: myAddress(),
            value: ton("0.05"),
            bounce: false,
            mode: SendIgnoreErrors,
            body: TokenTransfer{
                queryId: qid,
                amount: msg.amount,
                destination: self.jettonWallet!!,
                response_destination: myAddress(),
                custom_payload: null,
                forward_ton_amount: ton("0.05"),
                forward_payload: emptySlice(),
            }.toCell()
        });
    }

    receive(msg: TokenWithdraw) {
        self.requireOperator();
        let ctx: Context = context();
        
        // check staking contract onekb balance, if enough then no need to mint else mint
        require(self.mintedToday + msg.amount <= self.dailyMintLimit, "Daily mint limit exceeded");
        
        self.mintedToday = self.mintedToday + msg.amount;

    }

    receive(msg: UpdatePresaleContract) {
        self.requireOwner();
        if (msg.presaleContract != newAddress(0, 0)) {
            self.presaleContract = msg.presaleContract;
        }
    }

    receive(msg: UpdateJettonWallet) {
        self.requireOwner();
        if (msg.newWallet != newAddress(0, 0)) {
            self.jettonWallet = msg.newWallet;
        }
    }
}