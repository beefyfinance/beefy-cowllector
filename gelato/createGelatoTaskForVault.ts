// import { ethers, Wallet } from "ethers";
// import { keccak256 } from "@ethersproject/keccak256";

// import OPS_ABI from "./abis/Ops.json";

// // change this
// const vaultMap: Record<string, string> = {

// };

// const harvesterAddress = "0x5e7F411EE92838275c96438B6A1A93acCC16364C";
// const opsAddress = "0x6EDe1597c05A0ca77031cBA43Ab887ccf24cd7e8"

// const createTask = async (vault: string, gelatoTaskAdmin: Wallet) => {
//   console.log(`Submitting Task for vault: ${vault}`);

//   const ops = new ethers.Contract(opsAddress, OPS_ABI, gelatoTaskAdmin);

//   const performSelector = await ops.getSelector("performUpkeep(address,uint256,uint256,uint256,uint256,bool)");
//   const checkerSelector = (await ops.getSelector("checker(address)"));
//   const replaced0x = `000000000000000000000000${vault.toLowerCase().slice(2)}`
//   const resolverData = `${checkerSelector}${replaced0x}`

//   console.log("Create task data:");
//   console.log(`_execAddress: ${harvesterAddress}`);
//   console.log(`_execSelector: ${performSelector}`);
//   console.log(`_resolverAddress: ${harvesterAddress}`);
//   console.log(`_resolverData: ${resolverData}`);

//   const txn = await ops.createTask(
//     harvesterAddress,
//     performSelector,
//     harvesterAddress,
//     resolverData
//   );

//   const res = await txn.wait();
//   console.log(res);

//   console.log("Task Submitted");
// }

// const createTasks = async (vaultMap: Record<string, string>, gelatoTaskAdmin: Wallet) => {
//   for (const key in vaultMap) {
//       const vault = vaultMap[key];
//       console.log(`Creating task for ${key}`)
//       try {
//         await createTask(vault, gelatoTaskAdmin);
//       } catch (e) {
//         console.log(e);
//         console.log(`Failed for ${key}`)
//       }
//   }
// }

console.log("Helo")