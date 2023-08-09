

### install
    
```bash
yarn
```

Install foundry: https://book.getfoundry.sh/getting-started/installation

### Start a local fork

```bash
anvil -f https://rpc.ankr.com/eth --accounts 3 --balance 300 --no-cors
```


### update the addressbook

```bash
yarn run ncu --upgrade blockchain-addressbook
yarn
```

### Run the tests

```bash
yarn test:unit
```

### prettify tho output log

```bash
cat test.log | yarn pino-pretty
```

### Run harvest and explore debug logs
    
```bash
LOG_LEVEL=trace yarn ts-node ./src/script/harvest.ts -c base | yarn pino-pretty > debug-pretty.log
```