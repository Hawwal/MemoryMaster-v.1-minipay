import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const USDT_CELO_MAINNET = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e";
  const ENTRY_FEE = "100000";

  const provider = new ethers.JsonRpcProvider("https://forno.celo.org");
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

  console.log("Deploying with account:", wallet.address);

  const artifactPath = join(__dirname, "../artifacts/contracts/MemoryMasterEntry.sol/MemoryMasterEntry.json");
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(USDT_CELO_MAINNET, ENTRY_FEE);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("Deployed to:", address);
  console.log("Verify with: npx hardhat verify --network celo " + address + " " + USDT_CELO_MAINNET + " " + ENTRY_FEE);
  console.log("Add to .env: VITE_CONTRACT_ADDRESS=" + address);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});