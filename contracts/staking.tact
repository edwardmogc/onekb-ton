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

contract Staking with Deployable, Ownable {
    tokenContract: Address;
    owner: Address;
    operator: Address;
    dailyMintLimit: Int;
    mintedToday: Int;
    lastMintTime: Int;
    staked: map<Address, Int>;
    
    init(owner: Address, operator: Address, tokenContract: Address, dailyMintLimit: Int) {
        self.owner = owner;
        self.operator = operator;
        self.dailyMintLimit = dailyMintLimit;
        self.mintedToday = 0;
        self.lastMintTime = 0;
        self.tokenContract = tokenContract;
    }

    receive(msg: TokenDeposit) {
        let ctx: Context = context();
        let current: Int = self.staked.get(ctx.sender)!!;
        self.staked.set(ctx.sender, current + msg.amount);
    }

    receive(msg: TokenWithdraw) {
        let ctx: Context = context();
        let staker = msg.staker;
        let stakedAmount: Int = self.staked.get(staker)!!;
        require(stakedAmount > 0, "No staked tokens");

        require(self.mintedToday + msg.amount <= self.dailyMintLimit, "Daily mint limit exceeded");
        
        self.mintedToday = self.mintedToday + msg.amount;
        self.staked.set(staker, 0);
    }
}
