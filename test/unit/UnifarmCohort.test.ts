import { ethers, waffle } from 'hardhat';
import chai, { expect } from 'chai';
import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deploy, deployProxy } from '../../utilities/deploy';
import { getBlockNumber, setRewardCap, getRewardCap, unitParser, unitFormatter } from '../../utilities';
import { setupAllConfigurationForCohort } from '../helpers/setup';
import { DEAD_ADDRESS } from '../constants';
import _ from 'lodash';
import { formatEther, parseUnits } from 'ethers/lib/utils';
import { ZERO_ADDRESS } from '../constants';
import { getPerBlockReward } from '../../utilities/reward';
import { transferBatch } from '../../utilities/multicall';

chai.use(waffle.solidity);

interface MockStakeToken {
  UFARM: Contract;
  RAZOR: Contract;
  STACK: Contract;
  NETVRK: Contract;
  TBC: Contract;
}

describe('UnifarmCohort', () => {
  var mocks: MockStakeToken;

  let cohort: Contract;
  let factory: Contract;
  let multicall: Contract;
  let registry: Contract;
  let cohortTest: Contract;
  let nftManager: Contract;
  let descriptor: Contract;
  let rewardRegistry: Contract;

  // wallets
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let user: SignerWithAddress;
  let referral: SignerWithAddress;
  // let nftManager: SignerWithAddress;

  const feeAmount = unitParser('0.01');
  before('deploy', async () => {
    const [ownerWallet, aliceWallet, bobWallet, userWallet, feeWallet, masterWallet, defaultreferralWallet, boosterWallet] =
      await ethers.getSigners();

    owner = ownerWallet;
    alice = aliceWallet;
    referral = defaultreferralWallet;
    user = userWallet;
    bob = bobWallet;

    factory = await deployProxy('UnifarmCohortFactoryUpgradeable', '__UnifarmCohortFactoryUpgradeable_init', []);

    cohort = await deploy('UnifarmCohort', [factory.address]);
    cohortTest = await deploy('UnifarmCohortTest', [factory.address]);

    const version = ethers.utils.keccak256(ethers.utils.hexlify(35));
    const startBlock = await getBlockNumber();
    const endBlock = _.add(startBlock, 518400);

    multicall = await deploy('Multicall2', [masterWallet.address]);

    // deploy two mock token as well
    const supply = ethers.utils.parseUnits('50000000000', 'ether');

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

    // deploy registry contract
    registry = await deployProxy('UnifarmCohortRegistryUpgradeable', '__UnifarmCohortRegistryUpgradeable_init', [
      masterWallet.address,
      DEAD_ADDRESS,
      multicall.address,
    ]);

    // deploy the NFT descriptor
    descriptor = await deployProxy('UnifarmNFTDescriptorUpgradeable', '__UnifarmNFTDescriptorUpgradeable_init', [registry.address]);

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

    // set factory state
    await factory.connect(owner).setStorageContracts(registry.address, nftManager.address, rewardRegistry.address);

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
              cohortId: cohort.address,
              paymentToken: UFARM.address,
              bpid: 1,
              boosterVault: boosterWallet.address,
              boosterPackAmount: unitParser('500'),
            },
            {
              cohortId: cohort.address,
              paymentToken: NETVRK.address,
              bpid: 2,
              boosterVault: boosterWallet.address,
              boosterPackAmount: unitParser('2'),
            },
          ],
          rewardTokens: {
            rewardTokens: [UFARM.address, RAZOR.address, STACK.address, NETVRK.address, TBC.address],
            pbr: getPerBlockReward([451971, 225000, 487163, 57015, 321429], 300),
          },
        },
      },
      owner
    );

    // for unifarmCohort_test
    await setupAllConfigurationForCohort(
      {
        registry,
        multicall,
        rewardRegistry,
        configuration: {
          cohortId: cohortTest.address,
          cohortDetails: {
            cohortVersion: 'V35',
            startBlock: blockNumber,
            endBlock: _.add(blockNumber, 300),
            epochBlocks: 300 / 3,
            hasLiquidityMining: false,
            hasContainsWrappedToken: false,
            hasCohortLockinAvaliable: false,
          },
          tokenMetaData: [],
          boosterInfo: [],
          rewardTokens: {
            rewardTokens: [UFARM.address, RAZOR.address, STACK.address, NETVRK.address, TBC.address],
            pbr: getPerBlockReward([451971, 225000, 487163, 57015, 321429], 300),
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
    // transfer ether to contract
    const tx = {
      to: cohort.address,
      value: ethers.utils.parseEther('2'),
    };

    await owner.sendTransaction(tx);

    // transfer tokens to alice
    await transferBatch(owner, Object.values(mocks), [10000, 2000, 3000, 4000, 5000], alice.address);
  });

  describe('read only functions', async () => {
    it('#factory', async () => {
      const cohortFactory = await cohortTest.factory();
      expect(cohortFactory).to.equal(factory.address);
    });

    it('#totalStaking', async () => {
      expect(await cohortTest.totalStaking(1)).to.equal(0);
    });

    it('#_onlyOwner', async () => {
      await expect(cohortTest.connect(alice)._onlyOwner()).to.revertedWith('ONA');
      await cohortTest.connect(owner)._onlyOwner();
    });
  });

  describe('#safeWithdrawEth', () => {
    it('non owner can not withdraw eth', async () => {
      await expect(cohort.connect(alice).safeWithdrawEth(owner.address, unitParser(1))).to.revertedWith('ONA');
    });

    it('factory owner can withdraw eth', async () => {
      expect(((await factory.owner()) as string).toLowerCase()).to.be.equal(owner.address.toLowerCase());
      await cohort.connect(owner).safeWithdrawEth(DEAD_ADDRESS, unitParser(1));

      const balance = await ethers.provider.getBalance(cohort.address);
      expect(unitFormatter(String(await ethers.provider.getBalance(DEAD_ADDRESS)))).to.equal(1);
      expect(unitFormatter(String(balance))).to.equal(1);
    });
  });

  describe('#safeWithdrawAll', () => {
    it('non owner can not withdraw all token', async () => {
      const amount = await unitParser(5000000);
      await expect(
        cohort.connect(alice).safeWithdrawAll(alice.address, [mocks.UFARM.address, mocks.STACK.address], [amount, amount])
      ).to.revertedWith('ONA');
    });

    it('invalid reciever address', async () => {
      const amount = await unitParser(5000000);
      await expect(cohort.connect(owner).safeWithdrawAll(ZERO_ADDRESS, [mocks.UFARM.address, mocks.STACK.address], [amount])).to.revertedWith('IWA');
    });

    it('invalid list of token and amount', async () => {
      const amount = await unitParser(5000000);
      await expect(cohort.connect(owner).safeWithdrawAll(alice.address, [mocks.UFARM.address, mocks.STACK.address], [amount])).to.revertedWith('SF');
    });

    it('factory owner can withdraw all token', async () => {
      // transfer tokens to contract
      await mocks.UFARM.connect(owner).transfer(cohort.address, unitParser(1000));
      await mocks.STACK.connect(owner).transfer(cohort.address, unitParser(1000));
      await cohort.connect(owner).safeWithdrawAll(alice.address, [mocks.UFARM.address, mocks.STACK.address], [unitParser(1000), unitParser(1000)]);
    });

    it('checking both balances', async () => {
      const ufarmBalance = await mocks.UFARM.balanceOf(cohort.address);
      const oroBalance = await mocks.STACK.balanceOf(cohort.address);

      /// cheking
      const aliceUfarmBalance = await mocks.UFARM.balanceOf(alice.address);
      const aliceOroBalance = await mocks.STACK.balanceOf(alice.address);

      // verify balance
      expect(unitFormatter(ufarmBalance)).to.equal(0);
      expect(unitFormatter(oroBalance)).to.equal(0);

      // verify balance
      expect(unitFormatter(aliceUfarmBalance)).to.equal(11000);
      expect(unitFormatter(aliceOroBalance)).to.equal(4000);
    });
  });

  // should be called by nftManager
  describe('#stake', () => {
    it('Non nft manager can not stake', async () => {
      await expect(cohort.connect(owner).stake(1, 1, user.address, alice.address)).to.be.revertedWith('ONM');
    });
  });

  // should be called by nftManager
  describe('#collectPrematureRewards', () => {
    it('Staking is not active', async () => {
      await expect(cohort.connect(alice).collectPrematureRewards(alice.address, 2)).to.be.revertedWith('ONM');
    });
  });

  describe('#unStake', () => {
    it('unstake will not happen directly', async () => {
      await expect(cohort.connect(owner).unStake(alice.address, 2, 1)).to.be.revertedWith('ONM');
    });
  });

  describe('#buyBooster', () => {
    it('Non owner or non nftManager can not buy booster pack', async () => {
      await expect(cohort.connect(alice).buyBooster(alice.address, mocks.UFARM.address, 10)).to.be.revertedWith('IS');
    });

    it('buy booster pack', async () => {
      await expect(cohort.connect(owner).buyBooster(alice.address, mocks.UFARM.address, 1));
    });
  });

  describe('#disableBooster', () => {
    it('non owner can not disable booster', async () => {
      await expect(cohort.connect(alice).disableBooster(1)).to.revertedWith('ONA');
    });

    it('factory owner can disable booster', async () => {
      await cohort.connect(owner).disableBooster(1);
      const stakes = await cohort.stakes(1);
      expect(stakes.isBooster).to.be.false;
    });
  });

  describe('#setPortionAmount', () => {
    it('non owner can not set portion', async () => {
      const amount = await unitParser(5000000);
      await expect(cohort.connect(alice).setPortionAmount(1, amount)).to.revertedWith('ONA');
    });

    it('factory owner can not set portion', async () => {
      const amount = await unitParser(5000000);
      await cohort.connect(owner).setPortionAmount(1, amount);
      const stakes = await cohort.stakes(1);
      expect(stakes.stakedAmount).to.equal(amount);
    });
  });
});
