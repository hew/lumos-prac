"use strict";

const {initializeConfig} = require("@ckb-lumos/config-manager");
const {addressToScript, TransactionSkeleton} = require("@ckb-lumos/helpers");
const {addDefaultCellDeps, addDefaultWitnessPlaceholders, collectCapacity, getLiveCell, initializeLumosIndexer, describeTransaction, sendTransaction, signTransaction, waitForTransactionConfirmation} = require("./lib.js");
const {ckbytesToShannons, hexToInt, intToHex} = require("./util.js");

const nodeUrl = "http://127.0.0.1:8114/";
const privateKey = "0x6fc935dad260867c749cf1ba6602d5f5ed7fb1131f1beb65be2d342e912eaafe";
// const lock_args = "0xa3b8598e1d53e6c5e89e8acb6b4c34d3adb13f2b";
const address = "ckt1qyq28wze3cw48ek9az0g4jmtfs6d8td38u4s6hp2s0";
const txFee = 100_000n;

async function main()
{
    // Initialize the Lumos configuration which is held in config.json.
    initializeConfig();

    // Start the Lumos Indexer and wait until it is fully synchronized.
    const indexer = await initializeLumosIndexer(nodeUrl);

    // Create a transaction skeleton.
    let transaction = TransactionSkeleton({cellProvider: indexer});

    // Add the cell dep for the lock script.
    transaction = addDefaultCellDeps(transaction);

    const res = await collectCapacity(indexer, addressToScript(address), ckbytesToShannons(100n));
    console.log(res);
    console.log(res.inputCells[0].cell_output);
    console.log(res.inputCells[0].out_point);

    const input =
        {
            cell_output:
                {
                    capacity: res.inputCells[0].cell_output.capacity,
                    lock: {code_hash: res.inputCells[0].cell_output.lock.code_hash, hash_type: res.inputCells[0].cell_output.lock.hash_type, args: res.inputCells[0].cell_output.lock.args},
                    type: (!res.inputCells[0].cell_output.type) ? undefined : {code_hash: res.inputCells[0].cell_output.type.code_hash, hash_type: res.inputCells[0].cell_output.type.hash_type, args: res.inputCells[0].cell_output.type.args}
                },
            out_point:
                {
                    tx_hash: res.inputCells[0].out_point.tx_hash,
                    index: res.inputCells[0].out_point.index
                },
            data: res.inputCells[0].cell_output.data
        }

    transaction = transaction.update("inputs", (i)=>i.push(input));

    // Add an output cell.
    const outputCapacity = intToHex(hexToInt(input.cell_output.capacity) - txFee);
    const output = {cell_output: {capacity: outputCapacity, lock: addressToScript(address), type: null}, data: "0x"};
    transaction = transaction.update("outputs", (i)=>i.push(output));

    // Add in the witness placeholders.
    transaction = addDefaultWitnessPlaceholders(transaction);

    // Print the details of the transaction to the console.
    const options =
        {
            showCellDeps: false,
            showWitnesses: false,
            showInputType: false,
            showOutputType: false,
        };
    describeTransaction(transaction.toJS(), options);

    // Sign the transaction.
    const signedTx = signTransaction(transaction, privateKey);

    // Send the transaction to the RPC node.
    const txid = await sendTransaction(nodeUrl, signedTx);
    console.log(`Transaction Sent: ${txid}\n`);

    // Wait for the transaction to confirm.
    await waitForTransactionConfirmation(nodeUrl, txid);
    console.log("\n");

    console.log("Example completed successfully!");
}
main();