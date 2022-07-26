const { network, ethers } = require("hardhat")
const { verify } = require("../hardhat.config")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("30")

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainID = network.config.chainId
    let vrfCoordinatorV2Address, subscriptionID

    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        subscriptionID = transactionReceipt.events[0].args.subId

        // Fund the subscription
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionID, VRF_SUB_FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }

    const entranceFee = networkConfig[chainID]["entranceFee"]
    const gasLane = networkConfig[chainID]["gasLane"]
    const callbackGasLimit = networkConfig[chainID]["callbackGasLimit"]
    const interval = networkConfig[chainID]["interval"]

    const args = [vrfCoordinatorV2Address, entranceFee, gasLane, subscriptionID, callbackGasLimit, interval]
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if(!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY){
        log("Verifying contract ...")
        await verify(raffle.address, args)
        log("--------------------------------------------")
    }
}

module.exports.tags = ["all", "raffle"]