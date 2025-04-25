# Authentication
[Authentication](#frontmatter-title)
------------------------------------

By default, whatsapp-web.js does not save session information. This means that you would have to scan the QR-Code to reauthenticate every time you restart the client. If you'd like to persist the session, you can pass an `authStrategy` as a client option. The library provides a few authentication strategies to choose from, but you can also choose to extend them or build your own.

WARNING

To ensure proper functioning of Puppeteer on **no-gui systems**, include the `no-sandbox flag` into the launch command within the configuration. Additionally, if your program runs with root privileges, remember to include the `--disable-setuid-sandbox` flag, as Chromium doesn't support running as root without a sandbox by default due to security reasons:

```
const client = new Client({
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

```


TIP

For most usage cases, we would recommend the [`LocalAuth` strategy](#localauth-strategy) because it is the easiest to use. However, you can also use the [RemoteAuth strategy](#remoteauth-strategy) for more flexibility and customization.

[`NoAuth` Strategy](#noauth-strategy)
-------------------------------------

This is the default `authStrategy` used when you don't provide one. It does not provide any means of saving and restoring sessions. You can set this if you'd like to be explicit about getting a fresh session every time the client is restarted.

```
const { Client, NoAuth } = require('whatsapp-web.js');

const client = new Client();

// equivalent to:
const client = new Client({
    authStrategy: new NoAuth()
});

```


[`LocalAuth` Strategy](#localauth-strategy)
-------------------------------------------

WARNING

`LocalAuth` requires a persistent filesystem to be able to restore sessions. This means that out of the box it is not compatible with hosts that provide ephemeral file systems, such as Heroku.

This strategy enables session-restore functionality by passing a persistent [user data directory](https://chromium.googlesource.com/chromium/src/+/master/docs/user_data_dir.md) to the browser. This means that other data, such as message history when using a multidevice-enabled account, will also be persisted and restored.

```
const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
    authStrategy: new LocalAuth()
});

```


### [Location Path](#location-path)

By default, the relevant session files are stored under a `.wwebjs_auth` directory. However, you can change this by specifying the `dataPath` option when instantiating `LocalAuth` Strategy:

```
const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: 'yourFolderName'
    })
});

```


This will create a `yourFolderName` folder with a stored session.

### [Multiple Sessions](#multiple-sessions)

If you're interested in using multiple clients belonging to different sessions, you can pass a `clientId` to segregate them from each other. This is useful when you want to run multiple clients at the same time.

```
const { Client, LocalAuth } = require('whatsapp-web.js');

const client1 = new Client({
    authStrategy: new LocalAuth({
    clientId: "client-one" })
});

const client2 = new Client({
    authStrategy: new LocalAuth({
    clientId: "client-two" })
});

```


[`RemoteAuth` Strategy](#remoteauth-strategy)
---------------------------------------------

The [RemoteAuth strategy](#remoteauth-strategy) allows you to save the WhatsApp Multi-Device session in a remote database. Instead of relying on a persistent file system, RemoteAuth can efficiently save, extract, and restore sessions. It also generates periodic backups to ensure that the saved session is always in sync and avoids data loss.

```
const { Client, RemoteAuth } = require('whatsapp-web.js');

const store = new MongoStore({ mongoose: mongoose });
const client = new Client({
    authStrategy: new RemoteAuth({
        store: store,
        backupSyncIntervalMs: 300000
    })
});

```


### [Remote Stores](#remote-stores)

Stores are external-independent database plugins that enable storing the session into different databases. To work with RemoteAuth, new stores must implement the following interface.

```
await store.sessionExists({session: 'yourSessionName'});

```


```
await store.save({session: 'yourSessionName'});

```


```
await store.extract({session: 'yourSessionName'});

```


```
await store.delete({session: 'yourSessionName'});

```


You can either implement your own store or use already implemented ones.

#### [MongoDB Store](#mongodb-store)

Before you can use this Auth strategy you need to install the [`wwebjs-mongo`](https://github.com/jtouris/wwebjs-mongo) module in your terminal:

Once the package is installed, you have to import it and pass it to the `RemoteAuth` strategy as follows:

```
const { Client, RemoteAuth } = require('whatsapp-web.js');

// Require database
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');

// Load the session data
mongoose.connect(process.env.MONGODB_URI).then(() => {
    const store = new MongoStore({ mongoose: mongoose });
    const client = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 300000
        })
    });

    client.initialize();
});

```


#### [AWS S3 Store](#aws-s3-store)

Before you can use this Auth strategy you need to install the [`wwebjs-aws-s3`](https://github.com/arbisyarifudin/wwebjs-aws-s3) module in your terminal:

```
npm install wwebjs-aws-s3

```


Once the package is installed, you have to import it and pass it to the `RemoteAuth`strategy as follows:

```
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { AwsS3Store } = require('wwebjs-aws-s3');
const {
    S3Client,
    PutObjectCommand,
    HeadObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand
} = require('@aws-sdk/client-s3');

const s3 = new S3Client({
    region: 'AWS_REGION',
    credentials: {
        accessKeyId: 'AWS_ACCESS_KEY_ID',
        secretAccessKey: 'AWS_SECRET_ACCESS_KEY'
    }
});

const putObjectCommand = PutObjectCommand;
const headObjectCommand = HeadObjectCommand;
const getObjectCommand = GetObjectCommand;
const deleteObjectCommand = DeleteObjectCommand;

const store = new AwsS3Store({
    bucketName: 'example-bucket',
    remoteDataPath: 'example/path/',
    s3Client: s3,
    putObjectCommand,
    headObjectCommand,
    getObjectCommand,
    deleteObjectCommand
});

const client = new Client({
    authStrategy: new RemoteAuth({
        clientId: 'yourSessionName',
        dataPath: 'yourFolderName',
        store: store,
        backupSyncIntervalMs: 600000
    })
});

```


### [Session Saved](#session-saved)

After the initial QR scan to link the device, RemoteAuth takes about `1 minute` to successfully save the WhatsApp session into the remote database, therefore the ready event does not mean the session has been saved yet. In order to listen to this event, you can now use the following:

```
client.on('remote_session_saved', () => {
    // Do Stuff...
});

```


### [Platform Compatibility](#platform-compatibility)


|Status|OS                              |
|------|--------------------------------|
|✅     |MacOS                           |
|✅     |Windows                         |
|✅     |Ubuntu 20.04 (Heroku Compatible)|
