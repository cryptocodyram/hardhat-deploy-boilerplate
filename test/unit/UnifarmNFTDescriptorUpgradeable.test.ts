import { waffle, upgrades, ethers } from 'hardhat';
import chai, { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract } from 'ethers';
import { deploy, deployProxy } from '../../utilities/deploy';
import { getBlockNumber, getRewardCap, mineNBlocks, setRewardCap, unitParser } from '../../utilities';
import { setupAllConfigurationForCohort } from '../helpers/setup';
import _ from 'lodash';
import { getPerBlockReward } from '../../utilities/reward';
import { transferBatch } from '../../utilities/multicall';
import { DEAD_ADDRESS, ZERO_ADDRESS } from '../constants';
import base64 from 'base-64';

chai.use(waffle.solidity);

interface MockStakeToken {
  UFARM: Contract;
  RAZOR: Contract;
  STACK: Contract;
  NETVRK: Contract;
  TBC: Contract;
}

let startBlockNumber;
describe('UnifarmNFTDescriptorUpgradeable', () => {
  let mocks: MockStakeToken;

  let descriptor: Contract;
  let descriptorTest: Contract;
  let registry: Contract;
  let multicall: Contract;
  let factory: Contract;
  let cohort: Contract;
  let rewardRegistry: Contract;
  let nftManager: Contract;
  // let nftManager: Contract

  let owner: SignerWithAddress;
  let master: SignerWithAddress;
  let user: SignerWithAddress;
  let alice: SignerWithAddress;

  const feeAmount = unitParser('0.01');
  before(async () => {
    const [ownerWallet, masterWallet, aliceWallet, userWallet, boosterWallet, feeWallet] = await ethers.getSigners();

    owner = ownerWallet;
    master = masterWallet;
    user = userWallet;
    alice = aliceWallet;

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

    // deploy the NFT descriptor
    descriptorTest = await deployProxy('UnifarmNFTDescriptorUpgradeableTest', '__UnifarmNFTDescriptorUpgradeable_init', [registry.address]);

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
    const blockNumber = await getBlockNumber();
    startBlockNumber = _.add(blockNumber, 10);
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
            endBlock: _.add(blockNumber, 200),
            epochBlocks: 200 / 10,
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
            pbr: getPerBlockReward([451971, 225000, 487163, 57015, 321429], 200),
          },
        },
      },
      owner
    );

    // transfer token
    await transferBatch(owner, [UFARM, RAZOR, STACK, NETVRK, TBC], [451971, 225000, 487163, 57015, 321429], user.address);
    await transferBatch(owner, [UFARM, RAZOR, STACK, NETVRK, TBC], [451971, 225000, 487163, 57015, 321429], nftManager.address);

    await UFARM.connect(owner).approve(nftManager.address, unitParser(10000000));
    // minting
    await nftManager.connect(owner).stakeOnUnifarm(cohort.address, ZERO_ADDRESS, UFARM.address, unitParser(1000), 1);
    // // stake
    // await cohort.attach(nftManager.address).stake(
    //   1,
    //   1,
    //   owner.address,
    //   ZERO_ADDRESS
    // )
  });

  it('#getTokenTicker', async () => {
    const ufarmTicker = await descriptorTest.getTokenTicker(mocks.UFARM.address);
    const razorTicker = await descriptorTest.getTokenTicker(mocks.RAZOR.address);
    const stackTicker = await descriptorTest.getTokenTicker(mocks.STACK.address);
    const netvrkTicker = await descriptorTest.getTokenTicker(mocks.NETVRK.address);
    const tbcTicker = await descriptorTest.getTokenTicker(mocks.TBC.address);

    expect(ufarmTicker).to.equal('UFARM');
    expect(razorTicker).to.equal('RAZOR');
    expect(stackTicker).to.equal('STACK');
    expect(netvrkTicker).to.equal('NETVRK');
    expect(tbcTicker).to.equal('TBC');
  });

  it('#formatPrincipalStakedAmount', async () => {
    const formatAmount = await descriptorTest.formatPrincipalStakedAmount(unitParser(1), 18);
    expect(formatAmount).to.equal(1);
  });

  it('#getCohortDetails', async () => {
    await mineNBlocks(140);
    const [cohortName, confirmedEpochs] = await descriptorTest.getCohortDetails(cohort.address, 10, 150);
    expect(cohortName).to.equal('V35');
    expect(confirmedEpochs.toString()).to.equal('7');
  });

  // when user endblock is 0
  it('#getCohortDetails, consider user is not burn yet', async () => {
    await mineNBlocks(200);
    const [cohortName, confirmedEpochs] = await descriptorTest.getCohortDetails(cohort.address, startBlockNumber, 0);
    expect(cohortName).to.equal('V35');
    expect(confirmedEpochs.toString()).to.equal('9');
  });

  it('#generateTokenURI', async () => {
    const cohortDetails = await cohort.viewStakingDetails(0);
    const tokenURI = await descriptor.generateTokenURI(cohort.address, 1);
    let description = base64.decode(tokenURI.replace('data:application/json;base64,', ''));
    description = JSON.parse(description);

    // matching ERC721 standard
    expect(description).to.have.property('name');
    expect(description).to.have.property('description');
    expect(description).to.have.property('image');

    expect(description.name).to.eql('UFARM (V35)');

    expect(description.description).contains(
      'This NFT denotes your staking on Unifarm. Owner of this nft can Burn or sell on any NFT marketplace. please check staking details below'
    );
    expect(description.description).contains('Token Id :1');
    expect(description.description).contains('Cohort Name :V35');
    expect(description.description).contains('Cohort Address :');
    expect(description.description).contains('Staked Token Ticker :UFARM');
    expect(description.description).contains('Staked Amount :1000');
    expect(description.description).contains('Confirmed Epochs :9');
    expect(description.description).contains('Booster: No');
  });
});
