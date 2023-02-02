mojito-contracts

### General

`npx hardhat compile` - compile and generate ABIs

`npx hardhat node` - restart nodes and reset account nonce (if a Tx get stuck)

`npx hardhat test test/your_test_file.ts` - run test

`npx hardhat verify --network rinkeby DEPLOYED_CONTRACT_ADDRESS "Constructor argument 1"` - verify source code on Etherscan

### Manifold deployment

1. Deploy Implementation contract `npx hardhat run --network rinkeby scripts/genart/manifold/deploy_creator_implementation.ts`

2. Initialize Implementation `npx hardhat run --network rinkeby scripts/genart/manifold/initialize_implementation.ts`. Change constructor arguments if you want.

3. Deploy Main contract (Manifold Creator) - `npx hardhat run --network rinkeby scripts/genart/manifold/deploy_main.ts`. Change `CREATOR_IMPLEMENTATION_ADDR` constant to the one from step #1, also `_name` and `_symbol` arguments can be modified.

4. Deploy Extension contract - `npx hardhat run --network rinkeby scripts/genart/manifold/deploy_extension.ts`. Change `CREATOR_ADDR` constant to the one from step #3.

5. Register extension, two options

- option A: Register Extension contract - `npx hardhat run --network rinkeby scripts/genart/manifold/register_extension.ts`. Change `CREATOR_ADDR` and `EXTENSION_ADDR` constants to the one from step #3 and #4.

- option B: Verify the contract on Etherscan and register the contract from the Etherscan UI. To verify contract: `npx hardhat verify --contract contracts/mojito/manifold/Main.sol:Main $contractAddress $constructorArg1 $constructorArg2 $constructorArg3 --network rinkeby --show-stack-traces`.

6. Mint from Extension contract. `npx hardhat run --network rinkeby scripts/genart/manifold/mint.ts`. Change `EXTENSION_ADDR` to the one from #4. Contract need to get unpaused before minting can happen.
