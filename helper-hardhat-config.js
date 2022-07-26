const { ethers } = require("hardhat")

const networkConfig = {
    4: {
        name: "Rinkeby",
        vrfCoordinatorV2: "0x271682DEB8C4E0901D1a1550aD2e64D568E69909",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc",
        subscriptionID: "0", // To be updated
        callbackoGasLimit: "500000",
        interval: 30, // s
    },
    31337: {
        name: "hardhat",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc", // It doesnt matter as we'll be mocking this owrselves
        callbackGasLimit: "500000",
        interval: 30, // s
    },
}

const developmentChains = ["hardhat", "localhost"]

module.exports = {
    networkConfig,
    developmentChains,
}
