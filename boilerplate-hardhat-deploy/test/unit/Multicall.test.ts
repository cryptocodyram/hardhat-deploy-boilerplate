import { ethers, waffle } from 'hardhat';
import chai, { expect } from 'chai';
import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deploy, deployProxy } from '../../utilities/deploy';
import { getBlockNumber, unitParser } from '../../utilities';
import { createBoosterPackDetailsCalls } from '../../utilities/multicall';
import { DEAD_ADDRESS } from '../constants';

chai.use(waffle.solidity);

describe('Multicall', () => {
  let multicall: Contract;
  let regsirty: Contract;

  let UFARM: Contract;
  let RAZOR: Contract;
  let ORO: Contract;
  let STACK: Contract;
  let NETVRK: Contract;
  let TBC: Contract;

  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  const COHORT_ID: string = '0x1720bb2B6E11F6582cC1a7f6510FEb84064Ea811';

  before(async () => {
    const [ownerWallet, aliceWallet, masterWallet] = await ethers.getSigners();
    owner = ownerWallet;
    alice = aliceWallet;

    multicall = await deploy('Multicall2', [owner.address]);
    regsirty = await deployProxy('UnifarmCohortRegistryUpgradeable', '__UnifarmCohortRegistryUpgradeable_init', [
      masterWallet.address,
      DEAD_ADDRESS,
      multicall.address,
    ]);

    // deploy tokens
    const supply = unitParser(5000000);
    UFARM = await deploy('MockERC20', ['Unifarm', 'UFARM', supply, 18]);
    RAZOR = await deploy('MockERC20', ['RAZOR Network', 'RAZOR', supply, 18]);
    ORO = await deploy('MockERC20', ['ORO Token', 'ORO', supply, 18]);
    STACK = await deploy('MockERC20', ['ORO Token', 'ORO', supply, 18]);
    NETVRK = await deploy('MockERC20', ['ORO Token', 'ORO', supply, 18]);
    TBC = await deploy('MockERC20', ['ORO Token', 'ORO', supply, 18]);

    await UFARM.connect(owner).approve(multicall.address, unitParser(10000000));
    await UFARM.connect(owner).approve(multicall.address, unitParser(10000000));
  });

  it('#owner', async () => {
    const multicallOwner = await multicall.owner();
    expect(multicallOwner).to.equal(owner.address);
  });

  it('#getBlockNumber', async () => {
    const blockNumber = await multicall.getBlockNumber();
    const blockNumberFromChain = await getBlockNumber();
    expect(blockNumber.toNumber()).to.be.equal(blockNumberFromChain);
  });

  it('#getCurrentBlockDifficulty', async () => {
    const blockDifficulty = await multicall.getCurrentBlockDifficulty();
    const blockNumberFromChain = await getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumberFromChain);
    expect(blockDifficulty.toNumber()).to.be.equal(block.difficulty);
  });

  it('#getCurrentBlockGasLimit', async () => {
    const gasLimit = await multicall.getCurrentBlockGasLimit();
    const blockNumberFromChain = await getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumberFromChain);
    expect(gasLimit).to.be.equal(block.gasLimit);
  });

  it('#getBlockHash', async () => {
    const bl = await getBlockNumber();
    const block = await ethers.provider.getBlock(bl);
    const currentHash = await multicall.getBlockHash(bl - 1);
    expect(currentHash.toString()).to.be.equal(block.parentHash);
  });

  it('#getCurrentBlockCoinbase', async () => {
    const miner = await multicall.getCurrentBlockCoinbase();
    const blockNumberFromChain = await getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumberFromChain);
    expect(miner).to.be.equal(block.miner);
  });

  it('#getCurrentBlockTimestamp', async () => {
    const timeStamp = await multicall.getCurrentBlockTimestamp();
    const blockNumberFromChain = await getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumberFromChain);
    expect(timeStamp.toNumber()).to.be.equal(block.timestamp);
  });

  it('#getEthBalance', async () => {
    const balance = await multicall.getEthBalance(multicall.address);
    expect(balance.toString()).to.eql('0');
  });

  it('#getLastBlockHash', async () => {
    const lastHash = await multicall.getLastBlockHash();
    const blockNumberFromChain = await getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumberFromChain);
    expect(lastHash).to.be.equal(block.parentHash);
  });

  it('#aggregate', async () => {
    const calls = createBoosterPackDetailsCalls(regsirty, [
      {
        cohortId: COHORT_ID,
        paymentToken: UFARM.address,
        bpid: 1,
        boosterVault: owner.address,
        boosterPackAmount: unitParser('1000'),
      },
    ]);
    await expect(multicall.connect(alice).aggregate(calls)).to.be.revertedWith('ONA');
    await multicall.connect(owner).aggregate(calls);
  });

  it('#blockAndAggregate', async () => {
    const calls = createBoosterPackDetailsCalls(regsirty, [
      {
        cohortId: COHORT_ID,
        paymentToken: UFARM.address,
        bpid: 1,
        boosterVault: owner.address,
        boosterPackAmount: unitParser('1000'),
      },
    ]);
    await expect(multicall.connect(alice).blockAndAggregate(calls)).to.be.revertedWith('ONA');
    await multicall.connect(owner).blockAndAggregate(calls);
  });

  it('#tryAggregate', async () => {
    const calls = createBoosterPackDetailsCalls(regsirty, [
      {
        cohortId: COHORT_ID,
        paymentToken: UFARM.address,
        bpid: 1,
        boosterVault: owner.address,
        boosterPackAmount: unitParser('1000'),
      },
    ]);
    await expect(multicall.connect(alice).tryAggregate(true, calls)).to.be.revertedWith('ONA');
    await multicall.connect(owner).tryAggregate(true, calls);
  });

  it('#tryBlockAndAggregate', async () => {
    const calls = createBoosterPackDetailsCalls(regsirty, [
      {
        cohortId: COHORT_ID,
        paymentToken: UFARM.address,
        bpid: 1,
        boosterVault: owner.address,
        boosterPackAmount: unitParser('1000'),
      },
    ]);
    await expect(multicall.connect(alice).tryBlockAndAggregate(true, calls)).to.be.revertedWith('ONA');
    await multicall.connect(owner).tryBlockAndAggregate(true, calls);
  });
});
