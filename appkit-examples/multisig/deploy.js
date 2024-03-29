const { libNode } = require("@eversdk/lib-node");
const fs = require("fs");
const path = require("path");
const { Account } = require("@eversdk/appkit");
const {
    signerKeys,
    TonClient,
} = require("@eversdk/core");
const { MultisigContract } = require("./contracts");

const keyPairFile = path.join(__dirname, "keyPair.json");

// Account is active when contract is deployed.
const ACCOUNT_TYPE_ACTIVE = 1;

// Account is uninitialized when contract is not deployed yet.
const ACCOUNT_TYPE_UNINITIALIZED = 0;

// Number of tokens required to deploy the contract.
// See https://docs.everos.dev/ever-sdk/guides/work_with_contracts/estimate_fees on how to calculate definite number.
const CONTRACT_REQUIRED_DEPLOY_TOKENS = 500_000_000;

TonClient.useBinaryLibrary(libNode);

// Create a project on https://dashboard.evercloud.dev and pass
// its Development Network HTTPS endpoint as a parameter:
const HTTPS_DEVNET_ENDPOINT = process.argv[2];

if (HTTPS_DEVNET_ENDPOINT === undefined) {
    throw new Error("HTTPS endpoint required");
}

;(async () => {
    const client = new TonClient({
        network: {
            endpoints: [ HTTPS_DEVNET_ENDPOINT ]
        }
    });
    try {
        if (!fs.existsSync(keyPairFile)) {
            console.log("Please use preparation.js to generate key pair and seed phrase");
            process.exit(1);
        }

        const keyPair = JSON.parse(fs.readFileSync(keyPairFile, "utf8"));
        // We create a deploy message to calculate the future address of the contract
        // and to send it with 'sendMessage' later - if we use Pattern 1 for deploy (see below)
        const acc = new Account(MultisigContract, {
            signer: signerKeys(keyPair),
            client
        });

        const address = await acc.getAddress();
        let info;
        try {
            info = await acc.getAccount();
        } catch (err) {
            console.log(`Account with address ${address} isn't exist`);
            process.exit(1);
        }

        if (info.acc_type === ACCOUNT_TYPE_ACTIVE) {
            console.log(`Account with address ${address} is already deployed`);
            process.exit(1);
        }

        // Balance is stored as HEX so we need to convert it.
        if (info.acc_type === ACCOUNT_TYPE_UNINITIALIZED && BigInt(info.balance) <= BigInt(CONTRACT_REQUIRED_DEPLOY_TOKENS)) {
            console.log(`Balance of ${address} is too low for deploy to DevNet`);
            process.exit(1);
        }

        const response = await acc.deploy({
            initInput: {
                // Multisig owners public key.
                // We are going to use a single key.
                // You can use any number of keys and custodians.
                // See https://github.com/tonlabs/ton-labs-contracts/tree/master/solidity/safemultisig#35-deploy-wallet-set-custodians
                owners: [`0x${keyPair.public}`],
                // Number of custodians to require for confirm transaction.
                // We use 0 for simplicity. Consider using 2+ for sufficient security.
                reqConfirms: 0,
            },
        });
        console.log(`Transaction id is ${response.transaction.id}`);
        console.log(`Deploy fees are  ${JSON.stringify(response.fees, null, 2)}`);
        console.log(`Contract is successfully deployed. You can play with your multisig wallet now at ${address}`);

        process.exit(0);

    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();
