# Hardhat Decentralzied Raffle project

This is a demo project following the freeCodeCamp [course](https://www.youtube.com/watch?v=gyMwXuJrbJQ) ([git](https://github.com/PatrickAlphaC/hardhat-smartcontract-lottery-fcc)) on Full Stack Web3 with JavaScript, by Patrick Collins.
Lesson 9 -  Hardhat Smart Contract Lottery

### How it works
Participators may enter the raffle by providing a value >= 0.01 ETH.
At every specific ammount of time (30 seconds for demonstration) a winner is picked. Chainlink's [Keepers](https://keepers.chain.link/?_ga=2.54071272.1761196254.1658822626-1769886121.1654430720) is used to trigger the contracts' checkUpkeep() function which will select a winner if a minimum of 1 participant has entered the raffle. Chainlink's [VRF](https://vrf.chain.link/?_ga=2.44690660.1761196254.1658822626-1769886121.1654430720) is used to get a tamper proof random number that is used to draw a winner from the list of participators. 

## Requirements:

* [Node.js](https://nodejs.org/)
* [yarn](https://yarnpkg.com/) 
    * instead of npm
* [Hardhat](https://hardhat.org/)

This project also uses Chainlink's [Keepers](https://keepers.chain.link/?_ga=2.54071272.1761196254.1658822626-1769886121.1654430720) and [VRF](https://vrf.chain.link/?_ga=2.44690660.1761196254.1658822626-1769886121.1654430720) (Verifiable Random Function).

## Quickstart: 

```
git clone https://github.com/AVDel7/THIS_PROJECT
cd THIS_PROJECT
yarn
```

## Usage:

```
yarn hardhat deploy
```
## Testing

```
yarn test
```

### Test coverage

```
yarn coverage
```




