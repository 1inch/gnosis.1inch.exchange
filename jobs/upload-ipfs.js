const IpfsHttpClient = require('ipfs-http-client');
const path = require("path");
const { globSource } = IpfsHttpClient;

const ipfs = IpfsHttpClient({
    host: 'ipfs.1inch.exchange',
    port: 443,
    protocol: 'https',
    headers: {
        authorization: process.env.IPFS_AUTHORIZATION
    }
});

const run = async () => {

    for await (const file of ipfs.add(globSource(path.resolve(__dirname, '../dist/gnosis-app'), { recursive: true, pin: true, timeout: 1000000 }))) {
        console.log(file)
    }

    process.exit(0);
};

run();
