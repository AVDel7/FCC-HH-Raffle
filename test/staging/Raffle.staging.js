const { assert, expect } = require("chai")
const { getNamedAccounts, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Unit Tests", function () {
      let raffle, raffleEntranceFee, deployer

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer
        console.log(`Deployer: ${deployer}`)
        await deployments.fixture(["all"])
        console.log(`Retrieving contract from deployer ${deployer.address}`)
        raffle = await ethers.getContract("Raffle", deployer) // CONTINUE DEBUGGING HERE
        console.log(`Contract retrieved: ${raffle.address}`)
        raffleEntranceFee = await raffle.getEntranceFee()
        interval = await raffle.getInterval()
      })

      describe("fulfillRandomWords", function () {
        it("works with live chainlink keepers and VRF, we get a random winner", async function () {
          const startingTimestamp = await raffle.getLatestTimestamp()
          console.log(`Latest timestamp: ${startingTimestamp}`)
          const accounts = await ethers.getSigner()

          // Set listener first.
          console.log("Setting up listener ...")
          await new Promise(async function (resolve, reject) {
            raffle.once("WinnerPicked", async function () {
              console.log("> WinnerPicked event fired!")
              resolve()
              try {
                const recentWinner = await raffle.getRecentWinner()
                const raffleState = await raffle.getRaffleState()
                const winnerEndingBalance = await accounts[0].getBalance()
                const endingTimestamp = await raffle.getLatestTimestamp()

                await expect(raffle.getPlayer(0)).to.be.reverted
                assert.equal(recentWinner.toString(), accounts[0].address)
                assert.equal(raffleState, 0)
                assert.equal(winnerEndingBalance.toString(), winnerStartingBalance.add(raffleEntranceFee).toString())
                assert(endingTimestamp > startingTimestamp)
                resolve()
              } catch (error) {
                console.log(error)
              }
            })

            // Entering the raffle
            console.log(`Entering raffle with ${raffleEntranceFee} ETH`)
            await raffle.enterRaffle({ value: raffleEntranceFee })
            const winnerStartingBalance = await accounts[0].getBalance()
            console.log(`Starting balance: ${winnerStartingBalance}`)
          })
        })
      })
    })
