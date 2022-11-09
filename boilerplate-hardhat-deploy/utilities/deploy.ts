import { Contract } from 'ethers';
import { ethers, upgrades } from 'hardhat';

export async function deployProxy(contract: string, initializer: string, args: any[]): Promise<Contract> {
  const FACTORY = await ethers.getContractFactory(contract);
  const instance = await upgrades.deployProxy(FACTORY, args, {
    initializer,
  });
  await instance.deployed();
  return instance;
}

export async function deploy(contract: string, args: any[]): Promise<Contract> {
  const FACTORY = await ethers.getContractFactory(contract);
  const instance = await FACTORY.deploy(...args);
  return instance;
}
