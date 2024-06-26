import {AstraLibArgs} from "@langchain/community/vectorstores/astradb";
import {CassandraLibArgs} from "@langchain/community/vectorstores/cassandra";
import {getRequiredEnv} from "./config";
import {Client} from "cassandra-driver";
import {GenericContainer, StartedTestContainer, Wait} from "testcontainers";
import {DataAPIClient} from "@datastax/astra-db-ts";


export class VectorDatabaseTypeNotSupported extends Error {
    constructor(message: string) {
        super(message)
        Object.setPrototypeOf(this, VectorDatabaseTypeNotSupported.prototype);
    }
}

export interface VectorStoreHandler {

    beforeTest: () => Promise<void>;
    afterTest: () => Promise<void>;
    getBaseAstraLibArgs: () => AstraLibArgs;
    getBaseCassandraLibArgs: (dimensions: number) => CassandraLibArgs;

}


export class AstraDBVectorStoreHandler implements VectorStoreHandler {

    token: string;
    endpoint: string;
    databaseId: string;
    collectionName: string | undefined;
    bundleUrlTemplate: string | undefined;

    constructor() {
        this.token = getRequiredEnv("ASTRA_DB_APPLICATION_TOKEN")
        this.endpoint = getRequiredEnv("ASTRA_DB_API_ENDPOINT")
        this.databaseId = getRequiredEnv("ASTRA_DB_ID")
        const env = (process.env["ASTRA_DB_ENV"] || "prod").toLowerCase()
        this.bundleUrlTemplate = env !== "prod" ? "https://api.dev.cloud.datastax.com/v2/databases/{database_id}/secureBundleURL?all=true" : undefined

    }

    async afterTest(): Promise<void> {
        await this.deleteAllCollections();
    }

    async beforeTest(): Promise<void> {
        await this.deleteAllCollections();
        this.collectionName = "documents_" + Math.random().toString(36).substring(7)
    }


    private async deleteAllCollections() {
        const dataAPIClient = new DataAPIClient(this.token);
        try {
            const astraDbClient = dataAPIClient.db(this.endpoint)
            const collections = await astraDbClient.listCollections({nameOnly: true})
            console.log("Found collections: ", collections)
            for (const collection of collections) {
                console.log("Deleting collection: ", collection)
                await astraDbClient.dropCollection(collection)
            }
        } finally {
            await dataAPIClient.close()
        }
    }

    getBaseAstraLibArgs(): AstraLibArgs {
        return {
            token: this.token,
            endpoint: this.endpoint,
            collection: this.collectionName as string,
            maxRetries: 0
        }
    }


    getBaseCassandraLibArgs(dimensions: number): CassandraLibArgs {
        return {
            serviceProviderArgs: {
                astra: {
                    token: this.token,
                    endpoint: this.endpoint,
                    datacenterID: this.databaseId,
                    bundleUrlTemplate: this.bundleUrlTemplate
                },
            },
            keyspace: "default_keyspace",
            table: this.collectionName as string,
            dimensions: dimensions,
            primaryKey: [{name: "id", type: "uuid", partition: true}]
        }
    }
}

class CassandraContainer extends GenericContainer {
    private mappedPort: number | undefined;

    constructor() {
        super("docker.io/stargateio/dse-next:4.0.11-b259738f492f")
        this.withExposedPorts(9042)
            .withWaitStrategy(Wait.forLogMessage(/.*Startup complete.*/, 1))
            .withStartupTimeout(300_000);
    }


    public override async start(): Promise<StartedTestContainer> {
        const started = await super.start()
        this.mappedPort = started.getMappedPort(9042)
        return started
    }


    public getPort(): number {
        if (!this.mappedPort) {
            throw new Error("Container not started yet")
        }
        return this.mappedPort
    }

}

export class LocalCassandraVectorStoreHandler implements VectorStoreHandler {

    collectionName: string | undefined;
    client: Client | undefined;
    container: CassandraContainer | undefined;
    cassandraPort: number = 9042;

    async afterTest(): Promise<void> {
        if (this.client) {
            await this.client.shutdown()
            this.client = undefined
        }
    }

    async beforeTest(): Promise<void> {
        this.collectionName = "documents_" + Math.random().toString(36).substring(7)

        const shouldStartContainer = process.env["CASSANDRA_START_CONTAINER"] || "true"

        if (!this.container && shouldStartContainer === "true") {
            this.container = new CassandraContainer()
            console.log("Starting Cassandra container")
            await this.container.start()
            console.log("Cassandra container started at port", this.container.getPort())
            this.cassandraPort = this.container.getPort()
        }

        if (!this.client) {
            const connectionArgs = this.getConnectionArgs(this.cassandraPort);
            const client = new Client(connectionArgs)
            await client.connect()
            await client.execute("CREATE KEYSPACE IF NOT EXISTS default_keyspace WITH replication = {'class': 'SimpleStrategy', 'replication_factor': '1'}")
            this.client = client
        }
    }

    private getConnectionArgs(port: number) {
        return {
            contactPoints: ["127.0.0.1:" + port],
            localDataCenter: 'datacenter1',
            credentials: {
                username: "cassandra",
                password: "cassandra"
            }
        }
    }

    getBaseAstraLibArgs(): AstraLibArgs {
        throw new VectorDatabaseTypeNotSupported("AstraDB not supported by LocalCassandraVectorStoreHandler.");
    }


    getBaseCassandraLibArgs(dimensions: number): CassandraLibArgs {
        return {
            ...this.getConnectionArgs(this.cassandraPort),
            keyspace: "default_keyspace",
            table: this.collectionName as string,
            dimensions: dimensions,
            primaryKey: [{name: "id", type: "uuid", partition: true}]
        };
    }
}
