import { waffle, upgrades, ethers } from 'hardhat';
import chai, { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract } from 'ethers';
import { deploy, deployProxy } from '../../utilities/deploy';
import { addBoosterPackage, getBlockNumber, getRewardCap, mineNBlocks, setRewardCap, unitFormatter, unitParser } from '../../utilities';
import { setupAllConfigurationForCohort } from '../helpers/setup';
import _ from 'lodash';
import { getPerBlockReward } from '../../utilities/reward';
import { transferBatch } from '../../utilities/multicall';
import { DEAD_ADDRESS, ZERO_ADDRESS } from '../constants';

chai.use(waffle.solidity);

interface MockStakeToken {
  UFARM: Contract;
  RAZOR: Contract;
  STACK: Contract;
  NETVRK: Contract;
  TBC: Contract;
}

describe('UnifarmNFTManagerUpgradeableSimple', () => {
  var mocks: MockStakeToken;

  /// users
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let lee: SignerWithAddress;
  let joe: SignerWithAddress;
  let john: SignerWithAddress;
  let rose: SignerWithAddress;

  /// protocol addresses
  let feeWalletId: SignerWithAddress;
  let defaultReferral: SignerWithAddress;
  let boosterEthWallet: SignerWithAddress;

  // contracts
  let rewardRegistry: Contract;
  let registry: Contract;
  let descriptor: Contract;
  let nftManager: Contract;
  var cohort: Contract;
  let multicall: Contract;
  let factory: Contract;
  let WETH: Contract;

  const feeAmount = unitParser('0.01');

  before('deploy all contracts', async () => {
    const [
      ownerWallet,
      aliceWallet,
      bobWallet,
      leeWallet,
      joeWallet,
      masterWallet,
      feeWallet,
      defaultReferralWallet,
      boosterWallet,
      johnWallet,
      roseWallet,
    ] = await ethers.getSigners();

    owner = ownerWallet;
    alice = aliceWallet;
    bob = bobWallet;
    lee = leeWallet;
    joe = joeWallet;
    john = johnWallet;
    rose = roseWallet;

    feeWalletId = feeWallet;
    defaultReferral = defaultReferralWallet;
    boosterEthWallet = boosterWallet;

    // deploy multicall
    multicall = await deploy('Multicall2', [masterWallet.address]);

    /// deploy WETH9
    WETH = await deploy('WETH9', []);

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
    const TBC = await deploy('ReflectionERC20', []);

    mocks = {
      UFARM,
      RAZOR,
      STACK,
      NETVRK,
      TBC,
    };

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
              boosterPackAmount: unitParser('2'),
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
    // transfers some tokens to bob address
    await transferBatch(owner, Object.values(mocks), [10000, 20000, 30000, 40000, 50000], bob.address);
    // transfers some tokens to lee
    await transferBatch(owner, Object.values(mocks), [1000, 2000, 3000, 4000, 5000], lee.address);
    // transfers some tokens to joe
    await transferBatch(owner, [mocks.TBC], [10000], joe.address);
  });

  describe('#updateFeeConfiguration', () => {
    it('check fee config', async () => {
      const [feeWalletAddress, pFeeAmount] = await nftManager.fees();
      expect((feeWalletAddress as string).toLowerCase()).to.be.equal(feeWalletId.address.toLowerCase());
      expect(pFeeAmount).to.be.equal(feeAmount);
    });
    it('non owner not able to call', async () => {
      await expect(nftManager.connect(alice).updateFeeConfiguration(owner.address, unitParser('0.05'))).to.be.revertedWith('ONA');
    });
    it('fee wallet address should not be zero address', async () => {
      await expect(nftManager.connect(owner).updateFeeConfiguration(ZERO_ADDRESS, unitParser('0.05'))).to.be.revertedWith('IFWA');
    });
    it('fee amount should be greater than zero', async () => {
      await expect(nftManager.connect(owner).updateFeeConfiguration(owner.address, unitParser('0'))).to.be.revertedWith('IFA');
    });
    it('update the fee config and checking', async () => {
      await expect(nftManager.connect(owner).updateFeeConfiguration(owner.address, unitParser('0.05')))
        .to.be.emit(nftManager, 'FeeConfigurtionAdded')
        .withArgs(owner.address, unitParser('0.05'));
      const [feeWalletAddress, pFeeAmount] = await nftManager.fees();
      expect((feeWalletAddress as string).toLowerCase()).to.be.equal(owner.address.toLowerCase());
      expect(pFeeAmount).to.be.equal(unitParser('0.05'));
    });
    it('reset the fee config', async () => {
      await expect(nftManager.connect(owner).updateFeeConfiguration(feeWalletId.address, unitParser('0.01')))
        .to.be.emit(nftManager, 'FeeConfigurtionAdded')
        .withArgs(feeWalletId.address, unitParser('0.01'));
    });
  });

  describe('#stakeOnUnifarm', () => {
    it('TBC balance', async () => {
      const tbcBalance = await mocks.TBC.balanceOf(rewardRegistry.address);
      expect(tbcBalance).to.be.equal(unitParser(321429));
    });

    it('all approval', async () => {
      const amount = ethers.constants.MaxUint256;
      // alice approval
      await mocks.UFARM.connect(alice).approve(nftManager.address, amount);
      await mocks.STACK.connect(alice).approve(nftManager.address, amount);
      // bob approval
      await mocks.STACK.connect(bob).approve(nftManager.address, amount);
      await mocks.NETVRK.connect(bob).approve(nftManager.address, amount);
      await mocks.RAZOR.connect(bob).approve(nftManager.address, amount);
      // lee approval
      await mocks.RAZOR.connect(lee).approve(nftManager.address, amount);
      // joe approval
      await mocks.TBC.connect(joe).approve(nftManager.address, amount);
    });

    it('revert on when user pass cohort id as zero address', async () => {
      const amount = unitParser(500);
      await expect(nftManager.connect(alice).stakeOnUnifarm(ZERO_ADDRESS, ZERO_ADDRESS, mocks.UFARM.address, amount, 1)).to.be.revertedWith('ICI');
    });

    it('if farm not exist', async () => {
      const amount = unitParser(500);
      await expect(nftManager.connect(alice).stakeOnUnifarm(cohort.address, ZERO_ADDRESS, mocks.UFARM.address, amount, 7)).to.be.revertedWith('FTNE');
    });
    it('self referral not allowed', async () => {
      const amount = unitParser(500);
      await expect(nftManager.connect(alice).stakeOnUnifarm(cohort.address, alice.address, mocks.UFARM.address, amount, 1)).to.be.revertedWith(
        'SRNA'
      );
    });
    it('user min stake failed', async () => {
      const amount = unitParser(0.0001);
      await expect(nftManager.connect(alice).stakeOnUnifarm(cohort.address, ZERO_ADDRESS, mocks.UFARM.address, amount, 1)).to.be.revertedWith('UMF');
    });
    it('alice stake farm id 1', async () => {
      const amount = unitParser(499.8887755);
      await nftManager.connect(alice).stakeOnUnifarm(cohort.address, ZERO_ADDRESS, mocks.UFARM.address, amount, 1);
    });
    it('check non boosted #tokenURI', async () => {
      const tokenURI = await nftManager.tokenURI(1);
      //console.log('tokenURI', tokenURI);
    });
    it('lee stake farm id 2', async () => {
      const amount = unitParser(2000);
      await nftManager.connect(lee).stakeOnUnifarm(cohort.address, ZERO_ADDRESS, mocks.RAZOR.address, amount, 2);
    });
    it('check lee RAZOR balance', async () => {
      const leeBalance = await mocks.RAZOR.balanceOf(lee.address);
      expect(leeBalance).to.be.equal(0);
    });
    it('total staking', async () => {
      const totalStaking = await cohort.totalStaking(1);
      expect(totalStaking).to.be.equal(unitParser(499.8887755));
    });
    it('user total staking', async () => {
      const userTotalStaking = await cohort.userTotalStaking(alice.address, 1);
      expect(userTotalStaking).to.be.equal(unitParser(499.8887755));
    });
  });

  describe('#buyBoosterPackOnUnifarm', () => {
    before('add booster pack as WETH', async () => {
      await addBoosterPackage(registry, owner, {
        bpid: 3,
        cohortId: cohort.address,
        paymentToken: WETH.address,
        boosterVault: boosterEthWallet.address,
        boosterPackAmount: unitParser('0.02'),
      });
    });
    it('failed if cohort id is zero', async () => {
      await expect(nftManager.connect(alice).buyBoosterPackOnUnifarm(ZERO_ADDRESS, 1, 1)).to.be.revertedWith('ICI');
    });
    it('boost for someone behalf', async () => {
      await expect(nftManager.connect(alice).buyBoosterPackOnUnifarm(cohort.address, 1, 2)).to.be.revertedWith('INO');
    });
    it('bnf error', async () => {
      await expect(nftManager.connect(alice).buyBoosterPackOnUnifarm(cohort.address, 7, 1)).to.be.revertedWith('BNF');
    });
    it('buy with eth', async () => {
      await expect(
        nftManager.connect(alice).buyBoosterPackOnUnifarm(cohort.address, 1, 1, {
          value: unitParser(5),
        })
      ).to.be.reverted;
    });
    it('buy booster for #1', async () => {
      await expect(nftManager.connect(alice).buyBoosterPackOnUnifarm(cohort.address, 1, 1))
        .to.be.emit(cohort, 'BoosterBuyHistory')
        .withArgs(1, alice.address, 1);
    });
    it('already boosted', async () => {
      await expect(nftManager.connect(alice).buyBoosterPackOnUnifarm(cohort.address, 1, 1)).to.be.revertedWith('AB');
    });
    it('check booster vault balance', async () => {
      const boosterVaultBalance = await mocks.UFARM.balanceOf(boosterEthWallet.address);
      expect(boosterVaultBalance).to.be.equal(unitParser(500));
    });
    it('lee sends less eth', async () => {
      await expect(
        nftManager.connect(lee).buyBoosterPackOnUnifarm(cohort.address, 3, 2, {
          value: unitParser(0.01),
        })
      ).to.be.revertedWith('BAF');
    });
    it('lee sends ZERO eth', async () => {
      await expect(
        nftManager.connect(lee).buyBoosterPackOnUnifarm(cohort.address, 3, 2, {
          value: unitParser(0),
        })
      ).to.be.revertedWith('STFF');
    });
    it('lee buy the booster with ETH', async () => {
      const ethBalance = await ethers.provider.getBalance(lee.address);
      await expect(
        nftManager.connect(lee).buyBoosterPackOnUnifarm(cohort.address, 3, 2, {
          value: unitParser(10),
        })
      )
        .to.be.emit(cohort, 'BoosterBuyHistory')
        .withArgs(2, lee.address, 3);
      const currentEthBalance = await ethers.provider.getBalance(lee.address);
      expect(unitFormatter(String(currentEthBalance))).to.be.gt(unitFormatter(String(ethBalance)) - 10);
    });
    it('check booster vault balance Ethereum', async () => {
      const ethBalance = unitFormatter(String(await ethers.provider.getBalance(boosterEthWallet.address)));
      expect(ethBalance).to.be.gt(1000);
    });
  });

  describe('#stakeAndBuyBoosterPackOnUnifarm', () => {
    var bobStakeStartBlock: number;
    it('bob wants to stake + buy booster pack', async () => {
      const amount = unitParser(2000);
      await expect(nftManager.connect(bob).stakeAndBuyBoosterPackOnUnifarm(cohort.address, ZERO_ADDRESS, mocks.STACK.address, 2, amount, 3))
        .to.be.emit(nftManager, 'Transfer')
        .withArgs(ZERO_ADDRESS, bob.address, 3)
        .to.be.emit(cohort, 'ReferedBy');
      bobStakeStartBlock = await getBlockNumber();
    });
    it('looking balances of each', async () => {
      const balanceOfCohort = await mocks.STACK.balanceOf(cohort.address);
      const balanceOfBob = await mocks.STACK.balanceOf(bob.address);
      expect(balanceOfCohort).to.be.equal(unitParser(2000));
      expect(balanceOfBob).to.be.equal(unitParser(28000));
    });
    it('check booster vault balance', async () => {
      const boosterVaultBalance = await mocks.NETVRK.balanceOf(boosterEthWallet.address);
      expect(boosterVaultBalance).to.be.equal(unitParser(2));
    });
    it('#viewStakeDetails of bob', async () => {
      const cohortId = await nftManager.tokenIdToCohortId(3);
      const [fid, nftTokenId, stakedAmount, startBlock, endBlock, originalOwner, referralAddres, isBooster] = await cohort.viewStakingDetails(3);

      expect((cohortId as string).toLowerCase()).to.be.equal(cohort.address.toLowerCase());
      expect(fid as number).to.be.equal(3);
      expect(nftTokenId as number).to.be.equal(3);
      expect(stakedAmount).to.be.equal(unitParser(2000));
      expect(startBlock as number).to.be.equal(bobStakeStartBlock);
      expect(endBlock).to.be.equal(0);
      expect(originalOwner).to.be.eql(bob.address);
      expect(referralAddres).to.be.equal(ZERO_ADDRESS);
      expect(isBooster).to.be.true;
    });
  });

  describe('view state variables & functions', () => {
    it('#factory', async () => {
      expect(((await nftManager.factory()) as string).toLowerCase()).to.be.equal(factory.address.toLowerCase());
    });
    it('#nftDescriptor', async () => {
      expect(((await nftManager.nftDescriptor()) as string).toLowerCase()).to.be.equal(descriptor.address.toLowerCase());
    });
    it('#ownerOf', async () => {
      const nftOwner = await nftManager.ownerOf(2);
      expect(nftOwner).to.be.eql(lee.address);
    });
    it('#balanceOf', async () => {
      const bobNFTBalance = await nftManager.balanceOf(bob.address);
      expect(bobNFTBalance).to.be.equal(1);
    });
    it('#tokenIdToCohortId', async () => {
      const cohortId = await nftManager.tokenIdToCohortId(1);
      expect((cohortId as string).toLowerCase()).to.be.equal(cohort.address.toLowerCase());
    });
    it('#tokenURI', async () => {
      const tokenURI = await nftManager.tokenURI(2);
      //console.log('tokenURI', tokenURI);
    });
    it('check non minted NFT tokenURI', async () => {
      await expect(nftManager.tokenURI(10)).to.be.revertedWith('ICI');
    });
    it('#trustedForwarder', async () => {
      const trustedForwarder = await nftManager.trustedForwarder();
      expect(trustedForwarder).to.be.eql(ZERO_ADDRESS);
    });
  });

  describe('#mint when token is reflection', () => {
    var joeBal: number;
    it('joe stake farm id 3', async () => {
      joeBal = await mocks.TBC.balanceOf(joe.address);
      await nftManager.connect(joe).stakeOnUnifarm(cohort.address, ZERO_ADDRESS, mocks.TBC.address, joeBal, 5);
    });
    it('check joe stake object', async () => {
      const [, , stakedAmount, , , , ,] = await cohort.viewStakingDetails(4);
      // so token deduct the 2%
      const joeParse = unitFormatter(String(joeBal));
      const actualStaked = _.subtract(joeParse, _.multiply(joeParse, 2) / 100);
      expect(stakedAmount).to.be.equal(unitParser(actualStaked));
    });

    it('check both balances', async () => {
      // previous balance
      const joeParse = unitFormatter(String(joeBal));

      const balanceOfCohort = await mocks.TBC.balanceOf(cohort.address);
      const balanceOfJoe = await mocks.TBC.balanceOf(joe.address);
      const actualStaked = _.subtract(joeParse, _.multiply(joeParse, 2) / 100);

      expect(balanceOfCohort).to.be.equal(unitParser(actualStaked));
      expect(balanceOfJoe).to.be.equal(0);
    });
    it('check lee total staking', async () => {
      const userTotalStaking = await cohort.userTotalStaking(joe.address, 5);
      expect(userTotalStaking).to.be.equal(unitParser(9800));
    });
    it('check TBC total staking', async () => {
      const tbcTotalStaking = await cohort.totalStaking(5);
      expect(tbcTotalStaking).to.be.equal(unitParser(9800));
    });
  });

  describe('bob,alice #mint', () => {
    it('bob stake farm id 2', async () => {
      const amount = unitParser(2000);
      await nftManager.connect(bob).stakeOnUnifarm(cohort.address, ZERO_ADDRESS, mocks.RAZOR.address, amount, 2);
    });
    it('alice stake farm id 3', async () => {
      const amount = unitParser(3000);
      await nftManager.connect(alice).stakeOnUnifarm(cohort.address, ZERO_ADDRESS, mocks.STACK.address, amount, 3);
    });
  });

  describe('#claimOnUnifarm', () => {
    it('mine 100 blocks', async () => {
      await mineNBlocks(100);
    });
    it('tokenId not exist', async () => {
      await expect(nftManager.connect(lee).claimOnUnifarm(100, { value: feeAmount })).to.be.revertedWith('ERC721: owner query for nonexistent token');
    });
    it('invalid owner error', async () => {
      await expect(nftManager.connect(lee).claimOnUnifarm(3, { value: feeAmount })).to.be.revertedWith('INO');
    });
    it('fee amount required', async () => {
      await expect(nftManager.connect(lee).claimOnUnifarm(2, { value: 0 })).to.be.revertedWith('FAR');
    });
    it('claimOnUnifarm', async () => {
      await expect(nftManager.connect(lee).claimOnUnifarm(2, { value: feeAmount })).to.be.emit(cohort, 'Claim');
    });
    it('lee call claimOnUnifarm function again', async () => {
      await expect(nftManager.connect(lee).claimOnUnifarm(2, { value: feeAmount })).to.be.revertedWith('NRM');
    });
  });

  describe('#unstakeOnUnifarm', () => {
    it('alice wants to burn a nft thats not exist', async () => {
      // increase the block
      await mineNBlocks(40);

      await expect(
        nftManager.connect(bob).unstakeOnUnifarm(1000, {
          value: feeAmount,
        })
      ).to.be.revertedWith('ERC721: owner query for nonexistent token');
    });

    it('bob wants to burn alice nfts', async () => {
      // increase the block
      await mineNBlocks(40);
      await expect(
        nftManager.connect(bob).unstakeOnUnifarm(1, {
          value: feeAmount,
        })
      ).to.be.revertedWith('INO');
    });
    it('burn the alice nft without feeAmount', async () => {
      // increase the block
      await mineNBlocks(40);
      await expect(
        nftManager.connect(alice).unstakeOnUnifarm(1, {
          value: 0,
        })
      ).to.be.revertedWith('FAR');
    });
    it('burn the alice nft with feeAmount', async () => {
      await expect(
        nftManager.connect(alice).unstakeOnUnifarm(1, {
          value: feeAmount,
        })
      )
        .to.be.emit(nftManager, 'Transfer')
        .withArgs(alice.address, ZERO_ADDRESS, 1)
        .to.be.emit(cohort, 'Claim');
    });
    it('alice tried again', async () => {
      await expect(
        nftManager.connect(alice).unstakeOnUnifarm(1, {
          value: feeAmount,
        })
      ).to.be.revertedWith('ERC721: owner query for nonexistent token');
    });
    it('check total staking', async () => {
      const totalStaking = await cohort.totalStaking(1);
      expect(totalStaking).to.be.equal(0);
    });
    it('check user total staking', async () => {
      const userTotalStaking = await cohort.userTotalStaking(alice.address, 1);
      expect(userTotalStaking).to.be.equal(0);
    });
    it('lee wants to remove his principal staked amount', async () => {
      await expect(
        nftManager.connect(lee).unstakeOnUnifarm(2, {
          value: feeAmount,
        })
      )
        .to.be.emit(nftManager, 'Transfer')
        .withArgs(lee.address, ZERO_ADDRESS, 2)
        .to.be.emit(cohort, 'Claim');
    });
    it('lee cannot able to claim after farm end', async () => {
      await expect(nftManager.connect(lee).claimOnUnifarm(2, { value: feeAmount })).to.be.revertedWith('ERC721: owner query for nonexistent token');
    });
  });
  describe('#approve', () => {
    it('NFT approval', async () => {
      await expect(nftManager.connect(bob).approve(john.address, 5)).to.be.emit(nftManager, 'Approval').withArgs(bob.address, john.address, 5);
    });
    it('#getApproved', async () => {
      const operator = await nftManager.getApproved(5);
      expect(operator).to.be.eql(john.address);
    });
    it('#isApprovedForAll', async () => {
      const isApprovedForAll = await nftManager.isApprovedForAll(bob.address, john.address);
      expect(isApprovedForAll).to.be.false;
    });
    it('#ownerOf', async () => {
      const owner = await nftManager.ownerOf(5);
      expect(owner).to.be.eql(bob.address);
    });
  });
  describe('#setApprovalForAll', () => {
    it('set approval for all', async () => {
      await expect(nftManager.connect(alice).setApprovalForAll(rose.address, true))
        .to.be.emit(nftManager, 'ApprovalForAll')
        .withArgs(alice.address, rose.address, true);
    });
    it('#getApproved', async () => {
      const operator = await nftManager.getApproved(6);
      expect(operator).to.be.eql(ZERO_ADDRESS);
    });
    it('#isApprovedForAll', async () => {
      const isApprovedForAll = await nftManager.isApprovedForAll(alice.address, rose.address);
      expect(isApprovedForAll).to.be.true;
    });
    it('#ownerOf', async () => {
      const owner = await nftManager.ownerOf(6);
      expect(owner).to.be.eql(alice.address);
    });
  });
  describe('#transferFrom', () => {
    it('lee try to pull the nft from bob account', async () => {
      await expect(nftManager.connect(lee).transferFrom(bob.address, lee.address, 5)).to.be.revertedWith(
        'ERC721: transfer caller is not owner nor approved'
      );
    });
    it('john transferFrom', async () => {
      await expect(nftManager.connect(john).transferFrom(bob.address, john.address, 5))
        .to.be.emit(nftManager, 'Transfer')
        .withArgs(bob.address, john.address, 5);
    });
    it('#ownerOf', async () => {
      const owner = await nftManager.ownerOf(5);
      expect(owner).to.be.eql(john.address);
    });
    it('#balanceOf bob nfts', async () => {
      const bobNftsBalance = await nftManager.balanceOf(bob.address);
      expect(bobNftsBalance).to.be.equal(1);
    });
    it('#balanceOf john nfts', async () => {
      const johnNftsBalance = await nftManager.balanceOf(john.address);
      expect(johnNftsBalance).to.be.equal(1);
    });
  });
  describe('#safeTransferFrom', () => {
    it('lee try to pull the nft from alice account', async () => {
      await expect(nftManager.connect(lee)['safeTransferFrom(address,address,uint256)'](alice.address, lee.address, 6)).to.be.revertedWith(
        'ERC721: transfer caller is not owner nor approved'
      );
    });
    it('rose call safeTransferFrom', async () => {
      await expect(nftManager.connect(rose)['safeTransferFrom(address,address,uint256)'](alice.address, rose.address, 6))
        .to.be.emit(nftManager, 'Transfer')
        .withArgs(alice.address, rose.address, 6);
    });
    it('#ownerOf of 6', async () => {
      const owner = await nftManager.ownerOf(6);
      expect(owner).to.be.eql(rose.address);
    });
    it('#balanceOf alice nfts', async () => {
      const aliceNftsBalance = await nftManager.balanceOf(alice.address);
      expect(aliceNftsBalance).to.be.equal(0);
    });
    it('#balanceOf rose nfts', async () => {
      const roseNftsBalance = await nftManager.balanceOf(rose.address);
      expect(roseNftsBalance).to.be.equal(1);
    });
  });
  describe('burn after transfer', async () => {
    it('bob try to burn his transfered nft', async () => {
      await expect(nftManager.connect(bob).unstakeOnUnifarm(5, { value: feeAmount })).to.be.revertedWith('INO');
    });
    it('alice try to burn his transfered nft', async () => {
      await expect(nftManager.connect(alice).unstakeOnUnifarm(6, { value: feeAmount })).to.be.revertedWith('INO');
    });
    it('john able to burn the nft', async () => {
      await expect(nftManager.connect(john).unstakeOnUnifarm(5, { value: feeAmount }))
        .to.be.emit(nftManager, 'Transfer')
        .withArgs(john.address, ZERO_ADDRESS, 5);
    });
    it('rose able to burn the nft', async () => {
      await expect(nftManager.connect(rose).unstakeOnUnifarm(6, { value: feeAmount }))
        .to.be.emit(nftManager, 'Transfer')
        .withArgs(rose.address, ZERO_ADDRESS, 6);
    });
  });
});
