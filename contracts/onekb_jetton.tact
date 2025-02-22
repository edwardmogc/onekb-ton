import "@stdlib/ownable";
import "@stdlib/deploy";

struct JettonData {
    totalSupply: Int;
    mintable: Bool;
    owner: Address;
    content: Cell;
    walletCode: Cell;
}

struct JettonWalletData {
    balance: Int;
    owner: Address;
    master: Address;
    walletCode: Cell;
}

message(0x642b7d07) TokenMint {
    amount: Int;
    receiver: Address;
}

message AddMinter {
    minter: Address;
}

message DelMinter {
    minter: Address;
}

message TransferOwnership {
    newOwner: Address;
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
    forward_payload: Slice as remaining; // Comment Text message when Transfer the jetton
}

message(0x178d4519) TokenTransferInternal {
    queryId: Int as uint64;
    amount: Int as coins;
    from: Address;
    response_destination: Address;
    forward_ton_amount: Int as coins;
    forward_payload: Slice as remaining; // Comment Text message when Transfer the jetton
}

message(0x7362d09c) TokenNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    from: Address;
    forward_payload: Slice as remaining; // Comment Text message when Transfer the jetton 
}

message(0x595f07bc) TokenBurn {
    queryId: Int as uint64;
    amount: Int as coins;
    owner: Address;
    response_destination: Address;
}

message(0x7bdd97de) TokenBurnNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    owner: Address;
    response_destination: Address?;
}

message(0xd53276db) TokenExcesses {
    queryId: Int as uint64;
}

message TokenUpdateContent {
    content: Cell;
}

contract OnekbJetton with Deployable, Jetton {
    totalSupply: Int as coins;
    owner: Address;
    content: Cell;
    mintable: Bool;
    minters: map<Address, Bool>;

    max_supply: Int as coins;

    init(owner: Address, content: Cell, max_supply: Int) {
        self.totalSupply = 0;
        self.owner = owner;
        self.mintable = true;
        self.content = content;

        self.max_supply = max_supply;
    }

    receive(msg: TokenMint) {
        let ctx: Context = context();
        require(self.minters.get(ctx.sender) == true, "Not Minter");
        require(self.mintable, "Can't Mint Anymore");
        self.mint(msg.receiver, msg.amount, ctx.sender);
    }

    receive(msg: AddMinter) {
        self.requireOwner();
        if (msg.minter != newAddress(0, 0)) {
            self.minters.set(msg.minter, true);
        }
    }

    receive(msg: DelMinter) {
        self.requireOwner();
        if (msg.minter != newAddress(0, 0)) {
            self.minters.set(msg.minter, false);
        }
    }

    receive(msg: JettonTransfer) {
        dump("Jetton Transfer");
        let ctx: Context = context();
        require(self.minters.get(ctx.sender) == true, "Not Minter");
        self.transfer(
            ctx.sender,
            msg.queryId,
            msg.amount,
            msg.destination,
            msg.response_destination,
            msg.forward_ton_amount
        );
    }

    receive(msg: TransferOwnership) {
        self.requireOwner();
        self.owner = msg.newOwner;
    }

    get fun isMinter(account: Address): Bool? {
        return self.minters.get(account);
    }
}

@interface("org.ton.jetton.master")
trait Jetton with Ownable {
    owner: Address;
    totalSupply: Int;
    mintable: Bool;
    content: Cell;
    
    max_supply: Int;

    receive(msg: TokenUpdateContent) {
        self.requireOwner();
        self.content = msg.content;
    }

    receive(msg: TokenBurnNotification) {
        self.requireWallet(msg.owner);
        self.totalSupply = self.totalSupply - msg.amount;

        if (msg.response_destination != newAddress(0, 0)) {
            send(SendParameters{
                to: msg.response_destination!!,
                value: 0,
                bounce: false,
                mode: SendRemainingValue + SendIgnoreErrors,
                body: TokenExcesses{
                    queryId: msg.queryId
                }.toCell()
            });
        }
    }

    fun mint(to: Address, amount: Int, response_destination: Address) {
        require(self.totalSupply + amount <= self.max_supply, "The total supply will be overlapping.");
        self.totalSupply = self.totalSupply + amount;

        let winit: StateInit = self.getJettonWalletInit(to);
        send(SendParameters{
            to: contractAddress(winit),
            value: 0,
            bounce: false,
            mode: SendRemainingValue,
            body: TokenTransferInternal{
                queryId: 0,
                amount: amount,
                from: myAddress(),
                response_destination: response_destination,
                forward_ton_amount: 0,
                forward_payload: emptySlice()
            }.toCell(),
            code: winit.code,
            data: winit.data
        });
    }

    fun transfer(
        from: Address,
        queryId: Int,
        amount: Int,
        destination: Address,
        response_destination: Address,
        forward_ton_amount: Int,
    ) {
        dump("transfer");
        let winit: StateInit = self.getJettonWalletInit(from);
        send(SendParameters{
            to: contractAddress(winit),
            value: 0,
            bounce: false,
            mode: SendRemainingValue,
            body: TokenTransfer{
                queryId: queryId,
                amount: amount,
                destination: destination,
                response_destination: response_destination,
                forward_ton_amount: forward_ton_amount,
                forward_payload: emptySlice()
            }.toCell(),
            code: winit.code,
            data: winit.data
        });
    }

    fun requireWallet(owner: Address) {
        let ctx: Context = context();
        let winit: StateInit = self.getJettonWalletInit(owner);
        require(contractAddress(winit) == ctx.sender, "Invalid sender");
    }

