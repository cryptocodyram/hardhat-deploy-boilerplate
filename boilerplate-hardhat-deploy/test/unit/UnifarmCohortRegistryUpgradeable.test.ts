import { ethers, waffle, upgrades } from 'hardhat';
import chai, { expect } from 'chai';
import { BigNumber, Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import _ from 'lodash';
import { deploy, deployProxy } from '../../utilities/deploy';
import { DEAD_ADDRESS, ZERO_ADDRESS } from '../constants';
import { addBoosterPackage, addCohortDetails, addTokenMetaData, getBlockNumber, roundValue, unitParser } from '../../utilities';

chai.use(waffle.solidity);

const COHORT_ID: string = '0x1720bb2B6E11F6582cC1a7f6510FEb84064Ea811';

describe('UnifarmCohortRegistryUpgradeable', () => {
  let registry: Contract;
  let multicall: Contract;
  let UFARM: Contract;
  let ORO: Contract;

  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  var startBlock: number;
  const version = 'V35';

  before('deploy contracts', async () => {
    const [ownerWallet, aliceWallet, masterWallet] = await ethers.getSigners();
    owner = ownerWallet;
    alice = aliceWallet;

    multicall = await deploy('Multicall2', [masterWallet.address]);
    // deploy registry contract
    registry = await deployProxy('UnifarmCohortRegistryUpgradeable', '__UnifarmCohortRegistryUpgradeable_init', [
      masterWallet.address,
      DEAD_ADDRESS,
      multicall.address,
    ]);

    // deploy two mock token as well
    const supply = ethers.utils.parseUnits('50000000000', 'ether');
    UFARM = await deploy('MockERC20', ['Unifarm', 'UFARM', supply, 18]);
    ORO = await deploy('MockERC20', ['Oro', 'ORO', supply, 18]);
  });

  describe('#setCohortDetails', () => {
    it('non owner access not able to add the cohort details', async () => {
      const startBlock = await getBlockNumber();
      const endBlock = _.add(startBlock, 518400);
      await expect(
        addCohortDetails(registry, COHORT_ID, alice, {
          cohortVersion: version,
          startBlock,
          endBlock,
          epochBlocks: roundValue(endBlock / 10000, 0),
          hasLiquidityMining: false,
          hasContainsWrappedToken: false,
          hasCohortLockinAvaliable: false,
        })
      ).to.be.revertedWith('ONA');
    });

    it('cohort id should not be zero address', async () => {
      const startBlock = await getBlockNumber();
      const endBlock = _.add(startBlock, 518400);
      await expect(
        addCohortDetails(registry, ZERO_ADDRESS, owner, {
          cohortVersion: version,
          startBlock,
          endBlock,
          epochBlocks: roundValue(endBlock / 10000, 0),
          hasLiquidityMining: false,
          hasContainsWrappedToken: false,
          hasCohortLockinAvaliable: false,
        })
      ).to.be.revertedWith('ICI');
    });

    it('endBlock should be greater than startBlock', async () => {
      const startBlock = await getBlockNumber();
      const endBlock = 1;

      await expect(
        addCohortDetails(registry, COHORT_ID, owner, {
          cohortVersion: version,
          startBlock,
          endBlock,
          epochBlocks: roundValue(endBlock / 10000, 0),
          hasLiquidityMining: false,
          hasContainsWrappedToken: false,
          hasCohortLockinAvaliable: false,
        })
      ).to.be.revertedWith('IBR');
    });

    it('set cohort details', async () => {
      startBlock = await getBlockNumber();
      const endBlock = _.add(startBlock, 518400);

      await expect(
        addCohortDetails(registry, COHORT_ID, owner, {
          cohortVersion: version,
          startBlock,
          endBlock,
          epochBlocks: roundValue(endBlock / 10000, 0),
          hasLiquidityMining: false,
          hasContainsWrappedToken: false,
          hasCohortLockinAvaliable: false,
        })
      )
        .to.emit(registry, 'AddedCohortDetails')
        .withArgs(COHORT_ID, version, startBlock, endBlock, roundValue(endBlock / 10000, 0), false, false, false);
    });
  });

  describe('#setTokenMetaData', () => {
    it('non owner access not able to set token metadata', async () => {
      await expect(
        addTokenMetaData(registry, COHORT_ID, alice, {
          fid: 1,
          farmToken: ORO.address,
          userMinStake: ethers.utils.parseUnits('0.001', 'ether'),
          userMaxStake: ethers.utils.parseUnits('100', 'ether'),
          totalStakeLimit: ethers.utils.parseUnits('1000', 'ether'),
          decimals: 18,
          skip: false,
        })
      ).to.be.revertedWith('ONA');
    });

    it('farm token should not be zero address', async () => {
      await expect(
        addTokenMetaData(registry, COHORT_ID, owner, {
          fid: 1,
          farmToken: ZERO_ADDRESS,
          userMinStake: ethers.utils.parseUnits('0.001', 'ether'),
          userMaxStake: ethers.utils.parseUnits('100', 'ether'),
          totalStakeLimit: ethers.utils.parseUnits('1000', 'ether'),
          decimals: 18,
          skip: false,
        })
      ).to.be.revertedWith('IFT');
    });

    it('user max stake should be greater than zero', async () => {
      await expect(
        addTokenMetaData(registry, COHORT_ID, owner, {
          fid: 1,
          farmToken: ORO.address,
          userMinStake: ethers.utils.parseUnits('0.001', 'ether'),
          userMaxStake: ethers.utils.parseUnits('0', 'ether'),
          totalStakeLimit: ethers.utils.parseUnits('1000', 'ether'),
          decimals: 18,
          skip: false,
        })
      ).to.be.revertedWith('IC');
    });

    it('total max stake should be greater than zero', async () => {
      await expect(
        addTokenMetaData(registry, COHORT_ID, owner, {
          fid: 1,
          farmToken: ORO.address,
          userMinStake: ethers.utils.parseUnits('0.001', 'ether'),
          userMaxStake: ethers.utils.parseUnits('100', 'ether'),
          totalStakeLimit: ethers.utils.parseUnits('0', 'ether'),
          decimals: 18,
          skip: false,
        })
      ).to.be.revertedWith('IC');
    });

    it('total max stake should be greater than user max stake', async () => {
      await expect(
        addTokenMetaData(registry, COHORT_ID, owner, {
          fid: 1,
          farmToken: ORO.address,
          userMinStake: ethers.utils.parseUnits('0.001', 'ether'),
          userMaxStake: ethers.utils.parseUnits('100', 'ether'),
          totalStakeLimit: ethers.utils.parseUnits('90', 'ether'),
          decimals: 18,
          skip: false,
        })
      ).to.be.revertedWith('IC');
    });

    it('set the token metadata', async () => {
      await expect(
        addTokenMetaData(registry, COHORT_ID, owner, {
          fid: 1,
          farmToken: UFARM.address,
          userMinStake: ethers.utils.parseUnits('0.001', 'ether'),
          userMaxStake: ethers.utils.parseUnits('100', 'ether'),
          totalStakeLimit: ethers.utils.parseUnits('10000', 'ether'),
          decimals: 18,
          skip: false,
        })
      )
        .to.emit(registry, 'TokenMetaDataDetails')
        .withArgs(
          COHORT_ID,
          UFARM.address,
          1,
          ethers.utils.parseUnits('0.001', 'ether'),
          ethers.utils.parseUnits('100', 'ether'),
          ethers.utils.parseUnits('10000', 'ether'),
          18,
          false
        );
    });
  });

  describe('#addBoosterPackage', () => {
    const boosterPackAmount = unitParser('500');
    it('add booster pack ONA', async () => {
      await expect(
        addBoosterPackage(registry, alice, {
          cohortId: COHORT_ID,
          paymentToken: UFARM.address,
          bpid: 1,
          boosterVault: owner.address,
          boosterPackAmount,
        })
      ).to.be.revertedWith('ONA');
    });
    it('owner add the booster pack', async () => {
      await expect(
        addBoosterPackage(registry, owner, {
          cohortId: COHORT_ID,
          paymentToken: UFARM.address,
          bpid: 1,
          boosterVault: owner.address,
          boosterPackAmount,
        })
      )
        .to.be.emit(registry, 'BoosterDetails')
        .withArgs(COHORT_ID, 1, UFARM.address, boosterPackAmount);
    });
  });

  describe('#setWholeCohortLock', () => {
    it('non owner access can be failed', async () => {
      await expect(registry.connect(alice).setWholeCohortLock(COHORT_ID, true)).to.be.revertedWith('ONA');
    });
    it("owner can't able to set locking for zero cohort address", async () => {
      await expect(registry.connect(owner).setWholeCohortLock(ZERO_ADDRESS, true)).to.be.revertedWith('ICI');
    });

    it('set the wholeCohortLock', async () => {
      await registry.connect(owner).setWholeCohortLock(COHORT_ID, true);
    });

    it('validating lock status on each action STAKE/UNSTAKE', async () => {
      await expect(registry.validateStakeLock(COHORT_ID, 0)).to.be.revertedWith('LC');
      await expect(registry.validateUnStakeLock(COHORT_ID, 0)).to.be.revertedWith('LC');
    });

    it('reset lock settings', async () => {
      await registry.connect(owner).setWholeCohortLock(COHORT_ID, false);
    });
  });

  describe('#setCohortLockStatus', () => {
    const STAKE_ACTION_BYTE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('STAKE')).slice(0, 10);
    it('non owner access can be failed', async () => {
      await expect(registry.connect(alice).setCohortLockStatus(COHORT_ID, STAKE_ACTION_BYTE, true)).to.be.revertedWith('ONA');
    });
    it('owner not able to set locking for zero cohort address', async () => {
      await expect(registry.connect(owner).setCohortLockStatus(ZERO_ADDRESS, STAKE_ACTION_BYTE, true)).to.be.revertedWith('ICI');
    });
    it('set the cohort specfic action', async () => {
      await registry.connect(owner).setCohortLockStatus(COHORT_ID, STAKE_ACTION_BYTE, true);
    });
    it('validating the stake lock', async () => {
      await expect(registry.validateStakeLock(COHORT_ID, 0)).to.be.revertedWith('LC');
    });
    it('unstake having no lock', async () => {
      await registry.validateUnStakeLock(COHORT_ID, 0);
    });
    it('reset lock settings', async () => {
      await registry.connect(owner).setCohortLockStatus(COHORT_ID, STAKE_ACTION_BYTE, false);
    });
  });

  describe('#setCohortTokenLockStatus', () => {
    const cohortSalt = ethers.utils.solidityKeccak256(['address', 'uint32'], [COHORT_ID, 1]);
    const UNSTAKE_ACTION_BYTE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('UNSTAKE')).slice(0, 10);
    it('non owner access can be failed', async () => {
      await expect(registry.connect(alice).setCohortTokenLockStatus(cohortSalt, UNSTAKE_ACTION_BYTE, true)).to.be.revertedWith('ONA');
    });
    it('set the cohort specfic action', async () => {
      await registry.connect(owner).setCohortTokenLockStatus(cohortSalt, UNSTAKE_ACTION_BYTE, true);
    });
    it('unstake having no lock', async () => {
      await expect(registry.validateUnStakeLock(COHORT_ID, 1)).to.be.revertedWith('LC');
    });
    it('validating the stake lock', async () => {
      await registry.validateStakeLock(COHORT_ID, 1);
    });
  });

  describe('#updateMulticall', () => {
    it('non owner access not able to update multiCall Address', async () => {
      await expect(registry.connect(alice).updateMulticall(DEAD_ADDRESS)).to.be.revertedWith('ONA');
    });
    it('multicall address should be different', async () => {
      await expect(registry.connect(owner).updateMulticall(multicall.address)).to.be.revertedWith('SMA');
    });
    it('update multicall', async () => {
      await registry.updateMulticall(DEAD_ADDRESS);
      const newMultiCall = await registry.multiCall();
      expect((newMultiCall as string).toLowerCase()).to.be.equal(DEAD_ADDRESS.toLowerCase());
    });
  });

  describe('#getCohort', () => {
    it('get cohort details', async () => {
      const [cohortVersion, sBlock, endBlock, epochBlocks, hasLiquidityMining, hasContainsWrappedToken, hasCohortLockinAvaliable] =
        await registry.getCohort(COHORT_ID);
      expect((cohortVersion as string).toLowerCase()).to.be.equal(version.toLowerCase());
      expect(sBlock).to.be.equal(startBlock);
      expect(endBlock).to.be.equal(_.add(startBlock, 518400));
      expect(epochBlocks).to.be.equal(roundValue(endBlock / 10000, 0));
      expect(hasLiquidityMining).to.be.false;
      expect(hasContainsWrappedToken).to.be.false;
      expect(hasCohortLockinAvaliable).to.be.false;
    });
  });

  describe('#getCohortToken', async () => {
    it('get cohort token details', async () => {
      const [fid, farmToken, userMinStake, userMaxStake, totalStakeLimit, decimals, skip] = await registry.getCohortToken(COHORT_ID, 1);
      expect(fid).to.be.equal(1);
      expect((farmToken as string).toLowerCase()).to.be.equal(UFARM.address.toLowerCase());
      expect(userMinStake).to.be.equal(ethers.utils.parseUnits('0.001', 'ether'));
      expect(userMaxStake).to.be.equal(ethers.utils.parseUnits('100', 'ether'));
      expect(totalStakeLimit).to.be.equal(ethers.utils.parseUnits('10000', 'ether'));
      expect(decimals).to.be.equal(18);
      expect(skip).to.be.false;
    });
  });

  describe('#getBoosterPackDetails', () => {
    it('get booster pack details', async () => {
      const [cohortId, paymentToken, boosterVault, boosterPackAmount] = await registry.getBoosterPackDetails(COHORT_ID, 1);
      expect((cohortId as string).toLowerCase()).to.be.equal(COHORT_ID.toLowerCase());
      expect((paymentToken as string).toLowerCase()).to.be.equal(UFARM.address.toLowerCase());
      expect((boosterVault as string).toLowerCase()).to.be.equal(owner.address.toLowerCase());
      expect(boosterPackAmount).to.be.equal(ethers.utils.parseUnits('500', 'ether'));
    });
  });

  describe('#transferOwnership', async () => {
    it('non owner access not able to transferOwnership', async () => {
      await expect(registry.connect(alice).transferOwnership(DEAD_ADDRESS)).to.be.revertedWith('ONA');
    });
    it('newAddress should not be zero address', async () => {
      await expect(registry.connect(owner).transferOwnership(ZERO_ADDRESS)).to.be.revertedWith('INA');
    });
    it('transfer the ownership to dead adddres', async () => {
      await expect(registry.connect(owner).transferOwnership(DEAD_ADDRESS))
        .to.be.emit(registry, 'OwnershipTransferred')
        .withArgs(owner.address, DEAD_ADDRESS);
    });
    it('check new owner', async () => {
      const factoryOwner = (await registry.owner()) as string;
      expect(factoryOwner.toLowerCase()).to.be.equal(DEAD_ADDRESS.toLowerCase());
    });
  });
});
