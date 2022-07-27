// This script checks the current funds in the Raffle contract

const { getNamedAccounts, ethers, network } = require("hardhat")

async function main() {
  const raffle = await ethers.getContract("Raffle") // Retrieve latest contract on the chain
  console.log(`Retrieved contract (${network.name}): ${raffle.address}`)
  console.log(
    `  Balance: ${ethers.utils.parseEther(await (await ethers.provider.getBalance(raffle.address)).toString())}`
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
