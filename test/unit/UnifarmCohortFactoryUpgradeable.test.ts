import { ethers, waffle, upgrades } from 'hardhat';
import chai, { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract } from 'ethers';
import { deployProxy } from '../../utilities/deploy';
import { DEAD_ADDRESS, ZERO_ADDRESS } from '../constants';

chai.use(waffle.solidity);

describe('UnifarmCohortFactoryUpgradeable', () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  let factory: Contract;

  before('deploy factory', async () => {
    const [ownerWallet, aliceWallet] = await ethers.getSigners();
    owner = ownerWallet;
    alice = aliceWallet;
    // deploy the factory
    factory = await deployProxy('UnifarmCohortFactoryUpgradeable', '__UnifarmCohortFactoryUpgradeable_init', []);
  });

  describe('#createUnifarmCohort', () => {
    it("non owner access can't able to create cohort", async () => {
      const salt = ethers.utils.solidityKeccak256(['string'], ['V35']);
      await expect(factory.connect(alice).createUnifarmCohort(salt)).to.be.revertedWith('ONA');
    });

    it('deploy the cohort contract', async () => {
      const salt = ethers.utils.solidityKeccak256(['string'], ['V35']);
      await expect(factory.connect(owner).createUnifarmCohort(salt)).to.be.emit(factory, 'CohortConstructed');
    });
  });

  describe('#setStorageContracts', () => {
    it("non owner access can't able to set storage contracts", async () => {
      await expect(factory.connect(alice).setStorageContracts(DEAD_ADDRESS, DEAD_ADDRESS, DEAD_ADDRESS)).to.be.revertedWith('ONA');
    });
    it('owner can set this storage contract', async () => {
      await factory.connect(owner).setStorageContracts(DEAD_ADDRESS, DEAD_ADDRESS, DEAD_ADDRESS);
    });
    it('get the updated storage contracts', async () => {
      const storageContracts = await factory.getStorageContracts();
      expect(storageContracts[0]).to.be.equal(DEAD_ADDRESS);
      expect(storageContracts[1]).to.be.equal(DEAD_ADDRESS);
      expect(storageContracts[2]).to.be.equal(DEAD_ADDRESS);
    });
  });

  describe('read only functions', () => {
    it('#obtainNumberOfCohorts', async () => {
      const cohorts = (await factory.obtainNumberOfCohorts()) as number;
      expect(cohorts).to.be.equal(1);
    });

    it('#computeCohortAddress', async () => {
      const salt = ethers.utils.solidityKeccak256(['string'], ['V35']);
      const cohort = (await factory.cohorts(0)) as string;
      const computedCohortAddress = (await factory.computeCohortAddress(salt)) as string;
      expect(computedCohortAddress.toLowerCase()).to.be.equal(cohort.toLowerCase());
    });

    it('#owner', async () => {
      const factoryOwner = (await factory.owner()) as string;
      expect(factoryOwner.toLowerCase()).to.be.equal(owner.address.toLowerCase());
    });
  });

  describe('#transferOwnership', async () => {
    it('non owner access not able to transferOwnership', async () => {
      await expect(factory.connect(alice).transferOwnership(DEAD_ADDRESS)).to.be.revertedWith('ONA');
    });
    it('newAddress should not be zero address', async () => {
      await expect(factory.connect(owner).transferOwnership(ZERO_ADDRESS)).to.be.revertedWith('NOIA');
    });
    it('transfer the ownership to dead adddres', async () => {
      await expect(factory.connect(owner).transferOwnership(DEAD_ADDRESS))
        .to.be.emit(factory, 'OwnershipTransferred')
        .withArgs(owner.address, DEAD_ADDRESS);
    });
    it('check new owner', async () => {
      const factoryOwner = (await factory.owner()) as string;
      expect(factoryOwner.toLowerCase()).to.be.equal(DEAD_ADDRESS.toLowerCase());
    });
  });
});
