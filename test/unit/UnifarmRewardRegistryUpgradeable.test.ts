import { ethers, upgrades, waffle } from 'hardhat';
import chai, { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract } from 'ethers';
import { deploy, deployProxy } from '../../utilities/deploy';
import { DEAD_ADDRESS, ZERO_ADDRESS } from '../constants';
import { unitParser, setRewardTokenDetails, setRewardCap, updateDefaultReferralConfiguration, getRewardCap } from '../../utilities';
import { getPerBlockReward } from '../../utilities/reward';
import { transferBatch } from '../../utilities/multicall';
chai.use(waffle.solidity);

describe('UnifarmRewardRegistryUpgradeable', () => {
  let owner: SignerWithAddress;
  let master: SignerWithAddress;
  let alice: SignerWithAddress;
  let joe: SignerWithAddress;
  let trustedForwarder: SignerWithAddress;
  let referralAddress: SignerWithAddress;
  let defaultReferral: SignerWithAddress;
  let user: SignerWithAddress;
  let cohort: SignerWithAddress;

  let rewardRegistry: Contract;
  let multicall: Contract;
  let newMulticall: Contract;

  // tokens
  let UFARM: Contract;
  let RAZOR: Contract;
  let STACK: Contract;
  let NETVRK: Contract;
  let TBC: Contract;
  let WETH: Contract;

  before(async () => {
    const [
      ownerWallet,
      masterWallet,
      cohortWallet,
      trustedForwarderWallet,
      aliceWallet,
      userWallet,
      joeWallet,
      referralWallet,
      defaultReferralWallet,
    ] = await ethers.getSigners();

    owner = ownerWallet;
    alice = aliceWallet;
    joe = joeWallet;
    master = masterWallet;
    referralAddress = referralWallet;
    trustedForwarder = trustedForwarderWallet;
    defaultReferral = defaultReferralWallet;
    user = userWallet;
    cohort = cohortWallet;

    // deploy multicall
    multicall = await deploy('Multicall2', [masterWallet.address]);
    // deploy multicall for update later
    newMulticall = await deploy('Multicall2', [masterWallet.address]);
    // referral percentage
    const referralPercentage = ethers.utils.parseUnits('1');

    // // deploy unifarm factory contract
    // const factoryContract = await deployProxy(
    //   'UnifarmCohortFactoryUpgradeable',
    //   '__UnifarmCohortFactoryUpgradeable__init',
    //   []
    // );

    // const salt = ethers.utils.solidityKeccak256(['string'], ['v35']);
    // await factoryContract.connect(owner).createUnifarmCohort(salt);

    // const computeCohort = await factoryContract.computeCohortAddress(salt);

    // cohort = await ethers.getContractAt('UnifarmCohort', computeCohort);

    // console.log(cohort.address)
    rewardRegistry = await deployProxy('UnifarmRewardRegistryUpgradeable', '__UnifarmRewardRegistryUpgradeable_init', [
      masterWallet.address,
      trustedForwarder.address,
      multicall.address,
      referralPercentage,
    ]);

    // deploy tokens
    const supply = unitParser(5000000);
    UFARM = await deploy('MockERC20', ['Unifarm', 'UFARM', supply, 18]);
    RAZOR = await deploy('MockERC20', ['RAZOR Network', 'RAZOR', supply, 18]);
    UFARM = await deploy('MockERC20', ['ORO Token', 'ORO', supply, 18]);
    STACK = await deploy('MockERC20', ['ORO Token', 'ORO', supply, 18]);
    NETVRK = await deploy('MockERC20', ['ORO Token', 'ORO', supply, 18]);
    TBC = await deploy('MockERC20', ['ORO Token', 'ORO', supply, 18]);
    WETH = await deploy('WETH9', []);

    // set reward cap
    await setRewardCap(rewardRegistry, owner, cohort.address, {
      rewardTokenAddress: [UFARM.address, RAZOR.address, STACK.address, NETVRK.address, TBC.address],
      rewardTokens: getRewardCap([451971, 225000, 487163, 57015, 321429]),
    });

    await transferBatch(owner, [UFARM, RAZOR, STACK, NETVRK, TBC], [451971, 225000, 487163, 57015, 321429], rewardRegistry.address);

    // console.log(await WETH.balanceOf(rewardRegistry.address))
    await WETH.connect(owner).deposit({ value: unitParser(3) });
  });

  it('#updateRefPercentage', async () => {
    await rewardRegistry.updateRefPercentage(unitParser(2));
    const refPercentage = await rewardRegistry.refPercentage();
    expect(refPercentage).to.eql(unitParser(2));
  });

  describe('#addInfluencers', () => {
    const aliceReferralPercentage = 2000;
    const joeReferralPercentage = 5000;
    it('non owner and non multicall can not add influencers', async () => {
      await expect(
        rewardRegistry.connect(alice).addInfluencers([alice.address, joe.address], [aliceReferralPercentage, joeReferralPercentage])
      ).to.be.revertedWith('IS');
    });

    it('array length revert', async () => {
      await expect(rewardRegistry.connect(owner).addInfluencers([alice.address, joe.address], [aliceReferralPercentage])).to.be.revertedWith('AIF');
    });

    it('addInfluencers', async () => {
      await rewardRegistry.connect(owner).addInfluencers([alice.address, joe.address], [aliceReferralPercentage, joeReferralPercentage]);
    });

    it('alice referral', async () => {
      const refPercentage = await rewardRegistry.getInfluencerReferralPercentage(alice.address);
      expect(refPercentage).to.be.equal(aliceReferralPercentage);
    });

    it('joe referral', async () => {
      const refPercentage = await rewardRegistry.getInfluencerReferralPercentage(joe.address);
      expect(refPercentage).to.be.equal(joeReferralPercentage);
    });
  });

  describe('#updateMulticall', () => {
    it('non owner can not update multicall', async () => {
      await expect(rewardRegistry.connect(alice).updateMulticall(newMulticall.address)).to.be.revertedWith('ONA');
    });

    it('new multicall address should not match with old', async () => {
      await expect(rewardRegistry.connect(owner).updateMulticall(multicall.address)).to.be.revertedWith('SMA');
    });

    it('update the multicall', async () => {
      await rewardRegistry.connect(owner).updateMulticall(newMulticall.address);
      const newMultiCallAddress = await rewardRegistry.multiCall();
      expect((newMultiCallAddress as string).toLowerCase()).to.be.equal(newMulticall.address.toLowerCase());
    });
  });

  describe('#setRewardCap', () => {
    const rewardAmountForUFARM = unitParser('1000');
    const rewardAmountForRAZOR = unitParser('1000');
    it("non owner can't set reward cap", async () => {
      await expect(
        rewardRegistry.connect(alice).setRewardCap(cohort.address, [UFARM.address, RAZOR.address], [rewardAmountForUFARM, rewardAmountForRAZOR])
      ).to.be.revertedWith('IS');
    });

    it('cohortId can not be zero', async () => {
      await expect(
        rewardRegistry.connect(owner).setRewardCap(ZERO_ADDRESS, [UFARM.address, RAZOR.address], [rewardAmountForUFARM, rewardAmountForRAZOR])
      ).to.be.revertedWith('ICI');
    });

    it('invalid length', async () => {
      await expect(
        rewardRegistry.connect(owner).setRewardCap(cohort.address, [UFARM.address, RAZOR.address], [rewardAmountForUFARM])
      ).to.be.revertedWith('IL');
    });

    it("reward amount can't zero", async () => {
      await expect(
        rewardRegistry.connect(owner).setRewardCap(cohort.address, [UFARM.address, RAZOR.address], [0, rewardAmountForRAZOR])
      ).to.be.revertedWith('IRA');
    });

    it('set reward cap', async () => {
      await rewardRegistry.connect(owner).setRewardCap(cohort.address, [UFARM.address, RAZOR.address], [rewardAmountForUFARM, rewardAmountForRAZOR]);
      // check the reward cap
      const ufarmRewardCap = await rewardRegistry.rewardCap(cohort.address, UFARM.address);
      const razorRewardCap = await rewardRegistry.rewardCap(cohort.address, RAZOR.address);
      expect(ufarmRewardCap).to.be.equal(rewardAmountForUFARM);
      expect(razorRewardCap).to.be.equal(rewardAmountForRAZOR);
    });
  });

  describe('#setRewardTokenDetails', () => {
    it('non owner can not set reward token details', async () => {
      await expect(
        setRewardTokenDetails(rewardRegistry, alice, cohort.address, {
          rewardTokens: [UFARM.address, RAZOR.address],
          pbr: getPerBlockReward([451971, 225000], 200000),
        })
      ).to.be.revertedWith('IS');
    });

    it('cohort can not be zero', async () => {
      await expect(
        setRewardTokenDetails(rewardRegistry, owner, ZERO_ADDRESS, {
          rewardTokens: [UFARM.address, RAZOR.address],
          pbr: getPerBlockReward([451971, 225000], 200000),
        })
      ).to.be.revertedWith('ICI');
    });

    it('set reward token', async () => {
      await setRewardTokenDetails(rewardRegistry, owner, cohort.address, {
        rewardTokens: [UFARM.address, RAZOR.address],
        pbr: getPerBlockReward([451971, 225000], 200000),
      });
    });

    it('getter for reward tokens', async () => {
      const [rewardTokens, pbr] = await rewardRegistry.getRewardTokens(cohort.address);
      expect(rewardTokens).to.eql([UFARM.address, RAZOR.address]);
      expect(pbr).to.eql(getPerBlockReward([451971, 225000], 200000));
    });
  });

  describe('#distributeRewards', () => {
    it('invalid sender', async () => {
      await expect(
        rewardRegistry.connect(alice).distributeRewards(cohort.address, user.address, alice.address, unitParser('10'), false)
      ).to.be.revertedWith('IS');
    });
    it('trying to steal this rewards', async () => {
      await expect(rewardRegistry.connect(alice).distributeRewards(alice.address, user.address, alice.address, unitParser('10'), false)).to.be
        .reverted;
    });
    it('non cohort cannot able to distribute reward it self', async () => {
      await expect(rewardRegistry.connect(owner).distributeRewards(cohort.address, user.address, alice.address, 1, false)).to.be.revertedWith('IS');
    });

    it('cohort can distribute reward', async () => {
      await expect(rewardRegistry.connect(cohort).distributeRewards(cohort.address, user.address, alice.address, 1, false));
    });
  });

  describe('#safeWithdrawAll', () => {
    const uframAmount = unitParser('100');
    const razorAmount = unitParser('200');
    it('non owner can not withdraw tokens from contract', async () => {
      await expect(
        rewardRegistry.connect(alice).safeWithdrawAll(alice.address, [UFARM.address, RAZOR.address], [uframAmount, razorAmount])
      ).to.be.revertedWith('ONA');
    });

    it("withdrawable address can't be zero", async () => {
      await expect(
        rewardRegistry.connect(owner).safeWithdrawAll(ZERO_ADDRESS, [UFARM.address, RAZOR.address], [uframAmount, razorAmount])
      ).to.be.revertedWith('IWA');
    });

    it('invalid token address or amounts length', async () => {
      await expect(rewardRegistry.connect(owner).safeWithdrawAll(alice.address, [UFARM.address, RAZOR.address], [uframAmount])).to.be.revertedWith(
        'SF'
      );
    });
    it('safe withdraw', async () => {
      await transferBatch(owner, [UFARM, RAZOR], [100, 200], rewardRegistry.address);
      await rewardRegistry.connect(owner).safeWithdrawAll(alice.address, [UFARM.address, RAZOR.address], [uframAmount, razorAmount]);
    });
    it('checking balances', async () => {
      expect(await UFARM.balanceOf(alice.address)).to.be.gt(unitParser(100));
      expect(await RAZOR.balanceOf(alice.address)).to.be.gt(unitParser(200));
    });
  });

  describe('#safeWithdrawEth', () => {
    const amount = unitParser('1.05');

    it('non owner can not call eth withdraw', async () => {
      await owner.sendTransaction({
        to: rewardRegistry.address,
        value: unitParser('2'),
      });
      await expect(rewardRegistry.connect(alice).safeWithdrawEth(alice.address, amount)).to.be.revertedWith('ONA');
    });
    it('safe withdraw eth', async () => {
      await rewardRegistry.connect(owner).safeWithdrawEth(DEAD_ADDRESS, amount);
      expect(await ethers.provider.getBalance(rewardRegistry.address)).to.be.equal(unitParser('0.95'));
      expect(await ethers.provider.getBalance(DEAD_ADDRESS)).to.be.equal(unitParser('2.05'));
    });
  });

  describe('#transferOwnership', async () => {
    it('non owner access not able to transferOwnership', async () => {
      await expect(rewardRegistry.connect(alice).transferOwnership(DEAD_ADDRESS)).to.be.revertedWith('ONA');
    });
    it('newAddress should not be zero address', async () => {
      await expect(rewardRegistry.connect(owner).transferOwnership(ZERO_ADDRESS)).to.be.revertedWith('INA');
    });
    it('transfer the ownership to dead adddres', async () => {
      await expect(rewardRegistry.connect(owner).transferOwnership(DEAD_ADDRESS))
        .to.be.emit(rewardRegistry, 'OwnershipTransferred')
        .withArgs(owner.address, DEAD_ADDRESS);
    });
    it('check new owner', async () => {
      const factoryOwner = (await rewardRegistry.owner()) as string;
      expect(factoryOwner.toLowerCase()).to.be.equal(DEAD_ADDRESS.toLowerCase());
    });
  });
});
