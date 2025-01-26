import "@stdlib/ownable";
import "@stdlib/deploy";

// Messages
message Mint {
    to: Address;
    amount: Int;
}

message BurnFrom {
    from: Address;
    amount: Int;
}

message AddMinter {
    minter: Address;
}

message DelMinter {
    minter: Address;
}

message Approve {
    spender: Address;
    amount: Int;
}

contract OnekbToken with Deployable, Ownable {
    const NAME: String = "1KB";
    const SYMBOL: String = "1KB";
    const DECIMALS: Int = 18;
    const MAX_SUPPLY: Int = 1000000000;
    const MinTonsForStorage: Int = ton("0.01");

    owner: Address;
    totalSupply: Int;
    balances: map<Address, Int>;
    minters: map<Address, Bool>;

    init() {
        self.owner = sender();
        self.totalSupply = 0;   
    }

    fun requireMinter() {
        nativeThrowUnless(132, self.minters.get(sender()) == true);
    }

    receive(msg: Mint) {
        self.requireMinter();
        let newSupply: Int = self.totalSupply + msg.amount;
        require(newSupply <= self.MAX_SUPPLY, "minting exceeds MAX SUPPLY");

        // Update supply & balance
        self.totalSupply = newSupply;

        if (self.balances.get(msg.to) == null) {
            self.balances.set(msg.to, 0);
        }
        
        let updateBalance = self.balances.get(msg.to)!! + msg.amount;

        self.balances.set(msg.to, updateBalance);

        dump(self.balances.get(msg.to)); // total balance of msg.to
    }

    receive(msg: AddMinter) {
        self.requireOwner();
        require(msg.minter != newAddress(0, 0), "Minter is zero address");
        self.minters.set(msg.minter, true);

        dump(self.minters.get(msg.minter)); // true
    }

    receive(msg: DelMinter) {
        self.requireOwner();
        require(msg.minter != newAddress(0, 0), "Minter is zero address");
        self.minters.set(msg.minter, false);

        dump(self.minters.get(msg.minter)); // false
    }

    get fun totalSupply(): Int {
        return self.totalSupply;
    }

    get fun maxSupply(): Int {
        return self.MAX_SUPPLY;
    }

    get fun balanceOf(account: Address): Int? {
        return self.balances.get(account);
    }

    get fun isMinter(account: Address): Bool? {
        return self.minters.get(account);
    }
}
