const { libNode } = require("@tonclient/lib-node");
const { Account } = require("@tonclient/appkit");
const { TonClient, signerKeys } = require("@tonclient/core");
const { SafeMultisigContract } = require("./contracts");
const { TransferIterator } = require("./lib/transfers");
const { Shard } = require("./lib/sharding");
const { BlockIterator } = require("./lib/blocks");

TonClient.useBinaryLibrary(libNode);

/**
 * Prints transfer details.
 *
 * @param {Transfer} transfer
 */
function printTransfer(transfer) {
    if (transfer.isDeposit) {
        console.log(`Account ${transfer.account} deposits ${transfer.value} from ${transfer.counterparty} at ${transfer.time}`);
    } else {
        console.log(`Account ${transfer.account} withdraws ${transfer.value} to ${transfer.counterparty} at ${transfer.time}`);
    }
}

/**
 * Demonstrates how to iterate 100 transfers since specified time.
 *
 * Also this example demonstrates how to suspend iteration
 * and then resume it from suspension point.
 *
 */
async function iterateTransfers(client) {
    const startTime = Math.round(new Date(2021, 4, 27, 0).getTime() / 1000);

    // Starts transfer iterator from specific time.
    //
    // Also we can specify shard filter.
    // Shard filter is a bitmask for first high bits of the account address.
    // This can significantly reduce time ans loading factor for data retrieval.
    // You can scale transfer iterator by starting several processes with several
    // shard filters.
    //
    // In addition to shard filter you can specify an account address you
    // are interested for.
    //
    // Transfer iterator will return only transfers related to accounts
    // satisfying to shard filter and included into account filter.
    // If you specify empty shard filter and empty account filter,
    // you will iterate all transfers for all accounts since specified time.
    //
    const transfers = await TransferIterator.start(
        client,
        {
            startBlockTime: startTime,
            shard: Shard.zero(),
        },
        [],
    );

    // Reads first 100 transfers and print it details
    for (let i = 0; i < 100; i += 1) {
        printTransfer(await transfers.next());
    }

    // We can suspend current iteration and get suspended state
    const suspended = transfers.suspend();

    // Suspended state is just a plain object so you can
    // safely serialize it into file and use it later to resume
    // iteration.

    console.log("\n====================== Resume");

    // Creates new iterator that will continue iteration from
    // the previously suspended state.
    const resumed = await TransferIterator.resume(client, [], suspended);
    for (let i = 0; i < 40; i += 1) {
        printTransfer(await resumed.next());
    }
}

let _giver = null;

async function ensureGiver(client) {
    if (!_giver) {
        const secret = process.argv[2];
        if (!secret) {
            console.log("USE: node index <safe-msig-sign-key>");
            process.exit(1);
        }
        _giver = new Account(SafeMultisigContract, {
            client,
            signer: signerKeys({
                public: (await client.crypto.nacl_sign_keypair_from_secret_key({ secret }))
                    .secret.substr(64),
                secret,
            }),
        });
    }
    return _giver;
}

/**
 * Topup an account for deploy operation.
 *
 * We need an account which can be used to deposit other accounts.
 * Usually it is called "giver".
 *
 * This sample uses existing account with positive balance and
 * SafeMultisigWallet smart contract.
 *
 * In production you can use any other contract that can transfer funds, as a giver,
 * like, for example, a multisig wallet.
 *
 * @param {string} address
 * @param {number} amount
 * @param {TonClient} client
 * @returns {Promise<void>}
 */
async function depositAccount(address, amount, client) {
    const giver = await ensureGiver(client);
    await giver.run("sendTransaction", {
        dest: address,
        value: amount,
        bounce: false,
        flags: 1,
        payload: "",
    });
}

/**
 * Demonstrates how to create wallet account,
 * deposits it with some values
 * and then read all transfers related to this account
 */
async function main(client) {
    const giver = await ensureGiver(client);

    // Generate a key pair for a wallet
    console.log("Generate new wallet keys");
    const walletKeys = await client.crypto.generate_random_sign_keys();

    // In this example we will deploy safeMultisig wallet.
    // Read about it here https://github.com/tonlabs/ton-labs-contracts/tree/master/solidity/safemultisig
    // The first step - initialize new account object with ABI,
    // target network (client) and signer (initialize it with previously generated key pair)
    const wallet = new Account(SafeMultisigContract, {
        client,
        signer: signerKeys(walletKeys),
    });

    // Calculate wallet address so that we can sponsor it before deploy
    const walletAddress = await wallet.getAddress();

    const startBlockTime = Date.now() / 1000;

    console.log(`Sending deploy fee to new wallet at ${walletAddress}`);
    await depositAccount(walletAddress, 10000000000, client);

    console.log(`Deploying new wallet at ${walletAddress}`);
    // Now lets deploy safeMultisig wallet
    // Here we declaratively specify 1 custodian and 1 reqConfirms
    // but in real life there can be many custodians as well and more than 1 required confirmations
    await wallet.deploy({
        initInput: {
            owners: [`0x${walletKeys.public}`], // constructor parameters of multisig
            reqConfirms: 1,
        },
    });

    console.log("Depositing 6 token...");
    await depositAccount(walletAddress, 6000000000, client);

    console.log("Depositing 7 tokens...");
    await depositAccount(walletAddress, 7000000000, client);

    const giverAddress = await giver.getAddress();
    console.log("Withdrawing 2 tokens...");
    await wallet.run("sendTransaction", {
        dest: giverAddress,
        value: 2000000000,
        bounce: false,
        flags: 1,
        payload: "",
    });
    console.log("Withdrawing 3 tokens...");
    await wallet.run("sendTransaction", {
        dest: giverAddress,
        value: 3000000000,
        bounce: false,
        flags: 1,
        payload: "",
    });

    // Wait for 5 sec to finalize all transactions
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Create transfer iterator
    // this iterator will iterate only blocks containing
    // our wallet account updates and transactions
    const transfers = await TransferIterator.start(
        client,
        {
            startBlockTime,
            endBlockTime: Math.round(Date.now() / 1000),
            shard: Shard.fromAddress(walletAddress),
        },
        [walletAddress],
    );
    while (!transfers.eof()) {
        const transfer = await transfers.next();
        if (transfer) {
            printTransfer(transfer);
        }
    }
}

(async () => {
    const client = new TonClient({
        network: {
            endpoints: ["net.ton.dev"],
        },
    });
    try {
        await main(client);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();
