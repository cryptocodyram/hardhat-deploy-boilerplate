import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract } from 'ethers';
import { addCohortDetails, setRewardTokenDetails } from '../../utilities';
import { addBoosterPackageDetailsThroughMulticall, addTokenMetaDataThroughMulticall } from '../../utilities/multicall';
import { BoosterPackageParams, Cohort, RewardTokens, Token } from '../../utilities/types';

interface Configuration {
  cohortId: string;
  cohortDetails: Cohort;
  tokenMetaData: Token[];
  boosterInfo: BoosterPackageParams[];
  rewardTokens: RewardTokens;
}

interface Arguments {
  registry: Contract;
  multicall: Contract;
  rewardRegistry: Contract;
  configuration: Configuration;
}

export const setupAllConfigurationForCohort = async (
  { registry, multicall, rewardRegistry, configuration }: Arguments,
  signer: SignerWithAddress
) => {
  if (registry && rewardRegistry) {
    await addCohortDetails(registry, configuration.cohortId, signer, configuration.cohortDetails);
    await addTokenMetaDataThroughMulticall(multicall, registry, configuration.cohortId, configuration.tokenMetaData, signer);
    await setRewardTokenDetails(rewardRegistry, signer, configuration.cohortId, configuration.rewardTokens);
    await addBoosterPackageDetailsThroughMulticall(multicall, signer, registry, configuration.boosterInfo);
  }
};
