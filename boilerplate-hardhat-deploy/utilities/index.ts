import { ethers } from 'hardhat';
import { BigNumber, Contract } from 'ethers';
import _ from 'lodash';
import { Promise } from 'bluebird';

export const convertBytes = (types: string[], values: any[]) => {
  return ethers.utils.defaultAbiCoder.encode(types, values);
};

export const unitParser = (units: string | number): BigNumber => {
  return ethers.utils.parseUnits(units.toString(), 'ether');
};

export const unitFormatter = (units: string): number => {
  return Number(ethers.utils.formatUnits(units, 'ether'));
};

export const getBlockNumber = async (): Promise<number> => {
  return await ethers.provider.getBlockNumber();
};

export const getBlockTimeStamp = async (): Promise<number> => {
  const blockNumber = await getBlockNumber();
  return await (
    await ethers.provider.getBlock(blockNumber)
  ).timestamp;
};

export const roundValue = (value: number, roundTo: number) => {
  return Math.floor(value * 10 ** roundTo) / 10 ** roundTo;
};

export const mineNBlocks = async (n: number): Promise<void> => {
  for (let index = 0; index < n; index++) {
    await ethers.provider.send('evm_mine', []);
  }
};
