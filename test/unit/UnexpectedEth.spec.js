const { expect, assert } = require("chai");
const { currentTime } = require("../helpers");

describe("Balance of stream", () => {

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
        [owner, sender, recipient1, randomAccount,  ...addrs] = await ethers.getSigners();

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

    describe("#reverts", function () {
          
        it("should revert when sending eth to the contract", async function () {
            let provider = ethers.provider;
            let beforeBalance = Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));
            await expect(randomAccount.sendTransaction({
                to: streamingContract.address,
                value: ethers.utils.parseEther("1.0")})).to.be.revertedWith("Streaming does not accept donations");
            let afterBalance = Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));
            assert(beforeBalance === afterBalance);
        });

        it("should revert when calling unknown function", async function () {
            // 1. deploy FallbackCaller
            let provider = ethers.provider;
            FallbackCaller = await ethers.getContractFactory("FallbackCaller");
            fallbackCallerContract = await FallbackCaller.deploy();
            await fallbackCallerContract.deployed();
            let beforeBalance = Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));
            await expect(fallbackCallerContract.connect(randomAccount).RandomCall(streamingContract.address, {value: deposit})).to.be.reverted;
            let afterBalance = Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));
            assert(beforeBalance === afterBalance);
        });

        it("CANNOT revert the eth if streamingContract is beneficiary of selfdestruct", async function () {
            // 1. deploy FallbackCaller
            let provider = ethers.provider;
            SelfDestruct = await ethers.getContractFactory("SelfDestruct");
            selfDestructContract = await SelfDestruct.deploy();
            await selfDestructContract.deployed();
            await randomAccount.sendTransaction({ to: selfDestructContract.address, value: deposit })
            let beforeBalance = Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));
            await selfDestructContract.connect(randomAccount).destroyMe(streamingContract.address);
            let afterBalance = Number(ethers.utils.formatEther(await provider.getBalance(streamingContract.address)));
            assert(beforeBalance + 1 === afterBalance);
        });

    });
});