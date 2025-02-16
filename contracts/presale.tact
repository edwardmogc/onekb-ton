import "@stdlib/ownable";
import "@stdlib/deploy";

message(0x642b7d07) TokenMint {
    amount: Int;
    receiver: Address;
}

message DepositFromPresale {
    buyer: Address;
    uid: String;
    amount: Int;
}

message BuyWithTON {
    amount: Int;
}

message BuyWithUSDT {
    amount: Int;
}

message BuyAndStake {
    uid: String;
    amount: Int;
}

message Phase {
    startTime: Int;
    endTime: Int;
    minPurchase: Int;
    maxPurchase: Int;
    usdRaised: Int;
    hardCap: Int;
    priceMultiplier: Int;
    isWhitelistRequired: Bool;
}

message AddPhase {
    startTime: Int;
    endTime: Int;
    minPurchase: Int;
    maxPurchase: Int;
    hardCap: Int;
    priceMultiplier: Int;
    isWhitelistRequired: Bool;
}

message UpdatePhase {
    id: Int;
    startTime: Int;
    endTime: Int;
    minPurchase: Int;
    maxPurchase: Int;
    hardCap: Int;
    priceMultiplier: Int;
    isWhitelistRequired: Bool;
}

message TransferOwnership {
    newOwner: Address;
}

message UpdateStakingContract {
    stakingContract: Address;
}

contract Presale with Deployable, Ownable {
    jettonToken: Address;
    stakingContract: Address?;
    owner: Address;
    operator: Address;
    dailyMintLimit: Int;
    mintedToday: Int;
    lastMintTime: Int;
    tokenPrice: Int;
    currentPhaseId: Int;
    totalPhases: Int;
    phases: map<Int, Phase>;

    init(owner: Address, operator: Address, jettonToken: Address, dailyMintLimit: Int, tokenPrice: Int) {
        self.owner = owner;
        self.operator = operator;
        self.dailyMintLimit = dailyMintLimit;
        self.mintedToday = 0;
        self.lastMintTime = 0;
        self.tokenPrice = tokenPrice;
        self.currentPhaseId = 0;
        self.totalPhases = 0;
        self.jettonToken = jettonToken;
    }

    receive(msg: BuyWithTON) {
        let ctx: Context = context();

        let phase: Phase? = self.phases.get(self.currentPhaseId);
        require(phase != null, "No active phase");
        let tokensToMint: Int = msg.amount / (self.tokenPrice * phase!!.priceMultiplier);
        
        self.tokenMint(tokensToMint, ctx.sender);
    }

    receive(msg: BuyWithUSDT) {        
        let ctx: Context = context();

        let phase: Phase? = self.phases.get(self.currentPhaseId);
        require(phase != null, "No active phase");
        let tokensToMint: Int = msg.amount / (self.tokenPrice * phase!!.priceMultiplier);

        self.tokenMint(tokensToMint, ctx.sender);
    }

    receive(msg: BuyAndStake) {
        let ctx: Context = context();

        require(self.stakingContract != null, "No staking contract");

        self.tokenMint(msg.amount, self.stakingContract!!);

        let depositMsg = DepositFromPresale{
            buyer: ctx.sender,
            uid: msg.uid,
            amount: msg.amount,
        };
        send(SendParameters{
            to: self.stakingContract!!,
            value: ton("0.01"),
            mode: SendRemainingValue,
            body: depositMsg.toCell(),
        });
    }

    fun tokenMint(amount: Int, to: Address) {
        send(SendParameters{
            to: self.jettonToken,
            value: ton("0.05"),
            mode: SendRemainingValue,
            body: TokenMint{
                amount: amount,
                receiver: to,
            }.toCell(),
        });
    }

    receive(msg: AddPhase) {
        self.requireOwner();
        require(msg.endTime > msg.startTime, "End Time must be after start time");
        require(msg.minPurchase > 0, "No min purchase");
        require(msg.maxPurchase > msg.minPurchase, "Max purchase must greater than min purchase");
        require(msg.priceMultiplier > 0, "No price muliplier");
        require(msg.hardCap > 0, "No hard cap");

        self.totalPhases += 1;
        self.phases.set(self.totalPhases, Phase{
            startTime: msg.startTime,
            endTime: msg.endTime,
            minPurchase: msg.minPurchase,
            maxPurchase: msg.maxPurchase,
            usdRaised: 0,
            hardCap: msg.hardCap,
            priceMultiplier: msg.priceMultiplier,
            isWhitelistRequired: msg.isWhitelistRequired,
        });
    }

    receive(msg: UpdatePhase) {
        self.requireOwner();
        require(msg.id > 0 && msg.id <= self.totalPhases, "Invalid phase id");
        require(msg.endTime > msg.startTime, "End Time must be after start time");
        require(msg.minPurchase > 0, "No min purchase");
        require(msg.maxPurchase > msg.minPurchase, "Max purchase must greater than min purchase");
        require(msg.priceMultiplier > 0, "No price muliplier");
        require(msg.hardCap > 0, "No hard cap");

        self.phases.set(msg.id, Phase{
            startTime: msg.startTime,
            endTime: msg.endTime,
            minPurchase: msg.minPurchase,
            maxPurchase: msg.maxPurchase,
            usdRaised: 0,
            hardCap: msg.hardCap,
            priceMultiplier: msg.priceMultiplier,
            isWhitelistRequired: msg.isWhitelistRequired,
        });
    }

    receive("transitionToNextPhase") {
        require(self.currentPhaseId <= self.totalPhases, "Already in final phase");

        let phase: Phase? = self.phases.get(self.currentPhaseId);
        require(phase != null, "Current phase not found");
        
        require(now() >= phase!!.endTime, "Phase not expired yet");
        self.currentPhaseId += 1;
    }

    receive(msg: TransferOwnership) {
        self.requireOwner();
        if (msg.newOwner != newAddress(0, 0)) {
            self.owner = msg.newOwner;
        }
    }
    
    receive(msg: UpdateStakingContract) {
        self.requireOwner();
        if (msg.stakingContract != newAddress(0, 0)) {
            self.stakingContract = msg.stakingContract;
        }
    }
}