    virtual fun getJettonWalletInit(address: Address): StateInit {
        return initOf JettonDefaultWallet(myAddress(), address);
    }

    get fun get_jetton_data(): JettonData {
        let code: Cell = self.getJettonWalletInit(myAddress()).code;
        return JettonData{
            totalSupply: self.totalSupply,
            mintable: self.mintable,
            owner: self.owner,
            content: self.content,
            walletCode: code
        };
    }

    get fun get_wallet_address(owner: Address): Address {
        let winit: StateInit = self.getJettonWalletInit(owner);
        return contractAddress(winit);
    }
}

@interface("org.ton.jetton.wallet")
contract JettonDefaultWallet {
    const minTonsForStorage: Int = ton("0.01");
    const gasConsumption: Int = ton("0.01");

    balance: Int;
    owner: Address;
    master: Address;

    init(master: Address, owner: Address) {
        self.balance = 0;
        self.owner = owner;
        self.master = master;
    }

    receive(msg: TokenTransfer) { // 0xf8a7ea5
        dump("Token Transfer");
        let ctx: Context = context(); // Check sender
        // require(ctx.sender == self.owner, "Invalid sender");

        // Gas checks
        let fwdFee: Int = ctx.readForwardFee() + ctx.readForwardFee();  
        let final: Int =  2 * self.gasConsumption + self.minTonsForStorage + fwdFee;
        require(ctx.value > min(final, ton("0.01")), "Invalid value!!"); 

        // Update balance
        self.balance = self.balance - msg.amount; 
        require(self.balance >= 0, "Invalid balance");

        let init: StateInit = initOf JettonDefaultWallet(self.master, msg.destination);  
        let walletAddress: Address = contractAddress(init);
        send(SendParameters{
                to: walletAddress, 
                value: 0,
                mode: SendRemainingValue, 
                bounce: false,
                body: TokenTransferInternal{
                    queryId: msg.queryId,
                    amount: msg.amount,
                    from: self.owner,
                    response_destination: msg.response_destination,
                    forward_ton_amount: msg.forward_ton_amount,
                    forward_payload: msg.forward_payload
                }.toCell(),
                code: init.code,
                data: init.data
            });
        dump("End Token");
    }

    receive(msg: TokenTransferInternal) { // 0x178d4519
        dump("Token Transfer Internal");
        let ctx: Context = context();

        // if (ctx.sender != self.master) {
        //     let sinit: StateInit = initOf JettonDefaultWallet(self.master, msg.from);
        //     require(contractAddress(sinit) == ctx.sender, "Invalid sender!");
        // }

        // Update balance
        self.balance = self.balance + msg.amount;
        require(self.balance >= 0, "Invalid balance"); 
        
        // Get value for gas
        let msgValue: Int = self.msgValue(ctx.value);  
        let fwdFee: Int = ctx.readForwardFee();
        msgValue = msgValue - msg.forward_ton_amount - fwdFee;
        
         // 0x7362d09c - notify the new owner of JettonToken that the transfer is complete
        if (msg.forward_ton_amount > 0) { 
            dump("Notify");
            send(SendParameters{
                to: self.owner,
                value: msg.forward_ton_amount,
                mode: SendPayGasSeparately + SendIgnoreErrors,
                bounce: false,
                body: TokenNotification {
                    queryId: msg.queryId,
                    amount: msg.amount,
                    from: msg.from,
                    forward_payload: msg.forward_payload
                }.toCell()
            });
            dump("End Notify");
        }

        // 0xd53276db -- Cashback to the original Sender
        if (msg.response_destination != newAddress(0, 0)) { 
            send(SendParameters {
                to: msg.response_destination, 
                value: msgValue,  
                bounce: false,
                body: TokenExcesses { 
                    queryId: msg.queryId
                }.toCell(),
                mode: SendIgnoreErrors
            });
        }
        dump("End Internal");
    }

    receive(msg: TokenBurn) {
        dump("Token Burn");
        let ctx: Context = context();
        require(ctx.sender == self.owner, "Invalid sender");  // Check sender

        self.balance = self.balance - msg.amount; // Update balance
        require(self.balance >= 0, "Invalid balance");

        let fwdFee: Int = ctx.readForwardFee(); // Gas checks
        require(ctx.value > fwdFee + 2 * self.gasConsumption + self.minTonsForStorage, "Invalid value - Burn");

        // Burn tokens
        send(SendParameters{  
            to: self.master,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: TokenBurnNotification{
                queryId: msg.queryId,
                amount: msg.amount,
                owner: self.owner,
                response_destination: self.owner
            }.toCell()
        });
        dump("End Burn");
    }

    get fun msgValue(value: Int): Int {
        let messageValue: Int = value;
        let tonBalanceBeforeMsg: Int = myBalance() - messageValue;
        let storageFee: Int = self.minTonsForStorage - min(tonBalanceBeforeMsg, self.minTonsForStorage);
        messageValue = messageValue - (storageFee + self.gasConsumption);
        return messageValue;
    }

    bounced(src: bounced<TokenTransferInternal>) {
        self.balance = self.balance + src.amount;
    }

    bounced(src: bounced<TokenBurnNotification>) {
        self.balance = self.balance + src.amount;
    }

    get fun get_wallet_data(): JettonWalletData {
        return JettonWalletData{
            balance: self.balance,
            owner: self.owner,
            master: self.master,
            walletCode: (initOf JettonDefaultWallet(self.master, self.owner)).code
        }
    }
}