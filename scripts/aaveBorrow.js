const { getWeth, AMOUNT } = require("./getWeth");
const { getNamedAccounts, ethers } = require("hardhat");

async function main () {
    await getWeth();
    const { deployer } = await getNamedAccounts();
    // aave lending pool address provider: 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5;
    // lending pool contract: create a new function to get lending pool from lendingpoolprovider.
    const lendingPool = await getLendingPool(deployer);
    console.log("lendingpool address: ", lendingPool.address);

    // Deposit.
    // To be able to deposit we need to approve first!
    const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT, deployer);
    console.log("depositing...");
    await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0);
    console.log("deposited!");


    // Borrow
    // get the necessary variables to be able to borrow.
    let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(lendingPool, deployer);
    const daiPrice = await getDaiPrice();
    const amountDaiToBorrow = availableBorrowsETH.toString() * (1 / daiPrice.toNumber()) * 0.9;
    console.log("dai to borrow: ", amountDaiToBorrow);
    const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString());
    console.log("dai to borrow wei: ", amountDaiToBorrowWei.toString());

    // Borrow function
    const daiTokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
    await borrowDai(daiTokenAddress, lendingPool, amountDaiToBorrowWei, deployer);
    await getBorrowUserData(lendingPool, deployer);

    // Repay
    await repay(amountDaiToBorrowWei, daiTokenAddress, lendingPool, deployer);
    await getBorrowUserData(lendingPool, deployer);
}

async function repay(
    amount,
    daiAddress,
    lendingPool,
    account
) {
    await approveErc20(daiAddress, lendingPool.address, amount, account);
    const repayTx = await lendingPool.repay(daiAddress, amount, 1, account);
    await repayTx;
    console.log("Repaid!");
}

async function borrowDai(
    daiAddress, 
    lendingPool, 
    amountDaiToBorrowWei, 
    account
) {
    const borrowTx = await lendingPool.borrow(
        daiAddress, 
        amountDaiToBorrowWei, 
        1, 
        0, 
        account
    );
    await borrowTx;
    console.log("You have borrowed!!!");
}

async function getDaiPrice() {
    const daiEthPriceFeed = await ethers.getContractAt("AggregatorV3Interface", "0x773616E4d11A78F511299002da57A0a94577F1f4");
    const price = (await daiEthPriceFeed.latestRoundData())[1];
    console.log("dai - eth price is: ", price.toString());
    return price;
}

async function getLendingPool(account) {
    const lendingPoolProvider = await ethers.getContractAt("ILendingPoolAddressesProvider", "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5", account);
    const lendingPoolAddress = await lendingPoolProvider.getLendingPool();
    const lendingPool = await ethers.getContractAt("ILendingPool", lendingPoolAddress, account);
    return lendingPool;
}

async function approveErc20(
    erc20ContractAddress,
    spenderAddress,
    amountToSpend,
    account
) {
    const erc20Token = await ethers.getContractAt("IERC20", erc20ContractAddress, account);
    const tx = await erc20Token.approve(spenderAddress, amountToSpend);
    await tx;
    console.log("Approved!")
}

async function getBorrowUserData(lendingPool, account) {
    const { totalCollateralETH, totalDebtETH, availableBorrowsETH } = await lendingPool.getUserAccountData(account);
    console.log(`You have ${totalCollateralETH} ETH deposited`);
    console.log(`You have ${totalDebtETH} ETH total debt`);
    console.log(`You can borrow ${availableBorrowsETH} ETH more`);
    return { availableBorrowsETH, totalDebtETH }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.log(error);
        process.exit(1);
    })