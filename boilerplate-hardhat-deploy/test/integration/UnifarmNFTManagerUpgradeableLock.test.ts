import { waffle, upgrades, ethers } from 'hardhat';
import chai, { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract } from 'ethers';
import { deploy, deployProxy } from '../../utilities/deploy';
import { addCohortDetails, getBlockNumber, getRewardCap, mineNBlocks, setRewardCap, unitParser } from '../../utilities';
import { setupAllConfigurationForCohort } from '../helpers/setup';
import _ from 'lodash';
import { getPerBlockReward } from '../../utilities/reward';
import { transferBatch } from '../../utilities/multicall';
import { DEAD_ADDRESS, ZERO_ADDRESS } from '../constants';

chai.use(waffle.solidity);

interface Mock {
  UFARM: Contract;
  RAZOR: Contract;
  STACK: Contract;
  NETVRK: Contract;
  TBC: Contract;
}

describe('UnifarmNFTManagerUpgradeableLock', () => {
  var mocks: Mock;

  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let lee: SignerWithAddress;

  /// protocol wallets
  let feeWallet: SignerWithAddress;
  let protocolReferralWallet: SignerWithAddress;
  let boosterWallet: SignerWithAddress;
  let masterWallet: SignerWithAddress;

  // contracts
  let rewardRegistry: Contract;
  let registry: Contract;
  let descriptor: Contract;
  let nftManager: Contract;
  var cohort: Contract;
  let multicall: Contract;
  let factory: Contract;

  const feeAmount = unitParser('0.01');

  var startBlock: number;

  before('deploy all contracts', async () => {
    [owner, alice, bob, lee, masterWallet, feeWallet, protocolReferralWallet, boosterWallet] = await ethers.getSigners();

    // deploy multicall
    multicall = await deploy('Multicall2', [masterWallet.address]);

    // deploy registry contract
    registry = await deployProxy('UnifarmCohortRegistryUpgradeable', '__UnifarmCohortRegistryUpgradeable_init', [
      masterWallet.address,
      DEAD_ADDRESS,
      multicall.address,
    ]);

    // deploy the NFT descriptor
    descriptor = await deployProxy('UnifarmNFTDescriptorUpgradeable', '__UnifarmNFTDescriptorUpgradeable_init', [registry.address]);

    // deploy unifarm factory contract
    factory = await deployProxy('UnifarmCohortFactoryUpgradeable', '__UnifarmCohortFactoryUpgradeable_init', []);

    // deploy the unifarm nft manager
    nftManager = await deployProxy('UnifarmNFTManagerUpgradeable', '__UnifarmNFTManagerUpgradeable_init', [
      feeWallet.address,
      descriptor.address,
      factory.address,
      masterWallet.address,
      ZERO_ADDRESS,
      feeAmount,
    ]);

    rewardRegistry = await deployProxy('UnifarmRewardRegistryUpgradeable', '__UnifarmRewardRegistryUpgradeable_init', [
      masterWallet.address,
      ZERO_ADDRESS,
      multicall.address,
      _.multiply(0.5, 1000),
    ]);

    const salt = ethers.utils.solidityKeccak256(['string'], ['V35']);
    await factory.connect(owner).createUnifarmCohort(salt);

    const cohortId = await factory.cohorts(0);
    cohort = await ethers.getContractAt('UnifarmCohort', cohortId);

    // deploy all the tokens
    const supply = unitParser(5000000);

    const UFARM = await deploy('MockERC20', ['Unifarm', 'UFARM', supply, 18]);
    const RAZOR = await deploy('MockERC20', ['RAZOR Network', 'RAZOR', supply, 18]);
    const STACK = await deploy('MockERC20', ['Stack Os', 'STACK', supply, 18]);
    const NETVRK = await deploy('MockERC20', ['Netvrk', 'NETVRK', supply, 18]);
    const TBC = await deploy('MockERC20', ['Terablock', 'TBC', supply, 18]);

    mocks = {
      UFARM,
      RAZOR,
      STACK,
      NETVRK,
      TBC,
    };

    await factory.connect(owner).setStorageContracts(registry.address, nftManager.address, rewardRegistry.address);
    // setup all configuration
    startBlock = await getBlockNumber();
    /// this function setup all things
    /// we define 22500 dollors for each farm
    await setupAllConfigurationForCohort(
      {
        registry,
        multicall,
        rewardRegistry,
        configuration: {
          cohortId: cohort.address,
          cohortDetails: {
            cohortVersion: 'YF/V35',
            startBlock: startBlock,
            endBlock: _.add(startBlock, 300),
            epochBlocks: 300 / 3,
            hasLiquidityMining: false,
            hasContainsWrappedToken: false,
            hasCohortLockinAvaliable: false,
          },
          tokenMetaData: [
            {
              fid: 1,
              farmToken: UFARM.address,
              userMinStake: unitParser(0.01),
              userMaxStake: unitParser(450000),
              totalStakeLimit: unitParser(4500000),
              decimals: 18,
              skip: false,
            },
            {
              fid: 2,
              farmToken: RAZOR.address,
              userMinStake: unitParser(0.01),
              userMaxStake: unitParser(225000),
              totalStakeLimit: unitParser(2250000),
              decimals: 18,
              skip: false,
            },
            {
              fid: 3,
              farmToken: STACK.address,
              userMinStake: unitParser(0.01),
              userMaxStake: unitParser(480000),
              totalStakeLimit: unitParser(4800000),
              decimals: 18,
              skip: false,
            },
            {
              fid: 4,
              farmToken: NETVRK.address,
              userMinStake: unitParser(0.01),
              userMaxStake: unitParser(57000),
              totalStakeLimit: unitParser(570000),
              decimals: 18,
              skip: false,
            },
            {
              fid: 5,
              farmToken: TBC.address,
              userMinStake: unitParser(0.01),
              userMaxStake: unitParser(320000),
              totalStakeLimit: unitParser(3200000),
              decimals: 18,
              skip: false,
            },
          ],
          boosterInfo: [
            {
              bpid: 1,
              cohortId: cohort.address,
              paymentToken: UFARM.address,
              boosterVault: boosterWallet.address,
              boosterPackAmount: unitParser('500'),
            },
            {
              bpid: 2,
              cohortId: cohort.address,
              paymentToken: NETVRK.address,
              boosterVault: boosterWallet.address,
              boosterPackAmount: unitParser('5'),
            },
          ],
          rewardTokens: {
            rewardTokens: [UFARM.address, RAZOR.address, STACK.address, NETVRK.address, TBC.address],
            pbr: getPerBlockReward([451971 / 5, 225000 / 5, 487163 / 5, 57015 / 5, 321429 / 5], 300),
          },
        },
      },
      owner
    );

    // set reward cap
    await setRewardCap(rewardRegistry, owner, cohort.address, {
      rewardTokenAddress: [UFARM.address, RAZOR.address, STACK.address, NETVRK.address, TBC.address],
      rewardTokens: getRewardCap([451971, 225000, 487163, 57015, 321429]),
    });
  });

  before('send tokens', async () => {
    // send all reward tokens to cohort contract
    await transferBatch(owner, Object.values(mocks), [451971, 225000, 487163, 57015, 321429], rewardRegistry.address);
    // send tokens to alice as well
    await transferBatch(owner, Object.values(mocks), [10000, 2000, 3000, 4000, 5000], alice.address);
    // transfer some tokens to bob address
    await transferBatch(owner, Object.values(mocks), [10000, 20000, 30000, 40000, 50000], bob.address);
    // transfer some token to lee address
    await transferBatch(owner, Object.values(mocks), [10000, 20000, 30000, 40000, 50000], lee.address);
  });

  describe('stakeOnUnifarm on lock', () => {
    const STAKE_ACTION_BYTE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('STAKE')).slice(0, 10);
    before('all approval', async () => {
      const amount = ethers.constants.MaxUint256;
      await mocks.UFARM.connect(alice).approve(nftManager.address, amount);
      await mocks.TBC.connect(lee).approve(nftManager.address, amount);
    });

    it('lock the whole cohort', async () => {
      await registry.connect(owner).setWholeCohortLock(cohort.address, true);
    });

    it('try to stakeOnUnifarm', async () => {
      const amount = unitParser(499.8887755);
      await expect(nftManager.connect(alice).stakeOnUnifarm(cohort.address, ZERO_ADDRESS, mocks.UFARM.address, amount, 1)).to.be.revertedWith('LC');
      await registry.connect(owner).setWholeCohortLock(cohort.address, false);
    });

    it('lock the specifc cohort action', async () => {
      await registry.connect(owner).setCohortLockStatus(cohort.address, STAKE_ACTION_BYTE, true);
    });

    it('try to stakeOnUnifarm again', async () => {
      const amount = unitParser(499.8887755);
      await expect(nftManager.connect(alice).stakeOnUnifarm(cohort.address, ZERO_ADDRESS, mocks.UFARM.address, amount, 1)).to.be.revertedWith('LC');
      await registry.connect(owner).setCohortLockStatus(cohort.address, STAKE_ACTION_BYTE, false);
    });

    it('lock the specfic farm token action', async () => {
      const salt = ethers.utils.solidityKeccak256(['address', 'uint32'], [cohort.address, 1]);
      await registry.connect(owner).setCohortTokenLockStatus(salt, STAKE_ACTION_BYTE, true);
    });

    it('try to stakeOnUnifarm again...  😃', async () => {
      const amount = unitParser(499.8887755);
      await expect(nftManager.connect(alice).stakeOnUnifarm(cohort.address, ZERO_ADDRESS, mocks.UFARM.address, amount, 1)).to.be.revertedWith('LC');
      const salt = ethers.utils.solidityKeccak256(['address', 'uint32'], [cohort.address, 1]);
      await registry.connect(owner).setCohortTokenLockStatus(salt, STAKE_ACTION_BYTE, false);
    });

    it('stakeOnUnifarm now', async () => {
      const amount = unitParser(499.8887755);
      await expect(nftManager.connect(alice).stakeOnUnifarm(cohort.address, ZERO_ADDRESS, mocks.UFARM.address, amount, 1))
        .to.be.emit(nftManager, 'Transfer')
        .withArgs(ZERO_ADDRESS, alice.address, 1)
        .to.be.emit(cohort, 'ReferedBy');
    });
    it('stakeOnUnifarm lee', async () => {
      const amount = unitParser(5000);
      await nftManager.connect(lee).stakeOnUnifarm(cohort.address, ZERO_ADDRESS, mocks.TBC.address, amount, 5);
    });
  });

  describe('unstakeOnUnifarm with lock', () => {
    const UNSTAKE_ACTION_BYTE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('UNSTAKE')).slice(0, 10);
    it('lock the whole cohort before unstakeOnUnifarm', async () => {
      await registry.connect(owner).setWholeCohortLock(cohort.address, true);
    });
    it('lee try to claimOnUnifarm', async () => {
      await expect(
        nftManager.connect(lee).claimOnUnifarm(2, {
          value: feeAmount,
        })
      ).to.be.revertedWith('LC');
    });
    it('try to call unstakeOnUnifarm now', async () => {
      await expect(
        nftManager.connect(alice).unstakeOnUnifarm(1, {
          value: feeAmount,
        })
      ).to.be.revertedWith('LC');
      await registry.connect(owner).setWholeCohortLock(cohort.address, false);
    });
    it('lock the specifc cohort action before unstakeOnUnifarm', async () => {
      await registry.connect(owner).setCohortLockStatus(cohort.address, UNSTAKE_ACTION_BYTE, true);
    });
    it('lee try to claimOnUnifarm... again', async () => {
      await expect(
        nftManager.connect(lee).claimOnUnifarm(2, {
          value: feeAmount,
        })
      ).to.be.revertedWith('LC');
    });

    it('try to call unstakeOnUnifarm again..', async () => {
      await expect(
        nftManager.connect(alice).unstakeOnUnifarm(1, {
          value: feeAmount,
        })
      ).to.be.revertedWith('LC');
      await registry.connect(owner).setCohortLockStatus(cohort.address, UNSTAKE_ACTION_BYTE, false);
    });

    it('lock the specfic farm token action before unstakeOnUnifarm', async () => {
      const salt = ethers.utils.solidityKeccak256(['address', 'uint32'], [cohort.address, 1]);
      await registry.connect(owner).setCohortTokenLockStatus(salt, UNSTAKE_ACTION_BYTE, true);
    });

    it('lock the TBC farm', async () => {
      const salt = ethers.utils.solidityKeccak256(['address', 'uint32'], [cohort.address, 5]);
      await registry.connect(owner).setCohortTokenLockStatus(salt, UNSTAKE_ACTION_BYTE, true);
    });

    it('lee try to claimOnUnifarm but reverted', async () => {
      await expect(
        nftManager.connect(lee).claimOnUnifarm(2, {
          value: feeAmount,
        })
      ).to.be.revertedWith('LC');
      const salt = ethers.utils.solidityKeccak256(['address', 'uint32'], [cohort.address, 5]);
      await registry.connect(owner).setCohortTokenLockStatus(salt, UNSTAKE_ACTION_BYTE, false);
    });

    it('unstakeOnUnifarm failed', async () => {
      await expect(
        nftManager.connect(alice).unstakeOnUnifarm(1, {
          value: feeAmount,
        })
      ).to.be.revertedWith('LC');
      const salt = ethers.utils.solidityKeccak256(['address', 'uint32'], [cohort.address, 1]);
      await registry.connect(owner).setCohortTokenLockStatus(salt, UNSTAKE_ACTION_BYTE, false);
    });

    it('lock the cohort', async () => {
      await addCohortDetails(registry, cohort.address, owner, {
        cohortVersion: 'V35',
        startBlock: startBlock,
        endBlock: _.add(startBlock, 300),
        epochBlocks: 300 / 3,
        hasLiquidityMining: false,
        hasContainsWrappedToken: false,
        hasCohortLockinAvaliable: true,
      });
    });

    it('call unstakeOnUnifarm on lockin available', async () => {
      await expect(
        nftManager.connect(alice).unstakeOnUnifarm(1, {
          value: feeAmount,
        })
      ).to.be.revertedWith('CIL');
    });

    it('lee call claimOnUnifarm rewards', async () => {
      await mineNBlocks(100);
      await expect(
        nftManager.connect(lee).claimOnUnifarm(2, {
          value: feeAmount,
        })
      ).to.be.emit(cohort, 'Claim');
    });

    it('mine 300 blocks', async () => {
      await mineNBlocks(300);
    });

    it('lee cannot able to claimOnUnifarm rewards after farm end', async () => {
      await expect(
        nftManager.connect(lee).claimOnUnifarm(2, {
          value: feeAmount,
        })
      ).to.be.revertedWith('FNA');
    });

    it('alice unstakeOnUnifarm #1', async () => {
      await expect(
        nftManager.connect(alice).unstakeOnUnifarm(1, {
          value: feeAmount,
        })
      ).to.be.emit(cohort, 'Claim');
    });
  });
});
