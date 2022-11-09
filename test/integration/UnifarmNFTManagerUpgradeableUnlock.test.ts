import { waffle, upgrades, ethers } from 'hardhat';
import chai, { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract } from 'ethers';
import { deploy, deployProxy } from '../../utilities/deploy';
import { getBlockNumber, getRewardCap, mineNBlocks, setRewardCap, unitFormatter, unitParser } from '../../utilities';
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

describe('UnifarmNFTManagerUpgradeableUnlock', () => {
  var mocks: Mock;

  let owner: SignerWithAddress;
  // staking participants
  let users: SignerWithAddress[];

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

  type NFT = { user: string; tokenId: number } | undefined;
  var nfts: NFT[] = [];
  var tokenId = 1;

  const feeAmount = unitParser('0.01');
  before('deploy all contracts', async () => {
    [owner, fee, referral, booster, masterWallet] = await ethers.getSigners();

    users = (await ethers.getSigners()).slice(6, 150);

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

    // set reward cap
    await setRewardCap(rewardRegistry, owner, cohort.address, {
      rewardTokenAddress: [mocks.ORO.address, mocks.BNF.address, mocks.RAZE.address, mocks.NETVRK.address, mocks.UFARM.address],
      rewardTokens: getRewardCap([124674, 3571427, 70200, 52767, 416145]),
    });
  });

  before('send tokens', async () => {
    // send all reward tokens to cohort contract
    await transferBatch(owner, Object.values(mocks), [124674, 3571427, 70200, 52767, 416145], rewardRegistry.address);
    // send tokens to user
    for (var i = 0; i < users.length; i++) {
      await transferBatch(owner, Object.values(mocks), [10000, 20000, 30000, 40000, 50000], users[i].address);
    }
  });

  describe('NFT mints and burns', () => {
    before('approval', async () => {
      const amount = ethers.constants.MaxUint256;
      await mocks.UFARM.connect(owner).approve(nftManager.address, amount);
      for (var a = 0; a < users.length; a++) {
        await mocks.UFARM.connect(users[a]).approve(nftManager.address, amount);
      }
    });

    before('setup cohort', async () => {
      // setup all configuration
      const blockNumber = await getBlockNumber();
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
              startBlock: blockNumber,
              endBlock: _.add(blockNumber, 300),
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
              {
                bpid: 2,
                cohortId: cohort.address,
                paymentToken: mocks.NETVRK.address,
                boosterVault: booster.address,
                boosterPackAmount: unitParser('0.01'),
              },
            ],
            rewardTokens: {
              rewardTokens: [mocks.ORO.address, mocks.BNF.address, mocks.RAZE.address, mocks.NETVRK.address, mocks.UFARM.address],
              pbr: getPerBlockReward([124674 / 5, 3571427 / 5, 70200 / 5, 52767 / 5, 416145 / 5], 300),
            },
          },
        },
        owner
      );
    });

    it('mint with out booster', async () => {
      const amount = unitParser(40000);
      for (var k = 0; k < users.slice(0, 16).length; k++) {
        nfts.push({ user: users[k].address, tokenId: tokenId++ });
        await nftManager.connect(users[k]).stakeOnUnifarm(cohort.address, ZERO_ADDRESS, mocks.UFARM.address, amount, 5);
      }
    });

    it('increase blocks', async () => {
      await mineNBlocks(120);
    });

    it('burn 10 nfts', async () => {
      for (var t = 0; t < 16; t++) {
        const user = nfts.filter((e) => String(e?.user).toLowerCase() === users[t].address.toLowerCase())[0];
        await nftManager.connect(users[t]).unstakeOnUnifarm(user?.tokenId, { value: feeAmount });
        nfts[t] = undefined;
      }
    });

    it('mint with booster pack', async () => {
      const amount = unitParser(39500);
      for (var q = 0; q < users.slice(0, 101).length; q++) {
        nfts.push({ user: users[q].address, tokenId: tokenId++ });
        await nftManager.connect(users[q]).stakeAndBuyBoosterPackOnUnifarm(cohort.address, ZERO_ADDRESS, mocks.UFARM.address, 1, amount, 5);
      }
    });

    it('try stake when farm already filled', async () => {
      const amount = unitParser(400000);
      await expect(nftManager.connect(owner).stakeOnUnifarm(cohort.address, ZERO_ADDRESS, mocks.UFARM.address, amount, 5)).to.be.revertedWith('TSLF');
    });

    it('mine 300 blocks', async () => {
      await mineNBlocks(300);
    });

    it('try to stake when farm closed', async () => {
      const amount = unitParser(30000);
      await expect(nftManager.connect(owner).stakeOnUnifarm(cohort.address, ZERO_ADDRESS, mocks.UFARM.address, amount, 5)).to.be.revertedWith('SC');
    });

    it('burn all nfts', async () => {
      for (var t = 0; t < 101; t++) {
        const user = nfts.filter((e) => String(e?.user).toLowerCase() === users[t].address.toLowerCase())[0];
        await nftManager.connect(users[t]).unstakeOnUnifarm(user?.tokenId, { value: feeAmount });
      }
    });
  });
});
