const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { DirectoryLoader } = require("langchain/document_loaders/fs/directory");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const { Pinecone } = require("@pinecone-database/pinecone");
const { PineconeStore } = require("langchain/vectorstores/pinecone");

const fs = require("fs");

async function trainBot(req, res) {
  try {
    const loader = new DirectoryLoader(
        "data_record",
        {
          ".txt": (path) => new TextLoader(path),
        }
      );
    const docs = await loader.load();

    const pinecone = new Pinecone();
    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX);

    const pinestore = await PineconeStore.fromDocuments(docs, new OpenAIEmbeddings(), {
      pineconeIndex,
      maxConcurrency: 5, // Maximum number of batch requests to allow at once. Each batch is 1000 vectors.
    });
    console.log("success");
    return res.status(200).json({
      message: pinestore,
    });    
    
  } catch (error) {
    // Handle any errors that may occur
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = trainBot;