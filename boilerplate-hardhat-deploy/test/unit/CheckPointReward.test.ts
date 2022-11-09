import { ethers, waffle } from 'hardhat';
import chai, { expect } from 'chai';
import { Contract } from 'ethers';
import _ from 'lodash';
import { deploy } from '../../utilities/deploy';
import { getBlockNumber, mineNBlocks } from '../../utilities';

chai.use(waffle.solidity);

describe('CheckPointReward', () => {
  let checkpoint: Contract;
  let startBlock: number;

  before('deploy', async () => {
    checkpoint = await deploy('CheckPointReward_Test', []);
    startBlock = await getBlockNumber();
  });

  it('#getBlockDifference', async () => {
    const startBlock = await getBlockNumber();
    const endBlock = _.add(startBlock, 20);
    const blockDiffrence = await checkpoint.getBlockDifference(startBlock, endBlock);
    expect(blockDiffrence.toNumber()).to.equal(20);
    await mineNBlocks(5);
  });

  it('#getCheckpoint', async () => {
    const startBlock = await getBlockNumber();
    const endBlock = _.add(startBlock, 20);
    const epochBlock = 2;
    const checkPoints = await checkpoint.getCheckpoint(startBlock, endBlock, epochBlock);
    expect(checkPoints.toNumber()).to.equal(10);
    await mineNBlocks(10);
  });

  it('#getCurrentCheckpoint', async () => {
    await mineNBlocks(15);
    const endBlock = _.add(startBlock, 20);
    const epochBlock = 2;
    const currentCheckPoint = await checkpoint.getCurrentCheckpoint(startBlock, endBlock, epochBlock);
    expect(currentCheckPoint.toNumber()).to.equal(10);
    expect(currentCheckPoint.toNumber()).to.be.not.equal(15);
  });

  it('#getStartCheckpoint', async () => {
    const userStakedBlock = _.add(startBlock, 10);
    const epochBlock = 2;
    const startCheckPoint = await checkpoint.getStartCheckpoint(startBlock, userStakedBlock, epochBlock);
    expect(startCheckPoint.toNumber()).to.equal(5);
  });
});
