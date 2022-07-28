const { assert, expect } = require("chai")
const { getNamedAccounts, ethers, network } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Stating Tests", function () {
      let raffle, raffleEntranceFee, deployer

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer
        raffle = await ethers.getContract("Raffle", deployer)
        raffleEntranceFee = await raffle.getEntranceFee()
      })

      describe("fulfillRandomWords", function () {
        it("works with live chainlink Keepers and VRF, we get a random winner", async function () {
          console.log("Setting up test ...")
          const startingTimestamp = await raffle.getLatestTimestamp()
          const accounts = await ethers.getSigners()

          // Set listener first.
          console.log("Setting up listener ...")
          await new Promise(async function (resolve, reject) {
            raffle.once("WinnerPicked", async function () {
              console.log("> WinnerPicked event fired!")
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
                reject(error)
              }
            })

            // Entering the raffle
            console.log(`Entering raffle with ${ethers.utils.formatEther(raffleEntranceFee)} ETH`)
            const tx = await raffle.enterRaffle({ value: raffleEntranceFee })
            await tx.wait(1)
            const winnerStartingBalance = await accounts[0].getBalance()
            console.log(`Starting balance: ${ethers.utils.formatEther(winnerStartingBalance)} ETH`)
            console.log("Waiting for event ...")
          })
        })
      })
    })
