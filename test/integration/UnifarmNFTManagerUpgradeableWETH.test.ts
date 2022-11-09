import { waffle, upgrades, ethers } from 'hardhat';
import chai, { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, Contract } from 'ethers';
import { deploy, deployProxy } from '../../utilities/deploy';
import {
  addBoosterPackage,
  addCohortDetails,
  addTokenMetaData,
  getBlockNumber,
  getCheckpoint,
  getRewardCap,
  getRewards,
  mineNBlocks,
  roundValue,
  rValue,
  setRewardCap,
  setRewardTokenDetails,
  unitFormatter,
  unitParser,
} from '../../utilities';
import { setupAllConfigurationForCohort } from '../helpers/setup';
import _, { isError } from 'lodash';
import { getPerBlockReward } from '../../utilities/reward';
import { transferBatch } from '../../utilities/multicall';
import { DEAD_ADDRESS, ZERO_ADDRESS } from '../constants';

chai.use(waffle.solidity);

interface Mock {
  ORO: Contract;
  BNF: Contract;
  RAZE: Contract;
  NETVRK: Contract;
  UFARM: Contract;
}

describe('UnifarmNFTManagerUpgradeableWETH', () => {
  var mocks: Mock;

  /// users
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let john: SignerWithAddress;

  /// protocol addresses
  let fee: SignerWithAddress;
  let referral: SignerWithAddress;
  let booster: SignerWithAddress;
  let masterWallet: SignerWithAddress;

  /// contracts
  let rewardRegistry: Contract;
  let registry: Contract;
  let descriptor: Contract;
  let nftManager: Contract;
  var cohort: Contract;
  let multicall: Contract;
  let factory: Contract;

  // reward tokens
  let WETH: Contract;
  let CHK: Contract;

  const feeAmount = unitParser('0.02');
  var startBlock: number;

  let NEW_ORO: Contract;
  var aliceStakedBlock: number;

  before('deploy all contracts', async () => {
    [owner, fee, referral, booster, masterWallet, alice, bob, john] = await ethers.getSigners();

    // deploy multicall
    multicall = await deploy('Multicall2', [masterWallet.address]);

    // deploy registry contract
    registry = await deployProxy('UnifarmCohortRegistryUpgradeable', '__UnifarmCohortRegistryUpgradeable_init', [
      masterWallet.address,
      DEAD_ADDRESS,
      multicall.address,
    ]);

    /// reward tokens
    WETH = await deploy('WETH9', []);
    CHK = await deploy('MockERC20', ['CHk', 'CHk', unitParser(124674), 18]);

    // deploy the NFT descriptor
    descriptor = await deployProxy('UnifarmNFTDescriptorUpgradeable', '__UnifarmNFTDescriptorUpgradeable_init', [registry.address]);

    // deploy unifarm factory contract
    factory = await deployProxy('UnifarmCohortFactoryUpgradeable', '__UnifarmCohortFactoryUpgradeable_init', []);

    // deploy the unifarm nft manager
    nftManager = await deployProxy('UnifarmNFTManagerUpgradeable', '__UnifarmNFTManagerUpgradeable_init', [
      fee.address,
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
    const supply = unitParser(50000000000);

    const ORO = await deploy('MockERC20', ['ORO Pocket', 'ORO', supply, 18]);
    const BNF = await deploy('MockERC20', ['Bonfi', 'BNF', supply, 18]);
    const RAZE = await deploy('MockERC20', ['Raze Network', 'RAZE', supply, 18]);
    const NETVRK = await deploy('MockERC20', ['Netvrk', 'NETVRK', supply, 18]);
    const UFARM = await deploy('MockERC20', ['Unifarm', 'UFARM', supply, 18]);

    mocks = {
      ORO,
      BNF,
      RAZE,
      NETVRK,
      UFARM,
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
            cohortVersion: 'V35',
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
              farmToken: mocks.ORO.address,
              userMinStake: unitParser(0.01),
              userMaxStake: unitParser(125000),
              totalStakeLimit: unitParser(1250000),
              decimals: 18,
              skip: false,
            },
            {
              fid: 2,
              farmToken: mocks.BNF.address,
              userMinStake: unitParser(0.01),
              userMaxStake: unitParser(3600000),
              totalStakeLimit: unitParser(36000000),
              decimals: 18,
              skip: false,
            },
            {
              fid: 3,
              farmToken: mocks.RAZE.address,
              userMinStake: unitParser(0.01),
              userMaxStake: unitParser(70000),
              totalStakeLimit: unitParser(700000),
              decimals: 18,
              skip: false,
            },
            {
              fid: 4,
              farmToken: mocks.NETVRK.address,
              userMinStake: unitParser(0.01),
              userMaxStake: unitParser(53000),
              totalStakeLimit: unitParser(530000),
              decimals: 18,
              skip: false,
            },
            {
              fid: 5,
              farmToken: mocks.UFARM.address,
              userMinStake: unitParser(0.01),
              userMaxStake: unitParser(400000),
              totalStakeLimit: unitParser(4000000),
              decimals: 18,
              skip: false,
            },
          ],
          boosterInfo: [
            {
              bpid: 1,
              cohortId: cohort.address,
              paymentToken: mocks.UFARM.address,
              boosterVault: booster.address,
              boosterPackAmount: unitParser('500'),
            },
          ],
          rewardTokens: {
            rewardTokens: [WETH.address, CHK.address],
            pbr: getPerBlockReward([3 / 5, 124674 / 5], 300),
          },
        },
      },
      owner
    );
    // set reward cap
    await setRewardCap(rewardRegistry, owner, cohort.address, {
      rewardTokenAddress: [WETH.address, CHK.address],
      rewardTokens: getRewardCap([3, 124674]),
    });
  });

  before('send tokens', async () => {
    // send all reward tokens to cohort contract
    await WETH.connect(owner).deposit({ value: unitParser(3) });
    await transferBatch(owner, [WETH, CHK], [3, 124674], rewardRegistry.address);
    // send tokens to user
    await transferBatch(owner, Object.values(mocks), [2000, 2000, 3000, 0, 5000], alice.address);
    // send tokens to bob
    await transferBatch(owner, Object.values(mocks), [1000, 2000, 3000, 4000, 5000], bob.address);
    // send tokens to john as well
    await transferBatch(owner, Object.values(mocks), [1000, 2000, 3000, 4000, 5000], john.address);
  });

  describe('alice #mint 1 and buy booster', () => {
    it('do approvals', async () => {
      const amount = ethers.constants.MaxUint256;
      await mocks.ORO.connect(alice).approve(nftManager.address, amount);
      await mocks.UFARM.connect(alice).approve(nftManager.address, amount);
      await mocks.RAZE.connect(bob).approve(nftManager.address, amount);
      await mocks.RAZE.connect(john).approve(nftManager.address, amount);
      await mocks.NETVRK.connect(bob).approve(nftManager.address, amount);
      await mocks.ORO.connect(bob).approve(nftManager.address, amount);
    });
    it('mint', async () => {
      const amount = unitParser('1000');
      aliceStakedBlock = await getBlockNumber();
      await nftManager.connect(alice).stakeOnUnifarm(cohort.address, referral.address, mocks.ORO.address, amount, 1);
    });
    it('john mint #2', async () => {
      const amount = unitParser('3000');
      await nftManager.connect(john).stakeOnUnifarm(cohort.address, ZERO_ADDRESS, mocks.RAZE.address, amount, 3);
    });

    it('owner can boost this tokenId', async () => {
      await expect(cohort.connect(alice).buyBooster(john.address, 1, 2)).to.be.revertedWith('IS');
      await expect(cohort.connect(owner).buyBooster(john.address, 1, 2)).to.be.emit(cohort, 'BoosterBuyHistory').withArgs(2, john.address, 1);
    });
    it('owner change the booster', async () => {
      await addBoosterPackage(registry, owner, {
        bpid: 1,
        cohortId: cohort.address,
        paymentToken: ZERO_ADDRESS,
        boosterVault: owner.address,
        boosterPackAmount: unitParser(0.00001),
      });
    });
    it('now alice wants to buy booster pack but unfortunately booster disabled', async () => {
      await expect(nftManager.connect(alice).buyBoosterPackOnUnifarm(cohort.address, 1, 1)).to.be.revertedWith('BNF');
    });
    it('after 20 blocks owner decided to change the booster pack', async () => {
      await mineNBlocks(20);
      await addBoosterPackage(registry, owner, {
        bpid: 1,
        cohortId: cohort.address,
        paymentToken: mocks.ORO.address,
        boosterVault: owner.address,
        boosterPackAmount: unitParser(500),
      });
    });
    it('now alice wants to buy booster with ORO', async () => {
      await expect(nftManager.connect(alice).buyBoosterPackOnUnifarm(cohort.address, 1, 1))
        .to.be.emit(cohort, 'BoosterBuyHistory')
        .withArgs(1, alice.address, 1);
    });
  });
  describe('now a token hacked called ORO', () => {
    before('deploy new ORO', async () => {
      NEW_ORO = await deploy('MockERC20', ['NEW ORO', 'NORO', unitParser(10000000), 18]);
      await NEW_ORO.connect(bob).approve(nftManager.address, unitParser(1000));
    });
    it('new ORO transfer to bob and cohort', async () => {
      await NEW_ORO.connect(owner).transfer(bob.address, unitParser(1000));
      await NEW_ORO.connect(owner).transfer(cohort.address, unitParser(1000));
    });
    it('after ORO hack owner decided to change ORO token', async () => {
      await addTokenMetaData(registry, cohort.address, owner, {
        fid: 1,
        farmToken: NEW_ORO.address,
        userMinStake: unitParser(0.01),
        userMaxStake: unitParser(125000),
        totalStakeLimit: unitParser(1250000),
        decimals: 18,
        skip: false,
      });
    });
    it('stakeAndBuyBoosterPackOnUnifarm #3 new ORO', async () => {
      const amount = unitParser('1000');
      await nftManager.connect(bob).stakeAndBuyBoosterPackOnUnifarm(cohort.address, ZERO_ADDRESS, NEW_ORO.address, 1, amount, 1);
    });
    it('check total staking for fid #1', async () => {
      const totalStaking = await cohort.totalStaking(1);
      expect(totalStaking).to.be.equal(unitParser(2000));
    });
    it('check prior EPOCH tvl', async () => {
      const priorEpochATVL = await cohort.priorEpochATVL(1, 0);
      expect(priorEpochATVL).to.be.equal(unitParser(2000));
    });
  });
  describe('cohort ownable features', () => {
    it('owner can disable bob booster', async () => {
      await cohort.connect(owner).disableBooster(3);
    });
    it('owner can set his portion to 200 tokens', async () => {
      await cohort.connect(owner).setPortionAmount(3, unitParser(200));
    });
    it('check his stakes', async () => {
      const [, , stakedAmount, , , , , isBooster] = await cohort.viewStakingDetails(3);
      expect(stakedAmount).to.be.equal(unitParser(200));
      expect(isBooster).to.be.false;
    });
  });
  describe('owner can skip stake token and reward token both', async () => {
    it('owner skip the stake token', async () => {
      await addTokenMetaData(registry, cohort.address, owner, {
        fid: 1,
        farmToken: NEW_ORO.address,
        userMinStake: unitParser(0.01),
        userMaxStake: unitParser(125000),
        totalStakeLimit: unitParser(1250000),
        decimals: 18,
        skip: true,
      });
    });
    it('now bob wants to burn', async () => {
      await mineNBlocks(100);
      await nftManager.connect(bob).unstakeOnUnifarm(3, {
        value: feeAmount,
      });
    });
    it('check bob new ORO balance', async () => {
      const newOroBalance = await NEW_ORO.balanceOf(bob.address);
      expect(newOroBalance).to.be.equal(0);
    });
  });
  describe('#emergencyBurn', async () => {
    it('non owner cannot able to call', async () => {
      await expect(nftManager.connect(alice).emergencyBurn(john.address, 2)).to.be.revertedWith('ONA');
    });
    it('user can be owner of that tokenId', async () => {
      await expect(nftManager.connect(owner).emergencyBurn(john.address, 1)).to.be.revertedWith('INO');
    });
    it('invalid tokenId', async () => {
      await expect(nftManager.connect(owner).emergencyBurn(john.address, 100)).to.be.revertedWith('ERC721: owner query for nonexistent token');
    });
    it('enable cohort locking', async () => {
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
    it('john fail to burn on lock cohort', async () => {
      await expect(nftManager.connect(john).unstakeOnUnifarm(2, { value: feeAmount })).to.be.revertedWith('CIL');
    });
    it('pause all cohort', async () => {
      await registry.connect(owner).setWholeCohortLock(cohort.address, true);
    });
    it('john fail to burn on lock cohort', async () => {
      await expect(nftManager.connect(john).unstakeOnUnifarm(2, { value: feeAmount })).to.be.revertedWith('LC');
    });
    it('now emergency burn', async () => {
      await expect(nftManager.connect(owner).emergencyBurn(john.address, 2)).to.be.emit(cohort, 'Claim');
      await registry.connect(owner).setWholeCohortLock(cohort.address, false);
    });
  });
  describe('admin can change the reward tokens as well', () => {
    before('change reward token', async () => {
      await setRewardTokenDetails(rewardRegistry, owner, cohort.address, {
        rewardTokens: [WETH.address, mocks.NETVRK.address],
        pbr: getPerBlockReward([3 / 5, 124674 / 5], 300),
      });
      await setRewardCap(rewardRegistry, owner, cohort.address, {
        rewardTokenAddress: [WETH.address, mocks.NETVRK.address],
        rewardTokens: getRewardCap([3, 124674]),
      });
      await mocks.NETVRK.connect(owner).transfer(rewardRegistry.address, unitParser(124674));
    });
    it('owner enable the stake token', async () => {
      await addTokenMetaData(registry, cohort.address, owner, {
        fid: 1,
        farmToken: NEW_ORO.address,
        userMinStake: unitParser(0.01),
        userMaxStake: unitParser(125000),
        totalStakeLimit: unitParser(1250000),
        decimals: 18,
        skip: false,
      });
    });
    it('alice wants to burn #1', async () => {
      await mineNBlocks(300);
      await nftManager.connect(alice).unstakeOnUnifarm(1, {
        value: feeAmount,
      });
    });
    it('reward calculation', async () => {
      const [, , , stakedBlock, , , ,] = await cohort.viewStakingDetails(1);
      const se = 0;
      const ee = 3;
      const r = rValue(
        se,
        ee,
        [2000, 1800, 0],
        {
          stakedAmount: 1000,
          userStakedBlock: stakedBlock - startBlock,
          totalStakeLimit: 1250000,
          epochBlocks: 100,
          totalStaking: 1800,
        },
        true
      );
      const rewardsEarned = getRewards(r, [3 / 1500, 124674 / 1500]);
      var userEarned: number[] = [];
      var refEarned: number[] = [];
      for (var e = 0; e < rewardsEarned.length; e++) {
        const ref = _.multiply(rewardsEarned[e], 0.5) / 100;
        refEarned.push(ref);
        userEarned.push(rewardsEarned[e] - ref);
      }
      const userWethBal = await WETH.balanceOf(alice.address);
      const userNeTVrkBalance = await mocks.NETVRK.balanceOf(alice.address);

      // referral balances
      const refWethBal = await WETH.balanceOf(referral.address);
      const refNeTVrkBalance = await mocks.NETVRK.balanceOf(referral.address);

      expect(roundValue(unitFormatter(userWethBal), 4)).to.be.equal(roundValue(userEarned[0], 4));
      expect(roundValue(unitFormatter(userNeTVrkBalance), 4)).to.be.equal(roundValue(userEarned[1], 4));
      expect(roundValue(unitFormatter(refWethBal), 4)).to.be.equal(roundValue(refEarned[0], 4));
      expect(roundValue(unitFormatter(refNeTVrkBalance), 4)).to.be.equal(roundValue(refEarned[1], 4));
    });
  });
});
