A fun project for creating a chatbot :
- Built using LangchainJs framework
- Used nodejs as a backend and React as frontend
- Database: Pinecone

Working of chatbot:
- First we feed custom data to chatbot for training
- Then convert the data to emedding form.
- Embedded data is stored in vector database (Pinecone)
- So now whenever user ask any query, the query is searched in vector database and relevant information is fetched from database.
- Then the information is passed through LLM(in our case we are using gpt-3.5 turbo)
- And now LLM modifies the answer which we can send back to user

Thanks
