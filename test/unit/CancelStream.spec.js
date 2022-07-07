const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const { providers } = require("web3");
const { currentTime } = require("../helpers");

describe("Cancel stream", () => {

    let owner;
    let sender;
    let recipient1, addrs;
    let startTimestamp;
    let stopTimestamp;

    let deposit = ethers.utils.parseEther("1");
    let now = currentTime();

    let duration;

    beforeEach("#deploy", async () => {
        Streaming = await ethers.getContractFactory("Streaming");
        [owner, sender, recipient1, recipient2, attacker, unknownCaller,
             ...addrs] = await ethers.getSigners();

        streamingContract = await Streaming.deploy();

        await streamingContract.deployed();
    });

    beforeEach("#setup", async function () {
        duration = 100;
        let delay = 100;

        startTimestamp = now + delay;
        stopTimestamp = startTimestamp + duration;

        await streamingContract.connect(sender).createStream(
            recipient1.address,
            deposit,
            startTimestamp,
            stopTimestamp,
            { value: deposit }
        );
    });

    describe("#success", function () {

        it("should emit the CancelStream event", async function () {
            await expect(
                streamingContract.connect(recipient1).cancelStream(1)
            ).to
                .emit(streamingContract, "CancelStream")
                .withArgs(1, recipient1.address, sender.address, deposit, 0);
        });

        // it("should cancel before start time - all back to sender", async function () {   
            
        //     // get a snapshot of the account values before
        //     let provider = ethers.provider;
        //     let balanceBeforeSender = Number(ethers.utils.formatEther(await provider.getBalance(sender.address)));
        //     let balanceBeforeRecipient = Number(ethers.utils.formatEther(await provider.getBalance(recipient1.address)));
        //     let balanceBeforeContract = Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));
            
        //     // send tx, keep gas cost
        //     let tx = await streamingContract.connect(sender).cancelStream(1);
        //     let receipt = await tx.wait();
        //     let gasCost =  Number(ethers.utils.formatEther(receipt.gasUsed.mul(tx.gasPrice)));

        //     // get a snapshot after
        //     let balanceAfterSender = Number(ethers.utils.formatEther(await provider.getBalance(sender.address)));
        //     let balanceAfterRecipient = Number(ethers.utils.formatEther(await provider.getBalance(recipient1.address)));
        //     let balanceAfterContract = Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));

        //     // compare - use toFixed to avoid rounding errors
        //     assert(Number(balanceAfterSender.toFixed(10)) === Number(balanceBeforeSender.toFixed(10)) - 
        //             Number(gasCost.toFixed(10)) + Number(1));
        //     assert(balanceBeforeRecipient === balanceAfterRecipient)
        //     assert(balanceAfterContract === balanceBeforeContract - 1);
      
        // });

        // it("should cancel after stop time - all goes to recipient", async function () {   

        //     function delay(time) {
        //         return new Promise(resolve => setTimeout(resolve, time));
        //       }
            
        //     // create stream
        //     startTimestamp = (await ethers.provider.getBlock()).timestamp;
        //     let provider = ethers.provider;
        //     await streamingContract.connect(sender).createStream(
        //         recipient2.address,
        //         deposit,
        //         startTimestamp + 5,
        //         startTimestamp + 15,
        //         { value: deposit }
        //     );

        //     // get a snapshot of the account values before
        //     let balanceBeforeSender = Number(ethers.utils.formatEther(await provider.getBalance(sender.address)));
        //     let balanceBeforeRecipient = Number(ethers.utils.formatEther(await provider.getBalance(recipient2.address)));
        //     let balanceBeforeContract = Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));

        //     // wait 20 seconds for stream window to finish
        //     console.log("waiting 20 seconds to pass so we are after stopTime...");
        //     await delay(20000);
            
        //     // send tx, keep gas cost
        //     let tx = await streamingContract.connect(sender).cancelStream(2);
        //     let receipt = await tx.wait();
        //     let gasCost =  Number(ethers.utils.formatEther(receipt.gasUsed.mul(tx.gasPrice)));
            
        //     // get a snapshot after
        //     let balanceAfterSender = Number(ethers.utils.formatEther(await provider.getBalance(sender.address)));
        //     let balanceAfterRecipient = Number(ethers.utils.formatEther(await provider.getBalance(recipient2.address)));
        //     let balanceAfterContract = Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));

        //     assert(balanceAfterSender === balanceBeforeSender - gasCost);
        //     assert(balanceBeforeRecipient === balanceAfterRecipient - 1);
        //     assert(balanceAfterContract === balanceBeforeContract - 1);
        // });

        it("should cancel during regular stream - distribute remainders accordingly", async function () {
            function delay(time) {
                return new Promise(resolve => setTimeout(resolve, time));
              }
            
            // create stream
            startTimestamp = (await ethers.provider.getBlock()).timestamp;
            let provider = ethers.provider;
            await streamingContract.connect(sender).createStream(
                recipient2.address,
                deposit,
                startTimestamp + 5,
                startTimestamp + 15,
                { value: deposit }
            );

            // get a snapshot of the account values before
            let balanceBeforeSender = Number(ethers.utils.formatEther(await provider.getBalance(sender.address)));
            let balanceBeforeRecipient = Number(ethers.utils.formatEther(await provider.getBalance(recipient2.address)));
            let balanceBeforeContract = Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));

            // wait 10 seconds and interupt in the middle
            console.log("waiting 10 seconds to pass (so we are in between startTime and stopTime)...");
            await delay(10000);
            
            // send tx, keep gas cost
            let tx = await streamingContract.connect(sender).cancelStream(2);
            let receipt = await tx.wait();
            let gasCost =  Number(ethers.utils.formatEther(receipt.gasUsed.mul(tx.gasPrice)));
            
            // get a snapshot after
            let balanceAfterSender = Number(ethers.utils.formatEther(await provider.getBalance(sender.address)));
            let balanceAfterRecipient = Number(ethers.utils.formatEther(await provider.getBalance(recipient2.address)));
            let balanceAfterContract = Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));
            // compare - we round on the 10th decimal due to rounding erros
            assert(Number((balanceAfterRecipient - balanceBeforeRecipient + balanceAfterSender - 
                balanceBeforeSender + gasCost).toFixed(10)) === Number(1));
            assert(balanceBeforeContract - balanceAfterContract === 1);
        });

        it("should cancel after Withdrawal and during regular stream - distribute remainders accordingly", async function () {
            function delay(time) {
                return new Promise(resolve => setTimeout(resolve, time));
              }
            
            // create stream
            startTimestamp = (await ethers.provider.getBlock()).timestamp;
            let provider = ethers.provider;
            await streamingContract.connect(sender).createStream(
                recipient2.address,
                deposit,
                startTimestamp + 5,
                startTimestamp + 15,
                { value: deposit }
            );

            // get a snapshot of the account values before
            let balanceBeforeSender = Number(ethers.utils.formatEther(await provider.getBalance(sender.address)));
            let balanceBeforeRecipient = Number(ethers.utils.formatEther(await provider.getBalance(recipient2.address)));
            let balanceBeforeContract = Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));

            // wait 7 seconds and interupt in the middle
            console.log("waiting 7 seconds to pass (so we are in between startTime and stopTime) and withdraw...");
            await delay(7000);
            
            // send tx, keep gas cost
            let tx_1 = await streamingContract.connect(sender).withdrawFromStream(2);
            let receipt_1 = await tx_1.wait();
            let gasCost_1 =  Number(ethers.utils.formatEther(receipt_1.gasUsed.mul(tx_1.gasPrice)));

            let balanceAfterSender = Number(ethers.utils.formatEther(await provider.getBalance(sender.address)));
            let balanceAfterRecipient = Number(ethers.utils.formatEther(await provider.getBalance(recipient2.address)));
            let balanceAfterContract = Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));

            console.log("waiting 3 seconds to pass (so we are in between startTime and stopTime) and cancel...");
            await delay(3000);
            // send tx, keep gas cost
            let tx_2 = await streamingContract.connect(sender).cancelStream(2);
            let receipt_2 = await tx_2.wait();
            let gasCost_2 =  Number(ethers.utils.formatEther(receipt_2.gasUsed.mul(tx_2.gasPrice)));
            
            // get a snapshot after
            let balanceEndSender = Number(ethers.utils.formatEther(await provider.getBalance(sender.address)));
            let balanceEndRecipient = Number(ethers.utils.formatEther(await provider.getBalance(recipient2.address)));
            let balanceEndContract = Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));

            let recipientFirstTx = balanceAfterRecipient - balanceBeforeRecipient;
            let recipientSecondTx = balanceEndRecipient - balanceAfterRecipient;

            let senderFirstTx = balanceAfterSender - balanceBeforeSender + gasCost_1;
            let senderSecondTx = balanceEndSender - balanceAfterSender + gasCost_2;

            assert(Number((recipientFirstTx+recipientSecondTx+senderSecondTx).toFixed(10)) === Number(1));
        });
    });

    describe("#reverts", function () {

        it("should revert if stream has zero balance left", async function () {
            await streamingContract.connect(sender).cancelStream(1);
            await expect(streamingContract.connect(sender).cancelStream(1)).to.be.revertedWith("stream has already ended");
        });

        it("should revert when streamId doesn't exist", async function () {
            let invalidStreamId = 3;
            await expect(
                streamingContract.connect(sender).cancelStream(invalidStreamId)
            ).to.be.revertedWith("streamId does not exist");
        });

        it("should revert when caller is not the sender or the recipient of the stream", async function () {
            await expect(
                streamingContract.connect(unknownCaller).cancelStream(1)
            ).to.be.revertedWith("caller is not the sender or the recipient of the stream");
        });

        it("should not allow reentrancy attack on cancelStream function", async function () {
            // deploy attacking contract
            let provider = ethers.provider;
            CancelReentrancyAttack = await ethers.getContractFactory("CancelReentrancyAttack");
            attackerContract = await CancelReentrancyAttack.deploy();
            await attackerContract.deployed();
            let balanceBefore = Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));
            await expect(attackerContract.connect(attacker).attackStreaming(streamingContract.address, 
                {value : deposit})).to.be.reverted;
            let balanceAfter =  Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));
            assert(balanceAfter === balanceBefore);
        });

        it("should revert if transaction fails", async function () {

            // deploy non payable contract
            nonPayable = await ethers.getContractFactory("NonPayableReceiver");
            nonPayableContract = await nonPayable.deploy();
            await nonPayableContract.deployed();

            // make a stream where receiver is the above contract
            startTimestamp = (await ethers.provider.getBlock()).timestamp;
            await streamingContract.connect(sender).createStream(
                nonPayableContract.address,
                deposit,
                startTimestamp + 5,
                startTimestamp + 15,
                { value: deposit }
            );

            // trey to cancel the stream and watch it revert - money stuck forever
            await expect(streamingContract.connect(sender).cancelStream(2)).to.be.revertedWith(
                "in Streaming.cancelStream(uint256) recipient transaction did NOT go through");
        });


  

    });

    describe("#gasCheck", function () {
        it("should happen within the gas limit", async function () {
            const BASE_GAS_USAGE = 88_100;

            const currentGas = (await streamingContract.connect(recipient1).estimateGas.cancelStream(1)).toNumber();
            assert(currentGas < BASE_GAS_USAGE);
        });
    });
});
