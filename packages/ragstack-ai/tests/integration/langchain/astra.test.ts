import {getVectorStoreHandler, testIf} from '../config';
import {AstraDBVectorStore, AstraLibArgs} from "@langchain/community/vectorstores/astradb";
import {FakeEmbeddings} from "@langchain/core/utils/testing";
import {Document} from "@langchain/core/documents";
import {VectorDatabaseTypeNotSupported} from "../vectorStore";
import {CreateCollectionOptions} from "@datastax/astra-db-ts";

describe("Astra tests", () => {
    let supported: boolean = true
    try {
        getVectorStoreHandler().getBaseAstraLibArgs()
    } catch (e: unknown) {
        if (e instanceof VectorDatabaseTypeNotSupported) {
            supported = false
        } else {
            throw e
        }
    }
    const ifSupported = () => supported

    beforeEach(async () => {
        await getVectorStoreHandler().beforeTest()
    })
    afterEach(async () => {
        await getVectorStoreHandler().afterTest()
    })

    const fakeEmbeddingsCollectionOptions: CreateCollectionOptions<any> = {
        vector: {
            dimension: 4,
            metric: "cosine",
        },
    };
    testIf(ifSupported)('basic vector search', async () => {
        let config = getVectorStoreHandler().getBaseAstraLibArgs()
        const fakeEmbeddings = new FakeEmbeddings();
        config = {
            ...config,
            collectionOptions: fakeEmbeddingsCollectionOptions,
        }

        const vectorStore = await AstraDBVectorStore.fromTexts(
            [
                "AstraDB is a NoSQL DB",
                "AstraDB is built on Apache Cassandra",
                "AstraDB supports vector search",
            ],
            [{foo: "foo"}, {foo: "bar"}, {foo: "baz"}],
            fakeEmbeddings,
            config as AstraLibArgs
        );
        const results = await vectorStore.similaritySearch("Cassandra", 1);
        console.log(results)
        expect(results.length).toBe(1);

    });

    testIf(ifSupported)('ingest errors', async () => {
        let config = getVectorStoreHandler().getBaseAstraLibArgs()
        const fakeEmbeddings = new FakeEmbeddings();
        config = {
            ...config,
            collectionOptions: fakeEmbeddingsCollectionOptions,
        }
        const vectorStore = new AstraDBVectorStore(fakeEmbeddings, config)
        await vectorStore.initialize()
        try {
            await vectorStore.addVectors([[0, 0, 0, 0]], [{
                pageContent: "",
                metadata: {}
            }
            ])
            fail("Should have thrown an error")
        } catch (e: unknown) {
            expect((e as Error).message).toContain("Zero vectors cannot be indexed or queried with cosine similarity")
        }


    });

    testIf(ifSupported)('long texts', async () => {
        let config = getVectorStoreHandler().getBaseAstraLibArgs()
        const fakeEmbeddings = new FakeEmbeddings();
        config = {
            ...config,
            collectionOptions: fakeEmbeddingsCollectionOptions,
        }
        const vectorStore = new AstraDBVectorStore(fakeEmbeddings, config)
        await vectorStore.initialize()
        let veryLongText = "Really long text".repeat(500)
        await vectorStore.addDocuments([{pageContent: veryLongText, metadata: {}}])
        try {
            veryLongText = "Really long text".repeat(1000)
            await vectorStore.addDocuments([{pageContent: veryLongText, metadata: {}}])
            fail("Should have thrown an error")
        } catch (e: unknown) {
            expect((e as Error).message).toContain("Document size limitation violated")
        }


    });


    testIf(ifSupported)('wrong connection parameters', async () => {
        const fakeEmbeddings = new FakeEmbeddings();
        let config = {
            ...getVectorStoreHandler().getBaseAstraLibArgs(),
            token: "invalid",
            endpoint: "https://locahost:1234",
            collectionOptions: fakeEmbeddingsCollectionOptions,
        }
        let vectorStore = new AstraDBVectorStore(fakeEmbeddings, config)
        try {
            await vectorStore.initialize()
            fail("Should have thrown an error")
        } catch (e: unknown) {
            expect((e as Error).message).toContain("getaddrinfo")
        }

        // endpoint valid, token is not
        config = {
            ...getVectorStoreHandler().getBaseAstraLibArgs(),
            token: "invalid",
            collectionOptions: fakeEmbeddingsCollectionOptions,
        }

        vectorStore = new AstraDBVectorStore(fakeEmbeddings, config)
        try {
            await vectorStore.initialize()
            fail("Should have thrown an error")
        } catch (e: unknown) {
            expect((e as Error).message).toContain("401")
        }
    });


    testIf(ifSupported)('basic metadata filtering no vector', async () => {
        const fakeEmbeddings = new FakeEmbeddings();
        const config = {
            ...getVectorStoreHandler().getBaseAstraLibArgs(),
            collectionOptions: fakeEmbeddingsCollectionOptions,
        }
        const vectorStore = new AstraDBVectorStore(fakeEmbeddings, config)
        await vectorStore.initialize()
        const document: Document = {
            pageContent: "RAGStack is very good",
            metadata: {
                "id": "http://mywebsite",
                "language": "en",
                "source": "website",
                "name": "Homepage",
            }
        };
        await vectorStore.addDocuments([document]);
        function assertDoc(result: Document) {
            expect(result.metadata._id).not.toBeNull()
            expect(result.metadata.$vector).not.toBeNull()
            for (const key in document.metadata) {
                expect(result.metadata[key]).toBe(document.metadata[key])
            }
        }
        let docs = await vectorStore.similaritySearch("RAGStack", 1, {metadata: {}})

        expect(docs.length).toBe(1)
        assertDoc(docs[0])

        docs = await vectorStore.similaritySearch("RAGStack", 1, {"name": "Homepage"})
        expect(docs.length).toBe(1)
        assertDoc(docs[0])

        docs = await vectorStore.similaritySearch("RAGStack", 1, {"name": "another"})
        expect(docs.length).toBe(0)

        docs = await vectorStore.similaritySearch("RAGStack", 1, {"$and": [{"language": "en"}, {"source": "website"}]})
        expect(docs.length).toBe(1)
        assertDoc(docs[0])

        try {
            await vectorStore.similaritySearch("RAGStack", 1, {"$vector": [0.1]})
            fail("Should have thrown an error")
        } catch (e: unknown) {
            expect((e as Error).message).toContain("INVALID_FILTER_EXPRESSION")
        }

        docs = await vectorStore.maxMarginalRelevanceSearch("RAGStack", {k: 1, filter: {"name": "Homepage"}})
        expect(docs.length).toBe(1)
        assertDoc(docs[0])

        docs = await vectorStore.maxMarginalRelevanceSearch("RAGStack", {k: 1, filter: {"name": "another"}})
        expect(docs.length).toBe(0)

        const retriever = vectorStore.asRetriever();
        docs = await retriever.getRelevantDocuments("RAGStack")
        expect(docs.length).toBe(1)
        assertDoc(docs[0])
    });


    testIf(ifSupported)("delete", async () => {
        const fakeEmbeddings = new FakeEmbeddings();
        const config = {
            ...getVectorStoreHandler().getBaseAstraLibArgs(),
            collectionOptions: fakeEmbeddingsCollectionOptions,
        }
        const store = await AstraDBVectorStore.fromTexts(
            [
                "AstraDB is built on Apache Cassandra",
                "AstraDB is a NoSQL DB",
                "AstraDB supports vector search",
            ],
            [{ id: 123 }, { id: 456 }, { id: 789 }],
            fakeEmbeddings,
            config
        );

        const results = await store.similaritySearch("Apache Cassandra", 3, {"id": 123});

        expect(results.length).toEqual(1);

        await store.delete({ ids: [results[0].metadata._id] });

        const results2 = await store.similaritySearch("Apache Cassandra", 3);

        expect(results2.length).toEqual(2);
        for (const result of results2) {
            expect(result.pageContent).not.toBe("AstraDB is built on Apache Cassandra");
            expect(result.metadata["id"]).not.toBe(123);
        }
    });

});
