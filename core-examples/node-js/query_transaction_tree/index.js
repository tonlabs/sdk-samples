const { abiContract, TonClient } = require('@eversdk/core')
const { libNode } = require('@eversdk/lib-node')
const path = require('path')

/**
 * In this example we will query the transaction tree of value transfer
 * We need to do it to check that inner message with transfer was delivered.
 *
 * Correct next 6 lines with your data. You can either copy the message_id from ton.live
 * or receive it as a result of encode_message and process_message functions.
 */

const inMsg = "9add67505ac1cb530414ad6c3979865475722f25506c364df3a9a5c71c93e5ec";
/*
 * In this example we use EverosSE network.
 * If you want to use the developer network, create a project on [dashboard.evercloud.dev](https://dashboard.evercloud.dev) 
 * and use specify its Development Network HTTPS endpoint below:
 */
const endpoints = [
    "http://localhost"
];
// https://github.com/tonlabs/ton-labs-abi/blob/master/docs/ABI_2.0_spec.md
const msigAbiFileName = 'SafeMultisigWallet.abi.json'

TonClient.useBinaryLibrary(libNode)
const client = new TonClient({
    network: { 
        endpoints 
    } 
});

const msigAbiFile = path.join(__dirname, msigAbiFileName)

const params = {
    in_msg: inMsg,
    abi: abiContract(msigAbiFile)
}
console.log('Query params:', params)

client.net.query_transaction_tree(params)
.then((result) => {
    // list of messages, produced in this transaction tree
    console.log(result.messages);
    // list of produced transactions 
    console.log(result.transactions);
    process.exit(0)
})    
.catch((err) => {
    console.error(err)
    process.exit(1)
}); 
