import { ethers, waffle, upgrades } from 'hardhat';
import chai, { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract } from 'ethers';
import { deploy } from '../../utilities/deploy';
import { unitParser } from '../../utilities';
import { ZERO_ADDRESS } from '../constants';

chai.use(waffle.solidity);

describe('Transfer Helper', () => {
  let transferHelper: Contract;
  let token: Contract;

  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let UFARM: Contract;
  let ORO: Contract;

  before(async () => {
    const [ownerWallet, aliceWallet, bobWallet] = await ethers.getSigners();

    owner = ownerWallet;
    alice = aliceWallet;
    bob = bobWallet;

    // deploy helper
    transferHelper = await deploy('TransferHelpers_Test', []);
    // deploy mock contract
    const supply = await ethers.utils.parseUnits('5000000000', 'ether');

    UFARM = await deploy('MockERC20', ['Unifarm', 'UFARM', supply, 18]);
    ORO = await deploy('MockERC20', ['OroToken', 'ORO', supply, 18]);
  });

  describe('Transfer Helpers', () => {
    it('#safeTransferFrom', async () => {
      // owner approve to transfer helper contract
      await UFARM.connect(owner).approve(transferHelper.address, unitParser('2000'));
      await transferHelper.connect(owner).safeTransferFrom(UFARM.address, owner.address, alice.address, unitParser('2000'));
      const aliceWalletBalance = await UFARM.balanceOf(alice.address);
      const transferHelperBalance = await UFARM.balanceOf(transferHelper.address);

      expect(aliceWalletBalance).to.be.equal(unitParser(2000));
      // check the router address
      expect(transferHelperBalance).to.be.equal(0);
    });

    it('#safeTransfer', async () => {
      // transfer some oro to router
      await ORO.connect(owner).transfer(transferHelper.address, unitParser('3000'));
      await transferHelper.connect(alice).safeTransfer(ORO.address, bob.address, unitParser('2000'));
      const bobWalletBalance = await ORO.balanceOf(bob.address);
      const transferHelperBalance = await ORO.balanceOf(transferHelper.address);
      expect(bobWalletBalance).to.be.equal(unitParser('2000'));
      expect(transferHelperBalance).to.be.equal(unitParser('1000'));
    });

    it('#safeTransferParentChainToken', async () => {
      // send some eth to router
      await owner.sendTransaction({
        data: '0x',
        value: unitParser('2'),
        to: transferHelper.address,
      });
      await transferHelper.connect(bob).safeTransferParentChainToken(ZERO_ADDRESS, unitParser('0.75'));
      /// see the balance
      const ZERO_ADDRESS_BalanceOf = await ethers.provider.getBalance(ZERO_ADDRESS);
      const Transfer_Helper_BalanceOf = await ethers.provider.getBalance(transferHelper.address);
      expect(ZERO_ADDRESS_BalanceOf).to.be.equal(unitParser('0.75'));
      expect(Transfer_Helper_BalanceOf).to.be.equal(unitParser('1.25'));
    });
  });
});
