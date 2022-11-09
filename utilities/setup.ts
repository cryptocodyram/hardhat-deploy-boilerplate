import { waffle, upgrades, ethers } from "hardhat";
import { aggregate, ICall } from "@makerdao/multicall";

export const multicall = async (target: string, calls: string[]): ICall => {
  return {
    target,
    calls,
    returns: [],
  };
};

export const setupAllCohortConfiguration = () => {};
