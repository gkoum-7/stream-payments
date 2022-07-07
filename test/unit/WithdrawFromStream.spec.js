const { expect, assert } = require("chai");
const { setTime, currentTime } = require("../helpers");

describe("Withdraw from stream", () => {

    let owner;
    let sender;
    let recipient1, addrs;
    let startTimestamp;
    let stopTimestamp;

    let deposit = ethers.utils.parseEther("1");
    let now = currentTime();

    let blockSpacing = 1000;
    let duration;

    beforeEach("#deploy", async () => {
        Streaming = await ethers.getContractFactory("Streaming");
        [owner, sender, recipient1, unknownCaller, attacker, ...addrs] = await ethers.getSigners();

        streamingContract = await Streaming.deploy();

        await streamingContract.deployed();
    });

    beforeEach("#setup", async function () {
        duration = 100;
        let delay = 100;

        now = now + blockSpacing;

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

    describe("#reverts", function () {

        it("should revert when streamId doesn't exist", async function () {
            let invalidStreamId = 3;
            await expect(
                streamingContract.connect(sender).withdrawFromStream(invalidStreamId)
            ).to.be.revertedWith("streamId does not exist");
        });

        it("should revert when caller is not the sender or the recipient of the stream", async function () {
            await expect(
                streamingContract.connect(unknownCaller).withdrawFromStream(1)
            ).to.be.revertedWith("caller is not the sender or the recipient of the stream");
        });

        it("should revert when startTime is not yet reached", async function () {
            await expect(
                streamingContract.connect(recipient1).withdrawFromStream(1)
            ).to.be.revertedWith("startTime not reached yet");
        });

        it("should revert if stream has zero balance left", async function () {
            await streamingContract.connect(sender).cancelStream(1);
            await expect(streamingContract.connect(sender).withdrawFromStream(1)).to.be.
                revertedWith("streamId has zero balance");
        });

        it("should revert if transaction fails", async function () {
            function delay(time) {
                return new Promise(resolve => setTimeout(resolve, time));
              }
            
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
            
            console.log("waiting 10 seconds to pass, so recipient can withdraw something...");
            await delay(10000);
            // trey to cancel the stream and watch it revert - money stuck forever
            await expect(streamingContract.connect(sender).withdrawFromStream(2)).to.be.revertedWith(
                "in Streaming.withdrawFromStream(uint256) transaction did NOT go through");
        });

        it("should not allow reentrancy attack on WithdrawFromStream function", async function () {
            // although using lock would be "cleaner", gas cost optimizations do not allow it (gas test fails).
            // To that end, we can still prevent reentrancy by updating "streams[_streamId].balance -= dueRecipient;" 
            // before we send tx to receiver. 

            function delay(time) {
                return new Promise(resolve => setTimeout(resolve, time));
              }
            let provider = ethers.provider;
            
            // 1. deploy WithdrawReentrancyAttackReceiver
            WithdrawReentrancyAttackReceiver = await ethers.getContractFactory("WithdrawalReentrancyAttackReceiver");
            attackerReceiverContract = await WithdrawReentrancyAttackReceiver.deploy();
            await attackerReceiverContract.deployed();

            // 2. deploy WithdrawReentrancyAttackSender
            WithdrawReentrancyAttackSender = await ethers.getContractFactory("WithdrawReentrancyAttackSender");
            attackerSenderContract = await WithdrawReentrancyAttackSender.deploy();
            await attackerSenderContract.deployed();

            // 3. prepare attackers
            await attackerSenderContract.connect(attacker).prepareAttack(streamingContract.address, attackerReceiverContract.address,
                {value : deposit});
            await attackerReceiverContract.connect(attacker).prepareAttack(streamingContract.address, 2);
            
            // 4. wait a little so we can call withdrawal (something needs to be due to recipient)
            console.log("waiting 5 seconds to pass, so recipient can withdraw something");
            await delay(5000);

            // 5. attack, keep track of contract value beforeand after
            let balanceBefore = Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));
            await expect(attackerSenderContract.connect(attacker).commenceAttack()).to.be.revertedWith(
                "in Streaming.withdrawFromStream(uint256) transaction did NOT go through");
            let balanceAfter =  Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));
            assert(balanceAfter === balanceBefore);
        });
    });

    describe("#success", function () {

        it("should make appropriate withdrawals, and withdraw all after stopTime ends", async function () {
            function delay(time) {
                return new Promise(resolve => setTimeout(resolve, time));
              }
            // make a stream where receiver is the above contract
            let provider = ethers.provider;
            startTimestamp = (await ethers.provider.getBlock()).timestamp;
            await streamingContract.connect(sender).createStream(
                recipient1.address,
                deposit,
                startTimestamp + 1,
                startTimestamp + 11,
                { value: deposit }
            );

            let contractStart =  Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));
            let recipient1Start =  Number(ethers.utils.formatEther(await provider.getBalance(recipient1.address)));
            console.log("waiting 7 seconds to pass, so recipient can withdraw something...");
            await delay(7000);

            // withdraw from stream
            await streamingContract.connect(sender).withdrawFromStream(2);
            let contractMid =  Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));
            let recipient1Mid =  Number(ethers.utils.formatEther(await provider.getBalance(recipient1.address)));
            
            console.log("waiting 6 seconds to pass, so stream stopTime passes...");
            await delay(6000);
            await streamingContract.connect(sender).withdrawFromStream(2);
            let contractEnd =  Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));
            let recipient1End =  Number(ethers.utils.formatEther(await provider.getBalance(recipient1.address)));

            // comparisons
            let firstInstallment = recipient1Mid - recipient1Start;
            let SecondInstallment = recipient1End - recipient1Mid;
            assert(firstInstallment > Number(0.5));
            assert(SecondInstallment < Number(0.5));
            assert(firstInstallment + SecondInstallment === Number(1));
            assert(contractStart - contractEnd === Number(1))
        });


        it("should emit the WithdrawFromStream event", async function () {
            let timeToSet = stopTimestamp + 1;
            await setTime(ethers.provider, timeToSet);

            await expect(
                streamingContract.connect(recipient1).withdrawFromStream(1)
            ).to
                .emit(streamingContract, "WithdrawFromStream")
                .withArgs(1, recipient1.address);
        });

    });

    describe("#gasCheck", function () {
        it("should happen within the gas limit", async function () {
            let timeToSet = stopTimestamp + 1;
            await setTime(ethers.provider, timeToSet);

            const BASE_GAS_USAGE = 58_100;

            const currentGas = (await streamingContract.connect(recipient1).estimateGas.withdrawFromStream(1)).toNumber();
            assert(currentGas < BASE_GAS_USAGE);
          });
    });
});