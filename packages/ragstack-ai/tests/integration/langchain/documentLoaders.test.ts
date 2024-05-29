import {getRequiredEnv} from '../config';
import {Document} from "@langchain/core/documents";
import * as os from "os";
import * as fs from "fs";
import {CSVLoader} from "langchain/document_loaders/fs/csv";
import * as path from "node:path";
import {S3Loader} from "langchain/document_loaders/web/s3";
import {randomUUID} from "node:crypto";
import {
    CreateBucketCommand,
    DeleteBucketCommand,
    DeleteObjectCommand,
    PutObjectCommand,
    S3Client
} from "@aws-sdk/client-s3";
import {UnstructuredLoader} from "langchain/document_loaders/fs/unstructured";
import {RecursiveCharacterTextSplitter} from "langchain/text_splitter";
import {BlobServiceClient} from "@azure/storage-blob";
import {AzureBlobStorageContainerLoader} from "langchain/document_loaders/web/azure_blob_storage_container";

describe("Document loaders", () => {
    test("csv loader", async () => {
        const csv = `column1,column2,column3
value1,value2,value3
value4,value5,value6
value7,value8,value9`;


        const tempFile = path.join(os.tmpdir(), 'temp.csv');
        fs.writeFileSync(tempFile, csv);
        const blob = new Blob([fs.readFileSync(tempFile)])

        const loader = new CSVLoader(blob, "column2");
        const docs = await loader.load();
        console.log(docs);
        expect(docs).toHaveLength(3);
        expect(docs[0]).toBeInstanceOf(Document);
        expect(docs[0].pageContent).toBe('value2');
        expect(docs[1].pageContent).toBe('value5');
        expect(docs[2].pageContent).toBe('value8');
    });

    test("unstructured loader", async () => {
        const filePath = path.join(__dirname, '..', '..', 'resources', "tree.pdf");
        const loader = new UnstructuredLoader(filePath, {
            apiUrl: getRequiredEnv("UNSTRUCTURED_API_URL"),
            apiKey: getRequiredEnv("UNSTRUCTURED_API_KEY"),
            strategy: "auto"
        });
        const split = await loader.loadAndSplit(new RecursiveCharacterTextSplitter());
        expect(split.length).toBeGreaterThan(1)
        for (const doc of split) {
            expect(doc.metadata.filename).toBe("tree.pdf")
            expect(doc.metadata.filetype).toBe("application/pdf")
            expect(doc.metadata.category).toMatch(/(Title|NarrativeText|Image)/)
        }
    })


    test("s3 loader", async () => {
        const bucket = "ragstackts-ci-" + randomUUID()

        const s3client = new S3Client({region: "us-east-1"})
        try {
            await s3client.send(new CreateBucketCommand({Bucket: bucket}))
            await s3client.send(new PutObjectCommand({
                Bucket: bucket,
                Key: "data.txt",
                Body: "test data"

            }))

            const loader = new S3Loader(
                {
                    s3Config:
                        {region: "us-east-1"},
                    bucket: bucket,
                    key: "data.txt",
                    unstructuredAPIURL: getRequiredEnv("UNSTRUCTURED_API_URL"),
                    unstructuredAPIKey: getRequiredEnv("UNSTRUCTURED_API_KEY")
                });
            const docs = await loader.load()
            expect(docs).toHaveLength(1);
            expect(docs[0].pageContent).toBe("test data");
            expect(docs[0].metadata.filename).toBe("data.txt");
            expect(docs[0].metadata.filetype).toBe("text/plain");
            expect(docs[0].metadata.category).toBe("Title");

        } finally {
            try {
                await s3client.send(new DeleteObjectCommand({Key: "data.txt", Bucket: bucket}))
            } catch (e: unknown) {
                // eslint-disable-next-line
            }
            try {
                await s3client.send(new DeleteBucketCommand({Bucket: bucket}))
            } catch (e: unknown) {
                // eslint-disable-next-line
            }
        }
    });


    test("azure blob storage loader", async () => {
        const container = "ragstackts-ci-" + randomUUID()
        const connectionString = getRequiredEnv("AZURE_BLOB_STORAGE_CONNECTION_STRING");
        const client = BlobServiceClient.fromConnectionString(connectionString).getContainerClient(container)

        try {
            await client.create()
            await client.getBlockBlobClient("data.txt").upload("test data", 9)
            const loader = new AzureBlobStorageContainerLoader(
                {
                    azureConfig:
                        {
                            connectionString: connectionString,
                            container: container
                        },
                    unstructuredConfig: {
                        apiUrl: getRequiredEnv("UNSTRUCTURED_API_URL"),
                        apiKey: getRequiredEnv("UNSTRUCTURED_API_KEY"),
                    }
                });
            const docs = await loader.load()
            expect(docs).toHaveLength(1);
            expect(docs[0].pageContent).toBe("test data");
            expect(docs[0].metadata.filename).toBe("data.txt");
            expect(docs[0].metadata.filetype).toBe("text/plain");
            expect(docs[0].metadata.category).toBe("Title");

        } finally {
            await client.delete()
        }
    });


});
