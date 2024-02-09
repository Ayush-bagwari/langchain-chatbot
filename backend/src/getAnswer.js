const {
  ChatOpenAI,
  OpenAIEmbeddings,
} = require("@langchain/openai");
const { LLMChain } = require("langchain/chains");
const { BufferWindowMemory } = require("langchain/memory");
const {
  formatDocumentsAsString,
} = require("langchain/util/document");
const { PromptTemplate } = require("@langchain/core/prompts");
const { RunnableSequence } = require("@langchain/core/runnables");
const { Pinecone } = require("@pinecone-database/pinecone");
const { PineconeStore } = require("langchain/vectorstores/pinecone");

const memory = new BufferWindowMemory({
  memoryKey: "chatHistory",
  inputKey: "question",
  outputKey: "text",
  returnMessages: true,
  k: 3
});
console.log("checking1");
async function getAnswer(req, res) {
  console.log("checking2");

  const { question } = req.body;
  try {
  const pinecone = new Pinecone();
  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX);

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
    `Given the following conversation and a follow-up question, rephrase the follow-up question to be a standalone question.
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
      ? serializeChatHistory(input.chatHistory)
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
        const savedMemory = await memory.loadMemoryVariables({});
        const hasHistory = savedMemory.chatHistory.length > 0;
        return hasHistory ? savedMemory.chatHistory : null;
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