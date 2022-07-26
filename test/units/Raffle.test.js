const { assert, expect } = require("chai")
const { getNamedAccounts, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Unit Tests", function () {
      let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval
      const chainId = network.config.chainId

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        raffle = await ethers.getContract("Raffle", deployer)
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
        raffleEntranceFee = await raffle.getEntranceFee()
        interval = await raffle.getInterval()
      })

      describe("constructor", function () {
        it("initializes the raffle correctly", async function () {
          const raffleState = await raffle.getRaffleState()
          assert.equal(raffleState.toString(), "0") // OPEN state
          assert.equal(interval.toString(), networkConfig[chainId]["interval"])
        })
      })

      describe("enterRaffle", function () {
        it("reverts when you don't pay enough", async function () {
          await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle_NotEnoughETHEntered")
        })
        it("record players when they enter", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee })
          const playerFromContract = await raffle.getPlayer(0)
          assert.equal(playerFromContract, deployer)
        })

        it("emits event on enter", async function () {
          await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(raffle, "RaffleEntered")
        })

        it("doesn't allow entrance when raffle is calculating", async function () {
          // This is a tricky one. We need to pretend to be the Keeper contract to force the contract into a state of CALCULATING
          await raffle.enterRaffle({ value: raffleEntranceFee })

          // Hardhat network provides us with several testing facilities, including the ability to speed up time.
          // More here: https://hardhat.org/hardhat-network/docs/reference#special-testing/debugging-methods
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", []) // Mine one extra block

          // Pretend to be chainlink keeper
          await raffle.performUpkeep([]) // This should set the contract into CALCULATING state.
          await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith("Raffle__NotOpen")
        })
      })

      describe("checkUpkeep", function () {
        it("returns false if people haven't sent any ETH", async function () {
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])

          //await raffle.checkUpkeep([]) // This sends a transaction... I want to simulate when the contract itself is calling this
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])

          assert(!upkeepNeeded)
        })
        it("returns false if raffle isn't open", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          await raffle.performUpkeep([]) // changes the state to CALCULATING
          const raffleState = await raffle.getRaffleState()
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert.equal(raffleState.toString() == "1", upkeepNeeded == false)
        })
        it("returns false if enough time hasn't passed", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() - 1])
          await network.provider.send("evm_mine", [])
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(!upkeepNeeded)
        })
        it("returns true if enough time has passed, has players, eth, and is open", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(upkeepNeeded)
        })
      })

      describe("performUpkeep", function () {
        it("can only run if checkUpkeep is true", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])

          const tx = await raffle.performUpkeep([])
          assert(tx)
        })
        it("reverts when checkUpkeep is false", async function () {
          await expect(raffle.performUpkeep([])).to.be.revertedWith("Raffle__UpkeepNotNeeded") // Note: We can also test for expected parameters within the error returned.
        })
        it("updates the raffle state, emmits and event, and calls the vrfCoordinator", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          const txResponse = await raffle.performUpkeep("0x") // emits requestId
          const txReceipt = await txResponse.wait(1) // waits 1 block
          const raffleState = await raffle.getRaffleState() // updates state
          const requestId = txReceipt.events[1].args[0]

          assert(requestId > 0)
          assert(raffleState == 1) // 0 = open, 1 = calculating
        })
      })

      describe("fulfillRandomWords", function () {
        beforeEach(async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
        })
        it("can only be called after performUpkeep", async function () {
          await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)).to.be.revertedWith(
            "nonexistent request"
          )
          await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)).to.be.revertedWith(
            "nonexistent request"
          )
        })
        it("picks a winner, resets the lottary, and sends the money", async function () {
          const additionalEntrants = 3
          const startingAccountingIndex = 1 // Since depoyer is 0
          const accounts = await ethers.getSigners()
          for (let i = startingAccountingIndex; i < startingAccountingIndex + additionalEntrants; i++) {
            // Have new accounts enter the raffle
            const accountConnected = raffle.connect(accounts[i])
            await accountConnected.enterRaffle({ value: raffleEntranceFee })
          }
          const startingTimestamp = await raffle.getLatestTimestamp() // stores starting timestamp (before we fire our event)

          // This will be more important for our staging tests...
          await new Promise(async function (resolve, reject) {
            raffle.once("WinnerPicked", async function () {
              console.log("Found the event!")
              try {
                const recentWinner = await raffle.getRecentWinner()
                console.log(`Winner: ${recentWinner}`)
                const raffleState = await raffle.getRaffleState()
                const endingTimestamp = await raffle.getLatestTimestamp()
                const numPlayers = await raffle.getNumPlayer()
                const winnerEndingBalance = await accounts[1].getBalance()
                assert.equal(numPlayers.toString(), "0")
                assert.equal(raffleState.toString(), "0")
                assert(endingTimestamp > startingTimestamp)
                assert.equal(winnerEndingBalance.toString(), winnerStartingBalance.add(raffleEntranceFee.mul(additionalEntrants).add(raffleEntranceFee).toString()))
              } catch (e) {
                reject(e) // if try fails, rejects the promise
              }
              resolve()
            })

            // Mocking Chainlink Keepers
            const tx = await raffle.performUpkeep([])
            const txReceipt = await tx.wait(1)
            // Mocking Chainlink's VRF
            const winnerStartingBalance = await accounts[1].getBalance() // The test is deterministic enough that we know the winner beforehand.
            await vrfCoordinatorV2Mock.fulfillRandomWords(txReceipt.events[1].args[0], raffle.address) // Note: For some reason txReceipt.events[1].args.requestId doesn't work for me.
          })
        })

      })
    })
