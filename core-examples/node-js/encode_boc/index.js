// This sample shows how to build cell using custom builder function.

const {
    signerNone,
    abiContract,
    TonClient,
    builderOpInteger,
    builderOpCell,
    builderOpCellBoc,
    builderOpBitString,
    builderOpAddress,
} = require("@eversdk/core");
const { libNode } = require("@eversdk/lib-node");
const transferAbi = {
    "ABI version": 2,
    "functions": [
        {
            "name": "transfer",
            "id": "0x00000000",
            "inputs": [{ "name": "comment", "type": "bytes" }],
            "outputs": []
        }
    ],
    "events": [],
    "data": []
};

TonClient.useBinaryLibrary(libNode);
const u = (size, x) => {
    if (size === 256) {
        return builderOpBitString(`x${BigInt(x).toString(16).padStart(64, "0")}`)
    } else {
        return builderOpInteger(size, x);
    }
}
const u8 = x => u(8, x);
const u32 = x => u(32, x);
const u128 = x => u(128, x);
const u256 = x => u(256, x);
const b0 = u(1, 0);
const b1 = u(1, 0);
const bits = x => builderOpBitString(x);
/**
 *
 * @param x {Buffer}
 */
const bytes = x => builderOpCell([bits(x.toString("hex"))]);
const str = x => bytes(Buffer.from(x, "utf8"));

(async () => {
    const client = new TonClient({
        abi: {
            message_expiration_timeout: 30000,
        },
    });
    try {
        // Create body using ABI
        const bodyEncodedUsingAbi = (await client.abi.encode_message_body({
            abi: abiContract(transferAbi),
            call_set: {
                function_name: "transfer",
                input: {
                    comment: Buffer.from("My comment").toString("hex"),
                },
            },
            is_internal: true,
            signer: signerNone(),
        })).body;

        // Create body using custom builder
        const bodyEncodedUsingBuilder = (await client.boc.encode_boc({
            builder: [
                u32(0), // function id
                str("My comment"),
            ],
        })).boc;

        console.log('ABI encoded body   ', bodyEncodedUsingAbi);
        console.log('Custom encoded body', bodyEncodedUsingBuilder);

        // Object below contains the same fields as a smart contract
        const price = {
            price: 0, // u128
            sells_amount: 0, // u128
            buys_amount: 0, // u128
            stock: "0:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", // addr_std_fixed
            min_amount: 0, // uint128
            deals_limit: 0, // u8 - limit for processed deals in one request
            notify_addr: "0:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", // INotifyPtr
            workchain_id: 0, // u8
            tons_cfg: {
                transfer_tip3: 0, // uint128
                return_ownership: 0, // uint128
                trading_pair_deploy: 0, // uint128
                order_answer: 0, // uint128
                process_queue: 0, // uint128
                send_notify: 0, // uint128
            },
            tip3cfg: {
                name: "name1", // string
                symbol: "S", // string
                decimals: 2, // u8
                root_public_key: "0", // uint256
                root_address: "0:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789", // address
                code: "te6ccgEBAgEAEwABCAAAAAABABRNeSBjb21tZW50", // cell
            },
            sells: {}, // queue<OrderInfo>
            buys: {}, // queue<OrderInfo>
        };
        const sellPriceCode = "te6ccgEBAgEAEwABCAAAAAABABRNeSBjb21tZW50"; // code boc encoded with base64

        // Create StateInit BOC using custom builder
        const stateInit = (await client.boc.encode_boc({
            builder: [
                b0, b0, b1,
                builderOpCellBoc(sellPriceCode),
                b1,
                builderOpCell([ // contract data
                    u128(price.price),
                    u128(price.sells_amount),
                    u128(price.buys_amount),
                    builderOpAddress(price.stock),
                    u128(price.min_amount),
                    u8(price.deals_limit),
                    builderOpCell([
                        builderOpAddress(price.notify_addr),
                        u8(price.workchain_id),
                        u128(price.tons_cfg.transfer_tip3),
                        builderOpCell([
                            u128(price.tons_cfg.return_ownership),
                            u128(price.tons_cfg.trading_pair_deploy),
                            u128(price.tons_cfg.order_answer),
                            u128(price.tons_cfg.process_queue),
                            u128(price.tons_cfg.send_notify),
                            str(price.tip3cfg.name),
                            str(price.tip3cfg.symbol),
                            u8(price.tip3cfg.decimals),
                            u256(price.tip3cfg.root_public_key),
                            builderOpCell([
                                builderOpAddress(price.tip3cfg.root_address),
                                builderOpCellBoc(price.tip3cfg.code),
                                b0,
                                u32(0),
                                b0,
                                u32(0),
                            ]),
                        ])
                    ]),
                ]),
                b0,
            ],
        })).boc;

        console.log('StateInit', stateInit);

        client.close();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();
