const {
  ChatOpenAI,
  OpenAIEmbeddings,
} = require("@langchain/openai");
const { LLMChain } = require("langchain/chains");
const { BufferWindowMemory, BufferMemory} = require("langchain/memory");
const {
  formatDocumentsAsString,
} = require("langchain/util/document");
const { PromptTemplate } = require("@langchain/core/prompts");
const { RunnableSequence } = require("@langchain/core/runnables");
const { Chroma } = require("@langchain/community/vectorstores/chroma");
const { RedisChatMessageHistory } = require("@langchain/community/stores/message/ioredis");
const moment = require('moment');
const { Pinecone } = require("@pinecone-database/pinecone");
const { PineconeStore } = require("langchain/vectorstores/pinecone");

// const memory = new BufferWindowMemory({
//   memoryKey: "chatHistory",
//   inputKey: "question",
//   outputKey: "text",
//   returnMessages: true,
//   k: 3,
// });
console.log('inside getanswer file');
async function getAnswer(req, res) {

  const { question } = req.body;
  try {
    console.log(moment().format('YYMMDDHHmm'));
    const memory = new BufferMemory({
      chatHistory: new RedisChatMessageHistory({
        sessionId: moment().format('YYMMDDHHmm'), // Or some other unique identifier for the conversation
        sessionTTL: 300, // 5 minutes, omit this parameter to make sessions never expire
        url: "redis://localhost:6379", // Default value, override with your own instance's URL
      }),
    });
    console.log('inside getanswer api');
  const pinecone = new Pinecone();
  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX);
      console.log("checking");
  const vectorStore = await PineconeStore.fromExistingIndex(
    new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY }),
    { pineconeIndex }
  );

  const retriever = vectorStore.asRetriever();
  const serializeChatHistory = (chatHistory) =>
    chatHistory
      .map((chatMessage) => {
        if (chatMessage._getType() === "human") {
          return `Human: ${chatMessage.content}`;
        } else if (chatMessage._getType() === "ai") {
          return `Assistant: ${chatMessage.content}`;
        } else {
          return `${chatMessage.content}`;
        }
      })
  .join("\n");

  const questionPrompt = PromptTemplate.fromTemplate(
    `Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.
    ----------
    CONTEXT: {context}
    ----------
    CHAT HISTORY: {chatHistory}
    ----------
    QUESTION: {question}
    ----------
    Helpful Answer:`
  );

  const questionGeneratorTemplate = PromptTemplate.fromTemplate(
    `Given the following conversation and a follow-up question,if you are sure the question is not complete rephrase the follow-up question to be a standalone question.
    ----------
    CHAT HISTORY: {chatHistory}
    ----------
    FOLLOWUP QUESTION: {question}
    ----------
    Standalone question:`
  );

  const model = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    temperature: 0.7,
    modelName: "gpt-3.5-turbo",
  });

  const questionGeneratorChain = new LLMChain({
    llm: model,
    prompt: questionGeneratorTemplate,
  });

  const answerGeneratorChain = new LLMChain({
    llm: model,
    prompt: questionPrompt,
  });

  const performQuestionAnswering = async (input) => {
    let newQuestion = input.question;
    // Serialize context and chat history into strings
    const serializedDocs = formatDocumentsAsString(input.context);
    const chatHistoryString = input.chatHistory
      ? input.chatHistory
      : null;
    if (chatHistoryString) {
      // Call the faster chain to generate a new question
      const { text } = await questionGeneratorChain.invoke({
        chatHistory: chatHistoryString,
        context: serializedDocs,
        question: input.question,
      });

      newQuestion = text;
    }
    const response = await answerGeneratorChain.invoke({
      chatHistory: chatHistoryString ?? "",
      context: serializedDocs,
      question: newQuestion,
    });
    // Save the chat history to memory
    await memory.saveContext(
      {
        question: input.question,
      },
      {
        text: response.text,
      }
    );
    return {
      result: response.text,
      sourceDocuments: input.context,
    };
  };

  const chain = RunnableSequence.from([
    {
      // Pipe the question through unchanged
      question: (input) => input.question,
      // Fetch the chat history, and return the history or null if not present
      chatHistory: async () => {
        // const context = await memory.getContext({
        //   sessionId: "12345"
        // });
        console.log("checki");
        console.log(memory);          
        const savedMemory = await memory.loadMemoryVariables();
        console.log(savedMemory);
        // const hasHistory = savedMemory.chatHistory.length > 0;
        // return hasHistory ? savedMemory.chatHistory : null;
        return savedMemory;
      },
      // Fetch relevant context based on the question
      context: async (input) =>
        retriever.getRelevantDocuments(input.question),
    },
    performQuestionAnswering,
  ]);
  const resultOne = await chain.invoke({
    question: question,
  });
  return res.status(200).json({
    answer: resultOne.result,
  });
} catch (error) {
  console.log(error);
    return res.status(500).send({
      message: "Something went wrong",
      error,
    });
  }
}
module.exports = getAnswer;