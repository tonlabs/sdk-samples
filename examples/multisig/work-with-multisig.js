const { libNode } = require("@tonclient/lib-node");
const { MultisigContract } = require("./contracts");
const {
    Account,
    signerKeys,
    TonClient,
} = require("@tonclient/core");

const fs = require("fs");
const path = require("path");
const keyPairFile = path.join(__dirname, "keyPair.json");

// Account is active when contract is deployed.
const ACCOUNT_TYPE_ACTIVE = 1;

// Address to send tokens to
const recipient = "0:ece57bcc6c530283becbbd8a3b24d3c5987cdddc3c8b7b33be6e4a6312490415";

(async () => {
    try {
        TonClient.useBinaryLibrary(libNode);
        TonClient.defaultConfig = {
            network: {
                //Read more about NetworkConfig https://github.com/tonlabs/TON-SDK/blob/e16d682cf904b874f9be1d2a5ce2196b525da38a/docs/mod_client.md#networkconfig
                server_address: "net.ton.dev",
                message_retries_count: 3,
                message_processing_timeout: 60000,
                network_retries_count: 2,
                reconnect_timeout: 3,
            },
        };

        if (!fs.existsSync(keyPairFile)) {
            console.log("Please use preparation.js to generate key pair and seed phrase");
            process.exit(1);
        }

        const keyPair = JSON.parse(fs.readFileSync(keyPairFile, "utf8"));

        const acc = new Account(MultisigContract, { signer: signerKeys(keyPair) });
        const address = await acc.getAddress();
        console.log(address);
        const info = await acc.getAccount();
        if (info.acc_type !== ACCOUNT_TYPE_ACTIVE) {
            console.log(`Contract ${address} is not deployed yet. Use deploy.js to deploy it.`);
            process.exit(1);
        }

        const response = await acc.runLocal("getCustodians", {});
        // Print the custodians of the wallet
        console.log("Сustodians list:", response.decoded.output.custodians);


        // Run 'submitTransaction' method of multisig wallet

        console.log("Call `submitTransaction` function");
        // Call `submitTransaction` function
        const sentTransactionInfo = await acc.run("submitTransaction", {
            dest: recipient,
            value: 100_000_000,
            bounce: false,
            allBalance: false,
            payload: "",
        });

        console.log(sentTransactionInfo);
        console.log("Transaction info:");

        console.log("Id:");
        console.log(sentTransactionInfo.transaction.id);

        console.log("Account address:");
        console.log(sentTransactionInfo.transaction.account_addr);

        console.log("Logical time:");
        console.log(sentTransactionInfo.transaction.lt);

        console.log("Transaction inbound message ID:");
        console.log(sentTransactionInfo.transaction.in_msg);

        console.log("Transaction outbound message IDs:");
        console.log(sentTransactionInfo.transaction.out_msgs);

        // Convert address to different types
        console.log("Multisig address in HEX:");
        let convertedAddress = (await TonClient.default.utils.convert_address({
            address,
            output_format: {
                type: "Hex",
            },
        })).address;
        console.log(convertedAddress);

        console.log("Multisig non-bounce address in Base64:");
        convertedAddress = (await TonClient.default.utils.convert_address({
            address,
            output_format: {
                type: "Base64",
                url: false,
                test: false,
                bounce: false,
            },
        })).address;
        console.log(convertedAddress);

        console.log("Multisig bounce address in Base64:");
        convertedAddress = (await TonClient.default.utils.convert_address({
            address,
            output_format: {
                type: "Base64",
                url: false,
                test: false,
                bounce: true,
            },
        })).address;
        console.log(convertedAddress);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();