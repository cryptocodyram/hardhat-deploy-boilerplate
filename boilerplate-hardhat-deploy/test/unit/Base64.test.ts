import { ethers, waffle } from 'hardhat';
import chai, { expect } from 'chai';
import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deploy } from '../../utilities/deploy';

chai.use(waffle.solidity);

describe('Base64', () => {
  let Base64: Contract;
  before(async () => {
    Base64 = await deploy('Base64_Test', []);
  });

  it('encode', async () => {
    const encode = await Base64.encode('0x12345678');
    expect(encode).to.eql(ethers.utils.base64.encode('0x12345678'));
  });

  it('#decode', async () => {
    const decode = await Base64.decode('EjQ=');
    expect(decode).to.eql('0x1234');
  });
});
