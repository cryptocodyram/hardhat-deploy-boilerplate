import { ethers, waffle, upgrades } from 'hardhat';
import chai, { expect } from 'chai';
import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import _ from 'lodash';
import { deploy, deployProxy } from '../../utilities/deploy';
import { unitParser } from '../../utilities';

chai.use(waffle.solidity);

const COHORT_ID: string = '0x1720bb2B6E11F6582cC1a7f6510FEb84064Ea811';

describe('NFTDescriptor', () => {
  let descriptor: Contract;
  let cohort: Contract;
  let factory: Contract;

  let Owner: SignerWithAddress;

  before(async () => {
    const [owner] = await ethers.getSigners();

    Owner = owner;

    descriptor = await deploy('NFTDescriptor_Test', []);

    // deploy factory
    const factory = await deployProxy('UnifarmCohortFactoryUpgradeable', '__UnifarmCohortFactoryUpgradeable_init', []);

    const salt = ethers.utils.solidityKeccak256(['string'], ['v33']);
    await factory.connect(owner).createUnifarmCohort(salt);

    const cohortId = await factory.cohorts(0);
    cohort = await ethers.getContractAt('UnifarmCohort', cohortId);
  });

  it('#generateName', async () => {
    let descriptorValue = await descriptor.generateName('V33', 'RAZOR');
    descriptorValue = descriptorValue.replace('\u0000', '');
    expect(descriptorValue).to.be.a('string');
    expect(descriptorValue).to.equal('RAZOR (V33)');
  });

  it('#generateDescriptionSegment1', async () => {
    const stakedAmount = unitParser('1');
    const description1 = await descriptor.generateDescriptionSegment1(stakedAmount, '33', 'ORO', COHORT_ID);
    expect(description1).to.be.a('string');
  });

  it('#generateDescriptionSegment2', async () => {
    const stakedAmount = unitParser('100');
    const confirmedEpochs = 100;
    const stakedBlock = 100;
    const descriptorValue = await descriptor.generateDescriptionSegment2(stakedAmount, confirmedEpochs, stakedBlock, true);
    expect(descriptorValue).to.be.a('string');
  });

  it('#generateSvg', async () => {
    const descriptorValue = await descriptor.generateSVG({
      fid: 1,
      cohortName: '33',
      stakeTokenTicker: 'UFARM',
      cohortAddress: COHORT_ID,
      stakedBlock: 23218,
      tokenId: 3328,
      stakedAmount: unitParser(100),
      confirmedEpochs: 23218,
      isBoosterAvailable: true,
    });
    expect(descriptorValue).to.be.a('string');
  });

  it('#generateRectanglesSVG', async () => {
    const descriptorValue = await descriptor.generateRectanglesSVG();
    expect(descriptorValue).to.be.a('string');
  });

  it('#generateBoosterIndicator', async () => {
    const descriptorValue = await descriptor.generateBoosterIndicator(true);
    expect(descriptorValue).to.be.a('string');
  });

  it('#generateRocketIcon', async () => {
    const descriptorValue = await descriptor.generateRocketIcon(true);
    expect(descriptorValue).to.be.a('string');
  });

  it('#generateRocketIcon', async () => {
    const descriptorValue = await descriptor.generateRocketIcon(false);
    expect(descriptorValue).to.be.a('string');
  });

  it('#generateSVGTypographyForRectangles', async () => {
    const stakedAmount = unitParser('14568');
    const descriptorValue = await descriptor.generateSVGTypographyForRectangles(23218, 23218, 3328);
    expect(descriptorValue).to.be.a('string');
  });

  it('#generateBoostedLabelText', async () => {
    const descriptorValue = await descriptor.generateBoostedLabelText(true);
    expect(descriptorValue).to.be.a('string');
  });

  it('#generateSVGDefs', async () => {
    const descriptorValue = await descriptor.generateSVGDefs();
    expect(descriptorValue).to.be.a('string');
  });
});
