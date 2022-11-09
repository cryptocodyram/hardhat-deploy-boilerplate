import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import chalk from 'chalk';

const log = console.log;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  try {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    log(chalk.blue(`loading fixtures for Multicall2`));
    const { deployer, masterWallet } = await getNamedAccounts();

    const multicall = await deploy('Multicall2', {
      from: deployer,
      args: [masterWallet],
      log: true,
      autoMine: true,
      skipIfAlreadyDeployed: true,
      waitConfirmations: 5,
    });

    log(chalk.green(`Multicall2 deployed with ${multicall.transactionHash} at ${multicall.address}`));
  } catch (err) {
    if (err instanceof Error) {
      log(chalk.red(err.message));
    }
  }
};

export default func;
