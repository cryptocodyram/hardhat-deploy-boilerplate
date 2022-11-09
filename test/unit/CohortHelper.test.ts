import { ethers, waffle } from 'hardhat';
import chai, { expect } from 'chai';
import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import _ from 'lodash';

import { deploy, deployProxy } from '../../utilities/deploy';
import { addBoosterPackage, addCohortDetails, addTokenMetaData, unitParser, getBlockNumber } from '../../utilities';

chai.use(waffle.solidity);

describe('Cohort Helper', () => {
  let cohortHelper: Contract;
  let cohort: Contract;
  let factory: Contract;
  let rewardRegistry: Contract;
  let registry: Contract;
  let ORO: Contract;
  let WETH: Contract;

  let owner: SignerWithAddress;
  let nftManager: SignerWithAddress;
  let boosterVault: SignerWithAddress;

  const version = ethers.utils.keccak256(ethers.utils.hexlify(35));

  before(async () => {
    const [OwnerWallet, masterWallet, trustedForwarder, boosterWallet, referralAddress, nftManagerWallet] = await ethers.getSigners();

    owner = OwnerWallet;
    nftManager = nftManagerWallet;
    boosterVault = boosterWallet;
    // deploy factory
    factory = await deployProxy('UnifarmCohortFactoryUpgradeable', '__UnifarmCohortFactoryUpgradeable_init', []);

    const salt = ethers.utils.solidityKeccak256(['string'], ['v35']);
    await factory.connect(owner).createUnifarmCohort(salt);

    const cohortId = await factory.cohorts(0);
    const supply = unitParser('500000000');

    ORO = await deploy('MockERC20', ['Orotoken', 'ORO', supply, 18]);
    WETH = await deploy('WETH9', []);
    cohort = await ethers.getContractAt('UnifarmCohort', cohortId);

    cohortHelper = await deploy('CohortHelper_Test', []);

    // deploy multicall
    const multicall = await deploy('Multicall2', [masterWallet.address]);

    // deploy registry
    registry = await deployProxy('UnifarmCohortRegistryUpgradeable', '__UnifarmCohortRegistryUpgradeable_init', [
      masterWallet.address,
      trustedForwarder.address,
      multicall.address,
    ]);

    const referralPercentage = unitParser('1');
    // deploy reward registry
    rewardRegistry = await deployProxy('UnifarmRewardRegistryUpgradeable', '__UnifarmRewardRegistryUpgradeable_init', [
      masterWallet.address,
      trustedForwarder.address,
      multicall.address,
      referralPercentage,
    ]);
  });

  it('#getBlockNumber', async () => {
    const evmBlockNumber = await getBlockNumber();
    const blockNumber = await cohortHelper.getBlockNumber();
    expect(blockNumber.toNumber()).to.equal(evmBlockNumber);
  });

  it('#owner', async () => {
    const factoryOwner = await cohortHelper.owner(factory.address);
    expect(factoryOwner).to.equal(owner.address);
  });

  it('#verifyCaller', async () => {
    await factory.connect(owner).setStorageContracts(registry.address, nftManager.address, rewardRegistry.address);
    const [registrys, nftManagers, rewardRegistrys] = await cohortHelper.connect(nftManager).verifyCaller(factory.address);
    expect(registrys).to.equal(registry.address);
    expect(nftManagers).to.equal(nftManager.address);
    expect(rewardRegistrys).to.equal(rewardRegistry.address);
    await expect(cohortHelper.connect(boosterVault).verifyCaller(factory.address)).to.be.revertedWith('ONM');
  });

  it('#getCohort', async () => {
    const startB = await getBlockNumber();
    const endB = _.add(startB, 518400);

    await addCohortDetails(registry, cohort.address, owner, {
      cohortVersion: version,
      startBlock: startB,
      endBlock: endB,
      epochBlocks: 518400 / 51840,
      hasLiquidityMining: false,
      hasContainsWrappedToken: false,
      hasCohortLockinAvaliable: true,
    });

    const [cohortVersion, startBlock, endBlock, epochBlocks, hasLiquidityMining, hasContainsWrappedToken, hasCohortLockinAvaliable] =
      await cohortHelper.getCohort(registry.address, cohort.address);

    expect(cohortVersion).to.equal(version);
    expect(startBlock).to.equal(startB);
    expect(endBlock).to.equal(endB);
    expect(epochBlocks).to.equal(10);
    expect(hasLiquidityMining).to.be.false;
    expect(hasContainsWrappedToken).to.be.false;
    expect(hasCohortLockinAvaliable).to.be.true;
  });

  it('#getCohortToken', async () => {
    await addTokenMetaData(registry, cohort.address, owner, {
      fid: 1,
      farmToken: ORO.address,
      userMinStake: unitParser(0.01),
      userMaxStake: unitParser(450000),
      totalStakeLimit: unitParser(4500000),
      decimals: 18,
      skip: false,
    });
    const [fid, farmToken, userMinStake, userMaxStake, totalStakeLimit, decimals, skip] = await cohortHelper.getCohortToken(
      registry.address,
      cohort.address,
      1
    );
    expect(fid as number).to.be.equal(1);
    expect((farmToken as string).toLowerCase()).to.be.equal(ORO.address.toLowerCase());
    expect(userMinStake).to.be.equal(unitParser(0.01));
    expect(userMaxStake).to.be.equal(unitParser(450000));
    expect(totalStakeLimit).to.be.equal(unitParser(4500000));
    expect(decimals as number).to.be.equal(18);
    expect(skip).to.be.false;
  });

  it('#getBoosterPackDetails', async () => {
    const boosterPackAmount = unitParser('10');

    await addBoosterPackage(registry, owner, {
      cohortId: cohort.address,
      paymentToken: ORO.address,
      bpid: 1,
      boosterVault: boosterVault.address,
      boosterPackAmount,
    });

    const [cohortId_, paymentToken_, boosterVault_, boosterPackAmount_] = await cohortHelper.getBoosterPackDetails(
      registry.address,
      cohort.address,
      1
    );

    expect(cohortId_).to.equal(cohort.address);
    expect(paymentToken_).to.equal(ORO.address);
    expect(boosterVault_).to.equal(boosterVault.address);
    expect(boosterPackAmount_).to.equal(boosterPackAmount);
  });

  it('#getCohortBalance', async () => {
    await ORO.connect(owner).transfer(cohortHelper.address, unitParser('1200'));
    const totalStaking = unitParser('500');
    const balance = await ORO.balanceOf(cohortHelper.address);
    const actualBalance = await cohortHelper.getCohortBalance(ORO.address, totalStaking);
    expect(balance).to.be.equal(unitParser('1200'));
    expect(actualBalance).to.be.equal(unitParser('700'));
  });

  it('#getStorageContracts', async () => {
    const [registrys, nftManagers, rewardRegistrys] = await cohortHelper.getStorageContracts(factory.address);
    expect(registrys).to.equal(registry.address);
    expect(nftManagers).to.equal(nftManager.address);
    expect(rewardRegistrys).to.equal(rewardRegistry.address);
  });
  it('#depositWETH', async () => {
    await cohortHelper.depositWETH(WETH.address, unitParser('0.05'), {
      value: unitParser('0.05'),
    });
    const wethInCohortHelper = await WETH.balanceOf(cohortHelper.address);
    expect(wethInCohortHelper).to.be.equal(unitParser('0.05'));
  });
  it('#validateStakeLock', async () => {
    await cohortHelper.validateStakeLock(registry.address, cohort.address, 1);
  });
  it('#validateUnStakeLock', async () => {
    await cohortHelper.validateUnStakeLock(registry.address, cohort.address, 1);
  });
});
