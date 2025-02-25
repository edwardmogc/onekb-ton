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

message DepositFromPresale {
    buyer: Address;
    uid: String;
    amount: Int;
}

message BuyWithTON {
    amount: Int as coins;
    usdPerTon: Int;
}

message BuyWithUSDT {
    amount: Int as coins;
    usdPerJettonUsd: Int;
}

message BuyAndStake {
    uid: String;
    amount: Int as coins;
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

message AddToWhitelist {
    phaseId: Int;
    users: Cell;
}

message RemoveFromWhitelist {
    phaseId: Int;
    users: Cell;
}

message UpdateStakingContract {
    stakingContract: Address;
}

message TransferOwnership {
    newOwner: Address;
}

contract Presale with Deployable, Ownable {
    jettonToken: Address;
    myJettonWalletAddress: Address;
    stakingContract: Address?;
    owner: Address;
    operator: Address;
    totalMintLimit: Int;
    totalMinted: Int;
    totalPresaleMintLimit: Int;
    totalPresaleMinted: Int;
    totalRetailMintLimit: Int;
    totalRetailMinted: Int;
    dailyMintLimit: Int;
    mintedToday: Int;
    lastMintTime: Int;
    tokenPrice: Int;
    currentPhaseId: Int;
    totalPhases: Int;
    phases: map<Int, Phase>;
    phasePurchases: map<Int, Cell>;
    whitelists: map<Int, Cell>;

    init(
        owner: Address, 
        operator: Address, 
        jettonWalletCode: Cell,
        jettonMasterAddress: Address,
        totalMintLimit: Int,
        totalPresaleMintLimit: Int,
        totalRetailMintLimit: Int,
        dailyMintLimit: Int, 
        tokenPrice: Int
    ) {
        self.owner = owner;
        self.operator = operator;
        self.totalMintLimit = totalMintLimit;
        self.totalMinted = 0;
        self.totalPresaleMintLimit = totalPresaleMintLimit;
        self.totalPresaleMinted = 0;
        self.totalRetailMintLimit = totalRetailMintLimit;
        self.totalRetailMinted = 0;
        self.dailyMintLimit = dailyMintLimit;
        self.mintedToday = 0;
        self.lastMintTime = 0;
        self.tokenPrice = tokenPrice;
        self.currentPhaseId = 0;
        self.totalPhases = 0;
        self.phases = emptyMap();
        self.phasePurchases = emptyMap();
        self.whitelists = emptyMap();
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

    fun checkSaleState(amount: Int, buyer: Address) {
        require(self.currentPhaseId > 0 && self.currentPhaseId <= self.totalPhases, "No active phase");
        
        let phase: Phase? = self.phases.get(self.currentPhaseId);
        require(now() > phase!!.startTime && now() < phase!!.endTime, "Sale is not active");

        if (phase!!.isWhitelistRequired) {
            require(self.isWhitelisted(self.currentPhaseId, buyer), "Not whitelisted");
        }

        require(amount >= phase!!.minPurchase, "Amount is below minimum purchase tokens");
        let currentPurchase: Int = self.buyerPurchase(self.currentPhaseId, buyer);
        require(amount + currentPurchase <= phase!!.maxPurchase, "Cumulative purchase exceeds max tokens to buy");

        require(self.totalPresaleMinted + amount <= self.totalPresaleMintLimit, "Presale mint limit exceeded");
        require(self.totalMinted + amount <= self.totalMintLimit, "Total mint limit exceeded");

        let usdPrice: Int = (phase!!.priceMultiplier * self.tokenPrice * amount);
        require(phase!!.usdRaised + usdPrice <= phase!!.hardCap, "Hard cap reached for this phase");
    }

    fun tokenMint(amount: Int, to: Address) {
        send(SendParameters{
            to: self.jettonToken,
            value: JettonTransferGas,
            mode: SendPayGasSeparately,
            body: TokenMint{
                amount: amount,
                receiver: to,
            }.toCell(),
        });
    }

    fun updateBuyerPurchase(phaseId: Int, buyer: Address, additional: Int) {
        let records: Cell? = self.phasePurchases.get(phaseId);
        let builder: Builder = beginCell();
        let found: Bool = false;
        if (records != null) {
            let slice: Slice = records!!.beginParse();
            while(!slice.empty()) {
                let recordBuyer: Address = slice.loadAddress();
                let recordAmount: Int = slice.loadInt(256);
                if (recordBuyer == buyer) {
                    builder.storeAddress(recordBuyer);
                    builder.storeInt(recordAmount + additional, 256);
                    found = true;
                } else {
                    builder.storeAddress(recordBuyer);
                    builder.storeInt(recordAmount, 256);
                }
            }
        }
        if (!found) {
            builder.storeAddress(buyer);
            builder.storeInt(additional, 256);
        }
        self.phasePurchases.set(phaseId, builder.endCell());
    }

    receive(msg: BuyWithTON) {
        let ctx: Context = context();
        let phase: Phase? = self.phases.get(self.currentPhaseId);
        require(phase != null, "No active phase");

        let tokensToMint: Int = (msg.amount * msg.usdPerTon) / (self.tokenPrice * phase!!.priceMultiplier);
      
        self.checkSaleState(tokensToMint, ctx.sender);
        self.tokenMint(tokensToMint, ctx.sender);
        self.updateBuyerPurchase(self.currentPhaseId, ctx.sender, tokensToMint);
    }

    receive(msg: BuyWithUSDT) {        
        let ctx: Context = context();
        let phase: Phase? = self.phases.get(self.currentPhaseId);
        require(phase != null, "No active phase");

        let tokensToMint: Int = (msg.amount * msg.usdPerJettonUsd) / (self.tokenPrice * phase!!.priceMultiplier);

        self.checkSaleState(tokensToMint, ctx.sender);
        self.tokenMint(tokensToMint, ctx.sender);
        self.updateBuyerPurchase(self.currentPhaseId, ctx.sender, tokensToMint);
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
            value: JettonTransferGas,
            mode: SendRemainingValue + SendIgnoreErrors,
            body: depositMsg.toCell(),
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

    receive(msg: AddToWhitelist) {
        self.requireOperator();
        require(msg.phaseId > 0 && msg.phaseId <= self.totalPhases, "Invalid phase id");

        let currentWhitelist: Cell? = self.whitelists.get(msg.phaseId);
        let builder: Builder = beginCell();

        if (currentWhitelist != null) {
            let currentSlice: Slice = currentWhitelist!!.beginParse();
            while (!currentSlice.empty()) {
                let addr: Address = currentSlice.loadAddress();
                builder.storeAddress(addr);
            }
        }
        let newSlice: Slice = msg.users.beginParse();
        while(!newSlice.empty()) {
            let addr: Address = newSlice.loadAddress();
            builder.storeAddress(addr);
        }

        self.whitelists.set(msg.phaseId, builder.endCell());
    }

    receive(msg: RemoveFromWhitelist) {
        self.requireOperator();
        require(msg.phaseId > 0 && msg.phaseId <= self.totalPhases, "Invalid phase id");

        let currentWhitelist: Cell? = self.whitelists.get(msg.phaseId);
        if (currentWhitelist == null) {
            return;
        }

        let removalCell: Cell = msg.users;
        let newBuilder: Builder = beginCell();
        let currentSlice: Slice = currentWhitelist!!.beginParse();
        while(!currentSlice.empty()) {
            let addr: Address = currentSlice.loadAddress();
            let removalSlice: Slice = removalCell.beginParse();
            let shouldRemove: Bool = false;
            while(!removalSlice.empty()) {
                let removeAddr: Address = removalSlice.loadAddress();
                shouldRemove = shouldRemove || (removeAddr == addr);
            }
            if (!shouldRemove) {
                newBuilder.storeAddress(addr);
            }
        }

        self.whitelists.set(msg.phaseId, newBuilder.endCell());
    }

    receive(msg: UpdateStakingContract) {
        self.requireOwner();
        self.stakingContract = msg.stakingContract;
    }

    receive(msg: TransferOwnership) {
        self.requireOwner();
        self.owner = msg.newOwner;
    }

    get fun isWhitelisted(phaseId: Int, buyer: Address): Bool {
        if (phaseId == 0 || phaseId > self.totalPhases) {
            return false;
        }
        let phase: Phase? = self.phases.get(phaseId);
        if (!phase!!.isWhitelistRequired) {
            return true;
        }
        let whitelistCell: Cell? = self.whitelists.get(phaseId);
        if (whitelistCell == null) {
            return false;
        }
        let slice: Slice = whitelistCell!!.beginParse();
        while (!slice.empty()) {
            let addr: Address = slice.loadAddress();
            if (addr == buyer) {
                return true;
            }
        }
        return false;
    }

    get fun buyerPurchase(phaseId: Int, buyer: Address): Int {
        let records: Cell? = self.phasePurchases.get(phaseId);
        if (records == null) {
            return 0;
        }

        let slice: Slice = records!!.beginParse();
        let purchase: Int = 0;
        while(!slice.empty()) {
            let recordBuyer: Address = slice.loadAddress();
            let recordAmount: Int = slice.loadInt(256);
            if (recordBuyer == buyer) {
                purchase = recordAmount;
            }
        }
        return purchase;
    }
}
