import { unitParser } from '.';
import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BoosterPackageParams, Cohort, RewardCap, SetRewardTokenDetailsParams, Token } from './types';

export const createMulticallRequest = async (multiCall: Contract, signer: SignerWithAddress, calls: Call[]) => {
  await multiCall.connect(signer).aggregate(calls);
};

export const getFunctionCallData = (instance: Contract, functionName: string, args: any[]) => {
  return instance.interface.encodeFunctionData(functionName, args);
};

export interface Call {
  target: string;
  callData: string;
}

export const createCohortDetailsCalls = (registry: Contract, cohortId: string, cohortDetails: Cohort[]) => {
  const calls = [] as Call[];
  for (var i = 0; i < cohortDetails.length; i++) {
    calls.push({
      target: registry.address,
      callData: getFunctionCallData(registry, 'setCohortDetails', [
        cohortId,
        cohortDetails[i].cohortVersion,
        cohortDetails[i].startBlock,
        cohortDetails[i].endBlock,
        cohortDetails[i].epochBlocks,
        cohortDetails[i].hasLiquidityMining,
        cohortDetails[i].hasContainsWrappedToken,
        cohortDetails[i].hasCohortLockinAvaliable,
      ]),
    });
  }
  return calls;
};